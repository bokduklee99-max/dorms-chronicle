"""Build the editor's distributable backgrounds with Python, Shapely and pyshp."""
import concurrent.futures
import gzip
import io
import json
import math
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import shapefile
from shapely.geometry import shape
from shapely.ops import linemerge

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/history-map"
GEOMETRY = ROOT / "assets/event-geometry"
REVISION = "4b5039e50d8d2464b065bd76ad6086cd4597108d"
SOURCE = "https://raw.githubusercontent.com/aourednik/historical-basemaps/" + REVISION
YEARS = [-123000,-10000,-8000,-5000,-4000,-3000,-2000,-1500,-1000,-700,-500,-400,-323,-300,-200,-100,-1,
         100,200,300,400,500,600,700,800,900,1000,1100,1200,1279,1300,1400,1492,1500,1530,1600,1650,1700,
         1715,1783,1800,1815,1878,1880,1900,1914,1920,1930,1938,1945,1960,1980,1994,2000,2010]


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def number(value):
    return format(value, ".3f").rstrip("0").rstrip(".") or "0"


def path(coords, close=False):
    points = []
    for lon, lat, *_ in coords:
        lat = max(-85, min(85, lat))
        y = -math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
        points.append(number(lon) + "," + number(y))
    return "M" + "L".join(points) + ("Z" if close else "")


def edition(year):
    key = "world_" + ("bc" if year < 0 else "") + str(abs(year))
    svg = GEOMETRY / ("world-" + str(year) + ".svg")
    paths = []
    if svg.exists():
        for el in ET.parse(svg).getroot().iter("{http://www.w3.org/2000/svg}path"):
            rings = re.findall(r"M([^M]+)", el.attrib["d"])
            outline = ""
            for ring in rings:
                values = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", ring)]
                outline += path(zip(values[::2], (-y for y in values[1::2])), True)
            paths.append(outline)
    else:
        raw = ((GEOMETRY / "world-1980.geojson").read_bytes() if year == 1980
               else download(SOURCE + "/geojson/" + key + ".geojson"))
        for feature in json.loads(raw)["features"]:
            if not feature.get("geometry"):
                continue
            geom = shape(feature["geometry"])
            if year != 1980:
                geom = geom.simplify(.1, preserve_topology=True)
            polygons = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
            outline = "".join(path(r.coords, True) for p in polygons if p.geom_type == "Polygon"
                              for r in [p.exterior, *p.interiors])
            if outline:
                paths.append(outline)
    if not paths:
        raise ValueError("No polygons in " + key)
    label = ("기원전 " if year < 0 else "") + str(abs(year)) + "년"
    credit = "CShapes 2.1" if year == 1980 else "Historical Basemaps"
    return key, {"year": year, "name": label + " 세계지도 · " + credit, "paths": paths}


EAST_ASIA = {"CHN", "JPN", "KOR", "MNG", "PRK", "TWN"}


def natural_earth(name):
    base = "ne_10m_" + name
    archive = zipfile.ZipFile(io.BytesIO(download("https://naturalearth.s3.amazonaws.com/10m_cultural/" + base + ".zip")))
    return shapefile.Reader(shp=io.BytesIO(archive.read(base+".shp")), dbf=io.BytesIO(archive.read(base+".dbf")))


def boundary_lines(name, exclude=()):
    reader = natural_earth(name)
    parts = []
    for record in reader.iterShapeRecords():
        if exclude and record.record["ADM0_A3"] in exclude:
            continue
        kind = record.record["FEATURECLA"]
        if name.startswith("admin_1") and kind not in {"Admin-1 boundary", "Admin-1 region boundary"}:
            continue
        if record.shape.shapeType == shapefile.NULL or kind == "Overlay limit":
            continue
        geom = shape(record.shape.__geo_interface__).simplify(.018, preserve_topology=False)
        lines = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
        parts.extend(path(line.coords) for line in lines if line.geom_type == "LineString" and not line.is_empty)
    return "".join(parts)


def province_boundaries():
    parts = [boundary_lines("admin_1_states_provinces_lines", exclude=EAST_ASIA)]
    # Some actual province borders are classified as statistical lines. Use the
    # shared polygon edges so adjacent provinces meet without outlining coasts.
    reader = natural_earth("admin_1_states_provinces")
    countries = defaultdict(list)
    for record in reader.iterRecords(fields=["adm0_a3"]):
        if record.adm0_a3 in EAST_ASIA:
            countries[record.adm0_a3].append(shape(reader.shape(record.oid).__geo_interface__).boundary)
    for borders in countries.values():
        for left, right in combinations(borders, 2):
            shared = left.intersection(right)
            if shared.length == 0:
                continue
            if shared.geom_type != "LineString":
                shared = linemerge([line for line in shared.geoms if line.geom_type == "LineString"])
            lines = shared.geoms if shared.geom_type == "MultiLineString" else [shared]
            parts.extend(path(line.simplify(.008).coords) for line in lines)
    return "".join(parts)


def write(name, obj):
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
    (ASSETS / name).write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        editions = dict(pool.map(edition, YEARS))
    write("editions.json.gz", editions)
    write("boundaries.json.gz", {"countries": boundary_lines("admin_0_boundary_lines_land"),
                                 "provinces": province_boundaries()})
