/**
 * Core conversion logic for Google Maps V1 to V2 style conversion
 * Converts V1 style JSON (featureType, elementType, stylers) to V2 CBMS format
 */

import { hexToHsl, normalizeHex, extractColor } from "../utils/color-utils.js";
import {
  getV2Id,
  getV2PropertyPath,
  getV2Visibility,
  getAllV2Ids,
} from "./mapping.js";
import {
  supportsGeometry,
  supportsLabel,
  isValidGeometryProperty,
  isValidLabelProperty,
  mapGeometryColor,
  ensureRequiredElements,
} from "./feature-properties.js";

/**
 * Detects variant (light/dark) from V1 style data
 * Analyzes colors to determine if the theme is light or dark
 * @param {Array} v1Styles - V1 style array
 * @returns {string} 'light' or 'dark'
 */
function detectVariant(v1Styles) {
  if (!Array.isArray(v1Styles) || v1Styles.length === 0) {
    return "light";
  }

  let totalLightness = 0;
  let colorCount = 0;

  for (const style of v1Styles) {
    const stylers = style?.stylers;
    if (!Array.isArray(stylers)) continue;

    for (const styler of stylers) {
      if (styler?.color) {
        const hsl = hexToHsl(normalizeHex(styler.color));
        totalLightness += hsl.l;
        colorCount++;
      }
    }
  }

  if (colorCount > 0) {
    const avgLightness = totalLightness / colorCount;
    return avgLightness < 50 ? "dark" : "light";
  }

  return "light";
}

/**
 * Converts V1 weight to V2 strokeWeight
 * Validates and normalizes weight value
 * @param {string|number} weight - V1 weight value
 * @returns {number|null} V2 strokeWeight (0-8, multiple of 0.125) or null if invalid
 */
function convertWeight(weight) {
  if (weight === undefined || weight === null) {
    return null;
  }

  const numWeight = parseFloat(weight);
  if (isNaN(numWeight)) {
    return null;
  }

  const clamped = Math.max(0, Math.min(8, numWeight));
  return Math.round(clamped / 0.125) * 0.125;
}

/**
 * Gets all parent feature IDs for a given feature ID
 * For example: "infrastructure.roadNetwork.road.highway" returns
 * ["infrastructure.roadNetwork.road", "infrastructure.roadNetwork", "infrastructure"]
 * @param {string} featureId - V2 feature ID
 * @returns {string[]} Array of parent feature IDs (most specific first)
 */
function getParentFeatureIds(featureId) {
  const parents = [];
  const parts = featureId.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    parents.push(parts.slice(0, i).join("."));
  }
  return parents;
}

/**
 * Gets HSL adjustments for a feature ID, merging from feature and all applicable parents
 * Merges adjustments from the feature itself and all parent features in the hierarchy
 * Feature-specific adjustments override parent adjustments
 * @param {string} featureId - V2 feature ID
 * @param {Map} hslAdjustmentsMap - Map of feature ID to HSL adjustments
 * @returns {Object|null} Merged HSL adjustments object {saturation?: number, lightness?: number} or null
 */
function getHslAdjustments(featureId, hslAdjustmentsMap) {
  const adjustments = {};
  let hasAdjustments = false;

  // Start with adjustments from parent features (most general first)
  const parents = getParentFeatureIds(featureId);
  for (const parentId of parents) {
    const parentAdjustments = hslAdjustmentsMap.get(parentId);
    if (parentAdjustments) {
      if (parentAdjustments.saturation !== undefined) {
        adjustments.saturation = parentAdjustments.saturation;
        hasAdjustments = true;
      }
      if (parentAdjustments.lightness !== undefined) {
        adjustments.lightness = parentAdjustments.lightness;
        hasAdjustments = true;
      }
    }
  }

  // Override with feature-specific adjustments (most specific last)
  const featureAdjustments = hslAdjustmentsMap.get(featureId);
  if (featureAdjustments) {
    if (featureAdjustments.saturation !== undefined) {
      adjustments.saturation = featureAdjustments.saturation;
      hasAdjustments = true;
    }
    if (featureAdjustments.lightness !== undefined) {
      adjustments.lightness = featureAdjustments.lightness;
      hasAdjustments = true;
    }
  }

  return hasAdjustments ? adjustments : null;
}

/**
 * Processes a single V1 style rule and converts it to V2 style objects
 * @param {Object} v1Rule - V1 style rule
 * @param {Map} v2StylesMap - Map to accumulate V2 styles
 * @param {Map} hslAdjustmentsMap - Map to track HSL adjustments per feature type
 */
function processV1Rule(v1Rule, v2StylesMap, hslAdjustmentsMap) {
  const { featureType, elementType, stylers } = v1Rule;

  // Validate featureType and elementType are strings (or null/undefined)
  if (
    featureType !== undefined &&
    featureType !== null &&
    typeof featureType !== "string"
  ) {
    return;
  }
  if (
    elementType !== undefined &&
    elementType !== null &&
    typeof elementType !== "string"
  ) {
    return;
  }

  if (!Array.isArray(stylers)) {
    return;
  }

  const targetIds =
    featureType === "all"
      ? getAllV2Ids()
      : (() => {
          const mappedId = getV2Id(featureType);
          return mappedId
            ? Array.isArray(mappedId)
              ? mappedId
              : [mappedId]
            : [];
        })();

  if (targetIds.length === 0) {
    return;
  }

  const mergedStyler = Object.assign({}, ...stylers);

  const isGeneralRule = elementType === "all" || !elementType;
  const hasExplicitColor =
    mergedStyler.color !== undefined && mergedStyler.color !== null;
  const hasHslAdjustments =
    mergedStyler.saturation !== undefined ||
    mergedStyler.lightness !== undefined;

  if (isGeneralRule && !hasExplicitColor && hasHslAdjustments) {
    const adjustments = {};
    if (mergedStyler.saturation !== undefined) {
      const sat = parseFloat(mergedStyler.saturation);
      if (!isNaN(sat)) adjustments.saturation = sat;
    }
    if (mergedStyler.lightness !== undefined) {
      const light = parseFloat(mergedStyler.lightness);
      if (!isNaN(light)) adjustments.lightness = light;
    }

    if (Object.keys(adjustments).length > 0) {
      for (const id of targetIds) {
        const existing = hslAdjustmentsMap.get(id);
        hslAdjustmentsMap.set(id, {
          ...existing,
          ...adjustments,
        });
      }
    }
  }

  // Handle visibility rules
  // Visibility handling is complex because:
  // 1. Some features only support geometry, some only labels, some both
  // 2. elementType can target specific parts (geometry, labels) or all
  // 3. labels.icon has special handling - it controls label visibility, not pin color
  if (mergedStyler.visibility !== undefined) {
    const visible = getV2Visibility(mergedStyler.visibility);
    if (visible !== null) {
      // Special case: labels.icon visibility controls label visibility, not pinFillColor
      // This is a V1 quirk where labels.icon visibility affects the entire label element
      if (elementType === "labels.icon") {
        for (const id of targetIds) {
          if (!supportsLabel(id)) continue;

          let style = v2StylesMap.get(id);
          if (!style) {
            style = { id };
            v2StylesMap.set(id, style);
          }

          style.label ??= {};
          style.label.visible = visible;
        }
      } else {
        // General visibility handling
        for (const id of targetIds) {
          let style = v2StylesMap.get(id);
          if (!style) {
            style = { id };
            v2StylesMap.set(id, style);
          }

          const hasGeometry = supportsGeometry(id);
          const hasLabel = supportsLabel(id);

          // Case 1: Feature only supports labels (e.g., political.city)
          // Visibility applies directly to label
          if (!hasGeometry && hasLabel) {
            style.label ??= {};
            style.label.visible = visible;
          }
          // Case 2: Feature only supports geometry (e.g., natural.water)
          // Visibility applies directly to geometry
          else if (hasGeometry && !hasLabel) {
            style.geometry ??= {};
            style.geometry.visible = visible;
          }
          // Case 3: Feature supports both geometry and labels
          // Need to determine which element(s) the visibility rule targets
          else {
            ensureRequiredElements(style, id, elementType);

            // Determine target based on elementType:
            // - No elementType or "all" → applies to both geometry and labels
            // - Starts with "geometry" → applies to geometry only
            // - Starts with "labels" → applies to labels only
            const isGeometryTarget =
              !elementType ||
              elementType === "all" ||
              elementType.startsWith("geometry");
            const isLabelTarget =
              !elementType ||
              elementType === "all" ||
              elementType.startsWith("labels");

            // Apply visibility to geometry if it's a target and feature supports it
            if (isGeometryTarget && hasGeometry) {
              style.geometry ??= {};
              style.geometry.visible = visible;
            }
            // Apply visibility to labels if it's a target and feature supports it
            if (isLabelTarget && hasLabel) {
              style.label ??= {};
              style.label.visible = visible;
            }
          }
        }
      }
    }
  }

  // Handle colors and other properties
  const propertyPath = getV2PropertyPath(elementType);
  if (propertyPath) {
    const [section, property] = propertyPath.split(".");

    for (const id of targetIds) {
      if (section === "geometry" && !supportsGeometry(id)) continue;
      if (section === "label" && !supportsLabel(id)) continue;

      let style = v2StylesMap.get(id);
      if (!style) {
        style = { id };
        v2StylesMap.set(id, style);
      }

      ensureRequiredElements(style, id, elementType);

      if (section === "geometry") {
        const isColorProperty =
          property === "fillColor" ||
          property === "strokeColor" ||
          property === "color";
        const targetProperty =
          property === "color" ? mapGeometryColor(id) : property;

        if (isColorProperty && isValidGeometryProperty(id, targetProperty)) {
          const externalAdjustments = getHslAdjustments(id, hslAdjustmentsMap);
          const color = extractColor(mergedStyler, externalAdjustments);
          if (color !== null) {
            style.geometry ??= {};
            style.geometry[targetProperty] = color;
          }
        } else if (
          property === "strokeWeight" &&
          isValidGeometryProperty(id, "strokeWeight")
        ) {
          const weight = convertWeight(mergedStyler.weight);
          if (weight !== null) {
            style.geometry ??= {};
            style.geometry.strokeWeight = weight;
          }
        }
      } else if (section === "label") {
        const labelColorProps = [
          "textFillColor",
          "textStrokeColor",
          "pinFillColor",
        ];
        if (
          labelColorProps.includes(property) &&
          isValidLabelProperty(id, property)
        ) {
          const externalAdjustments = getHslAdjustments(id, hslAdjustmentsMap);
          const color = extractColor(mergedStyler, externalAdjustments);
          if (color !== null) {
            style.label ??= {};
            style.label[property] = color;
          }
        }
      }
    }
  } else if (elementType === "all" || !elementType) {
    for (const id of targetIds) {
      const externalAdjustments = getHslAdjustments(id, hslAdjustmentsMap);
      const color = extractColor(mergedStyler, externalAdjustments);
      if (color === null) continue;

      let style = v2StylesMap.get(id);
      if (!style) {
        style = { id };
        v2StylesMap.set(id, style);
      }

      ensureRequiredElements(style, id, elementType);

      if (supportsGeometry(id)) {
        const targetProperty = mapGeometryColor(id);
        if (isValidGeometryProperty(id, targetProperty)) {
          style.geometry ??= {};
          style.geometry[targetProperty] = color;
        }
      }

      if (supportsLabel(id)) {
        style.label ??= {};
        // Set color on all applicable label properties, not just one
        if (isValidLabelProperty(id, "textFillColor")) {
          style.label.textFillColor = color;
        }
        if (isValidLabelProperty(id, "pinFillColor")) {
          style.label.pinFillColor = color;
        }
      }
    }
  }
}

/**
 * Cleans up V2 styles by ensuring required elements are present and removing unsupported elements
 * Pure function that does not mutate input
 * @param {Object} style - V2 style object
 * @returns {Object} Cleaned style object or null if style should be removed
 */
function cleanupStyle(style) {
  const cleaned = { id: style.id };
  const hasGeometry = supportsGeometry(style.id);
  const hasLabel = supportsLabel(style.id);

  // Only include geometry if feature supports it and it has properties
  if (hasGeometry && style.geometry && Object.keys(style.geometry).length > 0) {
    cleaned.geometry = style.geometry;
  }

  // Only include label if feature supports it and it has properties
  if (hasLabel && style.label && Object.keys(style.label).length > 0) {
    cleaned.label = style.label;
  }

  // Return null if no valid properties remain
  if (!cleaned.geometry && !cleaned.label) {
    return null;
  }

  return cleaned;
}

/**
 * Converts V1 style JSON to V2 CBMS format
 * @param {Array|string} v1Input - V1 style JSON (array or JSON string)
 * @returns {Object} V2 style object with variant and styles array
 */
export function convertV1ToV2(v1Input) {
  let v1Styles;
  try {
    v1Styles = typeof v1Input === "string" ? JSON.parse(v1Input) : v1Input;
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error.message}`);
  }

  if (!Array.isArray(v1Styles)) {
    throw new Error("V1 input must be an array of style rules");
  }

  const variant = detectVariant(v1Styles);
  const v2StylesMap = new Map();
  const hslAdjustmentsMap = new Map();

  for (const rule of v1Styles) {
    processV1Rule(rule, v2StylesMap, hslAdjustmentsMap);
  }

  const styles = Array.from(v2StylesMap.values())
    .map(cleanupStyle)
    .filter((style) => style !== null && (style.geometry || style.label));

  return { variant, styles };
}
