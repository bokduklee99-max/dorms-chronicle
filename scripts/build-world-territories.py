"""Package the local Cliopatria GeoJSON into year ranges for the territory map."""

import gzip
import json
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / "assets/event-geometry"
OUTPUT = GEOMETRY / "cliopatria-world"


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def translated_names():
    names = {}
    for file in ("cliopatria-europe.geojson", "cliopatria-china.geojson", "cliopatria-east-asia.geojson"):
        for feature in json.loads((GEOMETRY / file).read_bytes())["features"]:
            props = feature["properties"]
            names[props["polity"]] = props["name"].rsplit(" (", 1)[0]
    return names


def rounded(value):
    if isinstance(value, (tuple, list)):
        return [rounded(item) for item in value]
    return round(value, 3)


def file_starts(first, last):
    year = first
    while year <= last:
        step = 50 if year >= 1600 else 200
        group = year // step * step
        yield group
        year = group + step


def main():
    names = translated_names()
    source = json.loads((ROOT / "cliopatria.geojson").read_bytes())
    groups = defaultdict(list)
    changes = set()
    start = float("inf")
    end = float("-inf")
    count = 0
    for index, feature in enumerate(source["features"]):
        props = feature["properties"]
        # Composite records repeat the geometry of their member polities.
        if props["Type"] != "POLITY" or props["Components"]:
            continue
        first, last = props["FromYear"] or 1, props["ToYear"] or -1
        simplified = shape(feature["geometry"]).simplify(.045, preserve_topology=True)
        if simplified.is_empty or first > last:
            raise ValueError(f"Empty area or year range in Cliopatria row {index}")
        polity = props["Name"]
        result = {
            "type": "Feature", "id": f"clio_world_{index}",
            "properties": {"polity": polity, "name": names.get(polity, polity), "fromYear": first, "toYear": last},
            "geometry": {"type": simplified.geom_type, "coordinates": rounded(mapping(simplified)["coordinates"])},
        }
        start, end = min(start, first), max(end, last)
        changes.update((first, 1 if last == -1 else last + 1))
        for group in file_starts(first, last):
            groups[group].append(result)
        count += 1

    OUTPUT.mkdir(exist_ok=True)
    for group, features in groups.items():
        data = encoded({"type": "FeatureCollection", "features": features})
        (OUTPUT / f"{group}.json.gz").write_bytes(gzip.compress(data, compresslevel=6, mtime=0))
    (OUTPUT / "index.json").write_bytes(encoded({
        "start": start, "end": end, "frames": sorted((changes | {end}) - {end + 1}),
    }) + b"\n")
    print(f"Packaged {count} Cliopatria territory records into {len(groups)} year ranges.")


if __name__ == "__main__":
    main()
