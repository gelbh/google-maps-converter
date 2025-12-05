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
function getApiKey() {
  const apiKey = import.meta.env.VITE_SNAZZY_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_SNAZZY_MAPS_API_KEY is not set. Please set it in your .env file."
    );
  }
  return apiKey;
}

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
  const { sort, tag, color, text, page = 1, pageSize = 12 } = options;

  const params = new URLSearchParams();
  // API key is required - use query parameter to avoid CORS preflight issues
  params.append("key", getApiKey());
  if (sort) params.append("sort", sort);
  // Handle multiple tags/colors - API may support comma-separated or multiple params
  if (tag) {
    const tags = Array.isArray(tag) ? tag : [tag];
    tags.forEach((t) => {
      if (t) params.append("tag", t);
    });
  }
  if (color) {
    const colors = Array.isArray(color) ? color : [color];
    colors.forEach((c) => {
      if (c) params.append("color", c);
    });
  }
  if (text) params.append("text", text);
  params.append("page", page.toString());
  params.append("pageSize", pageSize.toString());

  const url = `${API_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Snazzy Maps API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
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
export async function fetchStyleById(styleId) {
  try {
    // API key is required - use query parameter to avoid CORS preflight issues
    const params = new URLSearchParams();
    params.append("key", getApiKey());
    params.append("id", styleId.toString());
    const response = await fetch(`${API_BASE_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(
        `Snazzy Maps API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Handle different response structures
    let styleData = data;
    if (Array.isArray(data)) {
      styleData = data[0] || data;
    } else if (data.results && Array.isArray(data.results)) {
      styleData = data.results[0] || data;
    } else if (data.data) {
      styleData = data.data;
    }

    // The API returns styles with a 'json' field containing the V1 style JSON as a string
    if (styleData && styleData.json) {
      try {
        styleData.parsedJson = JSON.parse(styleData.json);
      } catch (parseError) {
        console.warn(
          `Failed to parse JSON for style ${styleId}:`,
          parseError
        );
      }
    }

    return styleData || data;
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
  if (!style || !style.json) {
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
    if (style.tags && Array.isArray(style.tags)) {
      style.tags.forEach((tag) => {
        if (tag && typeof tag === "string") {
          tagsSet.add(tag);
        }
      });
    }
  });
  return Array.from(tagsSet).sort();
}

/**
 * Extracts available colors from a list of styles
 * @param {Array} styles - Array of style objects
 * @returns {Array<string>} Array of unique color names
 */
export function extractColorsFromStyles(styles) {
  const colorsSet = new Set();
  styles.forEach((style) => {
    if (style.color && typeof style.color === "string") {
      colorsSet.add(style.color);
    }
    // Also check for colors in tags if they follow a pattern
    if (style.tags && Array.isArray(style.tags)) {
      style.tags.forEach((tag) => {
        // Check if tag looks like a color (basic heuristic)
        const colorLike = tag.toLowerCase();
        const commonColors = [
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
        if (commonColors.some((c) => colorLike.includes(c))) {
          colorsSet.add(tag);
        }
      });
    }
  });
  return Array.from(colorsSet).sort();
}

/**
 * Fetches a larger set of styles to extract available tags and colors
 * Note: This is a helper that fetches multiple pages to build a comprehensive list
 * @param {number} [maxPages=5] - Maximum number of pages to fetch
 * @returns {Promise<{tags: Array<string>, colors: Array<string>}>}
 */
export async function fetchAvailableFilters(maxPages = 5) {
  const tagsSet = new Set();
  const colorsSet = new Set();

  try {
    // Fetch multiple pages to get a good sample
    for (let page = 1; page <= maxPages; page++) {
      const response = await fetchStyles({
        sort: "popular",
        page,
        pageSize: 50,
      });

      const styles = Array.isArray(response)
        ? response
        : response.results || response.styles || response.data || [];

      if (styles.length === 0) break;

      // Extract tags and colors
      const tags = extractTagsFromStyles(styles);
      const colors = extractColorsFromStyles(styles);

      tags.forEach((tag) => tagsSet.add(tag));
      colors.forEach((color) => colorsSet.add(color));
    }
  } catch (error) {
    console.warn("Failed to fetch all filter options:", error);
  }

  return {
    tags: Array.from(tagsSet).sort(),
    colors: Array.from(colorsSet).sort(),
  };
}
