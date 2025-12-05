/**
 * Mapping rules for converting Google Maps V1 style JSON to V2 CBMS format
 * Maps featureType and elementType from V1 to V2 structure
 */

/**
 * Maps V1 featureType to V2 id
 * @type {Object.<string, string|string[]>}
 */
const featureTypeMap = {
  poi: "pointOfInterest",
  "poi.attraction": "pointOfInterest.attraction",
  "poi.business": "pointOfInterest.business",
  "poi.government": "pointOfInterest.government",
  "poi.medical": "pointOfInterest.medical",
  "poi.park": "pointOfInterest.recreation.park",
  "poi.place_of_worship": "pointOfInterest.placeOfWorship",
  "poi.school": "pointOfInterest.school",
  "poi.sports_complex": "pointOfInterest.sportsComplex",
  administrative: "political",
  "administrative.country": "political.countryOrRegion",
  "administrative.locality": "political.city",
  "administrative.neighborhood": "political.neighborhood",
  "administrative.land_parcel": "political.landParcel",
  "administrative.province": "political.stateOrProvince",
  road: "infrastructure.roadNetwork.road",
  "road.highway": "infrastructure.roadNetwork.road.highway",
  "road.arterial": "infrastructure.roadNetwork.road.arterial",
  "road.local": "infrastructure.roadNetwork.road.local",
  landscape: "natural.land",
  "landscape.man_made": "natural.land.manMade",
  "landscape.natural": "natural.land.natural",
  water: "natural.water",
  transit: "infrastructure.transit",
  "transit.line": "infrastructure.transit.line",
  "transit.station": "infrastructure.transit.station",
  "transit.station.airport": "infrastructure.transit.station.airport",
  "transit.station.bus": "infrastructure.transit.station.bus",
  "transit.station.rail": "infrastructure.transit.station.rail",
};

/**
 * Maps V1 elementType to V2 property paths
 * @type {Object.<string, string>}
 */
const elementTypeMap = {
  "geometry.fill": "geometry.fillColor",
  "geometry.stroke": "geometry.strokeColor",
  geometry: "geometry.color",
  "labels.text.fill": "label.textFillColor",
  "labels.text.stroke": "label.textStrokeColor",
  "labels.icon": "label.pinFillColor",
  labels: "label.visible",
  "labels.text": "label.visible",
};

/**
 * Maps V1 visibility values to V2 boolean
 * @type {Object.<string, boolean>}
 */
const visibilityMap = {
  on: true,
  off: false,
  simplified: true,
};

/**
 * Gets V2 id from V1 featureType
 * @param {string} featureType - V1 featureType
 * @returns {string|string[]|null} V2 id(s) or null if not mapped
 */
function getV2Id(featureType) {
  if (!featureType || featureType === "all") {
    return null; // 'all' needs special handling
  }
  return featureTypeMap[featureType] || null;
}

/**
 * Gets V2 property path from V1 elementType
 * @param {string} elementType - V1 elementType
 * @returns {string|null} V2 property path or null if not mapped
 */
function getV2PropertyPath(elementType) {
  if (!elementType || elementType === "all") {
    return null; // 'all' needs special handling
  }
  return elementTypeMap[elementType] || null;
}

/**
 * Gets V2 visibility boolean from V1 visibility value
 * @param {string} visibility - V1 visibility value
 * @returns {boolean|null} V2 visibility boolean or null if not mapped
 */
function getV2Visibility(visibility) {
  if (visibility === undefined || visibility === null) {
    return null;
  }
  const normalized = String(visibility).toLowerCase();
  return visibilityMap[normalized] !== undefined
    ? visibilityMap[normalized]
    : null;
}

/**
 * Gets all V2 ids that should be affected by 'all' featureType
 * @returns {string[]} Array of all V2 ids
 */
function getAllV2Ids() {
  return Object.values(featureTypeMap).filter((id) => typeof id === "string");
}

/**
 * Checks if a V1 featureType is mapped to V2
 * @param {string} featureType - V1 featureType
 * @returns {boolean} True if mapped
 */
function isFeatureTypeMapped(featureType) {
  return featureType !== "all" && featureTypeMap.hasOwnProperty(featureType);
}

/**
 * Checks if a V1 elementType is mapped to V2
 * @param {string} elementType - V1 elementType
 * @returns {boolean} True if mapped
 */
function isElementTypeMapped(elementType) {
  return elementType !== "all" && elementTypeMap.hasOwnProperty(elementType);
}
