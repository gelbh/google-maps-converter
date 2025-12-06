/**
 * Color conversion utilities for Google Maps V1 to V2 style conversion
 * Handles HSL adjustments and color normalization
 */

/**
 * Converts hex color to HSL
 * @param {string} hex - Hex color string (#RRGGBB)
 * @returns {{h: number, s: number, l: number}} HSL values (0-360 for h, 0-100 for s and l)
 */
export function hexToHsl(hex) {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
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
export function hslToHex(h, s, l) {
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
 * Applies HSL adjustment to a single component
 * @param {number} value - Current HSL component value (0-100)
 * @param {number|string} adjustment - Adjustment value (-100 to 100)
 * @returns {number} Adjusted value clamped to 0-100
 */
const applyHslComponent = (value, adjustment) => {
  if (adjustment === undefined || adjustment === null) return value;
  const adjust = parseFloat(adjustment);
  return Number.isNaN(adjust)
    ? value
    : Math.max(0, Math.min(100, value + adjust));
};

/**
 * Applies gamma adjustment to a hex color
 * Gamma adjusts the brightness curve: output = (input / 255) ^ (1 / gamma) * 255
 * @param {string} baseColor - Base hex color (#RRGGBB)
 * @param {number|string} gamma - Gamma value (typically 0.01 to 10.0)
 * @returns {string} Adjusted hex color (#RRGGBB)
 */
export function applyGamma(baseColor, gamma) {
  if (gamma === undefined || gamma === null) return baseColor;
  const gammaValue = parseFloat(gamma);
  if (Number.isNaN(gammaValue) || gammaValue <= 0) return baseColor;

  const normalized = normalizeHex(baseColor);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  // Apply gamma correction: output = (input / 255) ^ (1 / gamma) * 255
  const gammaCorrection = 1 / gammaValue;
  const applyGammaToChannel = (channel) => {
    const normalized = channel / 255;
    const corrected = Math.pow(normalized, gammaCorrection);
    return Math.round(Math.max(0, Math.min(255, corrected * 255)));
  };

  const correctedR = applyGammaToChannel(r);
  const correctedG = applyGammaToChannel(g);
  const correctedB = applyGammaToChannel(b);

  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(correctedR)}${toHex(correctedG)}${toHex(correctedB)}`;
}

/**
 * Applies V1 lightness and saturation adjustments to a base color
 * @param {string} baseColor - Base hex color (#RRGGBB)
 * @param {number|string} lightness - Lightness adjustment (-100 to 100)
 * @param {number|string} saturation - Saturation adjustment (-100 to 100)
 * @returns {string} Adjusted hex color (#RRGGBB)
 */
export function applyHslAdjustments(baseColor, lightness, saturation) {
  const normalized = normalizeHex(baseColor);
  let { h, s, l } = hexToHsl(normalized);

  s = applyHslComponent(s, saturation);
  l = applyHslComponent(l, lightness);

  return hslToHex(h, s, l);
}

/**
 * Normalizes hex color to 6-digit format (#RRGGBB)
 * @param {string} hex - Hex color string (may be 3 or 6 digits)
 * @returns {string} Normalized 6-digit hex color (#RRGGBB)
 */
export const normalizeHex = (hex) => {
  if (!hex || typeof hex !== "string") {
    return "#000000";
  }

  let normalized = hex.trim().toLowerCase();

  // Remove # if present
  if (normalized.startsWith("#")) {
    normalized = normalized.slice(1);
  }

  // Handle 3-digit hex
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Ensure 6 digits and validate hex characters
  if (normalized.length !== 6 || !/^[0-9a-f]{6}$/.test(normalized)) {
    return "#000000";
  }

  return `#${normalized}`;
};

/**
 * Extracts color from V1 styler object, applying HSL adjustments if present
 * When an explicit color is present in the styler, HSL adjustments from the same styler object
 * are applied to modify the explicit color. External HSL adjustments (from feature-level rules)
 * are then applied after styler-level adjustments.
 * @param {Object} styler - V1 styler object
 * @param {Object} externalAdjustments - Optional external HSL adjustments to apply {saturation?: number, lightness?: number}
 * @returns {string|null} Hex color string (#RRGGBB) or null if no color specified and no HSL adjustments
 */
export const extractColor = (styler, externalAdjustments = null) => {
  const hasExplicitColor = styler?.color !== undefined && styler.color !== null;
  const hasHslAdjustments =
    styler?.lightness !== undefined || styler?.saturation !== undefined;
  const hasExternalAdjustments =
    externalAdjustments &&
    (externalAdjustments.saturation !== undefined ||
      externalAdjustments.lightness !== undefined);

  if (!hasExplicitColor && !hasHslAdjustments && !hasExternalAdjustments) {
    return null;
  }

  // If no explicit color but only HSL adjustments, we can't extract a color
  if (!hasExplicitColor && (hasHslAdjustments || hasExternalAdjustments)) {
    return null;
  }

  // Use explicit color as base
  let color = normalizeHex(styler.color);

  // Check if base color is pure black or white - these should be preserved unless
  // there are HSL adjustments in the same styler
  const isPureBlack = color === "#000000";
  const isPureWhite = color === "#ffffff";
  const isPureBlackOrWhite = isPureBlack || isPureWhite;

  // Apply HSL adjustments from the same styler object to the explicit color
  if (hasHslAdjustments) {
    // Apply saturation adjustment - in V1, adding saturation to greyscale colors makes them colorful
    color = applyHslAdjustments(color, styler.lightness, styler.saturation);
  }

  // Apply external HSL adjustments (from feature-level rules) after styler-level adjustments
  // Skip external adjustments for pure black/white colors unless there were HSL adjustments in the same styler
  // This preserves explicit black/white colors from being modified by parent feature adjustments
  if (hasExternalAdjustments && (!isPureBlackOrWhite || hasHslAdjustments)) {
    // Apply saturation adjustment - in V1, adding saturation to greyscale colors makes them colorful
    color = applyHslAdjustments(
      color,
      externalAdjustments.lightness,
      externalAdjustments.saturation
    );
  }

  return color;
};
