"""Build the Cliopatria map edition clipped to the terrain used by the atlas."""

from hashlib import sha256
import json
from pathlib import Path

from shapely import make_valid, union_all
from shapely.geometry import Polygon, mapping, shape


GEOMETRY_DIR = Path(__file__).resolve().parents[1] / "assets" / "event-geometry"


def polygons_only(geometry):
    if geometry.geom_type in {"Polygon", "MultiPolygon"}:
        return geometry
    if geometry.geom_type == "GeometryCollection":
        return union_all([polygons_only(part) for part in geometry.geoms])
    return Polygon()


def land_geometry(path):
    land = Polygon()
    for subpath in path.removeprefix("M").removesuffix("Z").split("ZM"):
        xy = [tuple(map(float, point.split(","))) for point in subpath.split()]
        # The SVG stores (longitude, -latitude) and fills nested rings with even-odd parity.
        ring = polygons_only(make_valid(Polygon((x, -y) for x, y in xy)))
        land = land.symmetric_difference(ring)
    return land


def main():
    source_path = GEOMETRY_DIR / "cliopatria-east-asia.geojson"
    terrain = json.loads((GEOMETRY_DIR / "context" / "east-asia.json").read_text(encoding="utf-8"))
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    land = land_geometry(terrain["land"])
    if land.is_empty or not land.is_valid:
        raise ValueError("The Natural Earth land mask is empty or invalid.")

    features = []
    for feature in source["features"]:
        geometry = polygons_only(make_valid(shape(feature["geometry"])))
        clipped = polygons_only(geometry.intersection(land))
        if clipped.is_empty:
            continue
        if not clipped.is_valid or clipped.difference(land).area > 1e-9:
            raise ValueError(f"Invalid land clip for {feature['id']}")
        features.append({**feature, "geometry": mapping(clipped)})

    if not features:
        raise ValueError("No territory intersects the Natural Earth land mask.")
    result = {
        "type": "FeatureCollection",
        "clip": {
            "source_sha256": sha256(source_bytes).hexdigest(),
            "land_sha256": sha256(terrain["land"].encode("utf-8")).hexdigest(),
        },
        "features": features,
    }
    output = GEOMETRY_DIR / "cliopatria-east-asia-land-clipped.geojson"
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(features)} of {len(source['features'])} territory features retained in {output.name}.")


if __name__ == "__main__":
    main()
