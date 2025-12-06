#!/usr/bin/env node
/**
 * CLI test suite for V1 to V2 conversion similarity validation
 * Reuses API calls and conversions from validate-conversions.js to verify styling preservation
 */

import dotenv from "dotenv";
dotenv.config();

import { fetchAndConvertStyles } from "./validate-conversions.js";
import {
  getV2Id,
  getV2PropertyPath,
  getV2Visibility,
  getAllV2Ids,
} from "../src/core/mapping.js";
import {
  hexToHsl,
  normalizeHex,
  applyHslAdjustments,
} from "../src/utils/color-utils.js";
import {
  supportsGeometry,
  supportsLabel,
  isValidGeometryProperty,
  isValidLabelProperty,
} from "../src/core/feature-properties.js";
import { ICON_SHIELD_PATTERNS } from "../src/core/constants.js";
import { isIconShieldFeature } from "../src/core/feature-id-utils.js";
import { detectVariant } from "../src/core/variant-detection.js";

const WEIGHT_TOLERANCE = 0.5;
const COLOR_TOLERANCE = 5;

// Helper functions
const normalizeArray = (value) => (Array.isArray(value) ? value : [value]);

const normalizePropertyPaths = (propertyPathResult) =>
  normalizeArray(propertyPathResult);

const mergeStylers = (stylers) => Object.assign({}, ...stylers);

/**
 * Extracts styling properties from V1 JSON organized by featureType/elementType
 * @param {Array} v1Json - V1 style JSON array
 * @returns {Object} Extracted styling organized by featureType/elementType, with rule indices
 */
const extractV1Styling = (v1Json) => {
  const styling = {};

  if (!Array.isArray(v1Json)) {
    return styling;
  }

  v1Json.forEach((rule, i) => {
    const { featureType, elementType, stylers } = rule;

    if (!Array.isArray(stylers)) return;

    const featureKey = featureType ?? "all";
    const elementKey = elementType ?? "all";
    const key = `${featureKey}::${elementKey}`;

    if (!styling[key]) {
      styling[key] = {
        featureType: featureKey,
        elementType: elementKey,
        rules: [],
      };
    }

    const mergedStyler = mergeStylers(stylers);

    styling[key].rules.push({
      color: mergedStyler.color ? normalizeHex(mergedStyler.color) : null,
      visibility: mergedStyler.visibility,
      weight: mergedStyler.weight,
      saturation: mergedStyler.saturation,
      lightness: mergedStyler.lightness,
      ruleIndex: i,
    });
  });

  return styling;
};

/**
 * Extracts styling properties from V2 JSON organized by feature ID
 * @param {Object} v2Json - V2 style JSON object
 * @returns {Object} Extracted styling organized by feature ID
 */
const extractV2Styling = (v2Json) => {
  const styling = {};

  if (!v2Json?.styles || !Array.isArray(v2Json.styles)) {
    return styling;
  }

  for (const style of v2Json.styles) {
    const { id, geometry, label } = style;

    if (!id) continue;

    if (!styling[id]) {
      styling[id] = {
        featureId: id,
        geometry: {},
        label: {},
      };
    }

    if (geometry) {
      const geometryProps = [
        "fillColor",
        "strokeColor",
        "color",
        "visible",
        "strokeWeight",
      ];

      for (const prop of geometryProps) {
        if (geometry[prop] !== undefined) {
          styling[id].geometry[prop] =
            prop.includes("Color") || prop === "color"
              ? normalizeHex(geometry[prop])
              : geometry[prop];
        }
      }
    }

    if (label) {
      const labelProps = [
        "textFillColor",
        "textStrokeColor",
        "pinFillColor",
        "visible",
      ];

      for (const prop of labelProps) {
        if (label[prop] !== undefined) {
          styling[id].label[prop] = prop.includes("Color")
            ? normalizeHex(label[prop])
            : label[prop];
        }
      }
    }
  }

  return styling;
};

/**
 * Compares colors allowing for small differences due to HSL adjustments
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @param {number} tolerance - Tolerance in HSL space (default: 5)
 * @returns {boolean} True if colors are similar
 */
const colorsSimilar = (color1, color2, tolerance = COLOR_TOLERANCE) => {
  if (!color1 || !color2) return false;

  try {
    const hsl1 = hexToHsl(normalizeHex(color1));
    const hsl2 = hexToHsl(normalizeHex(color2));

    const hDiff = Math.min(
      Math.abs(hsl1.h - hsl2.h),
      360 - Math.abs(hsl1.h - hsl2.h)
    );
    const sDiff = Math.abs(hsl1.s - hsl2.s);
    const lDiff = Math.abs(hsl1.l - hsl2.l);

    return hDiff <= tolerance && sDiff <= tolerance && lDiff <= tolerance;
  } catch {
    return color1 === color2;
  }
};

/**
 * Checks if a more specific child feature type has a rule that would override a parent rule
 * @param {string} parentFeatureType - Parent V1 feature type (e.g., "road")
 * @param {string} elementType - Element type (e.g., "geometry", "geometry.fill")
 * @param {string} v2Id - V2 feature ID to check
 * @param {string} propertyPath - V2 property path (e.g., "geometry.fillColor")
 * @param {Map} v1FeatureMap - Map of all V1 feature types and their rules
 * @returns {boolean} True if a more specific rule exists for the same property
 */
const hasMoreSpecificRule = (
  parentFeatureType,
  elementType,
  v2Id,
  propertyPath,
  v1FeatureMap
) => {
  // If no specific featureType (undefined or "all"), check all specific feature types
  if (!parentFeatureType || parentFeatureType === "all") {
    return false;
  }
  const parentPrefix = `${parentFeatureType}.`;

  for (const [childFeatureType, childData] of v1FeatureMap.entries()) {
    if (
      childFeatureType === parentFeatureType ||
      !childFeatureType.startsWith(parentPrefix)
    ) {
      continue;
    }

    const childV2Ids = childData.v2Ids;
    if (!childV2Ids) continue;

    const childV2IdArray = normalizeArray(childV2Ids);
    if (!childV2IdArray.includes(v2Id)) continue;

    for (const childElement of childData.elements) {
      const childPropertyPathResult = getV2PropertyPath(
        childElement.elementType,
        v2Id
      );
      if (!childPropertyPathResult) continue;

      const childPropertyPaths = normalizePropertyPaths(
        childPropertyPathResult
      );

      if (childPropertyPaths.includes(propertyPath)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Checks if a v2Id is in the expanded target IDs for a featureType
 * This matches the converter's expandTargetIds logic
 * @param {string} featureType - V1 feature type
 * @param {string} v2Id - V2 feature ID to check
 * @returns {boolean} True if v2Id is in the expanded target IDs
 */
const isV2IdInExpandedTargets = (featureType, v2Id) => {
  // Treat undefined, null, or "all" as applying to all features
  if (!featureType || featureType === "all") {
    const allIds = getAllV2Ids();
    return allIds.includes(v2Id);
  }

  const mappedId = getV2Id(featureType);
  if (!mappedId) return false;

  const ids = normalizeArray(mappedId);
  const allFeatureIds = getAllV2Ids();

  for (const id of ids) {
    // Direct match
    if (id === v2Id) return true;

    // Check if v2Id is a child of id
    if (v2Id.startsWith(`${id}.`)) return true;

    // Check if id is a parent and v2Id is in its children
    const isParent = allFeatureIds.some((fid) => fid.startsWith(`${id}.`));
    if (isParent) {
      // Check if v2Id is a child
      if (v2Id.startsWith(`${id}.`)) return true;
    }
  }

  return false;
};

/**
 * Checks if an earlier rule has already set visibility for the same v2Id and elementType
 * This simulates the converter's visibilitySourceMap behavior
 * @param {string} featureType - Current feature type
 * @param {string} elementType - Element type
 * @param {string} v2Id - V2 feature ID to check
 * @param {number} ruleIndex - Index of the current rule in V1 JSON
 * @param {Array} v1Json - Original V1 JSON array
 * @returns {boolean} True if an earlier rule has already set visibility
 */
const hasEarlierVisibilitySet = (
  featureType,
  elementType,
  v2Id,
  ruleIndex,
  v1Json
) => {
  const keyElementType = elementType || "all";

  // Check all rules before the current one
  for (let i = 0; i < ruleIndex; i++) {
    const earlierRule = v1Json[i];
    const {
      featureType: earlierFeatureType,
      elementType: earlierElementType,
      stylers,
    } = earlierRule;

    if (!Array.isArray(stylers)) continue;

    // Check if this earlier rule would apply to the same v2Id (using expanded target IDs)
    if (!isV2IdInExpandedTargets(earlierFeatureType, v2Id)) continue;

    // Check if this earlier rule has visibility
    const mergedStyler = mergeStylers(stylers);
    if (mergedStyler.visibility === undefined) continue;

    const earlierKeyElementType = earlierElementType || "all";

    // Check if the elementType matches (same key would be used in visibilitySourceMap)
    if (earlierKeyElementType === keyElementType) {
      // Same elementType - earlier rule would have set visibility
      return true;
    }

    // Check if earlier rule elementType is more general and would apply
    if (
      earlierKeyElementType === "all" ||
      keyElementType === "all" ||
      keyElementType.startsWith(`${earlierKeyElementType}.`)
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if an earlier more specific rule would have prevented a rule from applying
 * This matches the converter's hasMoreSpecificVisibility logic
 * For "all" featureType, no V1 feature type is a child, so we only check if any earlier rule set visibility
 * For other featureTypes, checks if a child V1 feature type has set visibility
 * @param {string} featureType - Current feature type
 * @param {string} elementType - Element type
 * @param {string} v2Id - V2 feature ID to check
 * @param {number} ruleIndex - Index of the current rule in V1 JSON
 * @param {Array} v1Json - Original V1 JSON array
 * @returns {boolean} True if an earlier more specific rule would have set visibility
 */
const hasEarlierMoreSpecificVisibility = (
  featureType,
  elementType,
  v2Id,
  ruleIndex,
  v1Json
) => {
  if (!featureType || featureType === "all") {
    // For "all", check if ANY earlier rule has already set visibility for this v2Id+elementType
    // This simulates the visibilitySourceMap behavior
    return hasEarlierVisibilitySet(
      featureType,
      elementType,
      v2Id,
      ruleIndex,
      v1Json
    );
  }

  // For non-"all" feature types, check if a child V1 feature type has set visibility
  const parentPrefix = `${featureType}.`;

  // Check all rules before the current one
  for (let i = 0; i < ruleIndex; i++) {
    const earlierRule = v1Json[i];
    const {
      featureType: earlierFeatureType,
      elementType: earlierElementType,
      stylers,
    } = earlierRule;

    if (!Array.isArray(stylers)) continue;

    // Skip if not a child feature type (must start with parentPrefix)
    if (!earlierFeatureType || !earlierFeatureType.startsWith(parentPrefix)) {
      continue;
    }

    // Check if this earlier rule would apply to the same v2Id (using expanded target IDs)
    if (!isV2IdInExpandedTargets(earlierFeatureType, v2Id)) continue;

    // Check if this earlier rule has visibility
    const mergedStyler = mergeStylers(stylers);
    if (mergedStyler.visibility === undefined) continue;

    // Extract the elementType from the earlier rule
    const sourceElementType = earlierElementType || "all";

    // If parent rule has no elementType (applies to all), check if child rule set visibility for any element
    if (!elementType || elementType === "all") {
      // Parent rule applies to all elements, so if child rule set visibility for any element, skip
      return true;
    }

    // If parent rule has a specific elementType, check if child rule set visibility for the same or more specific element
    if (
      sourceElementType === "all" ||
      sourceElementType === elementType ||
      sourceElementType.startsWith(`${elementType}.`)
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a later more specific rule would override the current rule's visibility
 * This is especially important for "all" featureType, where any later non-"all" rule
 * for the same v2Id would override the "all" rule
 * @param {string} featureType - Current feature type
 * @param {string} elementType - Element type
 * @param {string} v2Id - V2 feature ID to check
 * @param {number} ruleIndex - Index of the current rule in V1 JSON
 * @param {Array} v1Json - Original V1 JSON array
 * @returns {boolean} True if a later more specific rule would override visibility
 */
const hasLaterMoreSpecificVisibility = (
  featureType,
  elementType,
  v2Id,
  ruleIndex,
  v1Json
) => {
  const keyElementType = elementType || "all";

  for (let i = ruleIndex + 1; i < v1Json.length; i++) {
    const laterRule = v1Json[i];
    const {
      featureType: laterFeatureType,
      elementType: laterElementType,
      stylers,
    } = laterRule;

    if (!Array.isArray(stylers)) continue;

    // Check if this later rule applies to the same v2Id
    if (!isV2IdInExpandedTargets(laterFeatureType, v2Id)) continue;

    // Check if this later rule has visibility
    const mergedStyler = mergeStylers(stylers);
    if (mergedStyler.visibility === undefined) continue;

    const laterKeyElementType = laterElementType || "all";

    // For "all" featureType (or undefined), any later non-"all" rule for the same v2Id is more specific
    if (
      (!featureType || featureType === "all") &&
      laterFeatureType &&
      laterFeatureType !== "all"
    ) {
      // Check element type compatibility
      if (
        laterKeyElementType === "all" ||
        keyElementType === "all" ||
        laterKeyElementType === keyElementType ||
        keyElementType.startsWith(`${laterKeyElementType}.`) ||
        laterKeyElementType.startsWith(`${keyElementType}.`)
      ) {
        return true;
      }
    }

    // For non-"all" featureType, check if later rule's featureType is more specific (child)
    // or the same as the current featureType
    if (featureType && featureType !== "all") {
      const isMoreSpecificOrSame =
        laterFeatureType === featureType ||
        (laterFeatureType && laterFeatureType.startsWith(`${featureType}.`));

      if (isMoreSpecificOrSame) {
        // Check element type compatibility
        if (
          laterKeyElementType === "all" ||
          keyElementType === "all" ||
          laterKeyElementType === keyElementType ||
          keyElementType.startsWith(`${laterKeyElementType}.`) ||
          laterKeyElementType.startsWith(`${keyElementType}.`)
        ) {
          return true;
        }
      }
    }

    // Check for same featureType but more specific elementType
    // e.g., "all::all" followed by "all::labels" - the labels rule is more specific for labels
    const sameOrMatchingFeatureType =
      (!featureType || featureType === "all") &&
      (!laterFeatureType || laterFeatureType === "all");

    if (sameOrMatchingFeatureType) {
      // Check if later element type is more specific
      // "all" -> "labels", "geometry", etc. are more specific
      // "labels" -> "labels.text", "labels.icon" are more specific
      if (
        keyElementType === "all" &&
        laterKeyElementType !== "all" &&
        laterKeyElementType !== keyElementType
      ) {
        return true;
      }
      // Check if later element type is a child of current (e.g., "labels" vs "labels.text")
      if (laterKeyElementType.startsWith(`${keyElementType}.`)) {
        return true;
      }
    }

    // Check for case where later rule has broader featureType but more specific elementType
    // e.g., "poi::all" followed by "all::labels.text" - the labels.text rule overrides for labels
    // This only applies when the current rule's elementType is "all" (affects everything)
    // and the later rule's elementType is more specific
    if (
      keyElementType === "all" &&
      (!laterFeatureType || laterFeatureType === "all") &&
      laterKeyElementType !== "all"
    ) {
      // Check if the later rule's element type would affect the same section
      // e.g., "labels.text" affects labels, "geometry.fill" affects geometry
      return true;
    }
  }

  return false;
};

/**
 * Checks if a later more specific rule would override the current rule's color
 * This is for "all" featureType where any later non-"all" rule with color
 * for the same v2Id would override
 * @param {string} featureType - Current feature type
 * @param {string} elementType - Element type
 * @param {string} v2Id - V2 feature ID to check
 * @param {string} propertyPath - V2 property path (e.g., "label.textFillColor")
 * @param {number} ruleIndex - Index of the current rule in V1 JSON
 * @param {Array} v1Json - Original V1 JSON array
 * @returns {boolean} True if a later more specific rule would override color
 */
const hasLaterMoreSpecificColor = (
  featureType,
  elementType,
  v2Id,
  propertyPath,
  ruleIndex,
  v1Json
) => {
  const keyElementType = elementType || "all";

  for (let i = ruleIndex + 1; i < v1Json.length; i++) {
    const laterRule = v1Json[i];
    const {
      featureType: laterFeatureType,
      elementType: laterElementType,
      stylers,
    } = laterRule;

    if (!Array.isArray(stylers)) continue;

    // Check if this later rule applies to the same v2Id
    if (!isV2IdInExpandedTargets(laterFeatureType, v2Id)) continue;

    // Check if this later rule has color or HSL adjustments that would modify color
    const mergedStyler = mergeStylers(stylers);
    const hasColor = mergedStyler.color !== undefined;
    const hasHslAdjustments =
      mergedStyler.lightness !== undefined ||
      mergedStyler.saturation !== undefined;

    if (!hasColor && !hasHslAdjustments) continue;

    const laterKeyElementType = laterElementType || "all";

    // For "all" featureType (or undefined), any later non-"all" rule for the same v2Id is more specific
    if (
      (!featureType || featureType === "all") &&
      laterFeatureType &&
      laterFeatureType !== "all"
    ) {
      // Check element type compatibility for color
      if (
        laterKeyElementType === "all" ||
        keyElementType === "all" ||
        laterKeyElementType === keyElementType ||
        keyElementType.startsWith(`${laterKeyElementType}.`) ||
        laterKeyElementType.startsWith(`${keyElementType}.`)
      ) {
        return true;
      }
    }

    // For non-"all" featureType, check if later rule's featureType is more specific (child)
    // or the same as the current featureType
    if (featureType && featureType !== "all") {
      const isMoreSpecificOrSame =
        laterFeatureType === featureType ||
        (laterFeatureType && laterFeatureType.startsWith(`${featureType}.`));

      if (isMoreSpecificOrSame) {
        // Check element type compatibility
        if (
          laterKeyElementType === "all" ||
          keyElementType === "all" ||
          laterKeyElementType === keyElementType ||
          keyElementType.startsWith(`${laterKeyElementType}.`) ||
          laterKeyElementType.startsWith(`${keyElementType}.`)
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Checks if a later parent rule would override a child rule
 * @param {string} childFeatureType - Child V1 feature type (e.g., "landscape.natural")
 * @param {string} elementType - Element type (e.g., "geometry.fill")
 * @param {string} v2Id - V2 feature ID to check
 * @param {string} propertyPath - V2 property path (e.g., "geometry.fillColor")
 * @param {number} ruleIndex - Index of the current rule in V1 JSON
 * @param {Array} v1Json - Original V1 JSON array
 * @returns {boolean} True if a later parent rule would override this rule
 */
const hasLaterParentRule = (
  childFeatureType,
  elementType,
  v2Id,
  propertyPath,
  ruleIndex,
  v1Json
) => {
  // If no specific featureType (undefined or "all"), there's no parent to check
  if (!childFeatureType || childFeatureType === "all") {
    return false;
  }
  const parts = childFeatureType.split(".");

  for (let i = parts.length - 1; i > 0; i--) {
    const parentFeatureType = parts.slice(0, i).join(".");
    const parentV2Ids = getV2Id(parentFeatureType);
    if (!parentV2Ids) continue;

    const parentV2IdArray = normalizeArray(parentV2Ids);

    const isChildOfParent = parentV2IdArray.some(
      (parentV2Id) => parentV2Id === v2Id || v2Id.startsWith(`${parentV2Id}.`)
    );

    if (!isChildOfParent) continue;

    for (let j = ruleIndex + 1; j < v1Json.length; j++) {
      const laterRule = v1Json[j];
      const { featureType, elementType: laterElementType, stylers } = laterRule;

      if (!Array.isArray(stylers) || featureType !== parentFeatureType) {
        continue;
      }

      const mergedStyler = mergeStylers(stylers);
      const hasOverrideProperty =
        mergedStyler.visibility !== undefined ||
        mergedStyler.color !== undefined;

      if (!laterElementType || laterElementType === "all") {
        if (hasOverrideProperty) return true;
        continue;
      }

      const laterPropertyPathResult = getV2PropertyPath(laterElementType, v2Id);
      if (!laterPropertyPathResult) continue;

      const laterPropertyPaths = normalizePropertyPaths(
        laterPropertyPathResult
      );

      if (laterPropertyPaths.includes(propertyPath) && hasOverrideProperty) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Checks if a feature supports a given section
 * @param {string} section - Section name ("geometry" or "label")
 * @param {string} v2Id - V2 feature ID
 * @returns {boolean} True if feature supports the section
 */
const supportsSection = (section, v2Id) => {
  if (section === "geometry") return supportsGeometry(v2Id);
  if (section === "label") return supportsLabel(v2Id);
  return false;
};

/**
 * Checks if geometry visibility should be applied for a given element type and feature
 * Matches the logic in converter.js
 * @param {string} elementType - Element type
 * @param {string} v2Id - V2 feature ID
 * @returns {boolean} True if geometry visibility should be applied
 */
const shouldApplyGeometryVisibility = (elementType, v2Id) => {
  if (elementType === "geometry.fill") {
    return isValidGeometryProperty(v2Id, "fillColor");
  }
  if (elementType === "geometry.stroke") {
    return isValidGeometryProperty(v2Id, "strokeColor");
  }
  return true;
};

/**
 * Gets the actual color value from V2 styling
 * @param {Object} v2Style - V2 style object
 * @param {string} section - Section name ("geometry" or "label")
 * @param {string} property - Property name
 * @returns {string|null} Color value or null
 */
const getActualColor = (v2Style, section, property) => {
  if (section === "geometry") {
    if (property === "color") {
      // Some features use fillColor/strokeColor, others use color directly
      return (
        v2Style.geometry?.fillColor ||
        v2Style.geometry?.strokeColor ||
        v2Style.geometry?.color ||
        null
      );
    }
    return v2Style.geometry?.[property] || null;
  }

  if (section === "label") {
    return v2Style.label?.[property] || null;
  }

  return null;
};

/**
 * Checks if a property is valid for a feature
 * @param {string} section - Section name ("geometry" or "label")
 * @param {string} property - Property name
 * @param {string} v2Id - V2 feature ID
 * @returns {boolean} True if property is valid
 */
const isValidProperty = (section, property, v2Id) => {
  if (section === "geometry") {
    if (property === "color") {
      return (
        isValidGeometryProperty(v2Id, "color") ||
        isValidGeometryProperty(v2Id, "fillColor") ||
        isValidGeometryProperty(v2Id, "strokeColor")
      );
    }
    return isValidGeometryProperty(v2Id, property);
  }

  if (section === "label") {
    return isValidLabelProperty(v2Id, property);
  }

  return false;
};

/**
 * Compares extracted V1 and V2 styling to identify differences
 * @param {Object} v1Styling - Extracted V1 styling
 * @param {Object} v2Styling - Extracted V2 styling
 * @param {Array} v1Json - Original V1 JSON for variant detection
 * @param {string} v2Variant - V2 variant from conversion
 * @returns {Array} Array of differences found
 */
const compareStyling = (v1Styling, v2Styling, v1Json, v2Variant) => {
  const differences = [];

  const expectedVariant = detectVariant(v1Json);
  if (v2Variant !== expectedVariant) {
    differences.push({
      type: "variant",
      expected: expectedVariant,
      actual: v2Variant,
    });
  }

  const v1FeatureMap = new Map();
  for (const key of Object.keys(v1Styling)) {
    const [featureType, elementType] = key.split("::");
    const v2Ids =
      !featureType || featureType === "all"
        ? getAllV2Ids()
        : normalizeArray(getV2Id(featureType) ?? []);

    if (!v1FeatureMap.has(featureType)) {
      v1FeatureMap.set(featureType, {
        v2Ids: v2Ids && v2Ids.length > 0 ? v2Ids : null,
        elements: [],
      });
    }
    v1FeatureMap.get(featureType).elements.push({
      elementType,
      styling: v1Styling[key],
    });
  }

  for (const [featureType, featureData] of v1FeatureMap.entries()) {
    const { v2Ids } = featureData;

    for (const elementData of featureData.elements) {
      const { elementType, styling: v1Rule } = elementData;

      for (const rule of v1Rule.rules) {
        if (rule.visibility !== undefined) {
          const expectedVisible = getV2Visibility(rule.visibility);
          if (expectedVisible === null || !v2Ids) continue;

          for (const v2Id of v2Ids) {
            const v2Style = v2Styling[v2Id];
            if (!v2Style) continue;

            // For visibility rules, we need to determine which section(s) to check
            // Element types starting with "labels" affect label.visible
            // Element types starting with "geometry" or empty/"all" affect geometry.visible or both
            // Note: labels.text.fill and labels.text.stroke are about sub-element styling,
            // not overall label visibility. V2 doesn't have separate visibility for these.
            const isGeometryTarget =
              !elementType ||
              elementType === "all" ||
              elementType.startsWith("geometry");
            const isLabelVisibilityTarget =
              !elementType ||
              elementType === "all" ||
              elementType === "labels" ||
              elementType === "labels.text" ||
              elementType === "labels.icon";
            const isLabelTarget = isLabelVisibilityTarget;

            // Check geometry visibility if applicable
            if (isGeometryTarget && supportsGeometry(v2Id)) {
              const shouldCheck = shouldApplyGeometryVisibility(
                elementType,
                v2Id
              );
              if (shouldCheck) {
                const propertyPath = "geometry.visible";
                // Skip if an earlier more specific rule would have prevented this rule from applying
                if (
                  rule.ruleIndex !== undefined &&
                  hasEarlierMoreSpecificVisibility(
                    featureType,
                    elementType,
                    v2Id,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                // Skip if a later parent rule would override this rule
                if (
                  rule.ruleIndex !== undefined &&
                  hasLaterParentRule(
                    featureType,
                    elementType,
                    v2Id,
                    propertyPath,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                // Skip if a later more specific rule would override this rule
                if (
                  rule.ruleIndex !== undefined &&
                  hasLaterMoreSpecificVisibility(
                    featureType,
                    elementType,
                    v2Id,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                const actualVisible = v2Style.geometry?.visible;
                if (actualVisible !== expectedVisible) {
                  differences.push({
                    type: "visibility",
                    v1FeatureType: featureType,
                    v1ElementType: elementType,
                    v2FeatureId: v2Id,
                    v2Property: propertyPath,
                    expected: expectedVisible,
                    actual: actualVisible,
                  });
                }
              }
            }

            // Check label visibility if applicable
            if (isLabelTarget && supportsLabel(v2Id)) {
              // Special handling for labels.icon
              if (elementType === "labels.icon") {
                if (isIconShieldFeature(v2Id)) {
                  const propertyPath = "label.visible";
                  // Skip if an earlier more specific rule would have prevented this rule from applying
                  if (
                    rule.ruleIndex !== undefined &&
                    hasEarlierMoreSpecificVisibility(
                      featureType,
                      elementType,
                      v2Id,
                      rule.ruleIndex,
                      v1Json
                    )
                  ) {
                    continue;
                  }
                  // Skip if a later parent rule would override this rule
                  if (
                    rule.ruleIndex !== undefined &&
                    hasLaterParentRule(
                      featureType,
                      elementType,
                      v2Id,
                      propertyPath,
                      rule.ruleIndex,
                      v1Json
                    )
                  ) {
                    continue;
                  }
                  // Skip if a later more specific rule would override this rule
                  if (
                    rule.ruleIndex !== undefined &&
                    hasLaterMoreSpecificVisibility(
                      featureType,
                      elementType,
                      v2Id,
                      rule.ruleIndex,
                      v1Json
                    )
                  ) {
                    continue;
                  }
                  const actualVisible = v2Style.label?.visible;
                  if (actualVisible !== expectedVisible) {
                    differences.push({
                      type: "visibility",
                      v1FeatureType: featureType,
                      v1ElementType: elementType,
                      v2FeatureId: v2Id,
                      v2Property: propertyPath,
                      expected: expectedVisible,
                      actual: actualVisible,
                    });
                  }
                }
              } else {
                // For other label element types (labels, labels.text, labels.text.fill, etc.)
                const propertyPath = "label.visible";
                // Skip if an earlier more specific rule would have prevented this rule from applying
                if (
                  rule.ruleIndex !== undefined &&
                  hasEarlierMoreSpecificVisibility(
                    featureType,
                    elementType,
                    v2Id,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                // Skip if a later parent rule would override this rule
                if (
                  rule.ruleIndex !== undefined &&
                  hasLaterParentRule(
                    featureType,
                    elementType,
                    v2Id,
                    propertyPath,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                // Skip if a later more specific rule would override this rule
                if (
                  rule.ruleIndex !== undefined &&
                  hasLaterMoreSpecificVisibility(
                    featureType,
                    elementType,
                    v2Id,
                    rule.ruleIndex,
                    v1Json
                  )
                ) {
                  continue;
                }
                const actualVisible = v2Style.label?.visible;
                if (actualVisible !== expectedVisible) {
                  differences.push({
                    type: "visibility",
                    v1FeatureType: featureType,
                    v1ElementType: elementType,
                    v2FeatureId: v2Id,
                    v2Property: propertyPath,
                    expected: expectedVisible,
                    actual: actualVisible,
                  });
                }
              }
            }
          }
        }

        if (rule.color) {
          if (!v2Ids) continue;

          for (const v2Id of v2Ids) {
            const v2Style = v2Styling[v2Id];
            if (!v2Style) continue;

            const propertyPathResult = getV2PropertyPath(elementType, v2Id);
            if (!propertyPathResult) continue;

            const propertyPaths = normalizePropertyPaths(propertyPathResult);

            for (const propertyPath of propertyPaths) {
              const [section, property] = propertyPath.split(".");

              if (!supportsSection(section, v2Id)) continue;

              if (
                rule.ruleIndex !== undefined &&
                hasLaterParentRule(
                  featureType,
                  elementType,
                  v2Id,
                  propertyPath,
                  rule.ruleIndex,
                  v1Json
                )
              ) {
                continue;
              }

              if (
                hasMoreSpecificRule(
                  featureType,
                  elementType,
                  v2Id,
                  propertyPath,
                  v1FeatureMap
                )
              ) {
                continue;
              }

              // Skip if a later more specific rule would override the color
              if (
                rule.ruleIndex !== undefined &&
                hasLaterMoreSpecificColor(
                  featureType,
                  elementType,
                  v2Id,
                  propertyPath,
                  rule.ruleIndex,
                  v1Json
                )
              ) {
                continue;
              }

              if (elementType === "geometry" && section === "geometry") {
                const hasGeometryFill = featureData.elements.some(
                  (el) => el.elementType === "geometry.fill"
                );
                const hasGeometryStroke = featureData.elements.some(
                  (el) => el.elementType === "geometry.stroke"
                );

                if (
                  (property === "fillColor" && hasGeometryFill) ||
                  (property === "strokeColor" && hasGeometryStroke)
                ) {
                  continue;
                }
              }

              if (!isValidProperty(section, property, v2Id)) continue;

              const actualColor = getActualColor(v2Style, section, property);

              if (actualColor) {
                let expectedColor = rule.color;
                if (
                  rule.saturation !== undefined ||
                  rule.lightness !== undefined
                ) {
                  expectedColor = applyHslAdjustments(
                    rule.color,
                    rule.lightness,
                    rule.saturation
                  );
                }

                if (!colorsSimilar(expectedColor, actualColor)) {
                  differences.push({
                    type: "color",
                    v1FeatureType: featureType,
                    v1ElementType: elementType,
                    v2FeatureId: v2Id,
                    v2Property: propertyPath,
                    expected: expectedColor,
                    actual: actualColor,
                  });
                }
              } else if (rule.color && !rule.saturation && !rule.lightness) {
                differences.push({
                  type: "color_missing",
                  v1FeatureType: featureType,
                  v1ElementType: elementType,
                  v2FeatureId: v2Id,
                  v2Property: propertyPath,
                  expected: rule.color,
                  actual: null,
                });
              }
            }
          }
        }

        if (rule.weight !== undefined && elementType?.includes("stroke")) {
          if (!v2Ids) continue;

          for (const v2Id of v2Ids) {
            const v2Style = v2Styling[v2Id];
            const strokeWeight = v2Style?.geometry?.strokeWeight;

            if (strokeWeight === undefined) continue;

            const expectedWeight = parseFloat(rule.weight);
            const diff = Math.abs(expectedWeight - strokeWeight);

            if (diff > WEIGHT_TOLERANCE) {
              differences.push({
                type: "weight",
                v1FeatureType: featureType,
                v1ElementType: elementType,
                v2FeatureId: v2Id,
                expected: rule.weight,
                actual: strokeWeight,
              });
            }
          }
        }
      }
    }
  }

  return differences;
};

/**
 * Formats error details as YAML for TAP output
 * @param {string} message - Error message
 * @param {Array} differences - Styling differences
 * @returns {string} YAML-formatted error block
 */
const formatErrorYaml = (message, differences = []) => {
  const lines = [`  ---`, `  message: ${JSON.stringify(message)}`];

  if (differences.length > 0) {
    lines.push(`  differences:`);
    for (const diff of differences) {
      lines.push(`    - type: ${JSON.stringify(diff.type)}`);
      lines.push(`      v1FeatureType: ${JSON.stringify(diff.v1FeatureType)}`);
      lines.push(`      v1ElementType: ${JSON.stringify(diff.v1ElementType)}`);

      if (diff.v2FeatureId) {
        lines.push(`      v2FeatureId: ${JSON.stringify(diff.v2FeatureId)}`);
      }
      if (diff.v2Property) {
        lines.push(`      v2Property: ${JSON.stringify(diff.v2Property)}`);
      }
      if (diff.expected !== undefined) {
        lines.push(`      expected: ${JSON.stringify(diff.expected)}`);
      }
      if (diff.actual !== undefined) {
        lines.push(`      actual: ${JSON.stringify(diff.actual)}`);
      }
    }
  }

  lines.push(`  ...`);
  return lines.join("\n");
};

/**
 * Main test execution
 * Reuses fetched styles and conversions from validate-conversions.js
 */
const runTests = async () => {
  const results = await fetchAndConvertStyles();

  if (results.length === 0) {
    console.error("No styles found from Snazzy Maps API");
    process.exit(1);
  }

  console.log("TAP version 13");
  console.log(`1..${results.length}`);

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const { style, v1Json, v2Json, conversionError, loadError } = results[i];
    const styleName = style.name ?? `Style #${style.id}`;
    const styleId = style.id;
    const testNumber = i + 1;

    try {
      if (loadError) {
        console.log(`not ok ${testNumber} - ${styleName} (load failed)`);
        console.log(formatErrorYaml(`Load error: ${loadError}`));
        failCount++;
        failures.push({ style: styleName, styleId, error: loadError });
        continue;
      }

      if (conversionError) {
        console.log(`not ok ${testNumber} - ${styleName} (conversion failed)`);
        console.log(formatErrorYaml(`Conversion error: ${conversionError}`));
        failCount++;
        failures.push({
          style: styleName,
          styleId,
          error: conversionError,
        });
        continue;
      }

      if (!v1Json || !v2Json) {
        console.log(`not ok ${testNumber} - ${styleName} (missing data)`);
        console.log(formatErrorYaml(`Missing V1 or V2 JSON data`));
        failCount++;
        failures.push({
          style: styleName,
          styleId,
          error: "Missing V1 or V2 JSON data",
        });
        continue;
      }

      const v1Styling = extractV1Styling(v1Json);
      const v2Styling = extractV2Styling(v2Json);

      const differences = compareStyling(
        v1Styling,
        v2Styling,
        v1Json,
        v2Json.variant
      );

      if (differences.length === 0) {
        console.log(`ok ${testNumber} - ${styleName}`);
        passCount++;
      } else {
        console.log(
          `not ok ${testNumber} - ${styleName} (styling differences found)`
        );
        console.log(
          formatErrorYaml(
            `Found ${differences.length} styling difference(s)`,
            differences
          )
        );
        failCount++;
        failures.push({
          style: styleName,
          styleId,
          differences,
        });
      }
    } catch (error) {
      console.log(`not ok ${testNumber} - ${styleName} (error)`);
      console.log(formatErrorYaml(`Test error: ${error.message}`));
      failCount++;
      failures.push({
        style: styleName,
        styleId,
        error: error.message,
      });
    }
  }

  console.log("");
  console.log(`# tests ${results.length}`);
  console.log(`# pass  ${passCount}`);
  console.log(`# fail  ${failCount}`);

  if (failCount > 0) {
    console.log("");
    console.log("# Failed tests:");
    for (const failure of failures) {
      const name = failure.style ?? `Style #${failure.styleId}`;
      console.log(`#   - ${name} (ID: ${failure.styleId})`);

      if (failure.error) {
        console.log(`#     Error: ${failure.error}`);
      }

      if (failure.differences) {
        console.log(`#     Styling differences: ${failure.differences.length}`);
        for (const diff of failure.differences.slice(0, 5)) {
          let diffLine = `#       ${diff.type}: ${diff.v1FeatureType}::${diff.v1ElementType}`;
          if (diff.v2FeatureId) {
            diffLine += ` -> ${diff.v2FeatureId}`;
          }
          if (diff.expected !== undefined && diff.actual !== undefined) {
            diffLine += ` (expected: ${diff.expected}, actual: ${diff.actual})`;
          }
          console.log(diffLine);
        }
        if (failure.differences.length > 5) {
          console.log(`#       ... and ${failure.differences.length - 5} more`);
        }
      }
    }
    process.exit(1);
  }

  process.exit(0);
};

runTests().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
