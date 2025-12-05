/**
 * V2 schema validation using AJV
 * Validates converted V2 JSON against cbms-json-schema.json
 */

let ajvInstance = null;
let schema = null;

/**
 * Initializes AJV and loads the schema
 * @returns {Promise<void>}
 */
async function initializeValidator() {
  if (ajvInstance && schema) {
    return; // Already initialized
  }

  // Load AJV from CDN if not available
  if (typeof Ajv === "undefined") {
    await loadScript("https://cdn.jsdelivr.net/npm/ajv@8.12.0/dist/ajv.min.js");
  }

  // Initialize AJV
  ajvInstance = new Ajv({ allErrors: true, verbose: true });

  // Load schema
  try {
    const response = await fetch("cbms-json-schema.json");
    schema = await response.json();
  } catch (error) {
    console.error("Failed to load schema:", error);
    throw new Error("Failed to load validation schema");
  }
}

/**
 * Loads a script dynamically
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

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
async function validateV2(v2Json) {
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
function formatValidationErrors(errors) {
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
