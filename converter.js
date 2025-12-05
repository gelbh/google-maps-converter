/**
 * Core conversion logic for Google Maps V1 to V2 style conversion
 * Converts V1 style JSON (featureType, elementType, stylers) to V2 CBMS format
 */

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
        if (!style.geometry) style.geometry = {};
        if (!style.label) style.label = {};

        // Visibility can apply to both geometry and label
        if (
          elementType === "all" ||
          !elementType ||
          elementType.startsWith("geometry")
        ) {
          style.geometry.visible = visible;
        }
        if (
          elementType === "all" ||
          !elementType ||
          elementType.startsWith("labels")
        ) {
          style.label.visible = visible;
        }
      }
    }
  }

  // Handle colors and other properties
  const propertyPath = getV2PropertyPath(elementType);
  if (propertyPath) {
    const [section, property] = propertyPath.split(".");

    for (const id of targetIds) {
      if (!v2StylesMap.has(id)) {
        v2StylesMap.set(id, { id });
      }
      const style = v2StylesMap.get(id);

      if (section === "geometry") {
        if (!style.geometry) style.geometry = {};

        if (
          property === "fillColor" ||
          property === "strokeColor" ||
          property === "color"
        ) {
          const color = extractColor(mergedStyler);
          style.geometry[property] = color;
        } else if (property === "strokeWeight") {
          const weight = convertWeight(mergedStyler.weight);
          if (weight !== null) {
            style.geometry.strokeWeight = weight;
          }
        }
      } else if (section === "label") {
        if (!style.label) style.label = {};

        if (
          property === "textFillColor" ||
          property === "textStrokeColor" ||
          property === "pinFillColor"
        ) {
          const color = extractColor(mergedStyler);
          style.label[property] = color;
        }
      }
    }
  } else if (elementType === "all" || !elementType) {
    // Handle 'all' elementType - apply color to geometry.fillColor as default
    const color = extractColor(mergedStyler);
    if (color && color !== "#000000") {
      for (const id of targetIds) {
        if (!v2StylesMap.has(id)) {
          v2StylesMap.set(id, { id });
        }
        const style = v2StylesMap.get(id);
        if (!style.geometry) style.geometry = {};
        style.geometry.fillColor = color;
      }
    }
  }
}

/**
 * Cleans up V2 styles by removing empty objects
 * @param {Object} style - V2 style object
 * @returns {Object} Cleaned style object
 */
function cleanupStyle(style) {
  const cleaned = { id: style.id };

  if (style.geometry && Object.keys(style.geometry).length > 0) {
    cleaned.geometry = style.geometry;
  }

  if (style.label && Object.keys(style.label).length > 0) {
    cleaned.label = style.label;
  }

  return cleaned;
}

/**
 * Converts V1 style JSON to V2 CBMS format
 * @param {Array|string} v1Input - V1 style JSON (array or JSON string)
 * @returns {Object} V2 style object with variant and styles array
 */
function convertV1ToV2(v1Input) {
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
      // Only include styles that have at least geometry or label properties
      return style.geometry || style.label;
    });

  // Build V2 output
  const v2Output = {
    variant,
    styles,
  };

  return v2Output;
}
