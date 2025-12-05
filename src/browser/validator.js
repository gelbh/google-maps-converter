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
  // The ajv7.min.js build exposes the library as 'ajv7' (not 'Ajv')
  // Check for both ajv7 and Ajv for compatibility
  let AjvConstructor;
  try {
    // Check for ajv7 first (the actual global name from ajv7.min.js)
    // ajv7 might be the Ajv class directly, or an object with Ajv property
    if (typeof ajv7 !== "undefined") {
      AjvConstructor = ajv7.Ajv || ajv7.default || ajv7;
    }
    // Also check for Ajv for backward compatibility
    if (!AjvConstructor) {
      AjvConstructor = typeof Ajv !== "undefined" ? Ajv : undefined;
    }
  } catch (e) {
    AjvConstructor = undefined;
  }

  if (!AjvConstructor && typeof window !== "undefined") {
    const ajv7Global = window.ajv7;
    if (ajv7Global) {
      AjvConstructor = ajv7Global.Ajv || ajv7Global.default || ajv7Global;
    }
    if (!AjvConstructor) {
      AjvConstructor = window.Ajv;
    }
  }

  if (!AjvConstructor) {
    // Try loading from CDN - use cdnjs which provides ajv7.min.js
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/ajv/8.17.1/ajv7.min.js"
    );

    // Small delay to ensure script has executed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if ajv7 is now available
    try {
      if (typeof ajv7 !== "undefined") {
        AjvConstructor = ajv7.Ajv || ajv7.default || ajv7;
      }
      if (!AjvConstructor) {
        AjvConstructor = typeof Ajv !== "undefined" ? Ajv : undefined;
      }
    } catch (e) {
      AjvConstructor = undefined;
    }

    if (!AjvConstructor && typeof window !== "undefined") {
      const ajv7Global = window.ajv7;
      if (ajv7Global) {
        AjvConstructor = ajv7Global.Ajv || ajv7Global.default || ajv7Global;
      }
      if (!AjvConstructor) {
        AjvConstructor = window.Ajv;
      }
    }

    // Final check - throw error if still not available
    if (!AjvConstructor) {
      throw new Error(
        "Failed to load Ajv library. Please check your internet connection."
      );
    }
  }

  // Initialize AJV
  ajvInstance = new AjvConstructor({ allErrors: true, verbose: true });

  // Load schema from new location
  try {
    const response = await fetch("/src/schema/cbms-json-schema.json");
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
