# Lagos Dumpsite Gas Emissions Dashboard

## Executive Summary

The Lagos Dumpsite Gas Emissions Dashboard is an interactive GIS-based decision support tool for Lagos State, Nigeria. It combines Sentinel-5P gas emission data with local landfill site locations, LGA boundaries, and spatial analysis capabilities to surface landfill-related environmental risk, emission trends, and actionable insights.

The dashboard supports executive review through:
- a state-level emission risk map,
- gas trend analytics,
- point / transect / zonal spatial reporting,
- comparative gas correlation analysis,
- buffer exposure assessment, and
- LGA-level performance ranking.

This document summarizes the project purpose, data sources, functionality, operating workflow, and recommended next steps.

## Project Objectives

1. Map and monitor landfill gas emissions across Lagos State.
2. Identify high-risk LGAs and potential emission hotspots.
3. Provide spatial analysis tools for point, transect, and zonal assessment.
4. Support trend analysis of CH₄, NO₂, and CO over time.
5. Deliver executive-ready reports and dashboards for environmental planning.

## Scope

The dashboard covers:
- Lagos State LGA boundaries and emission statistics,
- landfill / dumpsite point locations,
- annual emission values from 2018 through 2025,
- environmental risk indexing, and
- spatial overlay and buffer analysis.

The solution is built for desktop browser use via HTTP server and is designed to be extensible for future data additions.

## Data Sources

- Gas emissions: Google Earth Engine / Sentinel-5P derived values for CH₄, NO₂, and CO.
- LGAs: Lagos State administrative boundaries.
- Landfill sites: local dumpsite location points digitized from source data.
- Derived GeoJSON: processed emissions and spatial features produced by the dashboard preparation pipelines.

## System Components

### Files and Roles

- `index.html` — primary interactive dashboard user interface.
- `dashboard.html` — simplified alternative dashboard for basic mapping and analytics.
- `app.js` — core dashboard logic and feature implementation.
- `prepare_dashboard_data.py` — Python preparation script for GeoJSON data export.
- `prepare_dashboard_data.js` — Node.js data preparation entrypoint used by `npm run prepare-data`.
- `server.py` — optional local server integration for GEE-based raster and trend services.
- `style.css` — visual layout and theme styling.
- `data/` — GeoJSON datasets consumed by the dashboard.

### Key Visualization Modules

The dashboard exposes the following major modules:

- Dashboard overview panel
- Spatial analysis panel
- Gas emissions panel
- Landfill status panel
- About / project context overlay

## Feature Summary

### 1. Interactive Map and Spatial Controls

The core dashboard map enables user interactions with:
- LGA emission choropleth visualization,
- landfill point locations,
- buffer zone overlays (100m, 500m, 1km),
- basemap switching (Carto Dark, OpenStreetMap, Satellite),
- LGA filtering,
- search by location or LGA.

### 2. Emission Metric Controls

Users can select and compare:
- Methane (CH₄),
- Nitrogen Dioxide (NO₂),
- Carbon Monoxide (CO),
- an impact risk index (ISI), and
- hotspot score.

### 3. Executive KPIs

The dashboard surface includes summary metrics for:
- total landfill count,
- highest-risk LGA,
- lowest-risk LGA,
- year-on-year change,
- average ERI score.

### 4. LGA Inspection and Analytics

Clicking an LGA surface reveals:
- current emission value,
- YoY percentage change,
- CH₄, NO₂, CO breakdown,
- nearest landfill site distance,
- environmental risk classification,
- selected feature analytics updates.

### 5. Reports and Draw Analysis

The application supports report creation for spatial selections, including:
- point reports,
- transect reports,
- zonal (polygon / buffer) reports.

A dedicated analysis panel becomes available when users draw or select spatial contexts, showing:
- summary metrics,
- visual transect charts,
- report generation controls.

### 6. Trend Analysis

Trend analysis modules include:
- dynamic year-range sliders,
- YoY trend tables,
- trend charts for selected metrics,
- average emission trend visualizations for visible LGAs,
- point-based trend updates for clicked locations.

### 7. Gas Emissions Analysis

The embedded gas emissions panel offers:
- temporal overview of all three gases,
- gas correlation scatter plots across LGAs,
- gas1 vs gas2 comparison for anomaly detection,
- LGA emission data tables.

### 8. Spatial Analysis and Anomaly Detection

The spatial analysis panel supports:
- LGA ranking by metric,
- anomaly detection thresholds,
- exposure and buffer evaluation,
- zonal classification,
- overlay analysis of emission and landfill data.

## User Workflow

1. Start a local server in the dashboard folder.
2. Open `index.html` in the browser.
3. Select the year and emission metric to review.
4. Toggle map layers and basemaps to inspect spatial patterns.
5. Use the LGA selector or search box for targeted review.
6. Open the spatial analysis panel for ranking, trending, and anomaly review.
7. Open the gas panel to compare gas pairs and observe temporal behavior.
8. Draw a point / transect / zone or click an LGA to generate reports.

## Deployment Instructions

### Prerequisites

- Node.js installed for data preparation and optional static serving.
- Python installed if using `prepare_dashboard_data.py` or the `python -m http.server` fallback.

### Install

```powershell
npm install
```

### Prepare Data

```powershell
npm run prepare-data
```

### Serve Dashboard

```powershell
npm run serve
```

Alternative: open a local server with Python:

```powershell
python -m http.server 8000
```

### Open in Browser

- `http://localhost:8000/index.html`

## Technical Notes

- The dashboard loads local GeoJSON files using browser `fetch()`, so HTTP serving is required.
- `index.html` is the comprehensive application; `dashboard.html` is a lighter legacy view.
- The application is built with Leaflet for GIS mapping and Chart.js for analytics.
- If a local Earth Engine service is available, the dashboard can additionally enable live GEE raster layers and trend details.

## Limitations

- The current dataset is bounded through 2025; 2026 values appear only as a reserved placeholder.
- Emission values are derived from satellite/remote sensing sources and should be interpreted as indicative rather than discrete ground measurements.
- Spatial anomaly detection is based on available data and may require local validation for final operational decisions.

## Recommended Enhancements

For further executive-level use, the dashboard can be extended with:
- automated PDF/PowerPoint report export,
- additional socio-economic / population exposure layers,
- mobile-friendly layout,
- dashboard access control,
- more fine-grained spatial units such as wards or communities.

## Contact

Geoinfotech Resources Limited

For deployment support, data updates, or executive briefing materials, use the project source files as the authoritative implementation reference.
