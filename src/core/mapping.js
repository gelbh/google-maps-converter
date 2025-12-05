/**
 * Mapping rules for converting Google Maps V1 style JSON to V2 CBMS format
 * Maps featureType and elementType from V1 to V2 structure
 */

/**
 * Maps V1 featureType to V2 id
 * Only includes feature IDs that exist in the schema
 * @type {Object.<string, string|string[]>}
 */
const featureTypeMap = {
  poi: "pointOfInterest",
  "poi.park": "pointOfInterest.recreation.park",
  "poi.sports_complex": "pointOfInterest.recreation.sportsComplex",
  "poi.place_of_worship": "pointOfInterest.other.placeOfWorship",
  "poi.school": "pointOfInterest.other.school",
  "poi.government": "pointOfInterest.other.government",
  "poi.medical": "pointOfInterest.emergency.hospital",
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
  water: "natural.water",
  transit: "infrastructure.transitStation",
  "transit.station": "infrastructure.transitStation",
  "transit.station.airport": "pointOfInterest.transit.airport",
  "transit.station.bus": "infrastructure.transitStation.busStation",
  "transit.station.rail": "infrastructure.transitStation.railStation",
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
export function getV2Id(featureType) {
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
export function getV2PropertyPath(elementType) {
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
export function getV2Visibility(visibility) {
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
export function getAllV2Ids() {
  return Object.values(featureTypeMap).filter((id) => typeof id === "string");
}

/**
 * Checks if a V1 featureType is mapped to V2
 * @param {string} featureType - V1 featureType
 * @returns {boolean} True if mapped
 */
export function isFeatureTypeMapped(featureType) {
  return featureType !== "all" && featureTypeMap.hasOwnProperty(featureType);
}

/**
 * Checks if a V1 elementType is mapped to V2
 * @param {string} elementType - V1 elementType
 * @returns {boolean} True if mapped
 */
export function isElementTypeMapped(elementType) {
  return elementType !== "all" && elementTypeMap.hasOwnProperty(elementType);
}
