#!/usr/bin/env python3
"""
convert_csvs.py
===============
Converts Lagos_All_Gases_YYYY.csv files into:

  data/lga_emissions.geojson  — one Feature per LGA with aggregated per-year
                                 metric properties: ch4_YYYY, no2_YYYY, co_YYYY,
                                 isi_YYYY, hotspots_YYYY  (for every year 2018-2025)

NOTE: landfills.geojson is NOT produced here — it comes from your existing
      convert_landfills.py script which reads the shapefile of the 5 landfill sites.

Because LGA_NAME is blank in the CSVs, the script spatially joins each emission
point against data/lga_boundary.geojson to assign the correct LGA name.

Usage
-----
Place this script in the root of your project (same level as the data/ folder)
and run:

    python convert_csvs.py

Requirements:  pip install pandas shapely
"""

import os, sys, glob, json, math
import pandas as pd
from shapely.geometry import shape, Point

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT          = os.path.dirname(os.path.abspath(__file__))
# If a folder argument is given, resolve it relative to ROOT if not absolute
if len(sys.argv) > 1:
    arg = sys.argv[1]
    CSV_FOLDER = arg if os.path.isabs(arg) else os.path.join(ROOT, arg)
else:
    CSV_FOLDER = ROOT
DATA_DIR      = os.path.join(ROOT, 'data')
BOUNDARY      = os.path.join(DATA_DIR, 'lga_boundary.geojson')
OUT_EMISSIONS = os.path.join(DATA_DIR, 'lga_emissions.geojson')

YEARS   = [str(y) for y in range(2018, 2026)]
METRICS = ['ch4', 'no2', 'co', 'isi', 'hotspots']

# CH₄ conversion: Sentinel-5P CH₄ is in ppb (parts-per-billion).
# NO₂ and CO are already in mol/m². To match scales, convert CH₄ ppb → mol/m²:
#   mol/m² = ppb × 1e-9 × dry_air_column (≈ 2.1×10⁴ mol/m²)
CH4_PPB_TO_MOL_M2 = 2.1e-5
# ─────────────────────────────────────────────────────────────────────────────


def safe_float(val):
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


# ── 1. Load LGA boundary polygons ─────────────────────────────────────────────
def load_boundaries():
    if not os.path.exists(BOUNDARY):
        raise FileNotFoundError(
            f"Cannot find {BOUNDARY}\n"
            "Make sure lga_boundary.geojson is in the data/ folder."
        )
    with open(BOUNDARY) as f:
        gj = json.load(f)

    polygons = []
    for feat in gj['features']:
        name = (feat['properties'].get('lganame')
                or feat['properties'].get('LGA_NAME')
                or feat['properties'].get('name', 'Unknown'))
        try:
            poly = shape(feat['geometry'])
            polygons.append((name, poly))
        except Exception:
            pass
    print(f"  ✓  Loaded {len(polygons)} LGA boundary polygons")
    return polygons


def assign_lga(lon, lat, polygons):
    """Return the LGA name whose polygon contains (lon, lat).
       Falls back to nearest centroid if no polygon contains the point."""
    pt = Point(lon, lat)
    for name, poly in polygons:
        if poly.contains(pt):
            return name
    # fallback: nearest centroid
    best, best_dist = None, float('inf')
    for name, poly in polygons:
        d = pt.distance(poly.centroid)
        if d < best_dist:
            best_dist = d
            best = name
    return best


# ── 2. Load all CSVs ──────────────────────────────────────────────────────────
def load_all_csvs():
    frames = []
    found_years = set()
    # Search CSV_FOLDER and all immediate subfolders (handles nested Lagos_Gases/Lagos_Gases)
    search_dirs = [CSV_FOLDER] + [
        os.path.join(CSV_FOLDER, d) for d in os.listdir(CSV_FOLDER)
        if os.path.isdir(os.path.join(CSV_FOLDER, d))
    ]
    # Collect all matching CSV paths across all search dirs
    all_paths = set()
    for search_dir in search_dirs:
        for pattern in ['Lagos_All_Gases_*.csv', 'Lagos_All_Gases*.csv']:
            all_paths.update(glob.glob(os.path.join(search_dir, pattern)))

    for path in sorted(all_paths):
        df = pd.read_csv(path)
        df.columns = [c.strip().lower() for c in df.columns]
        if 'lga_name' not in df.columns and 'lganame' in df.columns:
            df = df.rename(columns={'lganame': 'lga_name'})
        year_val = str(int(df['year'].iloc[0])) if 'year' in df.columns else 'unknown'
        if year_val in found_years:
            continue  # skip duplicates (e.g. Lagos_All_Gases2020 vs Lagos_All_Gases_2020)
        found_years.add(year_val)
        df['year'] = year_val
        print(f"  ✓  {os.path.basename(path)}  ({len(df)} rows, year={year_val})")
        frames.append(df)

    if not frames:
        raise FileNotFoundError(
            f"No CSVs found in '{CSV_FOLDER}' or its subfolders.\n"
            "Check that the folder contains Lagos_All_Gases_YYYY.csv files."
        )

    missing = [y for y in YEARS if y not in found_years]
    if missing:
        print(f"  ⚠  No CSV found for years: {', '.join(missing)}")

    return pd.concat(frames, ignore_index=True)


# ── 3. Spatial join ───────────────────────────────────────────────────────────
def enrich_with_lga(df, polygons):
    print(f"\n  Spatially joining {len(df)} points to LGA boundaries …")
    names = []
    for _, row in df.iterrows():
        lon = safe_float(row.get('longitude'))
        lat = safe_float(row.get('latitude'))
        names.append(assign_lga(lon, lat, polygons) if lon and lat else None)
    df = df.copy()
    df['lga_name'] = names
    assigned = sum(1 for n in names if n)
    print(f"  ✓  Assigned LGA name to {assigned}/{len(df)} points")
    return df


# ── 4. Build lga_emissions.geojson ────────────────────────────────────────────
def build_lga_emissions(df, polygons):
    # Use polygon centroids for feature geometry (more accurate than point mean)
    centroids = {name: (poly.centroid.x, poly.centroid.y) for name, poly in polygons}

    features = []
    for lga_name, group in df.groupby('lga_name'):
        if not lga_name:
            continue
        lon, lat = centroids.get(lga_name, (group['longitude'].mean(), group['latitude'].mean()))

        props = {'lganame': lga_name}
        for year in YEARS:
            yr = group[group['year'] == year]
            for metric in METRICS:
                key = f"{metric}_{year}"
                if metric in yr.columns and len(yr) > 0:
                    vals = yr[metric].dropna()
                    if len(vals) > 0:
                        mean_val = float(vals.mean())
                        # Convert CH₄ from ppb to mol/m² to match NO₂ and CO scale
                        if metric == 'ch4':
                            mean_val = mean_val * CH4_PPB_TO_MOL_M2
                        props[key] = round(mean_val, 10)
                    else:
                        props[key] = 0
                else:
                    props[key] = 0

        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [round(lon, 8), round(lat, 8)]},
            'properties': props,
        })

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT_EMISSIONS, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': features}, f, separators=(',', ':'))
    print(f"\n  ✅  lga_emissions.geojson  →  {len(features)} LGAs written to {OUT_EMISSIONS}")


# ── main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"\n📂  CSV folder : {CSV_FOLDER}")
    print(f"📁  Output dir : {DATA_DIR}\n")

    polygons = load_boundaries()
    df       = load_all_csvs()
    print(f"\n📊  Total rows loaded: {len(df)}")

    df = enrich_with_lga(df, polygons)
    build_lga_emissions(df, polygons)

    print("\n✅  Done! Run convert_landfills.py separately if you need to")
    print("   regenerate landfills.geojson from the shapefile.\n")