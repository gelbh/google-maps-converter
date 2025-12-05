#!/usr/bin/env node
/**
 * CLI test suite for V1 to V2 conversion validation
 * Reads all V1 example files, converts them, validates against schema, and outputs TAP format
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { convertV1ToV2 } from "../src/node/converter-node.js";
import {
  validateV2,
  formatValidationErrors,
} from "../src/node/validator-node.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const examplesDir = join(projectRoot, "public", "examples", "v1");

/**
 * Reads all JSON files from the examples/v1 directory
 * @returns {Promise<string[]>} Array of file paths
 */
async function getV1ExampleFiles() {
  try {
    const files = await readdir(examplesDir);
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => join(examplesDir, file));
  } catch (error) {
    console.error(`Error reading examples directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Loads and parses a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object>} Parsed JSON object
 */
async function loadJsonFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
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

  const parts = path.split("/").filter((p) => p !== "");
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    const index = parseInt(part, 10);
    if (!isNaN(index)) {
      current = current[index];
    } else {
      current = current[part];
    }
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
function formatErrorYaml(message, errors = null, v2Json = null) {
  const lines = [`  ---`, `  message: ${JSON.stringify(message)}`];

  if (errors && errors.length > 0) {
    lines.push(`  errors:`);
    for (const error of errors) {
      const path = error.instancePath || error.schemaPath || "";
      const errorMsg = error.message || "Validation error";

      // Get the actual value at the error path
      let actualValue = undefined;
      let featureId = undefined;

      if (v2Json && path) {
        actualValue = getValueAtPath(v2Json, path);

        // If error is about /styles/N/id, extract the feature ID for context
        const styleMatch = path.match(/^\/styles\/(\d+)\/id$/);
        if (styleMatch) {
          const styleIndex = parseInt(styleMatch[1], 10);
          if (v2Json.styles && v2Json.styles[styleIndex]) {
            featureId = v2Json.styles[styleIndex].id;
          }
        }

        // If error is about /styles/N/something, get the feature ID
        const stylePropMatch = path.match(/^\/styles\/(\d+)\//);
        if (stylePropMatch && !featureId) {
          const styleIndex = parseInt(stylePropMatch[1], 10);
          if (v2Json.styles && v2Json.styles[styleIndex]) {
            featureId = v2Json.styles[styleIndex].id;
          }
        }
      }

      lines.push(`    - path: ${JSON.stringify(path)}`);
      lines.push(`      message: ${JSON.stringify(errorMsg)}`);

      if (featureId !== undefined) {
        lines.push(`      featureId: ${JSON.stringify(featureId)}`);
      }

      if (actualValue !== undefined) {
        const valueStr =
          typeof actualValue === "object"
            ? JSON.stringify(actualValue)
            : JSON.stringify(actualValue);
        lines.push(`      actualValue: ${valueStr}`);
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
  const files = await getV1ExampleFiles();

  if (files.length === 0) {
    console.error("No V1 example files found in public/examples/v1/");
    process.exit(1);
  }

  console.log("TAP version 13");
  console.log(`1..${files.length}`);

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = filePath.split(/[/\\]/).pop();
    const testNumber = i + 1;

    try {
      // Load V1 JSON
      const v1Json = await loadJsonFile(filePath);

      // Convert to V2
      let v2Json;
      try {
        v2Json = convertV1ToV2(v1Json);
      } catch (error) {
        console.log(`not ok ${testNumber} - ${fileName} (conversion failed)`);
        console.log(formatErrorYaml(`Conversion error: ${error.message}`));
        failCount++;
        failures.push({ file: fileName, error: error.message });
        continue;
      }

      // Validate against schema
      const validation = await validateV2(v2Json);

      if (validation.valid) {
        console.log(`ok ${testNumber} - ${fileName}`);
        passCount++;
      } else {
        console.log(`not ok ${testNumber} - ${fileName} (validation failed)`);
        console.log(
          formatErrorYaml("Validation failed", validation.errors, v2Json)
        );
        failCount++;
        failures.push({
          file: fileName,
          errors: validation.errors,
          v2Json: v2Json,
        });
      }
    } catch (error) {
      console.log(`not ok ${testNumber} - ${fileName} (error)`);
      console.log(formatErrorYaml(`Test error: ${error.message}`));
      failCount++;
      failures.push({ file: fileName, error: error.message });
    }
  }

  // Summary
  console.log("");
  console.log(`# tests ${files.length}`);
  console.log(`# pass  ${passCount}`);
  console.log(`# fail  ${failCount}`);

  if (failCount > 0) {
    console.log("");
    console.log("# Failed tests:");
    for (const failure of failures) {
      console.log(`#   - ${failure.file}`);
      if (failure.error) {
        console.log(`#     Error: ${failure.error}`);
      }
      if (failure.errors) {
        // Show enhanced error summary with feature IDs
        console.log(`#     Validation errors:`);
        for (const error of failure.errors) {
          const path = error.instancePath || error.schemaPath || "";
          const errorMsg = error.message || "Validation error";

          // Extract feature ID if this is a style error
          let featureId = undefined;
          if (failure.v2Json) {
            const styleMatch = path.match(/^\/styles\/(\d+)\//);
            if (styleMatch) {
              const styleIndex = parseInt(styleMatch[1], 10);
              if (failure.v2Json.styles && failure.v2Json.styles[styleIndex]) {
                featureId = failure.v2Json.styles[styleIndex].id;
              }
            }
          }

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
