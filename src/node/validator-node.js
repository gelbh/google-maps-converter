/**
 * Node.js-compatible validator module
 * Uses AJV npm package to validate V2 JSON against schema
 */

import Ajv from "ajv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ajvInstance = null;
let schema = null;
let validate = null;

/**
 * Initializes AJV and loads the schema
 * @returns {Promise<void>}
 */
async function initializeValidator() {
  if (ajvInstance && schema) {
    return; // Already initialized
  }

  // Initialize AJV
  ajvInstance = new Ajv({ allErrors: true, verbose: true });

  // Load schema from new location
  try {
    const schemaPath = join(__dirname, "..", "schema", "cbms-json-schema.json");
    const schemaText = readFileSync(schemaPath, "utf8");
    schema = JSON.parse(schemaText);
    validate = ajvInstance.compile(schema);
  } catch (error) {
    throw new Error(`Failed to load validation schema: ${error.message}`);
  }
}

/**
 * Validates V2 JSON against the schema
 * @param {Object} v2Json - V2 style object to validate
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 */
export async function validateV2(v2Json) {
  try {
    await initializeValidator();
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: error.message }],
    };
  }

  const valid = validate(v2Json);

  if (valid) {
    return { valid: true, errors: null };
  } else {
    return {
      valid: false,
      errors: validate.errors || [],
    };
  }
}

/**
 * Formats validation errors for display
 * @param {Array} errors - AJV validation errors
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return "Unknown validation error";
  }

  return errors
    .map((error) => {
      const path = error.instancePath || error.schemaPath || "";
      const message = error.message || "Validation error";
      return `${path ? path + ": " : ""}${message}`;
    })
    .join("\n");
}
