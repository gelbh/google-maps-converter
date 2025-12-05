/**
 * Color conversion utilities for Google Maps V1 to V2 style conversion
 * Handles HSL adjustments and color normalization
 */

/**
 * Converts hex color to HSL
 * @param {string} hex - Hex color string (#RRGGBB)
 * @returns {{h: number, s: number, l: number}} HSL values (0-360 for h, 0-100 for s and l)
 */
function hexToHsl(hex) {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string (#RRGGBB)
 */
function hslToHex(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Applies V1 lightness and saturation adjustments to a base color
 * @param {string} baseColor - Base hex color (#RRGGBB)
 * @param {number|string} lightness - Lightness adjustment (-100 to 100)
 * @param {number|string} saturation - Saturation adjustment (-100 to 100)
 * @returns {string} Adjusted hex color (#RRGGBB)
 */
function applyHslAdjustments(baseColor, lightness, saturation) {
  const normalized = normalizeHex(baseColor);
  let { h, s, l } = hexToHsl(normalized);

  // Apply saturation adjustment (-100 to 100 → 0-100% saturation)
  if (saturation !== undefined && saturation !== null) {
    const satAdjust = parseFloat(saturation);
    if (!isNaN(satAdjust)) {
      s = Math.max(0, Math.min(100, s + satAdjust));
    }
  }

  // Apply lightness adjustment (-100 to 100 → 0-100% lightness)
  if (lightness !== undefined && lightness !== null) {
    const lightAdjust = parseFloat(lightness);
    if (!isNaN(lightAdjust)) {
      l = Math.max(0, Math.min(100, l + lightAdjust));
    }
  }

  return hslToHex(h, s, l);
}

/**
 * Normalizes hex color to 6-digit format (#RRGGBB)
 * @param {string} hex - Hex color string (may be 3 or 6 digits)
 * @returns {string} Normalized 6-digit hex color (#RRGGBB)
 */
function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") {
    return "#000000";
  }

  hex = hex.trim().toLowerCase();

  // Remove # if present
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Ensure 6 digits
  if (hex.length !== 6) {
    return "#000000";
  }

  // Validate hex characters
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return "#000000";
  }

  return `#${hex}`;
}

/**
 * Extracts color from V1 styler object, applying HSL adjustments if present
 * @param {Object} styler - V1 styler object
 * @param {string} defaultColor - Default color if none specified
 * @returns {string} Hex color string (#RRGGBB)
 */
function extractColor(styler, defaultColor = "#000000") {
  let color = styler.color || defaultColor;
  color = normalizeHex(color);

  // Apply HSL adjustments if present
  if (styler.lightness !== undefined || styler.saturation !== undefined) {
    color = applyHslAdjustments(color, styler.lightness, styler.saturation);
  }

  return color;
}
