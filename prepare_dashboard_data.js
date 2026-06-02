const fs = require('fs').promises;
const path = require('path');
const shapefile = require('shapefile');
const { parse } = require('csv-parse/sync');

const ROOT = path.dirname(__filename);
const LGA_SHP = path.join(ROOT, 'lga_boundary', 'lga.shp');
const GAS_DIR = path.join(ROOT, 'Lagos_Gases', 'Lagos_Gases');
const OUTPUT_DIR = path.join(ROOT, 'data');
const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const METRICS = ['ch4', 'no2', 'co', 'isi', 'hotspots'];

function normalizeLgaName(value) {
  if (value === undefined || value === null) return '';
  let text = String(value).trim();
  text = text.replace(/[()]/g, '');
  text = text.replace(/\s*\/\s*/g, '/');
  text = text.replace(/\u00A0/g, ' ');
  text = text.replace(/[\s-]+/g, '-');
  text = text.replace(/\s+/g, ' ');
  return text.toLowerCase();
}

async function readLgaBoundaries(shpPath) {
  const reader = await shapefile.open(shpPath);
  const features = [];
  let result = await reader.read();

  while (!result.done) {
    const { properties = {}, geometry } = result.value || {};
    const keys = Object.keys(properties);
    const lgaKey = keys.find(key => key.toLowerCase() === 'lganame');
    if (!lgaKey) {
      throw new Error('Expected lganame field in LGA shapefile');
    }

    const lgaName = properties[lgaKey];
    features.push({
      type: 'Feature',
      properties: {
        lganame: lgaName,
        lga_match: normalizeLgaName(lgaName),
      },
      geometry,
    });

    result = await reader.read();
  }

  return { type: 'FeatureCollection', features };
}

function normalizeRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = value;
  }
  return normalized;
}

async function readGasCSVs(baseDir) {
  const emissions = {};
  const pointFeatures = [];

  for (const year of YEARS) {
    const csvPath = path.join(baseDir, year, `Lagos_All_Gases_${year}.csv`);
    try {
      const csvText = await fs.readFile(csvPath, 'utf8');
      const rows = parse(csvText, { columns: true, skip_empty_lines: true });

      for (const rawRow of rows) {
        const row = normalizeRow(rawRow);
        const lga = normalizeLgaName(row['adm2_name']);
        if (!lga) continue;

        const values = { year };
        for (const metric of METRICS) {
          const raw = row[metric] || '';
          const parsed = parseFloat(raw);
          values[metric] = raw.trim() === '' || raw.toUpperCase() === 'NA' || Number.isNaN(parsed) ? null : parsed;
        }

        const lat = row['latitude'] ? parseFloat(row['latitude']) : null;
        const lon = row['longitude'] ? parseFloat(row['longitude']) : null;
        values.latitude = Number.isFinite(lat) ? lat : null;
        values.longitude = Number.isFinite(lon) ? lon : null;

        emissions[lga] = emissions[lga] || {};
        emissions[lga][year] = values;

        if (values.latitude !== null && values.longitude !== null) {
          pointFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [values.longitude, values.latitude] },
            properties: {
              lganame: row['adm2_name'] || '',
              year,
              ...METRICS.reduce((acc, metric) => {
                acc[metric] = values[metric];
                return acc;
              }, {}),
            },
          });
        }
      }
    } catch (err) {
      throw new Error(`Failed to read CSV ${csvPath}: ${err.message}`);
    }
  }

  return { emissions, pointFeatures };
}

function createGeoJSONFeatures(boundaries, emissionsByLga) {
  const features = [];
  const unmatched = [];

  for (const feature of boundaries.features) {
    const matchKey = feature.properties.lga_match;
    const values = emissionsByLga[matchKey] || {};

    for (const year of YEARS) {
      for (const metric of METRICS) {
        feature.properties[`${metric}_${year}`] = values[year] ? values[year][metric] : null;
      }
    }

    features.push(feature);
    if (!Object.keys(values).length) unmatched.push(feature.properties.lganame);
  }

  const csvKeys = Object.keys(emissionsByLga).sort();
  const shpKeys = boundaries.features.map(f => f.properties.lga_match).sort();
  const extraCsv = csvKeys.filter(k => !shpKeys.includes(k));

  if (unmatched.length) {
    console.warn('Warning: these LGAs were not matched to CSV data:', unmatched);
  }
  if (extraCsv.length) {
    console.warn('Warning: these CSV LGAs were not matched to shapefile:', extraCsv);
  }

  return { type: 'FeatureCollection', features };
}

async function saveJSON(data, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved ${filePath}`);
}

async function main() {
  console.log('Reading LGA boundaries...');
  const boundaries = await readLgaBoundaries(LGA_SHP);

  console.log('Reading gas CSV data...');
  const { emissions, pointFeatures } = await readGasCSVs(GAS_DIR);

  console.log('Creating joined LGA GeoJSON...');
  const joined = createGeoJSONFeatures(boundaries, emissions);
  await saveJSON(joined, path.join(OUTPUT_DIR, 'lga_emissions.geojson'));

  console.log('Creating point measurement GeoJSON...');
  const pointCollection = { type: 'FeatureCollection', features: pointFeatures };
  await saveJSON(pointCollection, path.join(OUTPUT_DIR, 'emission_points.geojson'));

  console.log('Dashboard data preparation complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
