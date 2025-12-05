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
    return "light"; // Default to light
  }

  let totalLightness = 0;
  let colorCount = 0;

  // Analyze colors from all styles
  for (const style of v1Styles) {
    if (!style.stylers || !Array.isArray(style.stylers)) {
      continue;
    }

    for (const styler of style.stylers) {
      if (styler.color) {
        const hsl = hexToHsl(normalizeHex(styler.color));
        totalLightness += hsl.l;
        colorCount++;
      }
    }
  }

  // If we have colors, use average lightness to determine variant
  if (colorCount > 0) {
    const avgLightness = totalLightness / colorCount;
    return avgLightness < 50 ? "dark" : "light";
  }

  // Default to light if no colors found
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

  // Clamp to 0-8 range
  const clamped = Math.max(0, Math.min(8, numWeight));

  // Round to nearest 0.125
  const rounded = Math.round(clamped / 0.125) * 0.125;

  return rounded;
}

/**
 * Processes a single V1 style rule and converts it to V2 style objects
 * @param {Object} v1Rule - V1 style rule
 * @param {Map} v2StylesMap - Map to accumulate V2 styles
 */
function processV1Rule(v1Rule, v2StylesMap) {
  const { featureType, elementType, stylers } = v1Rule;

  if (!stylers || !Array.isArray(stylers)) {
    return;
  }

  // Determine which V2 ids to target
  let targetIds = [];
  if (featureType === "all") {
    targetIds = getAllV2Ids();
  } else {
    const mappedId = getV2Id(featureType);
    if (mappedId) {
      targetIds = Array.isArray(mappedId) ? mappedId : [mappedId];
    }
  }

  if (targetIds.length === 0) {
    return; // No valid mapping
  }

  // Merge all stylers into a single object (V1 stylers are applied together)
  const mergedStyler = {};
  for (const styler of stylers) {
    Object.assign(mergedStyler, styler);
  }

  // Handle visibility
  if (mergedStyler.visibility !== undefined) {
    const visible = getV2Visibility(mergedStyler.visibility);
    if (visible !== null) {
      for (const id of targetIds) {
        if (!v2StylesMap.has(id)) {
          v2StylesMap.set(id, { id });
        }
        const style = v2StylesMap.get(id);

        const hasGeometry = supportsGeometry(id);
        const hasLabel = supportsLabel(id);

        // For label-only features: always set visibility on label (even if elementType targets geometry)
        if (!hasGeometry && hasLabel) {
          if (!style.label) style.label = {};
          style.label.visible = visible;
        }
        // For geometry-only features: always set visibility on geometry (even if elementType targets labels)
        else if (hasGeometry && !hasLabel) {
          if (!style.geometry) style.geometry = {};
          style.geometry.visible = visible;
        }
        // For features supporting both: respect elementType
        else {
          // Ensure required elements are present based on feature capabilities
          ensureRequiredElements(style, id, elementType);

          // Visibility can apply to both geometry and label
          // Only set visibility if feature supports the element type
          if (
            (elementType === "all" ||
              !elementType ||
              elementType.startsWith("geometry")) &&
            hasGeometry
          ) {
            if (!style.geometry) style.geometry = {};
            style.geometry.visible = visible;
          }
          if (
            (elementType === "all" ||
              !elementType ||
              elementType.startsWith("labels")) &&
            hasLabel
          ) {
            if (!style.label) style.label = {};
            style.label.visible = visible;
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
      if (section === "geometry") {
        // Only process geometry if feature supports it
        if (!supportsGeometry(id)) {
          continue;
        }
      } else if (section === "label") {
        // Only process label if feature supports it
        if (!supportsLabel(id)) {
          continue;
        }
      }

      if (!v2StylesMap.has(id)) {
        v2StylesMap.set(id, { id });
      }
      const style = v2StylesMap.get(id);

      // Ensure required elements are present before processing properties
      ensureRequiredElements(style, id, elementType);

      if (section === "geometry") {
        let willSetProperty = false;
        let propertyToSet = null;
        let valueToSet = null;

        if (
          property === "fillColor" ||
          property === "strokeColor" ||
          property === "color"
        ) {
          // Map geometry.color to appropriate property based on feature
          // Note: More specific elementTypes (geometry.fill, geometry.stroke) map to
          // specific properties (fillColor, strokeColor), while general "geometry"
          // maps to "color" which then gets mapped to fillColor via mapGeometryColor.
          // Since rules are processed in order, later rules will override earlier ones,
          // ensuring that more specific elementTypes take precedence.
          const targetProperty =
            property === "color" ? mapGeometryColor(id) : property;

          // Only set if property is valid for this feature
          if (isValidGeometryProperty(id, targetProperty)) {
            willSetProperty = true;
            propertyToSet = targetProperty;
            valueToSet = extractColor(mergedStyler);
          }
        } else if (property === "strokeWeight") {
          if (isValidGeometryProperty(id, "strokeWeight")) {
            const weight = convertWeight(mergedStyler.weight);
            if (weight !== null) {
              willSetProperty = true;
              propertyToSet = "strokeWeight";
              valueToSet = weight;
            }
          }
        }

        // Only create geometry object if we're actually setting a property
        // This will overwrite any previous value for the same property, ensuring
        // that later rules (which are typically more specific) override earlier ones.
        if (willSetProperty) {
          if (!style.geometry) style.geometry = {};
          style.geometry[propertyToSet] = valueToSet;
        }
      } else if (section === "label") {
        if (
          property === "textFillColor" ||
          property === "textStrokeColor" ||
          property === "pinFillColor"
        ) {
          // Only set if property is valid for this feature
          if (isValidLabelProperty(id, property)) {
            if (!style.label) style.label = {};
            const color = extractColor(mergedStyler);
            style.label[property] = color;
          }
        }
      }
    }
  } else if (elementType === "all" || !elementType) {
    // Handle 'all' elementType - apply color to geometry.fillColor as default
    const color = extractColor(mergedStyler);
    if (color && color !== "#000000") {
      for (const id of targetIds) {
        // Only apply to geometry if feature supports it
        if (!supportsGeometry(id)) {
          continue;
        }

        // Map to appropriate property based on feature
        const targetProperty = mapGeometryColor(id);
        if (isValidGeometryProperty(id, targetProperty)) {
          if (!v2StylesMap.has(id)) {
            v2StylesMap.set(id, { id });
          }
          const style = v2StylesMap.get(id);
          // Ensure required elements are present
          ensureRequiredElements(style, id, elementType);
          if (!style.geometry) style.geometry = {};
          style.geometry[targetProperty] = color;
        }
      }
    }
  }
}

/**
 * Cleans up V2 styles by ensuring required elements are present and removing unsupported elements
 * @param {Object} style - V2 style object
 * @returns {Object} Cleaned style object or null if style should be removed
 */
function cleanupStyle(style) {
  const cleaned = { id: style.id };
  const hasGeometry = supportsGeometry(style.id);
  const hasLabel = supportsLabel(style.id);

  // Explicitly remove geometry from features that don't support it
  // This is a safety check to ensure label-only features never have geometry properties
  if (!hasGeometry) {
    // Remove any geometry properties that may have been incorrectly added
    if (style.geometry) {
      delete style.geometry;
    }
  }

  // Explicitly remove label from features that don't support it
  if (!hasLabel) {
    if (style.label) {
      delete style.label;
    }
  }

  // Ensure required elements are present based on feature capabilities
  // For label-only features: ensure label exists with at least one property
  if (!hasGeometry && hasLabel) {
    if (style.label && Object.keys(style.label).length > 0) {
      cleaned.label = style.label;
    } else {
      // If label-only feature has no label properties, the style object shouldn't exist
      // This shouldn't happen if ensureRequiredElements is called correctly
      return null;
    }
  }

  // For geometry-only features: ensure geometry exists with at least one property
  if (hasGeometry && !hasLabel) {
    if (style.geometry && Object.keys(style.geometry).length > 0) {
      cleaned.geometry = style.geometry;
    } else {
      // If geometry-only feature has no geometry properties, the style object shouldn't exist
      // This shouldn't happen if ensureRequiredElements is called correctly
      return null;
    }
  }

  // For features supporting both: include elements that have properties
  if (hasGeometry && hasLabel) {
    // Only include geometry if it has properties
    if (style.geometry && Object.keys(style.geometry).length > 0) {
      cleaned.geometry = style.geometry;
    }
    // Only include label if it has properties
    if (style.label && Object.keys(style.label).length > 0) {
      cleaned.label = style.label;
    }
    // If neither element has properties, the style object shouldn't exist
    if (!cleaned.geometry && !cleaned.label) {
      return null;
    }
  }

  // Final safety check: remove unsupported elements (shouldn't happen after above checks, but extra safety)
  if (!hasGeometry && cleaned.geometry) {
    delete cleaned.geometry;
  }
  if (!hasLabel && cleaned.label) {
    delete cleaned.label;
  }

  return cleaned;
}

/**
 * Converts V1 style JSON to V2 CBMS format
 * @param {Array|string} v1Input - V1 style JSON (array or JSON string)
 * @returns {Object} V2 style object with variant and styles array
 */
export function convertV1ToV2(v1Input) {
  // Parse input if it's a string
  let v1Styles;
  try {
    v1Styles = typeof v1Input === "string" ? JSON.parse(v1Input) : v1Input;
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error.message}`);
  }

  // Validate input structure
  if (!Array.isArray(v1Styles)) {
    throw new Error("V1 input must be an array of style rules");
  }

  // Detect variant
  const variant = detectVariant(v1Styles);

  // Process all V1 rules
  const v2StylesMap = new Map();

  for (const rule of v1Styles) {
    processV1Rule(rule, v2StylesMap);
  }

  // Convert map to array and clean up
  const styles = Array.from(v2StylesMap.values())
    .map(cleanupStyle)
    .filter((style) => {
      // Only include styles that are not null and have at least geometry or label properties
      return style !== null && (style.geometry || style.label);
    });

  // Build V2 output
  const v2Output = {
    variant,
    styles,
  };

  return v2Output;
}
