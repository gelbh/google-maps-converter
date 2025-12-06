/**
 * Snazzy Maps API Service
 * Handles fetching styles from the Snazzy Maps API
 */

const API_BASE_URL = "https://snazzymaps.com/explore.json";

/**
 * Gets the API key from environment variables
 * Vite exposes environment variables prefixed with VITE_ to the browser
 *
 * According to Snazzy Maps API documentation, the API key is required
 * and can be passed either as a query parameter (key) or header (X-ApiKey).
 * We use the query parameter to avoid CORS preflight issues.
 */
const getApiKey = () => {
  const apiKey = import.meta.env.VITE_SNAZZY_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_SNAZZY_MAPS_API_KEY is not set. Please set it in your .env file."
    );
  }
  return apiKey;
};

/**
 * Builds URLSearchParams with API key and optional parameters
 * @param {Object} options - Query parameters
 * @returns {URLSearchParams} Configured URLSearchParams
 */
const buildSearchParams = (options) => {
  const params = new URLSearchParams();
  params.append("key", getApiKey());

  if (options.sort) params.append("sort", options.sort);
  if (options.text) params.append("text", options.text);
  if (options.page) params.append("page", options.page.toString());
  if (options.pageSize) params.append("pageSize", options.pageSize.toString());

  if (options.tag) {
    const tags = Array.isArray(options.tag) ? options.tag : [options.tag];
    tags.filter(Boolean).forEach((t) => params.append("tag", t));
  }

  if (options.color) {
    const colors = Array.isArray(options.color)
      ? options.color
      : [options.color];
    colors.filter(Boolean).forEach((c) => params.append("color", c));
  }

  return params;
};

/**
 * Handles API response and extracts error message
 * @param {Response} response - Fetch response
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If response is not OK
 */
const handleApiResponse = async (response) => {
  if (!response.ok) {
    throw new Error(
      `Snazzy Maps API error: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
};

/**
 * Fetches styles from Snazzy Maps API
 * @param {Object} options - Query parameters
 * @param {string} [options.sort] - Sort order (e.g., 'popular', 'newest', 'alphabetical')
 * @param {string|string[]} [options.tag] - Filter by tag(s) - can be single tag or array
 * @param {string|string[]} [options.color] - Filter by color(s) - can be single color or array
 * @param {string} [options.text] - Search text
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.pageSize=12] - Number of styles per page
 * @returns {Promise<Object>} API response with styles array
 */
export async function fetchStyles(options = {}) {
  const params = buildSearchParams({
    ...options,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 12,
  });

  try {
    const data = await handleApiResponse(
      await fetch(`${API_BASE_URL}?${params.toString()}`)
    );
    return data;
  } catch (error) {
    throw new Error(
      `Failed to fetch styles from Snazzy Maps: ${error.message}`
    );
  }
}

/**
 * Fetches a single style by ID
 * @param {string|number} styleId - Style ID
 * @returns {Promise<Object>} Style object with parsed JSON
 */
/**
 * Extracts style data from API response, handling different response structures
 * @param {Object|Array} data - API response data
 * @returns {Object} Style data object
 */
const extractStyleData = (data) => {
  if (Array.isArray(data)) {
    return data[0] ?? data;
  }
  if (data?.results && Array.isArray(data.results)) {
    return data.results[0] ?? data;
  }
  if (data?.data) {
    return data.data;
  }
  return data;
};

export async function fetchStyleById(styleId) {
  try {
    const params = new URLSearchParams();
    params.append("key", getApiKey());
    params.append("id", styleId.toString());

    const data = await handleApiResponse(
      await fetch(`${API_BASE_URL}?${params.toString()}`)
    );

    const styleData = extractStyleData(data);

    if (styleData?.json) {
      try {
        styleData.parsedJson = JSON.parse(styleData.json);
      } catch (parseError) {
        console.warn(`Failed to parse JSON for style ${styleId}:`, parseError);
      }
    }

    return styleData ?? data;
  } catch (error) {
    throw new Error(
      `Failed to fetch style ${styleId} from Snazzy Maps: ${error.message}`
    );
  }
}

/**
 * Parses the JSON field from a style response
 * @param {Object} style - Style object from API
 * @returns {Object|null} Parsed V1 style JSON or null if parsing fails
 */
export function parseStyleJson(style) {
  if (!style?.json) {
    return null;
  }

  try {
    return JSON.parse(style.json);
  } catch (error) {
    console.error("Failed to parse style JSON:", error);
    return null;
  }
}

/**
 * Debounce helper function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Extracts available tags from a list of styles
 * @param {Array} styles - Array of style objects
 * @returns {Array<string>} Array of unique tag names
 */
export function extractTagsFromStyles(styles) {
  const tagsSet = new Set();
  styles.forEach((style) => {
    style?.tags?.forEach((tag) => {
      if (typeof tag === "string") {
        tagsSet.add(tag);
      }
    });
  });
  return Array.from(tagsSet).sort();
}

/**
 * Extracts available colors from a list of styles
 * @param {Array} styles - Array of style objects
 * @returns {Array<string>} Array of unique color names
 */
const COMMON_COLORS = [
  "black",
  "white",
  "gray",
  "grey",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
];

const isColorLike = (tag) => {
  const colorLike = tag.toLowerCase();
  return COMMON_COLORS.some((c) => colorLike.includes(c));
};

export function extractColorsFromStyles(styles) {
  const colorsSet = new Set();
  styles.forEach((style) => {
    if (typeof style?.color === "string") {
      colorsSet.add(style.color);
    }
    style?.tags?.forEach((tag) => {
      if (typeof tag === "string" && isColorLike(tag)) {
        colorsSet.add(tag);
      }
    });
  });
  return Array.from(colorsSet).sort();
}

/**
 * Extracts styles array from API response
 * @param {Object|Array} response - API response
 * @returns {Array} Array of styles
 */
const extractStylesFromResponse = (response) =>
  Array.isArray(response)
    ? response
    : response?.results ?? response?.styles ?? response?.data ?? [];

export async function fetchAvailableFilters(maxPages = 5) {
  const tagsSet = new Set();
  const colorsSet = new Set();

  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await fetchStyles({
        sort: "popular",
        page,
        pageSize: 50,
      });

      const styles = extractStylesFromResponse(response);
      if (styles.length === 0) break;

      extractTagsFromStyles(styles).forEach((tag) => tagsSet.add(tag));
      extractColorsFromStyles(styles).forEach((color) => colorsSet.add(color));
    }
  } catch (error) {
    console.warn("Failed to fetch all filter options:", error);
  }

  return {
    tags: Array.from(tagsSet).sort(),
    colors: Array.from(colorsSet).sort(),
  };
}
