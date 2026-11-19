"""Convert the old manifests of the viewers to the current format (core/MANIFEST.md).

    python -m optica_core.migrate [--dry-run] <data folder or manifest>...

Each old manifest (depth.json, spectral.json, stack.json, rotation.json, calibration.json) is
rewritten in place, the old file is kept next to it as <name>.v0.json. Manifests already in the
current format are left as they are.
"""

import argparse
import json
import os
import sys
from collections import Counter

from optica_core.dataset import MANIFEST_FORMAT, MANIFEST_VERSION


class MigrationError(ValueError):
    pass


def envelope(viewer: str, unit: str, old: dict, acquisitions: list[dict], angle_unit: str | None = None) -> dict:
    manifest = {"format": MANIFEST_FORMAT, "version": MANIFEST_VERSION, "viewer": viewer, "unit": unit}
    if angle_unit is not None:
        manifest["angleUnit"] = angle_unit
    if old.get("thumbnails"):
        manifest["thumbnails"] = old["thumbnails"]
    manifest["acquisitions"] = acquisitions
    return manifest


def size(data: dict) -> dict:
    return {"width": data["width"], "height": data["height"]}


# keys of an old dict that the conversion doesn't know, so they would be lost
def check_keys(where: str, data: dict, known: set[str], warnings: list[str]) -> None:
    for key in sorted(set(data) - known):
        warnings.append(f"{where}: unknown key {key!r} dropped")


# ---------------------------------------------------------------- depth.json


def migrate_depth(old: dict, warnings: list[str]) -> dict:
    check_keys("depth.json", old, {"thumbnails", "stacked"}, warnings)
    acquisitions = []
    for key, entry in old["stacked"].items():
        check_keys(f"stacked.{key}", entry, {"image", "data", "depthmap", "mask", "edges"}, warnings)
        data = entry["data"]
        check_keys(f"stacked.{key}.data", data, {"name", "label", "PixelRatio", "Zmin", "Zmax", "width", "height"}, warnings)
        acquisition = {"id": key}
        if "label" in data:
            acquisition["label"] = data["label"]
        acquisition["size"] = size(data)
        acquisition["pixelSize"] = data.get("PixelRatio")
        # "image", else the "name" of the data, else the key
        acquisition["image"] = {"file": entry.get("image", data.get("name", key))}
        acquisition["heightmap"] = {"file": entry["depthmap"], "zMin": data["Zmin"], "zMax": data["Zmax"]}
        if "mask" in entry:
            acquisition["mask"] = {"file": entry["mask"]}
        if "edges" in entry:
            check_keys(f"stacked.{key}.edges", entry["edges"], {"image", "threshold"}, warnings)
            acquisition["edges"] = {"file": entry["edges"]["image"], "thresholds": entry["edges"].get("threshold", {})}
        acquisitions.append(acquisition)
    return envelope("depthoptica", "mm", old, acquisitions)


# ---------------------------------------------------------------- spectral.json

BAND_KEYS = {"type", "value", "bandwidth", "min", "max", "description"}


# `bandwith` was misspelled
def band(where: str, data: dict | None, warnings: list[str]) -> dict | None:
    if data is None:
        return None
    result = {}
    for key, value in data.items():
        key = "bandwidth" if key == "bandwith" else key
        if key not in BAND_KEYS:
            warnings.append(f"{where}: unusual band key {key!r} kept")
        result[key] = value
    return result


def spectral_image(where: str, entry: dict, warnings: list[str], label: str | None = None) -> dict:
    image = {"file": entry["name"]}
    if label is not None:
        image["label"] = label
    wavelength = band(f"{where}.wavelength", entry.get("wavelength"), warnings)
    # the camera filter was also named "filter" and "image_filter", the light filter "light_filter"
    camera_filter = band(f"{where}.cameraFilter", entry.get("cameraFilter", entry.get("filter", entry.get("image_filter"))), warnings)
    light_filter = band(f"{where}.lightFilter", entry.get("lightFilter", entry.get("light_filter")), warnings)
    for key, value in (("wavelength", wavelength), ("cameraFilter", camera_filter), ("lightFilter", light_filter)):
        if value is not None:
            image[key] = value
    known = {"name", "wavelength", "cameraFilter", "filter", "image_filter", "lightFilter", "light_filter"}
    # other fields (a description...) are kept as they are
    for key, value in entry.items():
        if key not in known:
            image[key] = value
    return image


def migrate_spectral(old: dict, warnings: list[str]) -> dict:
    check_keys("spectral.json", old, {"thumbnails", "images", "PixelRatio"}, warnings)
    if "images" not in old:
        raise MigrationError("spectral.json without views (\"images\") isn't supported anymore")
    acquisitions = []
    for view, data in old["images"].items():
        check_keys(f"images.{view}", data, {"width", "height", "PixelRatio", "spectral", "individualImages",
                                            "thumbnails_width", "thumbnails_height"}, warnings)
        acquisition = {"id": view, "size": size(data), "pixelSize": data.get("PixelRatio", old.get("PixelRatio"))}
        series = data.get("spectral", [])
        if series:
            acquisition["images"] = [spectral_image(f"images.{view}.spectral[{i}]", entry, warnings)
                                     for i, entry in enumerate(series)]
        individual = data.get("individualImages", {})
        if individual:
            acquisition["standaloneImages"] = [spectral_image(f"images.{view}.individualImages.{label}", entry, warnings, label)
                                               for label, entry in individual.items()]
        acquisitions.append(acquisition)
    return envelope("spectraloptica", "mm", old, acquisitions)


# ---------------------------------------------------------------- stack.json


def migrate_stack(old: dict, warnings: list[str]) -> dict:
    check_keys("stack.json", old, {"Stacked_images", "thumbnails", "width", "height", "thumbnails_width",
                                   "thumbnails_height", "voxel", "stack"}, warnings)
    slices = sorted(old["stack"].items(), key=lambda item: item[1]["SlicePosition"][2])
    # the pixel size of most slices is the one of the acquisition, the others keep their own
    ratios = Counter(tuple(data["PixelRatio"]) for _, data in slices if "PixelRatio" in data)
    common = list(ratios.most_common(1)[0][0]) if ratios else (old["voxel"][:2] if "voxel" in old else None)
    images = []
    for name, data in slices:
        check_keys(f"stack.{name}", data, {"PixelRatio", "SlicePosition"}, warnings)
        x, y, z = data["SlicePosition"]
        if x != 0 or y != 0:
            raise MigrationError(f"stack.{name}: a slice offset in x or y ({x}, {y}) has no place in the format")
        image = {"file": name, "z": z}
        if "PixelRatio" in data and list(data["PixelRatio"]) != common:
            image["pixelSize"] = data["PixelRatio"]
        images.append(image)
    acquisition = {"id": "stack", "size": size(old), "pixelSize": common, "images": images}
    stacked = old.get("Stacked_images", {})
    if stacked:
        acquisition["standaloneImages"] = [{"file": name, "label": label} for label, name in stacked.items()]
    return envelope("stackoptica", "mm", old, [acquisition])


# ---------------------------------------------------------------- rotation.json


def migrate_rotation(old: dict, warnings: list[str]) -> dict:
    check_keys("rotation.json", old, {"thumbnails", "width", "height", "PixelRatio", "rotation"}, warnings)
    images = []
    for name, data in old["rotation"].items():
        check_keys(f"rotation.{name}", data, {"angle"}, warnings)
        image = {"file": name}
        if "angle" in data:
            image["angle"] = data["angle"]
        images.append(image)
    acquisition = {"id": "rotation", "size": size(old), "pixelSize": old.get("PixelRatio"), "images": images}
    # the angles were in degrees
    return envelope("polaroptica", "mm", old, [acquisition], angle_unit="deg")


# ---------------------------------------------------------------- calibration.json


# {"shape": {"row", "col"}, "data": [...]} -> rows
def rows(where: str, matrix: dict) -> list[list[float]]:
    row, col = matrix["shape"]["row"], matrix["shape"]["col"]
    data = matrix["data"]
    if len(data) != row * col:
        raise MigrationError(f"{where}: {len(data)} values for a {row}x{col} matrix")
    return [data[i * col:(i + 1) * col] for i in range(row)]


def migrate_calibration(old: dict, warnings: list[str]) -> dict:
    check_keys("calibration.json", old, {"version", "commands", "thumbnails", "intrinsics", "extrinsics",
                                         "thumbnails_width", "thumbnails_height"}, warnings)
    intrinsics = old["intrinsics"]
    check_keys("intrinsics", intrinsics, {"width", "height", "cameraMatrix", "distortionMatrix"}, warnings)
    distortion = rows("intrinsics.distortionMatrix", intrinsics["distortionMatrix"])
    if len(distortion) != 1:
        raise MigrationError("intrinsics.distortionMatrix: one row expected")
    images = []
    for name, data in old["extrinsics"].items():
        check_keys(f"extrinsics.{name}", data, {"matrix"}, warnings)
        images.append({"file": name, "extrinsics": rows(f"extrinsics.{name}", data["matrix"])})
    acquisition = {
        "id": "sphere",
        "size": size(intrinsics),
        # the views are calibrated as a whole, not by a pixel size
        "pixelSize": None,
        "calibration": {
            "cameraMatrix": rows("intrinsics.cameraMatrix", intrinsics["cameraMatrix"]),
            "distortion": distortion[0],
        },
        "images": images,
    }
    if old.get("commands"):
        acquisition["shortcuts"] = old["commands"]
    # the calibration is in meters, the shortcuts in degrees
    return envelope("sphaeroptica", "m", old, [acquisition], angle_unit="deg")


# ---------------------------------------------------------------- files

MIGRATIONS = {
    "depth.json": migrate_depth,
    "spectral.json": migrate_spectral,
    "stack.json": migrate_stack,
    "rotation.json": migrate_rotation,
    "calibration.json": migrate_calibration,
}


def migrate(filename: str, old: dict) -> tuple[dict, list[str]]:
    """(new manifest, warnings) of the old manifest named `filename` (depth.json...)."""
    warnings: list[str] = []
    return MIGRATIONS[filename](old, warnings), warnings


def backup_path(path: str) -> str:
    stem, extension = os.path.splitext(path)
    return f"{stem}.v0{extension}"


def migrate_file(path: str, dry_run: bool = False) -> str:
    """Rewrite one manifest, the old one goes to <name>.v0.json. Returns what was done."""
    with open(path) as f:
        old = json.load(f)
    if old.get("format") == MANIFEST_FORMAT:
        return f"{path}: already version {old.get('version')}"
    backup = backup_path(path)
    if os.path.exists(backup):
        raise MigrationError(f"{path}: {backup} exists already, not overwritten")
    new, warnings = migrate(os.path.basename(path), old)
    lines = [f"{path}: {len(new['acquisitions'])} acquisition(s)" + (" (dry run)" if dry_run else "")]
    lines += [f"  warning: {warning}" for warning in warnings]
    if not dry_run:
        os.rename(path, backup)
        with open(path, "w") as f:
            json.dump(new, f, indent=4, ensure_ascii=False)
            f.write("\n")
    return "\n".join(lines)


def manifests(paths: list[str]):
    for path in paths:
        if os.path.isfile(path):
            yield path
            continue
        for directory, folders, files in os.walk(path):
            folders[:] = sorted(folder for folder in folders if folder not in (".git", "node_modules", "thumbnails"))
            for name in sorted(files):
                if name in MIGRATIONS:
                    yield os.path.join(directory, name)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="+", help="data folders (searched recursively) or manifests")
    parser.add_argument("--dry-run", action="store_true", help="show what would be done, write nothing")
    args = parser.parse_args(argv)
    failed = False
    for path in manifests(args.paths):
        try:
            print(migrate_file(path, args.dry_run))
        except (MigrationError, KeyError, TypeError, ValueError) as error:
            failed = True
            print(f"{path}: NOT migrated, {type(error).__name__}: {error}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
