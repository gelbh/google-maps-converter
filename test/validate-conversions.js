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
const DEFAULT_TEST_STYLES_COUNT = 10;
const DEFAULT_PAGE_SIZE = 12;

/**
 * Parses command-line arguments to get test count
 * Supports --count=N or --count N or -c N
 * @returns {number} Number of styles to test
 */
export const getTestCount = () => {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--count" || arg === "-c") {
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        const count = Number.parseInt(value, 10);
        if (!Number.isNaN(count) && count > 0) {
          return count;
        }
      }
    } else if (arg.startsWith("--count=")) {
      const count = Number.parseInt(arg.split("=")[1], 10);
      if (!Number.isNaN(count) && count > 0) {
        return count;
      }
    }
  }
  return DEFAULT_TEST_STYLES_COUNT;
};

/**
 * Gets the API key from environment variables
 * Checks both SNAZZY_MAPS_API_KEY and VITE_SNAZZY_MAPS_API_KEY
 * (VITE_ prefix is used by browser code, but Node.js can also read it)
 * @returns {string} API key
 * @throws {Error} If API key is not set
 */
const getApiKey = () => {
  const apiKey =
    process.env.SNAZZY_MAPS_API_KEY ?? process.env.VITE_SNAZZY_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SNAZZY_MAPS_API_KEY or VITE_SNAZZY_MAPS_API_KEY is not set. Please set it in your .env file or as an environment variable."
    );
  }
  return apiKey;
};

/**
 * Fetches styles from Snazzy Maps API
 * @param {Object} options - Query parameters
 * @returns {Promise<Array>} Array of style objects
 */
const fetchStylesFromAPI = async (options = {}) => {
  const { sort = "popular", page = 1, pageSize = DEFAULT_PAGE_SIZE } = options;

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
};

/**
 * Fetches a list of popular styles from Snazzy Maps API for testing
 * @returns {Promise<Array>} Array of style objects with id and name
 */
export const getV1ExampleStyles = async () => {
  try {
    const testCount = getTestCount();
    const styles = await fetchStylesFromAPI({
      sort: "popular",
      page: 1,
      pageSize: testCount,
    });

    if (styles.length === 0) {
      throw new Error("No styles found from Snazzy Maps API");
    }

    return styles;
  } catch (error) {
    console.error(`Error fetching styles from API: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Attempts to clean up common JSON issues
 * Handles JavaScript object syntax, comments, and trailing commas
 * @param {string} jsonString - JSON string to clean
 * @returns {string} Cleaned JSON string
 */
const cleanupJson = (jsonString) => {
  let cleaned = jsonString;
  let result = "";
  let inString = false;
  let escapeNext = false;

  // Remove comments while preserving strings
  // Process character by character to handle strings correctly
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      result += char;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      result += char;
      continue;
    }

    // Check for single-line comment (//)
    if (char === "/" && nextChar === "/") {
      // Skip until end of line (skip the // and everything until newline)
      i += 2; // Skip //
      while (i < cleaned.length && cleaned[i] !== "\n" && cleaned[i] !== "\r") {
        i++;
      }
      // Include the newline if present (don't skip it, let the for loop handle it)
      continue;
    }

    // Check for multi-line comment (/* */)
    if (char === "/" && nextChar === "*") {
      // Skip until */
      i += 2; // Skip /*
      while (i < cleaned.length - 1) {
        if (cleaned[i] === "*" && cleaned[i + 1] === "/") {
          i += 2; // Skip */
          break;
        }
        i++;
      }
      // The for loop will increment i, so we need to decrement to account for that
      // This ensures we process the character after */ correctly
      if (i < cleaned.length) {
        i--;
      }
      continue;
    }

    result += char;
  }

  cleaned = result;

  // Quote unquoted property names
  // Match property names that are valid identifiers but not quoted
  // Pattern: { key: or , key: where key is a valid identifier
  cleaned = cleaned.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g,
    '$1"$2":'
  );

  // Remove trailing commas before closing brackets/braces
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  return cleaned.trim();
};

/**
 * Loads and parses V1 JSON from a style object
 * @param {Object} style - Style object from API with json field
 * @returns {Promise<Object>} Parsed V1 JSON object
 */
export const loadV1JsonFromStyle = async (style) => {
  if (!style?.json) {
    throw new Error("Style does not contain JSON data");
  }

  try {
    if (typeof style.json === "string") {
      // Try parsing as-is first
      try {
        return JSON.parse(style.json);
      } catch (firstError) {
        // If that fails, try cleaning up common issues
        try {
          const cleaned = cleanupJson(style.json);
          return JSON.parse(cleaned);
        } catch (secondError) {
          // If cleanup also fails, throw original error with more context
          throw new Error(
            `Failed to parse JSON: ${firstError.message}. ` +
              `After cleanup attempt: ${secondError.message}. ` +
              `JSON preview: ${style.json.substring(0, 100)}...`
          );
        }
      }
    }
    return style.json;
  } catch (error) {
    throw new Error(`Failed to load V1 JSON from style: ${error.message}`);
  }
};

/**
 * Gets the value at a JSON path
 * @param {Object} obj - Object to traverse
 * @param {string} path - JSON path (e.g., "/styles/3/id")
 * @returns {*} Value at path or undefined
 */
const getValueAtPath = (obj, path) => {
  if (!path || path === "/") return obj;

  const parts = path.split("/").filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;
    const index = Number.parseInt(part, 10);
    current = !Number.isNaN(index) ? current[index] : current[part];
  }

  return current;
};

/**
 * Formats error details as YAML for TAP output
 * @param {string} message - Error message
 * @param {Array} errors - Validation errors (optional)
 * @param {Object} v2Json - V2 JSON object for context (optional)
 * @returns {string} YAML-formatted error block
 */
const extractFeatureId = (v2Json, path) => {
  if (!v2Json || !path) return undefined;

  const styleMatch = path.match(/^\/styles\/(\d+)\//);
  if (styleMatch) {
    const styleIndex = Number.parseInt(styleMatch[1], 10);
    return v2Json.styles?.[styleIndex]?.id;
  }
  return undefined;
};

/**
 * Deduplicates errors and counts occurrences
 * @param {Array} errors - Array of validation errors
 * @param {Object} v2Json - V2 JSON object for context (optional)
 * @returns {Array} Array of deduplicated errors with count property
 */
const deduplicateErrors = (errors, v2Json = null) => {
  if (!errors?.length) return [];

  const errorMap = new Map();

  for (const error of errors) {
    const path = error.instancePath ?? error.schemaPath ?? "";
    const errorMsg = error.message ?? "Validation error";
    const featureId = extractFeatureId(v2Json, path);
    const key = `${path}|${errorMsg}|${featureId ?? ""}`;

    if (errorMap.has(key)) {
      errorMap.get(key).count++;
    } else {
      errorMap.set(key, {
        path,
        message: errorMsg,
        featureId,
        count: 1,
      });
    }
  }

  return Array.from(errorMap.values());
};

const formatErrorYaml = (message, errors = null, v2Json = null) => {
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
};

/**
 * Fetches styles, loads V1 JSON, and converts to V2 for all styles
 * Returns an array of objects with style, v1Json, and v2Json
 * @returns {Promise<Array>} Array of {style, v1Json, v2Json} objects
 */
export const fetchAndConvertStyles = async () => {
  const styles = await getV1ExampleStyles();
  const results = [];

  for (const style of styles) {
    try {
      const v1Json = await loadV1JsonFromStyle(style);
      let v2Json;
      try {
        v2Json = convertV1ToV2(v1Json);
      } catch (error) {
        results.push({
          style,
          v1Json,
          v2Json: null,
          conversionError: error.message,
        });
        continue;
      }
      results.push({
        style,
        v1Json,
        v2Json,
        conversionError: null,
      });
    } catch (error) {
      results.push({
        style,
        v1Json: null,
        v2Json: null,
        loadError: error.message,
      });
    }
  }

  return results;
};

/**
 * Main test execution
 * Uses fetchAndConvertStyles to ensure consistency with similarity tests
 */
const runTests = async () => {
  // Use the same function as similarity tests to ensure consistency
  const results = await fetchAndConvertStyles();

  if (results.length === 0) {
    console.error("No styles found from Snazzy Maps API");
    process.exit(1);
  }

  console.log("TAP version 13");
  console.log(`1..${results.length}`);

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const { style, v1Json, v2Json, conversionError, loadError } = results[i];
    const styleName = style.name ?? `Style #${style.id}`;
    const styleId = style.id;
    const testNumber = i + 1;

    try {
      // Handle errors from fetching/conversion
      if (loadError) {
        console.log(`not ok ${testNumber} - ${styleName} (load failed)`);
        console.log(formatErrorYaml(`Load error: ${loadError}`));
        failCount++;
        failures.push({
          style: styleName,
          styleId: styleId,
          error: loadError,
        });
        continue;
      }

      if (conversionError) {
        console.log(`not ok ${testNumber} - ${styleName} (conversion failed)`);
        console.log(formatErrorYaml(`Conversion error: ${conversionError}`));
        failCount++;
        failures.push({
          style: styleName,
          styleId: styleId,
          error: conversionError,
        });
        continue;
      }

      if (!v1Json || !v2Json) {
        console.log(`not ok ${testNumber} - ${styleName} (missing data)`);
        console.log(formatErrorYaml(`Missing V1 or V2 JSON data`));
        failCount++;
        failures.push({
          style: styleName,
          styleId: styleId,
          error: "Missing V1 or V2 JSON data",
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
  console.log(`# tests ${results.length}`);
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
        const deduplicatedErrors = deduplicateErrors(
          failure.errors,
          failure.v2Json
        );
        for (const error of deduplicatedErrors) {
          let errorLine = `#       ${error.path}: ${error.message}`;
          if (error.featureId !== undefined) {
            errorLine += ` (feature: ${error.featureId})`;
          }
          if (error.count > 1) {
            errorLine += ` (x${error.count})`;
          }
          console.log(errorLine);
        }
      }
    }
    process.exit(1);
  }

  process.exit(0);
};

// Run tests only if this file is executed directly (not imported)
// Check if this is the main module by comparing the file path
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("validate-conversions.js") ||
    process.argv[1].includes("validate-conversions.js"));

if (isMainModule) {
  runTests().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}
