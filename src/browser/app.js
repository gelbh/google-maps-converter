/**
 * Main application logic for Google Maps V1 to V2 Converter
 * Handles UI interactions and coordinates conversion
 */

import { convertV1ToV2 } from "../core/converter.js";
import { validateV2 } from "./validator.js";
import {
  fetchStyles,
  fetchStyleById,
  parseStyleJson,
  debounce,
  fetchAvailableFilters,
  extractTagsFromStyles,
  extractColorsFromStyles,
} from "./snazzy-maps-api.js";

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
  closeValidationErrors.addEventListener("click", hideValidationErrors);

  // Initialize style browser modal
  initializeStyleModal(v1Input);

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
   * Loads a style from Snazzy Maps API into the editor
   * @param {string|number} styleId - Style ID
   * @param {Object} [cachedStyle] - Optional cached style object from grid
   */
  async function handleStyleSelection(styleId, cachedStyle = null) {
    if (!styleId) return;

    showLoading(true);
    try {
      let selectedStyle = cachedStyle;

      // If we have cached style data with JSON, try to use it first
      if (cachedStyle && cachedStyle.json) {
        const v1Json = parseStyleJson(cachedStyle);
        if (v1Json) {
          const formatted = JSON.stringify(v1Json, null, 2);
          v1Input.setValue(formatted);
          hideError();
          return;
        }
      }

      // Otherwise, fetch the full style from API
      const response = await fetchStyleById(styleId);

      // Handle different response structures
      if (!selectedStyle) {
        selectedStyle = response;
        if (Array.isArray(response)) {
          selectedStyle = response[0];
        } else if (response.results && Array.isArray(response.results)) {
          selectedStyle = response.results[0];
        } else if (response.data) {
          selectedStyle = response.data;
        }
      }

      if (!selectedStyle) {
        throw new Error("Selected style not found in API response");
      }

      // Try to extract the JSON field - it might be in different formats
      let v1Json = null;

      // First, try to use parsedJson if available (from fetchStyleById)
      if (selectedStyle.parsedJson) {
        v1Json = selectedStyle.parsedJson;
      } else if (selectedStyle.json) {
        // Try to parse the json field
        v1Json = parseStyleJson(selectedStyle);
        if (!v1Json) {
          // If parsing failed, try to parse it as a string
          try {
            if (typeof selectedStyle.json === "string") {
              v1Json = JSON.parse(selectedStyle.json);
            } else {
              v1Json = selectedStyle.json;
            }
          } catch (e) {
            console.warn("Failed to parse style JSON:", e);
          }
        }
      } else if (selectedStyle.styles) {
        // If the response has a styles array, use it directly
        v1Json = { styles: selectedStyle.styles };
      } else if (Array.isArray(selectedStyle)) {
        // If the response is an array of styles
        v1Json = { styles: selectedStyle };
      } else {
        // Check if the style object itself looks like V1 JSON
        if (selectedStyle.variant || selectedStyle.styles) {
          v1Json = selectedStyle;
        }
      }

      if (!v1Json) {
        // Log detailed information for debugging
        console.error("Style response structure:", selectedStyle);
        console.error("Available fields:", Object.keys(selectedStyle));

        // Try to see if there's any JSON-like data anywhere in the response
        const jsonFields = Object.keys(selectedStyle).filter(
          (key) =>
            key.toLowerCase().includes("json") ||
            key.toLowerCase().includes("style")
        );
        console.error("Fields containing 'json' or 'style':", jsonFields);

        throw new Error(
          `Style does not contain valid JSON. The style may not be available, may require authentication, or may be in an unsupported format. Please check the browser console for details.`
        );
      }

      // Format and set the V1 JSON in the editor
      const formatted = JSON.stringify(v1Json, null, 2);
      v1Input.setValue(formatted);
      hideError();
    } catch (error) {
      console.error("Error loading style:", error);
      showError(`Failed to load style: ${error.message}`);
    } finally {
      showLoading(false);
    }
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

  /**
   * Initialize the style browser modal
   */
  function initializeStyleModal(v1InputEditor) {
    // Modal DOM elements
    const modal = document.getElementById("style-modal");
    const modalOverlay = document.getElementById("style-modal-overlay");
    const openModalBtn = document.getElementById("open-style-modal-btn");
    const closeModalBtn = document.getElementById("close-style-modal-btn");
    const searchInput = document.getElementById("style-search-input");
    const sortSelect = document.getElementById("style-sort-select");
    const tagFiltersContainer = document.getElementById(
      "tag-filters-container"
    );
    const colorFiltersContainer = document.getElementById(
      "color-filters-container"
    );
    const clearFiltersBtn = document.getElementById("clear-filters-btn");
    const toggleFiltersBtn = document.getElementById("toggle-filters-btn");
    const toggleFiltersText = document.getElementById("toggle-filters-text");
    const toggleFiltersIcon = document.getElementById("toggle-filters-icon");
    const filterControlsSection = document.getElementById(
      "filter-controls-section"
    );
    const resultsGrid = document.getElementById("style-results-grid");
    const resultsCount = document.getElementById("results-count");
    const modalLoading = document.getElementById("style-modal-loading");
    const modalError = document.getElementById("style-modal-error");
    const modalEmpty = document.getElementById("style-modal-empty");
    const paginationPrev = document.getElementById("pagination-prev");
    const paginationNext = document.getElementById("pagination-next");
    const paginationInfo = document.getElementById("pagination-info");
    const paginationPageSize = document.getElementById("pagination-page-size");

    // State management
    let modalState = {
      searchText: "",
      sort: "popular",
      selectedTags: new Set(),
      selectedColors: new Set(),
      currentPage: 1,
      pageSize: 24,
      totalPages: 1,
      totalResults: 0,
      availableTags: [],
      availableColors: [],
      isLoading: false,
      filtersVisible: true,
    };

    let currentStyles = [];
    let filterOptionsLoaded = false;

    // Debounced search handler
    const debouncedSearch = debounce(() => {
      modalState.currentPage = 1;
      loadStyles();
    }, 400);

    // Open modal
    function openModal() {
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (!filterOptionsLoaded) {
        loadFilterOptions();
      }
      loadStyles();
      searchInput.focus();
      // Initialize filter height after a short delay to ensure DOM is ready
      setTimeout(initializeFiltersHeight, 100);
    }

    // Close modal
    function closeModal() {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    }

    // Load filter options (tags and colors)
    async function loadFilterOptions() {
      try {
        const filterData = await fetchAvailableFilters(3);
        modalState.availableTags = filterData.tags || [];
        modalState.availableColors = filterData.colors || [];
        renderFilterOptions();
        filterOptionsLoaded = true;
      } catch (error) {
        console.warn("Failed to load filter options:", error);
        // Continue without filters
        filterOptionsLoaded = true;
      }
    }

    // Render filter options
    function renderFilterOptions() {
      // Render tag filters
      const tagLoadingEl = document.getElementById("tag-filters-loading");
      if (tagLoadingEl) {
        tagLoadingEl.remove();
      }

      tagFiltersContainer.innerHTML = "";
      if (modalState.availableTags.length === 0) {
        tagFiltersContainer.innerHTML =
          '<span class="text-white/50 text-sm">No tags available</span>';
      } else {
        modalState.availableTags.forEach((tag) => {
          const checkbox = document.createElement("label");
          checkbox.className =
            "flex items-center gap-2 px-3 py-1 rounded-md text-sm cursor-pointer transition-colors bg-white/5 hover:bg-white/10 border border-white/20";
          checkbox.innerHTML = `
            <input
              type="checkbox"
              value="${tag}"
              class="rounded border-white/20 text-white focus:ring-white/50"
              ${modalState.selectedTags.has(tag) ? "checked" : ""}
            />
            <span class="text-white/90">${tag}</span>
          `;
          checkbox.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) {
              modalState.selectedTags.add(tag);
            } else {
              modalState.selectedTags.delete(tag);
            }
            modalState.currentPage = 1;
            loadStyles();
          });
          tagFiltersContainer.appendChild(checkbox);
        });
      }

      // Render color filters
      const colorLoadingEl = document.getElementById("color-filters-loading");
      if (colorLoadingEl) {
        colorLoadingEl.remove();
      }

      colorFiltersContainer.innerHTML = "";
      if (modalState.availableColors.length === 0) {
        colorFiltersContainer.innerHTML =
          '<span class="text-white/50 text-sm">No colors available</span>';
      } else {
        modalState.availableColors.forEach((color) => {
          const checkbox = document.createElement("label");
          checkbox.className =
            "flex items-center gap-2 px-3 py-1 rounded-md text-sm cursor-pointer transition-colors bg-white/5 hover:bg-white/10 border border-white/20";
          checkbox.innerHTML = `
            <input
              type="checkbox"
              value="${color}"
              class="rounded border-white/20 text-white focus:ring-white/50"
              ${modalState.selectedColors.has(color) ? "checked" : ""}
            />
            <span class="text-white/90">${color}</span>
          `;
          checkbox.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) {
              modalState.selectedColors.add(color);
            } else {
              modalState.selectedColors.delete(color);
            }
            modalState.currentPage = 1;
            loadStyles();
          });
          colorFiltersContainer.appendChild(checkbox);
        });
      }

      // Update filter section height if filters are visible
      if (modalState.filtersVisible && filterControlsSection) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          if (
            filterControlsSection.style.maxHeight !== "none" &&
            filterControlsSection.style.maxHeight !== "0px"
          ) {
            filterControlsSection.style.maxHeight =
              filterControlsSection.scrollHeight + "px";
          }
        });
      }
    }

    // Load styles with current filters
    async function loadStyles() {
      if (modalState.isLoading) return;

      modalState.isLoading = true;
      hideError();
      hideEmpty();
      showLoading();

      try {
        const tags = Array.from(modalState.selectedTags);
        const colors = Array.from(modalState.selectedColors);

        const response = await fetchStyles({
          sort: modalState.sort,
          tag: tags.length > 0 ? tags : undefined,
          color: colors.length > 0 ? colors : undefined,
          text: modalState.searchText || undefined,
          page: modalState.currentPage,
          pageSize: modalState.pageSize,
        });

        // Handle different response structures
        currentStyles = Array.isArray(response)
          ? response
          : response.results || response.styles || response.data || [];

        // Try to extract pagination info
        if (response.totalPages) {
          modalState.totalPages = response.totalPages;
        } else if (response.total) {
          modalState.totalPages = Math.ceil(
            response.total / modalState.pageSize
          );
        }

        if (response.total) {
          modalState.totalResults = response.total;
        } else if (response.totalResults) {
          modalState.totalResults = response.totalResults;
        } else {
          modalState.totalResults = currentStyles.length;
        }

        // If we got a full page, estimate total pages
        if (
          currentStyles.length === modalState.pageSize &&
          modalState.totalPages === 1
        ) {
          modalState.totalPages = modalState.currentPage + 1;
        }

        renderStyles();
        updatePagination();
        updateResultsCount();
      } catch (error) {
        console.error("Failed to load styles:", error);
        showModalError(`Failed to load styles: ${error.message}`);
        currentStyles = [];
        renderStyles();
      } finally {
        modalState.isLoading = false;
        hideLoading();
      }
    }

    // Render styles in grid
    function renderStyles() {
      resultsGrid.innerHTML = "";

      if (currentStyles.length === 0) {
        showEmpty();
        return;
      }

      currentStyles.forEach((style) => {
        const card = document.createElement("div");
        card.className =
          "bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all cursor-pointer hover:bg-white/10";
        card.innerHTML = `
          <h3 class="text-white font-semibold mb-2 truncate">${
            style.name || `Style #${style.id}`
          }</h3>
          <p class="text-white/70 text-sm mb-3 line-clamp-2">
            ${style.description || "No description available"}
          </p>
          <div class="flex items-center justify-between">
            <div class="flex flex-wrap gap-1">
              ${
                style.tags && Array.isArray(style.tags)
                  ? style.tags
                      .slice(0, 3)
                      .map(
                        (tag) =>
                          `<span class="px-2 py-1 text-xs rounded bg-white/10 text-white/80">${tag}</span>`
                      )
                      .join("")
                  : ""
              }
            </div>
            <button
              class="px-3 py-1 text-sm rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
              data-style-id="${style.id}"
            >
              Load
            </button>
          </div>
        `;

        const loadBtn = card.querySelector("button");
        loadBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const styleId = loadBtn.dataset.styleId;
          closeModal();
          // Pass the full style object if available, otherwise just the ID
          await handleStyleSelection(styleId, style);
        });

        card.addEventListener("click", async () => {
          closeModal();
          // Pass the full style object if available, otherwise just the ID
          await handleStyleSelection(style.id, style);
        });

        resultsGrid.appendChild(card);
      });
    }

    // Update pagination controls
    function updatePagination() {
      paginationPrev.disabled = modalState.currentPage === 1;
      paginationNext.disabled = modalState.currentPage >= modalState.totalPages;
      paginationInfo.textContent = `Page ${modalState.currentPage} of ${
        modalState.totalPages || 1
      }`;
    }

    // Update results count
    function updateResultsCount() {
      if (modalState.totalResults > 0) {
        resultsCount.textContent = `${modalState.totalResults} style${
          modalState.totalResults !== 1 ? "s" : ""
        } found`;
      } else {
        resultsCount.textContent = "No styles found";
      }
    }

    // Clear all filters
    function clearFilters() {
      modalState.searchText = "";
      modalState.selectedTags.clear();
      modalState.selectedColors.clear();
      modalState.currentPage = 1;
      searchInput.value = "";
      renderFilterOptions();
      loadStyles();
    }

    // Show/hide loading state
    function showLoading() {
      modalLoading.classList.remove("hidden");
      resultsGrid.classList.add("hidden");
    }

    function hideLoading() {
      modalLoading.classList.add("hidden");
      resultsGrid.classList.remove("hidden");
    }

    // Show/hide error state
    function showModalError(message) {
      modalError.textContent = message;
      modalError.classList.remove("hidden");
    }

    function hideError() {
      modalError.classList.add("hidden");
    }

    // Show/hide empty state
    function showEmpty() {
      modalEmpty.classList.remove("hidden");
      resultsGrid.classList.add("hidden");
    }

    function hideEmpty() {
      modalEmpty.classList.add("hidden");
      resultsGrid.classList.remove("hidden");
    }

    // Toggle filters visibility
    function toggleFilters() {
      modalState.filtersVisible = !modalState.filtersVisible;

      if (modalState.filtersVisible) {
        // Show filters - get actual height
        filterControlsSection.style.maxHeight = null; // Reset to get real height
        const height = filterControlsSection.scrollHeight;
        filterControlsSection.style.maxHeight = height + "px";
        filterControlsSection.classList.remove("opacity-0");
        filterControlsSection.classList.add("opacity-100");
        toggleFiltersText.textContent = "Hide Filters";
        toggleFiltersIcon.style.transform = "rotate(0deg)";
        toggleFiltersBtn.setAttribute("aria-expanded", "true");

        // Reset max-height after transition to allow content to grow
        setTimeout(() => {
          if (modalState.filtersVisible) {
            filterControlsSection.style.maxHeight = "none";
          }
        }, 300);
      } else {
        // Hide filters
        const height = filterControlsSection.scrollHeight;
        filterControlsSection.style.maxHeight = height + "px";
        // Force reflow to ensure height is set before transition
        filterControlsSection.offsetHeight;
        filterControlsSection.style.maxHeight = "0px";
        filterControlsSection.classList.remove("opacity-100");
        filterControlsSection.classList.add("opacity-0");
        toggleFiltersText.textContent = "Show Filters";
        toggleFiltersIcon.style.transform = "rotate(180deg)";
        toggleFiltersBtn.setAttribute("aria-expanded", "false");
      }
    }

    // Initialize filter section height
    function initializeFiltersHeight() {
      if (modalState.filtersVisible) {
        const height = filterControlsSection.scrollHeight;
        filterControlsSection.style.maxHeight = height + "px";
        filterControlsSection.classList.add("opacity-100");
        // Reset to allow dynamic growth
        setTimeout(() => {
          filterControlsSection.style.maxHeight = "none";
        }, 300);
      } else {
        filterControlsSection.style.maxHeight = "0px";
        filterControlsSection.classList.add("opacity-0");
      }
    }

    // Event listeners
    openModalBtn.addEventListener("click", openModal);
    closeModalBtn.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", closeModal);

    searchInput.addEventListener("input", (e) => {
      modalState.searchText = e.target.value;
      debouncedSearch();
    });

    sortSelect.addEventListener("change", (e) => {
      modalState.sort = e.target.value;
      modalState.currentPage = 1;
      loadStyles();
    });

    clearFiltersBtn.addEventListener("click", clearFilters);
    toggleFiltersBtn.addEventListener("click", toggleFilters);

    paginationPrev.addEventListener("click", () => {
      if (modalState.currentPage > 1) {
        modalState.currentPage--;
        loadStyles();
        resultsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    paginationNext.addEventListener("click", () => {
      if (modalState.currentPage < modalState.totalPages) {
        modalState.currentPage++;
        loadStyles();
        resultsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    paginationPageSize.addEventListener("change", (e) => {
      modalState.pageSize = parseInt(e.target.value);
      modalState.currentPage = 1;
      loadStyles();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("hidden")) {
        if (e.key === "Escape") {
          closeModal();
        }
        if (e.key === "Enter" && document.activeElement === searchInput) {
          e.preventDefault();
          loadStyles();
        }
      }
    });
  }
}

// Start initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeEditors);
} else {
  initializeEditors();
}
