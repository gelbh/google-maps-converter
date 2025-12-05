/**
 * Main application logic for Google Maps V1 to V2 Converter
 * Handles UI interactions and coordinates conversion
 */

// DOM elements
const v1Input = document.getElementById("v1-input");
const v2Output = document.getElementById("v2-output");
const convertBtn = document.getElementById("convert-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const fileInput = document.getElementById("file-input");
const exampleSelect = document.getElementById("example-select");
const loading = document.getElementById("loading");
const errorDisplay = document.getElementById("error-display");
const validationStatus = document.getElementById("validation-status");

let currentV2Output = null;

// Event listeners
convertBtn.addEventListener("click", handleConvert);
clearBtn.addEventListener("click", handleClear);
copyBtn.addEventListener("click", handleCopy);
downloadBtn.addEventListener("click", handleDownload);
fileInput.addEventListener("change", handleFileUpload);
exampleSelect.addEventListener("change", handleExampleLoad);

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
  const input = v1Input.value.trim();

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
    v2Output.value = formatted;

    // Validate output
    const validation = await validateV2(v2Result);
    if (validation.valid) {
      updateValidationStatus("valid", "Valid ✓");
    } else {
      updateValidationStatus("invalid", "Invalid ✗");
      console.warn("Validation errors:", validation.errors);
    }
  } catch (error) {
    showError(`Conversion error: ${error.message}`);
    v2Output.value = "";
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
      v1Input.value = content;
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
    const response = await fetch(examplePath);
    if (!response.ok) {
      throw new Error(`Failed to load example: ${response.statusText}`);
    }
    const content = await response.text();
    v1Input.value = content;
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
  v1Input.value = "";
  v2Output.value = "";
  currentV2Output = null;
  hideError();
  updateValidationStatus("", "");
  v1Input.focus();
}

/**
 * Handles copy to clipboard
 */
async function handleCopy() {
  if (!v2Output.value) {
    showError("No output to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(v2Output.value);
    // Visual feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    copyBtn.style.background = "var(--success-color)";
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = "";
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
  errorDisplay.style.display = "block";
}

/**
 * Hides error message
 */
function hideError() {
  errorDisplay.style.display = "none";
}

/**
 * Shows/hides loading indicator
 */
function showLoading(show) {
  loading.style.display = show ? "block" : "none";
  convertBtn.disabled = show;
}

/**
 * Updates validation status
 */
function updateValidationStatus(status, text) {
  validationStatus.className = `validation-status ${status}`;
  validationStatus.textContent = text;
  validationStatus.style.display = text ? "inline-block" : "none";
}
