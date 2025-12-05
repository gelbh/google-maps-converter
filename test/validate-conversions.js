#!/usr/bin/env node
/**
 * CLI test suite for V1 to V2 conversion validation
 * Fetches styles from Snazzy Maps API, converts them, validates against schema, and outputs TAP format
 */

// Load environment variables from .env file if available
// Environment variables can also be set directly via the system
import dotenv from "dotenv";
dotenv.config();

import { convertV1ToV2 } from "../src/node/converter-node.js";
import {
  validateV2,
  formatValidationErrors,
} from "../src/node/validator-node.js";

const API_BASE_URL = "https://snazzymaps.com/explore.json";

/**
 * Gets the API key from environment variables
 * Checks both SNAZZY_MAPS_API_KEY and VITE_SNAZZY_MAPS_API_KEY
 * (VITE_ prefix is used by browser code, but Node.js can also read it)
 * @returns {string} API key
 * @throws {Error} If API key is not set
 */
function getApiKey() {
  const apiKey =
    process.env.SNAZZY_MAPS_API_KEY ?? process.env.VITE_SNAZZY_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SNAZZY_MAPS_API_KEY or VITE_SNAZZY_MAPS_API_KEY is not set. Please set it in your .env file or as an environment variable."
    );
  }
  return apiKey;
}

/**
 * Fetches styles from Snazzy Maps API
 * @param {Object} options - Query parameters
 * @returns {Promise<Array>} Array of style objects
 */
async function fetchStylesFromAPI(options = {}) {
  const { sort = "popular", page = 1, pageSize = 12 } = options;

  const params = new URLSearchParams();
  // API key is required - use query parameter (consistent with browser code)
  params.append("key", getApiKey());
  if (sort) params.append("sort", sort);
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

    return Array.isArray(data)
      ? data
      : data?.results ?? data?.styles ?? data?.data ?? [];
  } catch (error) {
    throw new Error(
      `Failed to fetch styles from Snazzy Maps: ${error.message}`
    );
  }
}

/**
 * Fetches a list of popular styles from Snazzy Maps API for testing
 * @returns {Promise<Array>} Array of style objects with id and name
 */
async function getV1ExampleStyles() {
  try {
    const styles = await fetchStylesFromAPI({
      sort: "popular",
      page: 1,
      pageSize: 10, // Test with first 10 popular styles
    });

    if (styles.length === 0) {
      throw new Error("No styles found from Snazzy Maps API");
    }

    return styles;
  } catch (error) {
    console.error(`Error fetching styles from API: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Loads and parses V1 JSON from a style object
 * @param {Object} style - Style object from API with json field
 * @returns {Promise<Object>} Parsed V1 JSON object
 */
async function loadV1JsonFromStyle(style) {
  if (!style?.json) {
    throw new Error("Style does not contain JSON data");
  }

  try {
    return typeof style.json === "string" ? JSON.parse(style.json) : style.json;
  } catch (error) {
    throw new Error(`Failed to load V1 JSON from style: ${error.message}`);
  }
}

/**
 * Gets the value at a JSON path
 * @param {Object} obj - Object to traverse
 * @param {string} path - JSON path (e.g., "/styles/3/id")
 * @returns {*} Value at path or undefined
 */
function getValueAtPath(obj, path) {
  if (!path || path === "/") return obj;

  const parts = path.split("/").filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;
    const index = parseInt(part, 10);
    current = !isNaN(index) ? current[index] : current[part];
  }

  return current;
}

/**
 * Formats error details as YAML for TAP output
 * @param {string} message - Error message
 * @param {Array} errors - Validation errors (optional)
 * @param {Object} v2Json - V2 JSON object for context (optional)
 * @returns {string} YAML-formatted error block
 */
function extractFeatureId(v2Json, path) {
  if (!v2Json || !path) return undefined;

  const styleMatch = path.match(/^\/styles\/(\d+)\//);
  if (styleMatch) {
    const styleIndex = parseInt(styleMatch[1], 10);
    return v2Json.styles?.[styleIndex]?.id;
  }
  return undefined;
}

function formatErrorYaml(message, errors = null, v2Json = null) {
  const lines = [`  ---`, `  message: ${JSON.stringify(message)}`];

  if (errors?.length) {
    lines.push(`  errors:`);
    for (const error of errors) {
      const path = error.instancePath ?? error.schemaPath ?? "";
      const errorMsg = error.message ?? "Validation error";
      const actualValue =
        v2Json && path ? getValueAtPath(v2Json, path) : undefined;
      const featureId = extractFeatureId(v2Json, path);

      lines.push(`    - path: ${JSON.stringify(path)}`);
      lines.push(`      message: ${JSON.stringify(errorMsg)}`);

      if (featureId !== undefined) {
        lines.push(`      featureId: ${JSON.stringify(featureId)}`);
      }

      if (actualValue !== undefined) {
        lines.push(`      actualValue: ${JSON.stringify(actualValue)}`);
      }
    }
  }

  lines.push(`  ...`);
  return lines.join("\n");
}

/**
 * Main test execution
 */
async function runTests() {
  const styles = await getV1ExampleStyles();

  if (styles.length === 0) {
    console.error("No styles found from Snazzy Maps API");
    process.exit(1);
  }

  console.log("TAP version 13");
  console.log(`1..${styles.length}`);

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    const styleName = style.name ?? `Style #${style.id}`;
    const styleId = style.id;
    const testNumber = i + 1;

    try {
      // Load V1 JSON from style
      const v1Json = await loadV1JsonFromStyle(style);

      // Convert to V2
      let v2Json;
      try {
        v2Json = convertV1ToV2(v1Json);
      } catch (error) {
        console.log(`not ok ${testNumber} - ${styleName} (conversion failed)`);
        console.log(formatErrorYaml(`Conversion error: ${error.message}`));
        failCount++;
        failures.push({
          style: styleName,
          styleId: styleId,
          error: error.message,
        });
        continue;
      }

      // Validate against schema
      const validation = await validateV2(v2Json);

      if (validation.valid) {
        console.log(`ok ${testNumber} - ${styleName}`);
        passCount++;
      } else {
        console.log(`not ok ${testNumber} - ${styleName} (validation failed)`);
        console.log(
          formatErrorYaml("Validation failed", validation.errors, v2Json)
        );
        failCount++;
        failures.push({
          style: styleName,
          styleId: styleId,
          errors: validation.errors,
          v2Json: v2Json,
        });
      }
    } catch (error) {
      console.log(`not ok ${testNumber} - ${styleName} (error)`);
      console.log(formatErrorYaml(`Test error: ${error.message}`));
      failCount++;
      failures.push({
        style: styleName,
        styleId: styleId,
        error: error.message,
      });
    }
  }

  // Summary
  console.log("");
  console.log(`# tests ${styles.length}`);
  console.log(`# pass  ${passCount}`);
  console.log(`# fail  ${failCount}`);

  if (failCount > 0) {
    console.log("");
    console.log("# Failed tests:");
    for (const failure of failures) {
      const styleName = failure.style || `Style #${failure.styleId}`;
      console.log(`#   - ${styleName} (ID: ${failure.styleId})`);
      if (failure.error) {
        console.log(`#     Error: ${failure.error}`);
      }
      if (failure.errors) {
        console.log(`#     Validation errors:`);
        for (const error of failure.errors) {
          const path = error.instancePath ?? error.schemaPath ?? "";
          const errorMsg = error.message ?? "Validation error";
          const featureId = extractFeatureId(failure.v2Json, path);

          let errorLine = `#       ${path}: ${errorMsg}`;
          if (featureId !== undefined) {
            errorLine += ` (feature: ${featureId})`;
          }
          console.log(errorLine);
        }
      }
    }
    process.exit(1);
  }

  process.exit(0);
}

// Run tests
runTests().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
