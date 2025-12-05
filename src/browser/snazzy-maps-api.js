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
 * @param {string} [options.sort] - Sort order (e.g., 'popular', 'newest')
 * @param {string} [options.tag] - Filter by tag
 * @param {string} [options.color] - Filter by color
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
  if (tag) params.append("tag", tag);
  if (color) params.append("color", color);
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

    // The API returns styles with a 'json' field containing the V1 style JSON as a string
    if (data && data.json) {
      try {
        data.parsedJson = JSON.parse(data.json);
      } catch (parseError) {
        console.warn(`Failed to parse JSON for style ${styleId}:`, parseError);
      }
    }

    return data;
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
