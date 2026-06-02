#!/usr/bin/env python3
"""
Convert landfills shapefile to GeoJSON
"""
import os
import json
import shapefile

ROOT = os.path.dirname(os.path.abspath(__file__))
LANDFILLS_SHP = os.path.join(ROOT, 'points', 'landfills.shp')
OUTPUT_DIR = os.path.join(ROOT, 'data')


def shape_to_geojson(shape):
    """Convert pyshp shape to GeoJSON geometry"""
    if shape.shapeType in [1, 11, 21]:  # Point, PointZ, PointM
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
    return {"type": "MultiPolygon", "coordinates": rings}


def read_landfills(shp_path):
    """Read landfills shapefile and convert to GeoJSON"""
    reader = shapefile.Reader(shp_path)
    features = []
    
    for record, shape in zip(reader.records(), reader.shapes()):
        properties = record.as_dict()
        geometry = shape_to_geojson(shape)
        
        features.append({
            "type": "Feature",
            "properties": properties,
            "geometry": geometry
        })
    
    return {"type": "FeatureCollection", "features": features}


def save_json(data, path):
    """Save data as JSON"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {path}")


def main():
    print("Converting landfills shapefile to GeoJSON...")
    landfills = read_landfills(LANDFILLS_SHP)
    save_json(landfills, os.path.join(OUTPUT_DIR, 'landfills.geojson'))
    print(f"✓ Converted {len(landfills['features'])} landfill features")


if __name__ == "__main__":
    main()
