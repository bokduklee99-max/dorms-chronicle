"""Refresh the southern Asia outline tile from Natural Earth 1:10m land v5.1.1."""
import io
import json
import math
import urllib.request
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import box, shape
from shapely.ops import unary_union

SOURCE = "https://naturalearth.s3.amazonaws.com/5.1.1/10m_physical/ne_10m_land.zip"
BASES = Path(__file__).resolve().parents[1] / "assets/history-map/bases.json"
WEST, EAST, SOUTH, NORTH = 57, 149, -17, 29
REGION = box(WEST, SOUTH, EAST, NORTH)


def mercator(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def path(line):
    return "M" + " ".join(f"{lon-WEST:.3f},{mercator(NORTH)-mercator(lat):.3f}" for lon, lat in line.coords)


def parts(geometry, kind):
    if geometry.is_empty:
        return
    if geometry.geom_type == kind:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for child in geometry.geoms:
            yield from parts(child, kind)


def tile(archive):
    reader = shapefile.Reader(shp=io.BytesIO(archive.read("ne_10m_land.shp")))
    land = unary_union([p for feature in reader.iterShapes()
                        for p in parts(shape(feature.__geo_interface__), "Polygon")
                        if REGION.intersects(p)]).simplify(.012, preserve_topology=True)
    fill = "".join(path(ring) + "Z" for p in parts(land.intersection(REGION), "Polygon")
                   for ring in [p.exterior, *p.interiors])
    # Clip the real shore separately so the rectangular tile edge never gets inked.
    coast = "".join(path(line) for line in parts(land.boundary.intersection(REGION), "LineString"))
    assert fill and coast
    return {"name": "남아시아·동남아시아", "source": "Natural Earth 1:10m land v5.1.1 (public domain)",
            "bbox": [WEST, EAST, SOUTH, NORTH], "w": EAST-WEST, "h": mercator(NORTH)-mercator(SOUTH),
            "land": fill, "coast": coast}


if __name__ == "__main__":
    bases = json.loads(BASES.read_bytes())
    with urllib.request.urlopen(SOURCE, timeout=60) as response, zipfile.ZipFile(io.BytesIO(response.read())) as archive:
        bases["southernAsia"] = tile(archive)
    BASES.write_text(json.dumps(bases, ensure_ascii=False, separators=(",", ":")) + "\n")
