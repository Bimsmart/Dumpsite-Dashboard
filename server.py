"""
server.py — Lagos ERM GEE Live Server
Mirrors GEE export script exactly. Serves:
  - Raster tiles (emission surface, hotspots)
  - LGA stats JSON (replaces lga_emissions.geojson)
  - Ward stats JSON (replaces ward CSVs)
  - Boundary tiles (LGA outlines, Lagos state)
  - Pixel values + trends at any point
Run: python server.py
"""

import os, json
from datetime import date
from flask import Flask, jsonify, request
from flask_cors import CORS
import ee

# ── Config ────────────────────────────────────────────────
SERVICE_ACCOUNT = 'dumpsite-dasboard@ee-bolawenlab66.iam.gserviceaccount.com'
ROOT     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')

app = Flask(__name__)
CORS(app)

# ── Tile URL helper ───────────────────────────────────────
def get_tile_url(map_id):
    if hasattr(map_id.get('tile_fetcher', None), 'url_format'):
        return map_id['tile_fetcher'].url_format
    if 'urlFormat' in map_id:
        return map_id['urlFormat']
    return f"https://earthengine.googleapis.com/v1/{map_id.get('mapid','')}/tiles/{{z}}/{{x}}/{{y}}"

# ── Authenticate ──────────────────────────────────────────
def init_ee():
    key_path = None
    for f in os.listdir(DATA_DIR):
        if f.endswith('.json') and 'geojson' not in f.lower():
            key_path = os.path.join(DATA_DIR, f)
            break
    if not key_path:
        raise FileNotFoundError('Service account key not found in data/')
    print(f'Using key: {key_path}')
    credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, key_path)
    ee.Initialize(credentials, opt_url='https://earthengine.googleapis.com')
    print('✅ GEE authenticated')

init_ee()

# ── Assets ────────────────────────────────────────────────
ASSETS = {
    'lga':       'projects/ee-bolawenlab66/assets/lagos_lga',
    'wards':     'projects/ee-bolawenlab66/assets/ngaWards',
    'landfills': 'projects/ee-bolawenlab66/assets/landfills',
}

IMAGE_ASSETS = {
    'stack': os.environ.get('GEE_STACK_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/Lagos_Gases_{year}'),
    'ch4': os.environ.get('GEE_CH4_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/CH4_{year}'),
    'no2': os.environ.get('GEE_NO2_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/NO2_{year}'),
    'co': os.environ.get('GEE_CO_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/CO_{year}'),
    'isi': os.environ.get('GEE_ISI_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/ISI_{year}'),
    'hotspots': os.environ.get('GEE_HOTSPOTS_ASSET_TEMPLATE', 'projects/ee-bolawenlab66/assets/Hotspots_{year}'),
}

START_YEAR = 2018
YEARS = list(range(START_YEAR, date.today().year + 1))
CACHE_VERSION = 'aoi-mask-v2'

# ── Cached objects ────────────────────────────────────────
_cache           = {}
_extent_cache    = None
_state_mask_cache = {}
_aoi_fc_cache    = None
_lga_fc_cache    = None
_wards_fc_cache  = None
_landfills_fc_cache = None
_lga_cache       = {}  # year → LGA stats
_ward_cache      = {}  # year → ward stats

# ── Asset helpers — single load point for every FC ───────
def get_lga_fc():
    global _lga_fc_cache
    if _lga_fc_cache is None:
        _lga_fc_cache = ee.FeatureCollection(ASSETS['lga'])
    return _lga_fc_cache

def get_aoi_fc():
    """Local Lagos AOI boundary used for raster clipping."""
    global _aoi_fc_cache
    if _aoi_fc_cache is None:
        path = os.path.join(DATA_DIR, 'lga_boundary.geojson')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                _aoi_fc_cache = ee.FeatureCollection(json.load(f).get('features', []))
        else:
            _aoi_fc_cache = get_lga_fc()
    return _aoi_fc_cache

def get_wards_fc():
    global _wards_fc_cache
    if _wards_fc_cache is None:
        _wards_fc_cache = ee.FeatureCollection(ASSETS['wards'])
    return _wards_fc_cache

def get_landfills_fc():
    global _landfills_fc_cache
    if _landfills_fc_cache is None:
        _landfills_fc_cache = ee.FeatureCollection(ASSETS['landfills'])
    return _landfills_fc_cache

def get_lagos_extent():
    """Dissolved Lagos state boundary (ee.Geometry) — for clipping."""
    global _extent_cache
    if _extent_cache is None:
        _extent_cache = get_aoi_fc().geometry().dissolve()
    return _extent_cache

def get_state_mask():
    """Painted binary mask image from the dissolved LGA boundary — clean tile edges."""
    if 'mask' not in _state_mask_cache:
        _state_mask_cache['mask'] = ee.Image.constant(0).byte().paint(get_aoi_fc(), 1).selfMask()
    return _state_mask_cache['mask']

def mask_to_aoi(img, geometry=None):
    """Clip an image and hide pixels outside the AOI boundary."""
    geom = geometry or get_lagos_extent()
    mask = get_state_mask().reproject(crs=img.projection(), scale=1000)
    return img.clip(geom).updateMask(mask)

def format_image_asset(template, metric, year):
    return template.format(year=year, metric=metric, metric_upper=metric.upper())

# Band order in the multiband Lagos_Gases stack (matches local GeoTIFF layout)
STACK_BAND_INDEX = {'ch4': 0, 'no2': 1, 'co': 2, 'isi': 3, 'hotspots': 4}

def get_asset_image(metric, year, asset_key=None):
    key = asset_key or 'stack'
    if key not in IMAGE_ASSETS:
        key = 'stack'  # always fall back to the multiband stack

    asset_id = format_image_asset(IMAGE_ASSETS[key], metric, year)
    img = ee.Image(asset_id)

    if key == 'stack':
        band_names = img.bandNames()
        preferred = {
            'ch4':      ['ch4', 'CH4', 'CH4_column_volume_mixing_ratio_dry_air'],
            'no2':      ['no2', 'NO2', 'tropospheric_NO2_column_number_density'],
            'co':       ['co', 'CO', 'CO_column_number_density'],
            'isi':      ['isi', 'ISI'],
            'hotspots': ['hotspots', 'Hotspots', 'HOTSPOTS'],
        }.get(metric, [metric])

        # Fallback: select by position (b1…b5) when bands are unnamed
        band_idx = STACK_BAND_INDEX.get(metric, 0)
        selected = ee.String(band_names.get(band_idx))
        for band in reversed(preferred):
            selected = ee.Algorithms.If(band_names.contains(band), band, selected)
        img = img.select(ee.String(selected)).rename(metric)
    else:
        img = img.select(0).rename(metric)

    if metric == 'no2':
        img = img.max(ee.Image(0)).rename(metric)
    return mask_to_aoi(img)

def get_distance_raster():
    return mask_to_aoi(get_landfills_fc().distance(10000))

# ── Core functions — mirrors GEE script exactly ───────────
def get_yearly_gases(year, mask_geometry):
    start = ee.Date.fromYMD(year, 1, 1)
    end   = ee.Date.fromYMD(year, 12, 31)

    def safe_mean(col, band_name):
        img = col.mean().rename(band_name)
        return ee.Image(ee.Algorithms.If(
            col.size().gt(0), img,
            ee.Image.constant(0).rename(band_name).toFloat()
        ))

    ch4 = safe_mean(
        ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4')
          .select('CH4_column_volume_mixing_ratio_dry_air')
          .filterDate(start, end).filterBounds(mask_geometry), 'ch4')
    no2 = safe_mean(
        ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
          .select('tropospheric_NO2_column_number_density')
          .filterDate(start, end).filterBounds(mask_geometry), 'no2')
    co  = safe_mean(
        ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CO')
          .select('CO_column_number_density')
          .filterDate(start, end).filterBounds(mask_geometry), 'co')

    return mask_to_aoi(ee.Image.cat([ch4, no2, co]), mask_geometry)

def compute_isi(gases, mask_geometry):
    ch4_norm = gases.select('ch4').unitScale(1750, 1950).clamp(0, 1)
    no2_norm = gases.select('no2').unitScale(0.00002, 0.0002).clamp(0, 1)
    co_norm  = gases.select('co').unitScale(0.02, 0.08).clamp(0, 1)
    return (ch4_norm.multiply(0.4)
              .add(no2_norm.multiply(0.35))
              .add(co_norm.multiply(0.25))
              .rename('isi'))

def compute_hotspots(isi, mask_geometry):
    threshold = isi.reduceRegion(
        reducer=ee.Reducer.percentile([90]),
        geometry=mask_geometry, scale=1000,
        bestEffort=True, maxPixels=int(1e13)
    ).getNumber('isi')
    threshold = ee.Number(ee.Algorithms.If(threshold, threshold, ee.Number(0)))
    return isi.gt(threshold).rename('hotspots').toFloat()

def build_stack(year, mask_geometry):
    gases = get_yearly_gases(year, mask_geometry)
    isi   = compute_isi(gases, mask_geometry)
    hspot = compute_hotspots(isi, mask_geometry)
    return mask_to_aoi(ee.Image.cat([
        gases.select('ch4').toFloat(),
        gases.select('no2').toFloat(),
        gases.select('co').toFloat(),
        isi.toFloat(),
        hspot.toFloat()
    ]), mask_geometry)

# ── Vis params ────────────────────────────────────────────
VIS = {
    'ch4':      {'min':1750,   'max':2000,    'palette':['#16a34a','#84cc16','#facc15','#f97316','#dc2626']},
    'no2':      {'min':0,      'max':0.00020, 'palette':['#16a34a','#84cc16','#facc15','#f97316','#dc2626']},
    'co':       {'min':0.02,   'max':0.08,    'palette':['#16a34a','#84cc16','#facc15','#f97316','#dc2626']},
    'isi':      {'min':0.2,    'max':0.7,     'palette':['#ffffcc','#fd8d3c','#800026']},
    'hotspots': {'min':0,      'max':1,       'palette':['00000000','#ff4d6a']},
}

CH4_MOL = 2.1e-5  # ppb → mol/m²

# ═══════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════

@app.route('/health')
def health():
    return jsonify({'status':'ok', 'service':'Lagos ERM GEE Server', 'years': YEARS})


# ── Raster tiles ─────────────────────────────────────────
@app.route('/gee-assets')
def get_gee_assets():
    return jsonify({
        'feature_assets': ASSETS,
        'image_asset_templates': IMAGE_ASSETS,
        'years': YEARS,
        'metrics': list(VIS.keys()),
    })


@app.route('/tiles/<metric>/<int:year>')
def get_tiles(metric, year):
    key = f'{CACHE_VERSION}_{metric}_{year}'
    if key in _cache:
        return jsonify({'url':_cache[key], 'cached':True})
    try:
        extent = get_lagos_extent()
        gases  = get_yearly_gases(year, extent)

        if   metric == 'ch4':      img = gases.select('ch4')
        elif metric == 'no2':      img = gases.select('no2').max(ee.Image(0))
        elif metric == 'co':       img = gases.select('co')
        elif metric == 'isi':      img = compute_isi(gases, extent)
        elif metric == 'hotspots':
            isi = compute_isi(gases, extent)
            img = compute_hotspots(isi, extent)
        else:
            return jsonify({'error':f'Unknown metric: {metric}'}), 400

        # Create binary mask from LGA boundary polygon — pixels outside = 0
        img = mask_to_aoi(img, extent)
        map_id = img.getMapId(VIS[metric])
        url    = get_tile_url(map_id)
        _cache[key] = url
        print(f'✅ Tiles: {metric}/{year}')
        return jsonify({'url':url})
    except Exception as e:
        print(f'❌ {e}')
        return jsonify({'error':str(e)}), 500


# ── LGA stats — mirrors processRegion(lga) ───────────────
@app.route('/asset-tiles/<metric>/<int:year>')
def get_asset_tiles(metric, year):
    # Default to 'stack' — only Lagos_Gases_{year} multiband assets were ingested;
    # individual CH4/NO2/CO/ISI assets do not exist.
    asset_key = request.args.get('asset', 'stack')
    key = f'{CACHE_VERSION}_asset_{asset_key}_{metric}_{year}'
    if key in _cache:
        return jsonify({'url': _cache[key], 'cached': True, 'asset': asset_key})
    try:
        if metric not in VIS:
            return jsonify({'error': f'Unknown metric: {metric}'}), 400
        img = get_asset_image(metric, year, asset_key)
        map_id = img.getMapId(VIS[metric])
        url = get_tile_url(map_id)
        _cache[key] = url
        print(f'Asset tiles: {asset_key}/{metric}/{year}')
        return jsonify({'url': url, 'asset': asset_key, 'metric': metric, 'year': year})
    except Exception as e:
        print(f'Asset tiles {asset_key}/{metric}/{year}: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/lga-stats/<int:year>')
def get_lga_stats(year):
    """
    Returns LGA zonal stats for a year — same as LGA_YYYY.csv.
    Includes ch4, no2, co, isi, hotspots,
    nearest_landfill_distance_m, local_ch4_1km, lon, lat.
    """
    if year in _lga_cache:
        return jsonify(_lga_cache[year])
    try:
        extent   = get_lagos_extent()
        lga_fc   = ee.FeatureCollection(ASSETS['lga'])
        stack    = build_stack(year, extent)
        gases    = get_yearly_gases(year, extent)
        dist_r   = get_distance_raster()

        zonal = stack.reduceRegions(
            collection=lga_fc, reducer=ee.Reducer.mean(), scale=1000)

        def enrich(feature):
            geom     = feature.geometry()
            centroid = geom.centroid()
            coords   = centroid.coordinates()
            buf      = centroid.buffer(1000)
            local_ch4 = gases.select('ch4').reduceRegion(
                reducer=ee.Reducer.mean(), geometry=buf,
                scale=1000, maxPixels=int(1e13))
            min_dist = dist_r.reduceRegion(
                reducer=ee.Reducer.min(), geometry=geom,
                scale=1000, maxPixels=int(1e13))
            return feature.set({
                'longitude':                   coords.get(0),
                'latitude':                    coords.get(1),
                'year':                        year,
                'nearest_landfill_distance_m': min_dist.get('distance'),
                'local_ch4_1km':               local_ch4.get('ch4'),
            })

        enriched = zonal.map(enrich)
        result   = enriched.getInfo()

        features = []
        for f in result['features']:
            p = f['properties']
            ch4_ppb = p.get('ch4') or 0
            features.append({
                'lga_name':   p.get('LGA_NAME') or p.get('lganame') or '',
                'longitude':  p.get('longitude') or 0,
                'latitude':   p.get('latitude')  or 0,
                'year':       year,
                'ch4':        ch4_ppb * CH4_MOL,
                'ch4_ppb':    ch4_ppb,
                'no2':        max(0, p.get('no2') or 0),
                'co':         p.get('co')       or 0,
                'isi':        p.get('isi')       or 0,
                'hotspots':   p.get('hotspots')  or 0,
                'nearest_landfill_distance_m': p.get('nearest_landfill_distance_m') or 0,
                'local_ch4_1km': (p.get('local_ch4_1km') or 0) * CH4_MOL,
            })

        _lga_cache[year] = features
        print(f'✅ LGA stats: {year} ({len(features)} LGAs)')
        return jsonify(features)
    except Exception as e:
        print(f'❌ LGA stats {year}: {e}')
        return jsonify({'error': str(e)}), 500


# ── All years LGA stats ───────────────────────────────────
@app.route('/lga-stats/all')
def get_all_lga_stats():
    """Returns LGA stats for all 8 years — used on dashboard init."""
    try:
        all_data = {}
        for year in YEARS:
            if year in _lga_cache:
                all_data[str(year)] = _lga_cache[year]
            else:
                resp = get_lga_stats(year)
                data = resp.get_json()
                if isinstance(data, list):
                    all_data[str(year)] = data
        return jsonify(all_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Ward stats — mirrors processRegion(wards) ────────────
@app.route('/ward-stats/<int:year>')
def get_ward_stats(year):
    """Returns ward zonal stats — same as WARDS_YYYY.csv."""
    if year in _ward_cache:
        return jsonify(_ward_cache[year])
    try:
        wards_fc  = ee.FeatureCollection(ASSETS['wards'])
        extent    = wards_fc.geometry().dissolve()
        stack     = build_stack(year, extent)
        gases     = get_yearly_gases(year, extent)
        dist_r    = get_distance_raster()

        zonal = stack.reduceRegions(
            collection=wards_fc, reducer=ee.Reducer.mean(), scale=1000)

        def enrich(feature):
            geom     = feature.geometry()
            centroid = geom.centroid()
            coords   = centroid.coordinates()
            buf      = centroid.buffer(1000)
            local_ch4 = gases.select('ch4').reduceRegion(
                reducer=ee.Reducer.mean(), geometry=buf,
                scale=1000, maxPixels=int(1e13))
            min_dist = dist_r.reduceRegion(
                reducer=ee.Reducer.min(), geometry=geom,
                scale=1000, maxPixels=int(1e13))
            return feature.set({
                'longitude': coords.get(0),
                'latitude':  coords.get(1),
                'year':      year,
                'nearest_landfill_distance_m': min_dist.get('distance'),
                'local_ch4_1km': local_ch4.get('ch4'),
            })

        enriched = zonal.map(enrich)
        result   = enriched.getInfo()

        features = []
        for f in result['features']:
            p = f['properties']
            ch4_ppb = p.get('ch4') or 0
            features.append({
                'ward_name':  p.get('wardname') or '',
                'longitude':  p.get('longitude') or 0,
                'latitude':   p.get('latitude')  or 0,
                'year':       year,
                'ch4':        ch4_ppb * CH4_MOL,
                'no2':        max(0, p.get('no2') or 0),
                'co':         p.get('co')      or 0,
                'isi':        p.get('isi')      or 0,
                'hotspots':   p.get('hotspots') or 0,
                'nearest_landfill_distance_m': p.get('nearest_landfill_distance_m') or 0,
            })

        _ward_cache[year] = features
        print(f'✅ Ward stats: {year} ({len(features)} wards)')
        return jsonify(features)
    except Exception as e:
        print(f'❌ Ward stats {year}: {e}')
        return jsonify({'error': str(e)}), 500


# ── Pixel values at point ─────────────────────────────────
@app.route('/pixel')
def get_pixel():
    try:
        lat   = float(request.args.get('lat'))
        lng   = float(request.args.get('lng'))
        year  = int(request.args.get('year', 2025))
        extent = get_lagos_extent()
        gases  = get_yearly_gases(year, extent)
        isi    = compute_isi(gases, extent)
        hspot  = compute_hotspots(isi, extent)
        stack  = ee.Image.cat([gases, isi, hspot])
        point  = ee.Geometry.Point([lng, lat]).buffer(1000)
        values = stack.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=point,
            scale=1000, maxPixels=int(1e13)).getInfo()
        ch4_ppb = values.get('ch4') or 0
        return jsonify({
            'lat': lat, 'lng': lng, 'year': year,
            'ch4':     ch4_ppb * CH4_MOL,
            'ch4_ppb': ch4_ppb,
            'no2':     max(0, values.get('no2') or 0),
            'co':      values.get('co')       or 0,
            'isi':     values.get('isi')       or 0,
            'hotspot': values.get('hotspots')  or 0,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Trend at point (2018–2025) ────────────────────────────
@app.route('/trend')
def get_trend():
    try:
        lat    = float(request.args.get('lat'))
        lng    = float(request.args.get('lng'))
        point  = ee.Geometry.Point([lng, lat]).buffer(1000)
        extent = get_lagos_extent()
        result = {}
        for year in YEARS:
            gases = get_yearly_gases(year, extent)
            isi   = compute_isi(gases, extent)
            vals  = ee.Image.cat([gases, isi]).reduceRegion(
                reducer=ee.Reducer.mean(), geometry=point,
                scale=1000, maxPixels=int(1e13)).getInfo()
            result[str(year)] = {
                'ch4': (vals.get('ch4') or 0) * CH4_MOL,
                'no2': max(0, vals.get('no2') or 0),
                'co':  vals.get('co')  or 0,
                'isi': vals.get('isi') or 0,
            }
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Boundary tile endpoints ───────────────────────────────
@app.route('/lga-boundary-tiles')
def get_lga_boundary():
    key = 'lga_boundary'
    if key in _cache: return jsonify({'url': _cache[key]})
    try:
        lga    = ee.FeatureCollection(ASSETS['lga'])
        img    = lga.style(color='ffffff', fillColor='00000000', width=1.5)
        map_id = img.getMapId({})
        url    = get_tile_url(map_id)
        _cache[key] = url
        return jsonify({'url': url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/lagos-boundary-tiles')
def get_lagos_boundary():
    key = 'lagos_boundary'
    if key in _cache: return jsonify({'url': _cache[key]})
    try:
        dissolved = get_lagos_extent()
        img = ee.Image().byte().paint(
            featureCollection=ee.FeatureCollection([ee.Feature(dissolved)]),
            color=1, width=3)
        map_id = img.getMapId({'palette':['00d4ff'], 'min':1, 'max':1})
        url    = get_tile_url(map_id)
        _cache[key] = url
        return jsonify({'url': url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/merge-tiles')
def merge_tiles():
    try:
        metric_a = request.args.get('a', 'ch4')
        metric_b = request.args.get('b', 'hotspots')
        year     = int(request.args.get('year', 2025))
        key      = f'merge_{metric_a}_{metric_b}_{year}'
        if key in _cache: return jsonify({'url': _cache[key]})

        extent = get_lagos_extent()
        gases  = get_yearly_gases(year, extent)
        isi    = compute_isi(gases, extent)

        def get_img(m):
            if m == 'ch4':      return gases.select('ch4')
            if m == 'no2':      return gases.select('no2').max(ee.Image(0))
            if m == 'co':       return gases.select('co')
            if m == 'isi':      return isi
            if m == 'hotspots': return compute_hotspots(isi, extent)
            return gases.select('ch4')

        merged = get_img(metric_a).visualize(**VIS.get(metric_a, VIS['ch4'])) \
                   .blend(get_img(metric_b).visualize(**VIS.get(metric_b, VIS['hotspots']))) \
                   .clip(extent)
        map_id = merged.getMapId({})
        url    = get_tile_url(map_id)
        _cache[key] = url
        return jsonify({'url': url, 'a': metric_a, 'b': metric_b})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print('🌿 Lagos ERM GEE Server starting on http://localhost:5001')
    print('   Dashboard should run on http://localhost:5500')
    app.run(host='0.0.0.0', port=5001, debug=False)
