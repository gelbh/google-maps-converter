/**
 * Main application logic for Google Maps V1 to V2 Converter
 * Handles UI interactions and coordinates conversion
 */

import { convertV1ToV2 } from "../core/converter.js";
import { validateV2 } from "./validator.js";

// Wait for CodeMirror to be available
function initializeEditors() {
  // DOM elements
  const v1InputTextarea = document.getElementById("v1-input");
  const v2OutputTextarea = document.getElementById("v2-output");

  if (!window.CodeMirror) {
    setTimeout(initializeEditors, 50);
    return;
  }

  // Initialize CodeMirror editors
  const v1Input = CodeMirror.fromTextArea(v1InputTextarea, {
    mode: { name: "javascript", json: true },
    theme: "monokai",
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    placeholder: "Paste your V1 style JSON here...",
    viewportMargin: Infinity,
  });

  const v2Output = CodeMirror.fromTextArea(v2OutputTextarea, {
    mode: { name: "javascript", json: true },
    theme: "monokai",
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    readOnly: true,
    cursorBlinkRate: 0,
    placeholder: "V2 output will appear here after conversion...",
    viewportMargin: Infinity,
  });

  // Set fixed height for editors
  v1Input.setSize(null, "250px");
  v2Output.setSize(null, "250px");

  // Apply custom dark theme styling
  const cmStyle = document.createElement("style");
  cmStyle.textContent = `
    .CodeMirror {
      background: rgba(0, 0, 0, 0.2) !important;
      backdrop-filter: blur(4px);
      color: #f8f8f2 !important;
      height: 100% !important;
    }
    .CodeMirror-scroll {
      height: 100% !important;
    }
    .CodeMirror-gutters {
      background: rgba(0, 0, 0, 0.3) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    .CodeMirror-linenumber {
      color: rgba(255, 255, 255, 0.5) !important;
    }
    .CodeMirror-cursor {
      border-left: 1px solid #f8f8f2 !important;
    }
    .CodeMirror-selected {
      background: rgba(255, 255, 255, 0.1) !important;
    }
    .CodeMirror-focused .CodeMirror-selected {
      background: rgba(66, 133, 244, 0.3) !important;
    }
    .CodeMirror-placeholder {
      color: rgba(255, 255, 255, 0.4) !important;
    }
  `;
  document.head.appendChild(cmStyle);

  // Make editors available globally
  window.v1InputEditor = v1Input;
  window.v2OutputEditor = v2Output;

  // Initialize the rest of the app
  initializeApp(v1Input, v2Output);
}

// DOM elements
const convertBtn = document.getElementById("convert-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const fileInput = document.getElementById("file-input");
const exampleSelect = document.getElementById("example-select");
const loading = document.getElementById("loading");
const errorDisplay = document.getElementById("error-display");
const validationStatus = document.getElementById("validation-status");
const validationErrors = document.getElementById("validation-errors");
const validationErrorsContent = document.getElementById(
  "validation-errors-content"
);
const closeValidationErrors = document.getElementById(
  "close-validation-errors"
);

function initializeApp(v1Input, v2Output) {
  let currentV2Output = null;

  // Event listeners
  convertBtn.addEventListener("click", handleConvert);
  clearBtn.addEventListener("click", handleClear);
  copyBtn.addEventListener("click", handleCopy);
  downloadBtn.addEventListener("click", handleDownload);
  fileInput.addEventListener("change", handleFileUpload);
  exampleSelect.addEventListener("change", handleExampleLoad);
  closeValidationErrors.addEventListener("click", hideValidationErrors);

  // Make validation status clickable to toggle errors
  validationStatus.addEventListener("click", () => {
    if (!validationErrors.classList.contains("hidden")) {
      hideValidationErrors();
    } else if (validationErrorsContent.innerHTML.trim() !== "") {
      validationErrors.classList.remove("hidden");
      validationErrors.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Enter to convert
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleConvert();
    }
  });

  /**
   * Handles conversion from V1 to V2
   */
  async function handleConvert() {
    const input = v1Input.getValue().trim();

    if (!input) {
      showError("Please enter V1 JSON to convert");
      return;
    }

    // Hide previous errors
    hideError();
    showLoading(true);
    updateValidationStatus("pending", "Validating...");

    try {
      // Convert V1 to V2
      const v2Result = convertV1ToV2(input);
      currentV2Output = v2Result;

      // Format and display output
      const formatted = JSON.stringify(v2Result, null, 2);
      v2Output.setValue(formatted);

      // Validate output
      const validation = await validateV2(v2Result);
      if (validation.valid) {
        updateValidationStatus("valid", "Valid ✓");
        hideValidationErrors();
      } else {
        updateValidationStatus("invalid", "Invalid ✗");
        showValidationErrors(validation.errors, v2Result);
        console.warn("Validation errors:", validation.errors);
      }
    } catch (error) {
      showError(`Conversion error: ${error.message}`);
      v2Output.setValue("");
      currentV2Output = null;
      updateValidationStatus("invalid", "Error");
    } finally {
      showLoading(false);
    }
  }

  /**
   * Handles file upload
   */
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        // Try to parse as JSON to validate
        JSON.parse(content);
        v1Input.setValue(content);
        hideError();
      } catch (error) {
        showError(`Invalid JSON file: ${error.message}`);
      }
    };
    reader.onerror = () => {
      showError("Failed to read file");
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  }

  /**
   * Handles example loading
   */
  async function handleExampleLoad(event) {
    const examplePath = event.target.value;
    if (!examplePath) return;

    try {
      // Prepend base URL for GitHub Pages compatibility
      const baseUrl = import.meta.env.BASE_URL || "/";
      const fullPath = `${baseUrl}${examplePath}`.replace(/\/+/g, "/");
      const response = await fetch(fullPath);
      if (!response.ok) {
        throw new Error(`Failed to load example: ${response.statusText}`);
      }
      const content = await response.text();
      v1Input.setValue(content);
      hideError();
    } catch (error) {
      showError(`Failed to load example: ${error.message}`);
    }

    // Reset select
    event.target.value = "";
  }

  /**
   * Handles clear action
   */
  function handleClear() {
    v1Input.setValue("");
    v2Output.setValue("");
    currentV2Output = null;
    hideError();
    updateValidationStatus("", "");
    v1Input.focus();
  }

  /**
   * Handles copy to clipboard
   */
  async function handleCopy() {
    const outputValue = v2Output.getValue();
    if (!outputValue) {
      showError("No output to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(outputValue);
      // Visual feedback
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      copyBtn.classList.remove("bg-white/20");
      copyBtn.classList.add("bg-green-500/40", "border-green-400/50");
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove("bg-green-500/40", "border-green-400/50");
        copyBtn.classList.add("bg-white/20");
      }, 2000);
    } catch (error) {
      showError(`Failed to copy: ${error.message}`);
    }
  }

  /**
   * Handles download
   */
  function handleDownload() {
    if (!currentV2Output) {
      showError("No output to download");
      return;
    }

    const json = JSON.stringify(currentV2Output, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "v2-style.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Shows error message
   */
  function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.remove("hidden");
  }

  /**
   * Hides error message
   */
  function hideError() {
    errorDisplay.classList.add("hidden");
  }

  /**
   * Shows/hides loading indicator
   */
  function showLoading(show) {
    loading.classList.toggle("hidden", !show);
    convertBtn.disabled = show;
  }

  /**
   * Updates validation status
   */
  function updateValidationStatus(status, text) {
    // Remove all status classes
    validationStatus.classList.remove("valid", "invalid", "pending");

    // Add appropriate status class and set base styles
    if (status) {
      validationStatus.classList.add(status);
      if (status === "valid") {
        validationStatus.className =
          "px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer transition-opacity hover:opacity-80 bg-green-100 text-green-800";
      } else if (status === "invalid") {
        validationStatus.className =
          "px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer transition-opacity hover:opacity-80 bg-red-100 text-red-800";
      } else if (status === "pending") {
        validationStatus.className =
          "px-3 py-1 rounded-full text-xs font-semibold uppercase cursor-pointer transition-opacity hover:opacity-80 bg-yellow-100 text-yellow-800";
      }
    }

    validationStatus.textContent = text;
    validationStatus.classList.toggle("hidden", !text);
  }

  /**
   * Shows detailed validation errors
   */
  function showValidationErrors(errors, v2Result) {
    if (!errors || errors.length === 0) {
      hideValidationErrors();
      return;
    }

    // Group errors by path
    const errorsByPath = {};
    errors.forEach((error) => {
      const path = error.instancePath || error.schemaPath || "/";
      if (!errorsByPath[path]) {
        errorsByPath[path] = [];
      }
      errorsByPath[path].push(error);
    });

    // Build detailed error display
    let html = `<div class="mb-4 p-3 bg-yellow-100/50 rounded-md text-yellow-800 font-medium">
      <p><strong>${errors.length} validation error${
      errors.length !== 1 ? "s" : ""
    } found</strong></p>
    </div>`;

    // Show errors grouped by path
    Object.entries(errorsByPath).forEach(([path, pathErrors]) => {
      html += `<div class="mb-4 p-4 bg-background rounded-md border-l-4 border-destructive">`;
      html += `<div class="mb-3 font-semibold text-foreground"><strong>Path:</strong> <code class="bg-muted px-2 py-1 rounded text-sm font-mono text-destructive">${
        path || "/"
      }</code></div>`;

      pathErrors.forEach((error) => {
        html += `<div class="mb-3 p-3 bg-muted rounded-md last:mb-0">`;
        html += `<div class="mb-2 text-destructive font-medium"><strong>Error:</strong> ${
          error.message || "Unknown error"
        }</div>`;

        if (error.params) {
          html += `<div class="mb-2 text-muted-foreground text-xs"><strong>Details:</strong> `;
          const params = Object.entries(error.params)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(", ");
          html += params;
          html += `</div>`;
        }

        // Show the actual value that failed
        if (path && v2Result) {
          const value = getNestedValue(v2Result, path);
          if (value !== undefined) {
            html += `<div class="mt-2 p-2 bg-background border border-border rounded"><strong>Value:</strong> <code class="font-mono text-xs text-foreground break-all">${JSON.stringify(
              value
            )}</code></div>`;
          }
        }

        html += `</div>`;
      });

      html += `</div>`;
    });

    // Show which styles are problematic
    const styleErrors = errors.filter(
      (e) => e.instancePath && e.instancePath.includes("/styles/")
    );
    if (styleErrors.length > 0) {
      const styleIndices = new Set();
      styleErrors.forEach((error) => {
        const match = error.instancePath.match(/\/styles\/(\d+)/);
        if (match) {
          styleIndices.add(parseInt(match[1]));
        }
      });

      if (styleIndices.size > 0) {
        html += `<div class="mb-4 p-4 bg-background rounded-md border-l-4 border-destructive">`;
        html += `<div class="mb-3 font-semibold text-foreground"><strong>Problematic Styles:</strong></div>`;
        Array.from(styleIndices)
          .sort((a, b) => a - b)
          .forEach((index) => {
            const style = v2Result.styles[index];
            if (style) {
              html += `<div class="mb-3 p-3 bg-muted rounded-md last:mb-0">`;
              html += `<div class="mb-2 text-destructive font-medium">Style #${index}: <code class="bg-muted px-2 py-1 rounded text-sm font-mono text-destructive">${
                style.id || "unknown"
              }</code></div>`;
              html += `<div class="mt-2 p-2 bg-background border border-border rounded"><pre class="m-0 p-0 font-mono text-xs text-foreground whitespace-pre-wrap break-all bg-transparent border-none">${JSON.stringify(
                style,
                null,
                2
              )}</pre></div>`;
              html += `</div>`;
            }
          });
        html += `</div>`;
      }
    }

    validationErrorsContent.innerHTML = html;
    validationErrors.classList.remove("hidden");

    // Scroll to validation errors
    validationErrors.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /**
   * Hides validation errors
   */
  function hideValidationErrors() {
    validationErrors.classList.add("hidden");
  }

  /**
   * Gets nested value from object using path
   */
  function getNestedValue(obj, path) {
    if (!path || path === "/") {
      return obj;
    }

    const parts = path.split("/").filter((p) => p);
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indices
      if (!isNaN(part)) {
        current = current[parseInt(part)];
      } else {
        current = current[part];
      }
    }

    return current;
  }
}

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeEditors);
} else {
  initializeEditors();
}
