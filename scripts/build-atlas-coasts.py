"""Refresh the global and southern Asia coastline tiles from Natural Earth land."""
import io
import json
import math
import urllib.request
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import box, shape
from shapely.ops import unary_union

SOURCE = "https://naturalearth.s3.amazonaws.com/5.1.1/{scale}_physical/ne_{scale}_land.zip"
BASES = Path(__file__).resolve().parents[1] / "assets/history-map/bases.json"


def mercator(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def parts(geometry, kind):
    if geometry.is_empty:
        return
    if geometry.geom_type == kind:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for child in geometry.geoms:
            yield from parts(child, kind)


def tile(scale, version, bbox, tolerance):
    west, east, south, north = bbox
    region = box(west, south, east, north)
    top = mercator(north)

    def path(line):
        return "M" + " ".join(f"{lon-west:.3f},{top-mercator(lat):.3f}" for lon, lat in line.coords)

    url = SOURCE.format(scale=scale)
    with urllib.request.urlopen(url, timeout=60) as response, zipfile.ZipFile(io.BytesIO(response.read())) as archive:
        actual = archive.read(f"ne_{scale}_land.VERSION.txt").decode().strip()
        if actual != version:
            raise ValueError(f"Expected {version}, got {actual} for {url}")
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(f"ne_{scale}_land.shp")))
    land = unary_union([p for feature in reader.iterShapes()
                        for p in parts(shape(feature.__geo_interface__), "Polygon")
                        if region.intersects(p)]).simplify(tolerance, preserve_topology=True)
    fill = "".join(path(ring) + "Z" for p in parts(land.intersection(region), "Polygon")
                   for ring in [p.exterior, *p.interiors])
    # Draw real shores without outlining the tile edges or the split at 180°.
    coast_clip = box(max(-179.999999, west), south, min(179.999999, east), north)
    coast = "".join(path(line) for line in parts(land.boundary.intersection(coast_clip), "LineString"))
    assert fill and coast
    return {"source": f"Natural Earth 1:{scale} land v{version} (public domain)", "bbox": bbox,
            "w": east-west, "h": top-mercator(south), "land": fill, "coast": coast}


if __name__ == "__main__":
    bases = json.loads(BASES.read_bytes())
    bases["globe"].update(tile("50m", "4.1.0", bases["globe"]["bbox"], .025))
    bases["southernAsia"].update(tile("10m", "5.1.1", bases["southernAsia"]["bbox"], .012))
    BASES.write_text(json.dumps(bases, ensure_ascii=False, separators=(",", ":")) + "\n")
