/**
 * Feature property whitelist
 * Defines which properties are valid for each V2 feature ID
 * Based on cbms-json-schema.json
 */

/**
 * Valid geometry properties for each feature type
 * @type {Readonly<Object.<string, string[]>>}
 */
const geometryProperties = Object.freeze({
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
  // pointOfInterest.entertainment.touristAttraction - no geometry, only labels
  "pointOfInterest.entertainment.touristAttraction": [], // Explicitly no geometry

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
  "natural.land.landCover": ["visible", "fillColor", "fillOpacity"],
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
  "infrastructure.building": [
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
});

/**
 * Valid label properties for each feature type
 * @type {Readonly<Object.<string, string[]>>}
 */
const labelProperties = Object.freeze({
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
  "pointOfInterest.entertainment.touristAttraction": [
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
  "infrastructure.building": [
    "visible",
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
});

/**
 * Gets parent feature IDs for a given feature ID
 * @param {string} featureId - V2 feature ID
 * @returns {string[]} Array of parent feature IDs (most specific first)
 */
function getParentFeatureIds(featureId) {
  const parts = featureId.split(".");
  const parents = [];
  for (let i = parts.length - 1; i > 0; i--) {
    parents.push(parts.slice(0, i).join("."));
  }
  return parents;
}

/**
 * Checks if a property is valid for a feature by checking the feature and its parents
 * @param {Object.<string, string[]>} propertiesMap - Map of feature IDs to valid properties
 * @param {string} featureId - V2 feature ID
 * @param {string} property - Property name
 * @returns {boolean} True if valid
 */
function isValidProperty(propertiesMap, featureId, property) {
  if (propertiesMap[featureId]?.includes(property)) {
    return true;
  }

  const parents = getParentFeatureIds(featureId);
  return parents.some((parentId) =>
    propertiesMap[parentId]?.includes(property)
  );
}

/**
 * Checks if a geometry property is valid for a feature
 * @param {string} featureId - V2 feature ID
 * @param {string} property - Property name
 * @returns {boolean} True if valid
 */
export function isValidGeometryProperty(featureId, property) {
  return isValidProperty(geometryProperties, featureId, property);
}

/**
 * Checks if a label property is valid for a feature
 * @param {string} featureId - V2 feature ID
 * @param {string} property - Property name
 * @returns {boolean} True if valid
 */
export function isValidLabelProperty(featureId, property) {
  return isValidProperty(labelProperties, featureId, property);
}

/**
 * Checks if a feature supports properties from a given map
 * @param {Object.<string, string[]>} propertiesMap - Map of feature IDs to valid properties
 * @param {string} featureId - V2 feature ID
 * @returns {boolean} True if feature supports properties
 */
function supportsProperties(propertiesMap, featureId) {
  if (Object.hasOwn(propertiesMap, featureId)) {
    const props = propertiesMap[featureId];
    return Array.isArray(props) && props.length > 0;
  }

  const parents = getParentFeatureIds(featureId);
  return parents.some((parentId) => {
    if (Object.hasOwn(propertiesMap, parentId)) {
      const props = propertiesMap[parentId];
      return Array.isArray(props) && props.length > 0;
    }
    return false;
  });
}

/**
 * Checks if a feature supports label properties
 * @param {string} featureId - V2 feature ID
 * @returns {boolean} True if feature supports labels
 */
export function supportsLabel(featureId) {
  return supportsProperties(labelProperties, featureId);
}

/**
 * Checks if a feature supports geometry properties
 * @param {string} featureId - V2 feature ID
 * @returns {boolean} True if feature supports geometry
 */
export function supportsGeometry(featureId) {
  return supportsProperties(geometryProperties, featureId);
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

  if (!hasGeometry && hasLabel) {
    style.label ??= {};
    return;
  }

  if (hasGeometry && !hasLabel) {
    style.geometry ??= {};
    return;
  }

  if (hasGeometry && hasLabel) {
    const isAll = !elementType || elementType === "all";
    if (isAll) {
      style.geometry ??= {};
      style.label ??= {};
    } else if (elementType.startsWith("geometry")) {
      style.geometry ??= {};
    } else if (elementType.startsWith("labels")) {
      style.label ??= {};
    }
  }
}
