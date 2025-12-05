/**
 * V2 schema validation using AJV
 * Validates converted V2 JSON against cbms-json-schema.json
 */

import schemaData from "../schema/cbms-json-schema.json";

let ajvInstance = null;
let schema = null;

/**
 * Gets Ajv constructor from global scope
 * @returns {Function|undefined} Ajv constructor or undefined
 */
function getAjvConstructor() {
  try {
    if (typeof ajv7 !== "undefined") {
      return ajv7.Ajv ?? ajv7.default ?? ajv7;
    }
    if (typeof Ajv !== "undefined") {
      return Ajv;
    }
    if (typeof window !== "undefined") {
      const ajv7Global = window.ajv7;
      if (ajv7Global) {
        return ajv7Global.Ajv ?? ajv7Global.default ?? ajv7Global;
      }
      return window.Ajv;
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Initializes AJV and loads the schema
 * @returns {Promise<void>}
 */
async function initializeValidator() {
  if (ajvInstance && schema) {
    return;
  }

  let AjvConstructor = getAjvConstructor();

  if (!AjvConstructor) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/ajv/8.17.1/ajv7.min.js"
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    AjvConstructor = getAjvConstructor();

    if (!AjvConstructor) {
      throw new Error(
        "Failed to load Ajv library. Please check your internet connection."
      );
    }
  }

  ajvInstance = new AjvConstructor({ allErrors: true, verbose: true });
  schema = schemaData;
}

/**
 * Loads a script dynamically
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
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

  const validate = ajvInstance.compile(schema);
  const valid = validate(v2Json);

  return valid
    ? { valid: true, errors: null }
    : { valid: false, errors: validate.errors ?? [] };
}
