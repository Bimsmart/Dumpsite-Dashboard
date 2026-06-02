import argparse
import csv
import json
import os
import shapefile

ROOT = os.path.dirname(os.path.abspath(__file__))
LGA_SHP = os.path.join(ROOT, "lga_boundary", "lga.shp")
GAS_DIR = os.path.join(ROOT, "Lagos_Gases", "Lagos_Gases")
DEFAULT_OUTPUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "lagos-dashboard-data")

YEARS = ["2020", "2021", "2022", "2023", "2024", "2025"]
METRICS = ["ch4", "no2", "co", "isi", "hotspots"]


def normalize_lga_name(value):
    if value is None:
        return ""
    text = str(value).strip()
    text = text.replace("(", "").replace(")", "")
    text = text.replace(" / ", "/").replace("/ ", "/").replace(" /", "/")
    text = text.replace("\u00A0", " ")
    text = text.replace(" - ", "-").replace("- ", "-").replace(" -", "-")
    text = text.replace(" ", "-")
    text = " ".join(text.split())
    return text.lower()


def read_lga_boundaries(shp_path):
    reader = shapefile.Reader(shp_path)
    fields = [field[0] for field in reader.fields[1:]]
    if "lganame" not in fields:
        raise ValueError("Expected lganame field in LGA shapefile")

    lga_index = fields.index("lganame")
    features = []

    for record, shape in zip(reader.records(), reader.shapes()):
        lga_name = record[lga_index]
        properties = {
            "lganame": lga_name,
            "lga_match": normalize_lga_name(lga_name),
        }
        geometry = shape_to_geojson(shape)
        features.append({"type": "Feature", "properties": properties, "geometry": geometry})

    return {"type": "FeatureCollection", "features": features}


def shape_to_geojson(shape):
    if shape.shapeType == 1:  # Point
        return {"type": "Point", "coordinates": list(shape.points[0])}

    points = shape.points
    parts = list(shape.parts) + [len(points)]
    rings = []
    for index in range(len(parts) - 1):
        start = parts[index]
        end = parts[index + 1]
        ring = [[float(x), float(y)] for x, y in points[start:end]]
        rings.append(ring)

    if len(rings) == 1:
        return {"type": "Polygon", "coordinates": [rings[0]]}
    return {"type": "Polygon", "coordinates": rings}


def read_gas_csvs(base_dir):
    emissions = {}
    point_features = []
    for year in YEARS:
        csv_path = os.path.join(base_dir, year, f"Lagos_All_Gases_{year}.csv")
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Missing CSV file: {csv_path}")

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lga = normalize_lga_name(row.get("ADM2_NAME"))
                if not lga:
                    continue

                values = {}
                for metric in METRICS:
                    raw = row.get(metric, "")
                    try:
                        values[metric] = float(raw) if raw not in (None, "", "NA") else None
                    except ValueError:
                        values[metric] = None

                values["year"] = year
                values["latitude"] = float(row["latitude"]) if row.get("latitude") else None
                values["longitude"] = float(row["longitude"]) if row.get("longitude") else None

                emissions.setdefault(lga, {})[year] = values

                if values["latitude"] is not None and values["longitude"] is not None:
                    point_features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [values["longitude"], values["latitude"]]},
                        "properties": {
                            "lganame": row.get("ADM2_NAME"),
                            "year": year,
                            **{metric: values[metric] for metric in METRICS},
                        },
                    })

    return emissions, point_features


def create_geojson_features(boundaries, emissions_by_lga):
    feature_collection = {"type": "FeatureCollection", "features": []}
    unmatched_lgas = []

    for feature in boundaries["features"]:
        match_key = feature["properties"]["lga_match"]
        values = emissions_by_lga.get(match_key, {})

        for year in YEARS:
            for metric in METRICS:
                feature["properties"][f"{metric}_{year}"] = values.get(year, {}).get(metric)

        feature_collection["features"].append(feature)

        if not values:
            unmatched_lgas.append(feature["properties"]["lganame"])

    if unmatched_lgas:
        print("Warning: these LGAs were not matched to CSV data:", unmatched_lgas)

    csv_keys = sorted(emissions_by_lga.keys())
    shp_keys = sorted([feature["properties"]["lga_match"] for feature in boundaries["features"]])
    extra_csv = [k for k in csv_keys if k not in shp_keys]
    if extra_csv:
        print("Warning: these CSV LGAs were not matched to shapefile:", extra_csv)

    return feature_collection


def save_json(data, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {path}")


def parse_args():
    parser = argparse.ArgumentParser(description="Prepare dashboard GeoJSON data from Lagos gas emissions datasets.")
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for generated GeoJSON files. Can be a local drive or mounted Google Drive path.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    output_dir = args.output_dir

    print("Reading LGA boundaries...")
    boundaries = read_lga_boundaries(LGA_SHP)

    print("Reading gas CSV data...")
    emissions_by_lga, point_features = read_gas_csvs(GAS_DIR)

    print("Creating joined LGA GeoJSON...")
    joined = create_geojson_features(boundaries, emissions_by_lga)
    save_json(joined, os.path.join(output_dir, "lga_emissions.geojson"))

    print("Creating point measurement GeoJSON...")
    point_collection = {"type": "FeatureCollection", "features": point_features}
    save_json(point_collection, os.path.join(output_dir, "emission_points.geojson"))

    print("Dashboard data preparation complete.")


if __name__ == "__main__":
    main()
