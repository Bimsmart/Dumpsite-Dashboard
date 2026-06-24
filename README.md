# Lagos Dumpsite Gas Emissions Dashboard

This project builds an interactive dashboard for Lagos State gas emissions and dumpsite risk using Sentinel-5P derived data.

For a full executive-level overview, see `EXECUTIVE_DOCUMENTATION.md`.

## What is included

- `index.html` / `app.js` / `style.css` — the dashboard itself (Leaflet + Chart.js), including spatial analysis, gas trend panels, and an admin panel.
- `backend.py` — Flask API (port 5002) providing authentication, the emissions/landfills data endpoints, and admin CSV/GeoJSON upload + user management. Stores users and tokens in `dashboard.db` (SQLite, not committed).
- `server.py` — Flask API (port 5001) that proxies live Google Earth Engine raster tiles, LGA/ward stats, pixel lookups, and trend data.
- `prepare_dashboard_data.py` / `prepare_dashboard_data.js` / `convert_csvs.py` / `convert_landfills.py` — data preparation scripts that turn source shapefiles/CSVs into the GeoJSON files under `data/`.
- `data/`: generated GeoJSON datasets consumed by the dashboard (`lga_emissions.geojson`, `landfills.geojson`, `emission_points.geojson`, `lga_boundary.geojson`, `places.geojson`).

## How to use

1. Install dependencies:

```powershell
npm install
pip install -r requirements.txt
```

2. (Optional) Regenerate the GeoJSON data from source files:

```powershell
npm run prepare-data
```

If you want to keep using Python instead, `prepare_dashboard_data.py`, `convert_csvs.py`, and `convert_landfills.py` still work and produce the same output files in `data/`.

3. Start the backend API (public data, admin login, uploads):

```powershell
python backend.py
```

4. (Optional) Start the GEE proxy for live raster/trend tiles:

```powershell
python server.py
```

5. Serve the dashboard's static files:

```powershell
npm run serve
```

Or use Python if you prefer:

```powershell
python -m http.server 8000
```

6. Open the dashboard in your browser:

```
http://localhost:8000/index.html
```

Public users can view the dashboard immediately. Admin users can select Admin Login, sign in with the default credentials (`admin` / `admin123`), and should change the password immediately via the admin panel.

## Notes

- The dashboard talks to `backend.py` (port 5002) for emissions/landfills data, auth, and admin uploads, and optionally to `server.py` (port 5001) for live GEE tiles — both must be running for full functionality.
- `dashboard.db` is created automatically by `backend.py` on first run and is intentionally untracked (see `.gitignore`).
- The UI is responsive, with a dedicated mobile layout (collapsible sidebar, bottom nav, bottom-sheet info panel).
- If you add ward boundaries, dumpsite locations, or population data later, the same dashboard structure can be extended.
