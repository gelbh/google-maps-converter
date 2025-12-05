# Google Maps V1 to V2 Style Converter

A web-based tool to convert Google Maps JavaScript API V1 style JSON to V2 CBMS (Custom Base Map Style) format.

## Overview

This converter transforms V1 style definitions (using `featureType`, `elementType`, and `stylers`) into V2 format (using `variant`, `id`, `geometry`, and `label` structure) as defined in the CBMS JSON schema.

## Features

- ✅ Converts V1 style JSON to V2 CBMS format
- ✅ Handles HSL color adjustments (lightness, saturation)
- ✅ Maps V1 feature types to V2 IDs
- ✅ Validates output against V2 schema
- ✅ Modern, responsive web interface
- ✅ File upload and example loading
- ✅ Copy to clipboard and download functionality

## Usage

### Web Interface

1. Open `index.html` in a web browser
2. Paste your V1 JSON or upload a file
3. Click "Convert" to generate V2 output
4. Copy or download the converted JSON

### Example Files

The project includes example files in the `examples/` directory:

- **V1 Examples** (`examples/v1/`):

  - `wy.json` - Wyoming style
  - `multi-brand-network.json` - Multi-brand network style
  - `assassins_creed_iv.json` - Assassin's Creed IV style

- **V2 Examples** (`examples/v2/`):
  - `dark.json` - Dark variant reference
  - `light.json` - Light variant reference

## Conversion Mapping

### Feature Type Mapping

| V1 Feature Type           | V2 ID                                     |
| ------------------------- | ----------------------------------------- |
| `poi`                     | `pointOfInterest`                         |
| `administrative`          | `political`                               |
| `administrative.country`  | `political.countryOrRegion`               |
| `administrative.locality` | `political.city`                          |
| `road`                    | `infrastructure.roadNetwork.road`         |
| `road.highway`            | `infrastructure.roadNetwork.road.highway` |
| `landscape`               | `natural.land`                            |
| `water`                   | `natural.water`                           |

### Element Type Mapping

| V1 Element Type      | V2 Property             |
| -------------------- | ----------------------- |
| `geometry.fill`      | `geometry.fillColor`    |
| `geometry.stroke`    | `geometry.strokeColor`  |
| `labels.text.fill`   | `label.textFillColor`   |
| `labels.text.stroke` | `label.textStrokeColor` |
| `labels.icon`        | `label.pinFillColor`    |

## Technical Details

### Color Conversion

The converter handles HSL adjustments from V1:

- `lightness`: -100 to 100 → 0-100% lightness adjustment
- `saturation`: -100 to 100 → 0-100% saturation adjustment
- Colors are normalized to 6-digit hex format (#RRGGBB)

### Variant Detection

The converter automatically detects the variant (light/dark) by analyzing the average lightness of colors in the V1 input.

### Schema Validation

Output is validated against `cbms-json-schema.json` using AJV (JSON Schema validator).

## Project Structure

```
google-maps-converter/
├── index.html              # Main web interface
├── styles.css              # UI styling
├── app.js                  # Application logic
├── converter.js            # Core conversion logic
├── color-utils.js          # HSL to hex color conversion
├── mapping.js              # V1 to V2 mapping rules
├── validator.js            # V2 schema validation
├── cbms-json-schema.json   # V2 schema definition
├── examples/               # Example files
│   ├── v1/                # V1 input examples
│   └── v2/                # V2 output examples
└── README.md               # This file
```

## Dependencies

All dependencies are loaded via CDN:

- **AJV** (v8.12.0) - JSON Schema validator
- **Prism.js** (v1.29.0) - Syntax highlighting (optional)

## Browser Support

- Modern browsers with ES6+ support
- Requires JavaScript enabled
- File API support for file uploads
- Clipboard API support for copy functionality

## GitHub Pages Deployment

This project is designed to be deployed on GitHub Pages:

1. Push the repository to GitHub
2. Enable GitHub Pages in repository settings
3. Select the `main` (or `master`) branch
4. The site will be available at `https://<username>.github.io/google-maps-converter/`

### Using GitHub CLI

```bash
# Create repository
gh repo create google-maps-converter --public --source=. --remote=origin

# Push code
git push -u origin main

# Enable GitHub Pages (via API)
gh api repos/:owner/:repo/pages -X POST \
  -f source='{"branch":"main","path":"/"}'
```

## License

This project is provided as-is for converting Google Maps style definitions.

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing style conventions
- All conversions are tested with example files
- Output validates against the V2 schema
