/**
 * Feature property whitelist
 * Defines which properties are valid for each V2 feature ID
 * Based on cbms-json-schema.json
 */

/**
 * Valid geometry properties for each feature type
 * @type {Object.<string, string[]>}
 */
const geometryProperties = {
  // pointOfInterest and sub-features
  pointOfInterest: ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.emergency": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.entertainment": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.foodAndDrink": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.landmark": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.lodging": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.recreation": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.retail": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.service": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.transit": ["visible", "fillColor", "fillOpacity"],
  "pointOfInterest.other": ["visible", "fillColor", "fillOpacity"],
  // pointOfInterest.other.placeOfWorship, .school, .government - no geometry, only labels
  "pointOfInterest.other.placeOfWorship": [], // Explicitly no geometry
  "pointOfInterest.other.school": [], // Explicitly no geometry
  "pointOfInterest.other.government": [], // Explicitly no geometry

  // political and sub-features
  political: ["visible", "fillColor"],
  // political.countryOrRegion, political.city, political.neighborhood - no geometry, only labels
  "political.countryOrRegion": [], // Explicitly no geometry
  "political.city": [], // Explicitly no geometry
  "political.neighborhood": [], // Explicitly no geometry
  "political.border": ["visible", "color"],
  "political.reservation": ["visible", "fillColor"],
  "political.stateOrProvince": ["visible", "fillColor"],
  "political.sublocality": ["visible", "fillColor"],
  "political.landParcel": [
    "visible",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],

  // natural features
  "natural.continent": ["visible", "fillColor", "fillOpacity"],
  "natural.archipelago": ["visible", "fillColor", "fillOpacity"],
  "natural.island": ["visible", "fillColor", "fillOpacity"],
  "natural.land": ["visible", "fillColor", "fillOpacity"],
  "natural.water": ["visible", "fillColor", "fillOpacity"],
  "natural.base": ["visible", "fillColor", "fillOpacity"],

  // infrastructure.roadNetwork.road and sub-features
  "infrastructure.roadNetwork.road": [
    "visible",
    "fillColor",
    "fillOpacity",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],
  "infrastructure.roadNetwork.road.highway": [
    "visible",
    "fillColor",
    "fillOpacity",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],
  "infrastructure.roadNetwork.road.arterial": [
    "visible",
    "fillColor",
    "fillOpacity",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],
  "infrastructure.roadNetwork.road.local": [
    "visible",
    "fillColor",
    "fillOpacity",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],

  // infrastructure (general)
  infrastructure: [
    "visible",
    "fillColor",
    "fillOpacity",
    "strokeColor",
    "strokeOpacity",
    "strokeWeight",
  ],
  // infrastructure.transitStation and sub-features - no geometry, only labels
  "infrastructure.transitStation": [], // Explicitly no geometry
  "infrastructure.transitStation.busStation": [], // Explicitly no geometry
  "infrastructure.transitStation.railStation": [], // Explicitly no geometry
};

/**
 * Valid label properties for each feature type
 * @type {Object.<string, string[]>}
 */
const labelProperties = {
  // pointOfInterest and sub-features support pinFillColor
  pointOfInterest: [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.emergency": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.entertainment": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.foodAndDrink": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.landmark": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.lodging": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.recreation": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.retail": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.service": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.transit": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.other": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.other.placeOfWorship": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.other.school": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "pointOfInterest.other.government": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],

  // political and sub-features support pinFillColor
  political: [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.countryOrRegion": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.stateOrProvince": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.city": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.sublocality": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.neighborhood": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "political.landParcel": [], // Explicitly no label

  // infrastructure.roadNetwork.road does NOT support pinFillColor
  "infrastructure.roadNetwork.road": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "infrastructure.roadNetwork.road.highway": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "infrastructure.roadNetwork.road.arterial": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "infrastructure.roadNetwork.road.local": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],

  // infrastructure (general)
  infrastructure: [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],

  // natural.water supports labels
  "natural.water": [
    "visible",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],

  // infrastructure.transitStation and sub-features
  "infrastructure.transitStation": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "infrastructure.transitStation.busStation": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
  "infrastructure.transitStation.railStation": [
    "visible",
    "pinFillColor",
    "textFillColor",
    "textFillOpacity",
    "textStrokeColor",
    "textStrokeOpacity",
  ],
};

/**
 * Checks if a geometry property is valid for a feature
 * @param {string} featureId - V2 feature ID
 * @param {string} property - Property name
 * @returns {boolean} True if valid
 */
export function isValidGeometryProperty(featureId, property) {
  // Check exact match first
  if (geometryProperties[featureId]) {
    return geometryProperties[featureId].includes(property);
  }

  // Check parent features (e.g., pointOfInterest.recreation.park -> pointOfInterest.recreation -> pointOfInterest)
  const parts = featureId.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentId = parts.slice(0, i).join(".");
    if (geometryProperties[parentId]) {
      return geometryProperties[parentId].includes(property);
    }
  }

  return false;
}

/**
 * Checks if a label property is valid for a feature
 * @param {string} featureId - V2 feature ID
 * @param {string} property - Property name
 * @returns {boolean} True if valid
 */
export function isValidLabelProperty(featureId, property) {
  // Check exact match first
  if (labelProperties[featureId]) {
    return labelProperties[featureId].includes(property);
  }

  // Check parent features (e.g., pointOfInterest.recreation.park -> pointOfInterest.recreation -> pointOfInterest)
  const parts = featureId.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentId = parts.slice(0, i).join(".");
    if (labelProperties[parentId]) {
      return labelProperties[parentId].includes(property);
    }
  }

  return false;
}

/**
 * Checks if a feature supports label properties
 * @param {string} featureId - V2 feature ID
 * @returns {boolean} True if feature supports labels
 */
export function supportsLabel(featureId) {
  // Check exact match first - if explicitly set to empty array, return false
  if (labelProperties.hasOwnProperty(featureId)) {
    const props = labelProperties[featureId];
    // If it's an empty array or null, explicitly no label support
    if (Array.isArray(props) && props.length === 0) {
      return false;
    }
    if (props === null || props === undefined) {
      return false;
    }
    return true;
  }

  // Check parent features
  const parts = featureId.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentId = parts.slice(0, i).join(".");
    if (labelProperties.hasOwnProperty(parentId)) {
      const props = labelProperties[parentId];
      // If parent explicitly has no labels (empty array), return false
      if (Array.isArray(props) && props.length === 0) {
        return false;
      }
      if (props === null || props === undefined) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Checks if a feature supports geometry properties
 * @param {string} featureId - V2 feature ID
 * @returns {boolean} True if feature supports geometry
 */
export function supportsGeometry(featureId) {
  // Check exact match first - if explicitly set to empty array, return false
  if (geometryProperties.hasOwnProperty(featureId)) {
    const props = geometryProperties[featureId];
    // If it's an empty array or null, explicitly no geometry support
    if (Array.isArray(props) && props.length === 0) {
      return false;
    }
    if (props === null || props === undefined) {
      return false;
    }
    return true;
  }

  // Check parent features
  const parts = featureId.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentId = parts.slice(0, i).join(".");
    if (geometryProperties.hasOwnProperty(parentId)) {
      const props = geometryProperties[parentId];
      // If parent explicitly has no geometry (empty array), return false
      if (Array.isArray(props) && props.length === 0) {
        return false;
      }
      if (props === null || props === undefined) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Maps geometry.color to the appropriate property for a feature
 * @param {string} featureId - V2 feature ID
 * @returns {string} Property name (fillColor, strokeColor, or color)
 */
export function mapGeometryColor(featureId) {
  if (isValidGeometryProperty(featureId, "color")) {
    return "color";
  }
  if (isValidGeometryProperty(featureId, "fillColor")) {
    return "fillColor";
  }
  return "fillColor"; // Default fallback
}

/**
 * Ensures a style object has the required element structure based on feature capabilities
 * For label-only features: ensures label element exists
 * For geometry-only features: ensures geometry element exists
 * For features supporting both: ensures both exist when appropriate
 * @param {Object} style - Style object to ensure elements for
 * @param {string} id - Feature ID
 * @param {string} elementType - V1 elementType (optional, for context)
 */
export function ensureRequiredElements(style, id, elementType) {
  const hasGeometry = supportsGeometry(id);
  const hasLabel = supportsLabel(id);

  // For label-only features, always ensure label exists
  if (!hasGeometry && hasLabel) {
    if (!style.label) {
      style.label = {};
    }
  }

  // For geometry-only features, always ensure geometry exists
  if (hasGeometry && !hasLabel) {
    if (!style.geometry) {
      style.geometry = {};
    }
  }

  // For features supporting both, create elements based on elementType context
  if (hasGeometry && hasLabel) {
    // If elementType is "all" or not specified, create both
    if (!elementType || elementType === "all") {
      if (!style.geometry) {
        style.geometry = {};
      }
      if (!style.label) {
        style.label = {};
      }
    } else if (elementType.startsWith("geometry")) {
      if (!style.geometry) {
        style.geometry = {};
      }
    } else if (elementType.startsWith("labels")) {
      if (!style.label) {
        style.label = {};
      }
    }
  }
}
