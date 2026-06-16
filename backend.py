"""
backend.py — Lagos ERM Dashboard Data API
Port 5002

Runs alongside server.py (GEE proxy, port 5001).
Start: python backend.py

Default credentials:  admin / admin123   (change after first login)

Endpoints
---------
POST /api/auth/login                        — obtain token
GET  /api/auth/me                           — current user (auth)
GET  /api/emissions                         — lga_emissions.geojson  (auth)
GET  /api/landfills                         — landfills.geojson      (auth)
POST /api/admin/emissions/upload            — CSV → update emissions  (admin)
POST /api/admin/landfills/upload            — GeoJSON → replace landfills (admin)
GET  /api/admin/vectors/<name>              — download current vector GeoJSON (admin)
POST /api/admin/vectors/<name>/upload       — GeoJSON → replace vector file  (admin)
  <name> = places
  (emission_points is generated from the CSV pipeline, not uploaded directly)
  (lga_boundary is managed offline, not exposed through the UI)
GET  /api/admin/users                       — list users  (admin)
POST /api/admin/users                       — create user (admin)
PUT  /api/admin/users/<id>/password         — change password (admin)
DELETE /api/admin/users/<id>                — delete user (admin)
"""

import os, json, sqlite3, csv, io, time, hmac, hashlib, base64, math
from functools import wraps
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

ROOT     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')
DB_PATH  = os.path.join(ROOT, 'dashboard.db')
SECRET   = os.environ.get('BACKEND_SECRET', 'lagos-erm-secret-CHANGE-IN-PRODUCTION')
TOKEN_TTL = 60 * 60 * 24 * 7   # 7 days

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ── Token helpers ──────────────────────────────────────────────────────────────

def _make_token(username, role):
    payload = json.dumps({'u': username, 'r': role, 't': int(time.time())}, separators=(',', ':'))
    p64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip('=')
    sig = hmac.new(SECRET.encode(), p64.encode(), hashlib.sha256).hexdigest()
    return f'{p64}.{sig}'

def _verify_token(token):
    try:
        p64, sig = token.rsplit('.', 1)
        expected = hmac.new(SECRET.encode(), p64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        pad = p64 + '=' * (-len(p64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
        if time.time() - payload['t'] > TOKEN_TTL:
            return None
        return payload
    except Exception:
        return None

def _get_token():
    auth = request.headers.get('Authorization', '')
    return auth[7:] if auth.startswith('Bearer ') else ''

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        payload = _verify_token(_get_token())
        if not payload:
            return jsonify({'error': 'Unauthorized'}), 401
        g.user = payload
        return fn(*args, **kwargs)
    return wrapper

def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        payload = _verify_token(_get_token())
        if not payload:
            return jsonify({'error': 'Unauthorized'}), 401
        if payload.get('r') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        g.user = payload
        return fn(*args, **kwargs)
    return wrapper

# ── Database ───────────────────────────────────────────────────────────────────

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL DEFAULT 'viewer',
            created_at    TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS lga_emissions (
            lganame    TEXT    NOT NULL,
            year       INTEGER NOT NULL,
            ch4        REAL,
            no2        REAL,
            co         REAL,
            isi        REAL,
            hotspots   REAL,
            PRIMARY KEY (lganame, year)
        );
        CREATE TABLE IF NOT EXISTS landfills (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT,
            lat        REAL,
            lng        REAL,
            status     TEXT,
            properties TEXT
        );
    """)
    # Default admin user
    if not db.execute("SELECT 1 FROM users WHERE username='admin'").fetchone():
        db.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?,?,?)",
            ('admin', generate_password_hash('admin123'), 'admin')
        )
        print('  Default admin created — username: admin / password: admin123')
        print('  IMPORTANT: change this password after first login.')
    db.commit()
    _seed_from_files(db)
    db.close()

def _seed_from_files(db):
    """Populate DB from existing GeoJSON files when the DB is first created."""
    if db.execute("SELECT COUNT(*) FROM lga_emissions").fetchone()[0] == 0:
        path = os.path.join(DATA_DIR, 'lga_emissions.geojson')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                gj = json.load(f)
            rows = []
            for feat in gj['features']:
                p = feat['properties']
                name = p.get('lganame', '')
                for year in range(2018, 2031):
                    y = str(year)
                    if f'ch4_{y}' in p or f'no2_{y}' in p:
                        rows.append((name, year,
                            p.get(f'ch4_{y}'), p.get(f'no2_{y}'),
                            p.get(f'co_{y}'),  p.get(f'isi_{y}'),
                            p.get(f'hotspots_{y}')))
            db.executemany(
                "INSERT OR REPLACE INTO lga_emissions VALUES (?,?,?,?,?,?,?)", rows)
            db.commit()
            print(f'  Seeded {len(rows)} emission records from lga_emissions.geojson')

    if db.execute("SELECT COUNT(*) FROM landfills").fetchone()[0] == 0:
        path = os.path.join(DATA_DIR, 'landfills.geojson')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                gj = json.load(f)
            _insert_landfills(db, gj.get('features', []))
            print(f'  Seeded {len(gj["features"])} landfills from landfills.geojson')

# ── GeoJSON builders ───────────────────────────────────────────────────────────

def _build_emissions_geojson(db):
    boundary_path = os.path.join(DATA_DIR, 'lga_boundary.geojson')
    centroids = {}
    if os.path.exists(boundary_path):
        try:
            from shapely.geometry import shape
            with open(boundary_path, encoding='utf-8') as f:
                bj = json.load(f)
            for feat in bj['features']:
                name = feat['properties'].get('lganame') or feat['properties'].get('LGA_NAME', '')
                try:
                    c = shape(feat['geometry']).centroid
                    centroids[name] = [round(c.x, 8), round(c.y, 8)]
                except Exception:
                    pass
        except ImportError:
            pass

    rows = db.execute("SELECT * FROM lga_emissions ORDER BY lganame, year").fetchall()
    by_lga = {}
    for r in rows:
        by_lga.setdefault(r['lganame'], {})[r['year']] = r

    features = []
    for lganame, years in by_lga.items():
        props = {'lganame': lganame}
        for year, r in years.items():
            y = str(year)
            if r['ch4']      is not None: props[f'ch4_{y}']      = r['ch4']
            if r['no2']      is not None: props[f'no2_{y}']      = r['no2']
            if r['co']       is not None: props[f'co_{y}']       = r['co']
            if r['isi']      is not None: props[f'isi_{y}']      = r['isi']
            if r['hotspots'] is not None: props[f'hotspots_{y}'] = r['hotspots']
        coord = centroids.get(lganame, [0.0, 0.0])
        features.append({'type': 'Feature',
                         'geometry': {'type': 'Point', 'coordinates': coord},
                         'properties': props})
    return {'type': 'FeatureCollection', 'features': features}

def _build_landfills_geojson(db):
    rows = db.execute("SELECT * FROM landfills").fetchall()
    features = []
    for r in rows:
        props = json.loads(r['properties']) if r['properties'] else {}
        props.update({'Name': r['name'], 'Status': r['status']})
        features.append({'type': 'Feature',
                         'geometry': {'type': 'Point', 'coordinates': [r['lng'], r['lat']]},
                         'properties': props})
    return {'type': 'FeatureCollection', 'features': features}

def _insert_landfills(db, features):
    db.execute("DELETE FROM landfills")
    for feat in features:
        geom   = feat.get('geometry') or {}
        coords = geom.get('coordinates', [None, None])
        props  = feat.get('properties') or {}
        lng, lat = (coords[0], coords[1]) if len(coords) >= 2 else (None, None)
        name   = props.get('Name') or props.get('name') or props.get('NAME') or ''
        status = props.get('Status') or props.get('status') or ''
        db.execute(
            "INSERT INTO landfills (name, lat, lng, status, properties) VALUES (?,?,?,?,?)",
            (name, lat, lng, status, json.dumps(props)))
    db.commit()

def _save_geojson(data, filename):
    with open(os.path.join(DATA_DIR, filename), 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))

# ── CSV processing ─────────────────────────────────────────────────────────────

CH4_PPB_TO_MOL = 2.1e-5

def _safe_float(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None

def _process_emissions_csv(text):
    """
    Accepts two formats:
      A) Pre-joined — columns: lganame (or lga_name), year, ch4, no2, co, isi, hotspots
      B) Point-based — columns: longitude, latitude, year, ch4, no2, co, isi, hotspots
         (spatial join is performed automatically using lga_boundary.geojson)

    Returns list of (lganame, year, ch4_mol, no2, co, isi, hotspots).
    """
    reader = csv.DictReader(io.StringIO(text))
    rows   = list(reader)
    if not rows:
        raise ValueError('CSV is empty')

    cols = {c.strip().lower() for c in rows[0].keys()}

    def norm(row):
        return {k.strip().lower(): (v.strip() if v else '') for k, v in row.items()}

    # ── Format A: pre-joined ───────────────────────────────
    if 'lganame' in cols or 'lga_name' in cols:
        name_col = 'lganame' if 'lganame' in cols else 'lga_name'
        records = []
        for row in rows:
            r    = norm(row)
            name = r.get(name_col, '').strip()
            year = int(float(r['year'])) if r.get('year') else 0
            if not name or not year:
                continue
            ch4 = _safe_float(r.get('ch4'))
            # Auto-detect ppb vs mol/m² (background CH4 ≈ 1800 ppb; mol/m² ≈ 0.038)
            if ch4 and ch4 > 1:
                ch4 = ch4 * CH4_PPB_TO_MOL
            records.append((name, year, ch4,
                            _safe_float(r.get('no2')), _safe_float(r.get('co')),
                            _safe_float(r.get('isi')), _safe_float(r.get('hotspots'))))
        return records

    # ── Format B: point-based (spatial join) ──────────────
    if 'longitude' in cols and 'latitude' in cols:
        try:
            from shapely.geometry import Point, shape
        except ImportError:
            raise ValueError('shapely is required for spatial-join CSV import. pip install shapely')

        boundary_path = os.path.join(DATA_DIR, 'lga_boundary.geojson')
        if not os.path.exists(boundary_path):
            raise ValueError('lga_boundary.geojson not found — required for spatial join')

        with open(boundary_path, encoding='utf-8') as f:
            bj = json.load(f)
        polygons = []
        for feat in bj['features']:
            lga = feat['properties'].get('lganame') or feat['properties'].get('LGA_NAME', '')
            try:
                polygons.append((lga, shape(feat['geometry'])))
            except Exception:
                pass

        def assign_lga(lon, lat):
            pt = Point(lon, lat)
            for name, poly in polygons:
                if poly.contains(pt):
                    return name
            best, bd = None, float('inf')
            for name, poly in polygons:
                d = pt.distance(poly.centroid)
                if d < bd:
                    bd, best = d, name
            return best

        acc = {}   # (lganame, year) → {metric: [vals]}
        for row in rows:
            r    = norm(row)
            lon  = _safe_float(r.get('longitude'))
            lat  = _safe_float(r.get('latitude'))
            year = int(float(r['year'])) if r.get('year') else 0
            if not lon or not lat or not year:
                continue
            name = assign_lga(lon, lat)
            if not name:
                continue
            key = (name, year)
            bucket = acc.setdefault(key, {m: [] for m in ['ch4', 'no2', 'co', 'isi', 'hotspots']})
            for m in bucket:
                v = _safe_float(r.get(m))
                if v is not None:
                    bucket[m].append(v)

        def mean(vals):
            return sum(vals) / len(vals) if vals else None

        records = []
        for (name, year), bucket in acc.items():
            ch4 = mean(bucket['ch4'])
            if ch4 and ch4 > 1:
                ch4 = ch4 * CH4_PPB_TO_MOL
            records.append((name, year, ch4,
                            mean(bucket['no2']), mean(bucket['co']),
                            mean(bucket['isi']), mean(bucket['hotspots'])))
        return records

    raise ValueError(
        f'Unrecognised CSV format.\n'
        f'Expected columns: lganame/lga_name + year + metrics  OR  '
        f'longitude + latitude + year + metrics.\n'
        f'Got: {", ".join(sorted(cols))}'
    )

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/health')
def api_health():
    return jsonify({'status': 'ok', 'service': 'Lagos ERM Backend', 'version': '1.0'})

# ── Auth ───────────────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    db   = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    db.close()
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid username or password'}), 401
    token = _make_token(username, user['role'])
    return jsonify({'token': token, 'username': username, 'role': user['role']})

@app.route('/api/auth/me')
@require_auth
def me():
    return jsonify({'username': g.user['u'], 'role': g.user['r']})

# ── Data API (viewer + admin) ──────────────────────────────────────────────────

@app.route('/api/emissions')
@require_auth
def get_emissions():
    db = get_db()
    gj = _build_emissions_geojson(db)
    db.close()
    return jsonify(gj)

@app.route('/api/landfills')
@require_auth
def get_landfills():
    db = get_db()
    gj = _build_landfills_geojson(db)
    db.close()
    return jsonify(gj)

# ── Admin: upload emissions CSV ────────────────────────────────────────────────

@app.route('/api/admin/emissions/upload', methods=['POST'])
@require_admin
def upload_emissions():
    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'No file uploaded'}), 400
    try:
        text    = f.read().decode('utf-8-sig')
        records = _process_emissions_csv(text)
        if not records:
            return jsonify({'error': 'No valid records found in CSV'}), 400
        db = get_db()
        db.executemany(
            "INSERT OR REPLACE INTO lga_emissions "
            "(lganame, year, ch4, no2, co, isi, hotspots) VALUES (?,?,?,?,?,?,?)",
            records)
        db.commit()
        gj = _build_emissions_geojson(db)
        db.close()
        _save_geojson(gj, 'lga_emissions.geojson')
        years = sorted({r[1] for r in records})
        lgas  = sorted({r[0] for r in records})
        print(f'Emissions updated: {len(records)} records, years {years}')
        return jsonify({'success': True, 'records': len(records), 'years': years, 'lgas': lgas})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Admin: upload landfills GeoJSON ───────────────────────────────────────────

@app.route('/api/admin/landfills/upload', methods=['POST'])
@require_admin
def upload_landfills():
    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'No file uploaded'}), 400
    try:
        gj = json.loads(f.read().decode('utf-8-sig'))
        if gj.get('type') != 'FeatureCollection':
            return jsonify({'error': 'File must be a GeoJSON FeatureCollection'}), 400
        features = gj.get('features', [])
        if not features:
            return jsonify({'error': 'GeoJSON has no features'}), 400
        db = get_db()
        _insert_landfills(db, features)
        out = _build_landfills_geojson(db)
        db.close()
        _save_geojson(out, 'landfills.geojson')
        print(f'Landfills updated: {len(features)} features')
        return jsonify({'success': True, 'count': len(features)})
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON / GeoJSON file'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Admin: generic vector file upload / download ──────────────────────────────

# Maps URL slug → (filename, allowed geometry types or None for any).
# emission_points.geojson is derived from the CSV pipeline — not uploaded directly.
# lga_boundary.geojson is managed offline — not exposed for upload through the UI.
_VECTOR_LAYERS = {
    'places': ('places.geojson', None),
}

@app.route('/api/admin/vectors/<string:vname>')
@require_admin
def download_vector(vname):
    if vname not in _VECTOR_LAYERS:
        return jsonify({'error': f'Unknown layer "{vname}". Valid: {", ".join(_VECTOR_LAYERS)}'}), 404
    filename, _ = _VECTOR_LAYERS[vname]
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return jsonify({'error': f'{filename} does not exist on the server'}), 404
    with open(path, encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/admin/vectors/<string:vname>/upload', methods=['POST'])
@require_admin
def upload_vector(vname):
    if vname not in _VECTOR_LAYERS:
        return jsonify({'error': f'Unknown layer "{vname}". Valid: {", ".join(_VECTOR_LAYERS)}'}), 404
    filename, allowed_geom_types = _VECTOR_LAYERS[vname]

    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'No file attached (field name: "file")'}), 400
    try:
        gj = json.loads(f.read().decode('utf-8-sig'))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return jsonify({'error': f'Could not parse file as GeoJSON: {e}'}), 400

    if gj.get('type') != 'FeatureCollection':
        return jsonify({'error': 'File must be a GeoJSON FeatureCollection'}), 400
    features = gj.get('features') or []
    if not features:
        return jsonify({'error': 'GeoJSON has no features'}), 400

    if allowed_geom_types:
        bad = [
            i for i, feat in enumerate(features)
            if (feat.get('geometry') or {}).get('type') not in allowed_geom_types
        ]
        if bad:
            sample = bad[:5]
            return jsonify({
                'error': (
                    f'Expected {" or ".join(allowed_geom_types)} geometries for "{vname}". '
                    f'Invalid at feature indices: {sample}'
                    + (' …' if len(bad) > 5 else '')
                )
            }), 400

    backup_path = os.path.join(DATA_DIR, filename + '.bak')
    existing = os.path.join(DATA_DIR, filename)
    if os.path.exists(existing):
        import shutil
        shutil.copy2(existing, backup_path)

    _save_geojson(gj, filename)
    print(f'Vector updated: {filename} ({len(features)} features) by {g.user["u"]}')
    return jsonify({'success': True, 'file': filename, 'count': len(features)})

# ── Admin: user management ─────────────────────────────────────────────────────

@app.route('/api/admin/users')
@require_admin
def list_users():
    db    = get_db()
    users = db.execute("SELECT id, username, role, created_at FROM users ORDER BY id").fetchall()
    db.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/admin/users', methods=['POST'])
@require_admin
def create_user():
    data     = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role     = data.get('role', 'viewer')
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if role not in ('admin', 'viewer'):
        return jsonify({'error': 'Role must be "admin" or "viewer"'}), 400
    try:
        db = get_db()
        db.execute("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)",
                   (username, generate_password_hash(password), role))
        db.commit()
        db.close()
        return jsonify({'success': True, 'username': username, 'role': role})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409

@app.route('/api/admin/users/<int:uid>', methods=['DELETE'])
@require_admin
def delete_user(uid):
    db   = get_db()
    user = db.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404
    if user['username'] == g.user['u']:
        db.close()
        return jsonify({'error': 'Cannot delete your own account'}), 400
    db.execute("DELETE FROM users WHERE id=?", (uid,))
    db.commit()
    db.close()
    return jsonify({'success': True})

@app.route('/api/auth/change-password', methods=['PUT'])
@require_auth
def change_own_password():
    data         = request.get_json() or {}
    current_pass = data.get('current_password') or ''
    new_pass     = data.get('new_password') or ''
    if not current_pass or not new_pass:
        return jsonify({'error': 'current_password and new_password are required'}), 400
    if len(new_pass) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    db   = get_db()
    user = db.execute("SELECT id, password_hash FROM users WHERE username=?", (g.user['u'],)).fetchone()
    if not user or not check_password_hash(user['password_hash'], current_pass):
        db.close()
        return jsonify({'error': 'Current password is incorrect'}), 403
    db.execute("UPDATE users SET password_hash=? WHERE id=?",
               (generate_password_hash(new_pass), user['id']))
    db.commit()
    db.close()
    return jsonify({'success': True})

@app.route('/api/admin/users/<int:uid>/password', methods=['PUT'])
@require_admin
def change_password(uid):
    data     = request.get_json() or {}
    password = data.get('password') or ''
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    db = get_db()
    if not db.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
        db.close()
        return jsonify({'error': 'User not found'}), 404
    db.execute("UPDATE users SET password_hash=? WHERE id=?",
               (generate_password_hash(password), uid))
    db.commit()
    db.close()
    return jsonify({'success': True})

# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('Lagos ERM Backend starting on http://localhost:5002')
    init_db()
    app.run(host='0.0.0.0', port=5002, debug=False)
