# Lagos Dumpsite Gas Emissions Dashboard

This project builds an interactive dashboard for Lagos State gas emissions using the current dataset.

For a full executive-level overview, see `EXECUTIVE_DOCUMENTATION.md`.

## What is included

- `prepare_dashboard_data.py`: Python script that joins LGA boundaries with yearly gas emission CSVs and exports GeoJSON files.
- `dashboard.html`: Leaflet + Chart.js dashboard that displays LGA choropleth mapping and time-series charts.
- `data/lga_emissions.geojson`: generated LGA-level emissions GeoJSON.
- `data/emission_points.geojson`: measurement point GeoJSON generated from the CSV point coordinates.

## How to use

1. Install the required Node.js dependencies:

```powershell
npm install
```

2. Run the JavaScript data preparation script:

```powershell
npm run prepare-data
```

Output files will be written to the local `data/` folder:

```powershell
<data-folder>/data/lga_emissions.geojson
<data-folder>/data/emission_points.geojson
```

If you want to keep using Python, the existing `prepare_dashboard_data.py` still works, but the dashboard itself is built in JavaScript.

3. Start a local web server in the dashboard folder:

```powershell
npm run serve
```

Or use Python if you prefer:

```powershell
python -m http.server 8000
```

4. Open the dashboard in your browser:

```
http://localhost:8000/dashboard.html
```

## Notes

- The dashboard uses browser `fetch()` to load local GeoJSON files from the `data/` folder, so it must be served through HTTP rather than opened directly as a file.
- The visualization is built in JavaScript with Leaflet and Chart.js.
- If you add ward boundaries, dumpsite locations, or population data later, the same dashboard structure can be extended.
