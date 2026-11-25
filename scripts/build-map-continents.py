"""Build the editor's continent lookup from Natural Earth 1:50m map units."""

import json
import sys
from collections import defaultdict
from pathlib import Path

from shapely import make_valid, union_all
from shapely.geometry import box, shape


SOURCE = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "v5.1.1/geojson/ne_50m_admin_0_map_units.geojson"
)
CONTINENTS = {
    "Asia": "아시아",
    "Europe": "유럽",
    "Africa": "아프리카",
    "North America": "북아메리카",
    "South America": "남아메리카",
    "Oceania": "오세아니아",
    "Antarctica": "남극",
}
OUTPUT = Path(__file__).resolve().parents[1] / "assets/history-map/continents.json"


def polygons(geometry):
    if geometry.geom_type == "Polygon" and not geometry.is_empty:
        yield geometry
    else:
        for part in getattr(geometry, "geoms", ()):
            yield from polygons(part)


def main(source_file):
    source = json.loads(Path(source_file).read_bytes())
    regions = defaultdict(list)
    for feature in source["features"]:
        properties = feature["properties"]
        continent = properties["CONTINENT"]
        if continent == "Seven seas (open ocean)":
            continent = properties["REGION_UN"]
        geometry = make_valid(shape(feature["geometry"]))
        if properties["ADM0_A3"] == "RUS":
            # Approximate the Urals with 60°E. Chukotka also crosses the date line.
            asia = geometry.intersection(box(60, -90, 180, 90).union(box(-180, -90, -169, 90)))
            regions["Asia"].extend(polygons(asia))
            geometry = geometry.difference(asia)
        if continent in CONTINENTS:
            regions[continent].extend(polygons(geometry))

    continents = []
    for key, name in CONTINENTS.items():
        geometry = union_all(regions[key]).simplify(.07, preserve_topology=True)
        parts = []
        for polygon in polygons(geometry):
            rings = [polygon.exterior, *polygon.interiors]
            parts.append({
                "bounds": [round(n, 3) for n in polygon.bounds],
                "rings": [[[round(x, 3), round(y, 3)] for x, y in ring.coords] for ring in rings],
            })
        continents.append({"name": name, "polygons": parts})
    OUTPUT.write_text(json.dumps({"source": SOURCE, "continents": continents},
                                 ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
