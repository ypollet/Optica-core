import json
import os

import pytest

from optica_core.migrate import MigrationError, main, migrate, migrate_file

def envelope(viewer, unit="mm", thumbnails="thumbnails", angle_unit=None):
    data = {"format": "optica-manifest", "version": 1, "viewer": viewer, "unit": unit}
    if angle_unit:
        data["angleUnit"] = angle_unit
    if thumbnails:
        data["thumbnails"] = thumbnails
    return data


OLD_DEPTH = {
    "thumbnails": "thumbnails",
    "stacked": {
        "x25": {
            "image": "x25_color.png",
            "data": {"PixelRatio": [0.01, 0.02], "Zmin": -5.9, "Zmax": 0.0, "height": 20, "width": 10},
            "depthmap": "x25_depth.png",
            "mask": "x25_mask.png",
        },
        # no "image": the name of the data, a label, edges
        "Hab": {
            "data": {"name": "hab.jpg", "label": "Habitus", "PixelRatio": [0.006, 0.006], "Zmin": 0, "Zmax": 25.28,
                     "height": 40, "width": 60},
            "depthmap": "hab_depth.png",
            "edges": {"image": "hab_sobel.png", "threshold": {"light": 5, "heavy": 50}},
        },
    },
}

OLD_SPECTRAL = {
    "thumbnails": "thumbnails",
    "PixelRatio": [0.5, 0.5],
    "images": {
        "Dorsal": {
            "height": 40, "width": 60, "thumbnails_width": 6, "thumbnails_height": 4,
            "spectral": [
                {"name": "365.jpg", "lightFilter": None, "cameraFilter": None,
                 "wavelength": {"type": "UV", "value": 365, "bandwith": 10}},
            ],
            "individualImages": {
                "White": {"name": "white.jpg", "filter": {"type": "VIS", "description": ""}, "wavelength": {"type": "VIS"}},
                "IR": {"name": "ir.jpg", "image_filter": {"type": "IR", "min": 720, "max": None},
                       "light_filter": {"type": "IR"}, "description": "kept"},
            },
        },
        "Ventral": {"height": 4, "width": 6, "PixelRatio": [0.1, 0.1], "individualImages": {}},
    },
}

OLD_STACK = {
    "Stacked_images": {"Dorsal": "dorsal.jpg"},
    "thumbnails": "thumbnails", "height": 20, "width": 10, "thumbnails_height": 2, "thumbnails_width": 1,
    "voxel": [0.1, 0.2, 0.002],
    "stack": {
        "p1.jpg": {"PixelRatio": [0.1, 0.2], "SlicePosition": [0, 0, 0.002]},
        "p0.jpg": {"PixelRatio": [0.1, 0.2], "SlicePosition": [0, 0, 0]},
        "p2.jpg": {"PixelRatio": [0.3, 0.3], "SlicePosition": [0, 0, 0.004]},
    },
}

OLD_ROTATION = {
    "thumbnails": "", "height": 490, "width": 490,
    "rotation": {"a01.jpg": {"angle": 0.0}, "a02.jpg": {"angle": 5.0}},
}

OLD_CALIBRATION = {
    "version": "2.0.1",
    "commands": {"FRONT": {"longitude": 0, "latitude": 0}},
    "thumbnails": "thumbnails", "thumbnails_width": 1, "thumbnails_height": 1,
    "intrinsics": {
        "width": 50, "height": 30,
        "cameraMatrix": {"shape": {"row": 3, "col": 3}, "data": [100.0, 0, 25, 0, 100.0, 15, 0, 0, 1]},
        "distortionMatrix": {"shape": {"row": 1, "col": 5}, "data": [0.1, 0.2, 0.3, 0.4, 0.5]},
    },
    "extrinsics": {
        "v1.jpg": {"matrix": {"shape": {"row": 3, "col": 4}, "data": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0.2]}},
    },
}


def test_depth():
    new, warnings = migrate("depth.json", OLD_DEPTH)
    assert warnings == []
    assert new == {**envelope("depthoptica"), "acquisitions": [
        {"id": "x25", "size": {"width": 10, "height": 20}, "pixelSize": [0.01, 0.02],
         "image": {"file": "x25_color.png"},
         "heightmap": {"file": "x25_depth.png", "zMin": -5.9, "zMax": 0.0},
         "mask": {"file": "x25_mask.png"}},
        {"id": "Hab", "label": "Habitus", "size": {"width": 60, "height": 40}, "pixelSize": [0.006, 0.006],
         "image": {"file": "hab.jpg"},
         "heightmap": {"file": "hab_depth.png", "zMin": 0, "zMax": 25.28},
         "edges": {"file": "hab_sobel.png", "thresholds": {"light": 5, "heavy": 50}}},
    ]}


def test_spectral():
    new, warnings = migrate("spectral.json", OLD_SPECTRAL)
    assert warnings == []
    assert new == {**envelope("spectraloptica"), "acquisitions": [
        {"id": "Dorsal", "size": {"width": 60, "height": 40},
         # the pixel size of the manifest, the view has none
         "pixelSize": [0.5, 0.5],
         "images": [{"file": "365.jpg", "wavelength": {"type": "UV", "value": 365, "bandwidth": 10}}],
         "standaloneImages": [
             {"file": "white.jpg", "label": "White", "wavelength": {"type": "VIS"},
              "cameraFilter": {"type": "VIS", "description": ""}},
             {"file": "ir.jpg", "label": "IR", "cameraFilter": {"type": "IR", "min": 720, "max": None},
              "lightFilter": {"type": "IR"}, "description": "kept"},
         ]},
        {"id": "Ventral", "size": {"width": 6, "height": 4}, "pixelSize": [0.1, 0.1]},
    ]}


def test_spectral_without_views():
    with pytest.raises(MigrationError):
        migrate("spectral.json", {"spectral": [], "width": 1, "height": 1})


def test_stack():
    new, warnings = migrate("stack.json", OLD_STACK)
    assert warnings == []
    # sorted by z, the pixel size of most slices is the acquisition's, the other slice keeps its own
    assert new == {**envelope("stackoptica"), "acquisitions": [
        {"id": "stack", "size": {"width": 10, "height": 20}, "pixelSize": [0.1, 0.2],
         "images": [{"file": "p0.jpg", "z": 0}, {"file": "p1.jpg", "z": 0.002},
                    {"file": "p2.jpg", "z": 0.004, "pixelSize": [0.3, 0.3]}],
         "standaloneImages": [{"file": "dorsal.jpg", "label": "Dorsal"}]},
    ]}


def test_stack_slice_offset():
    old = json.loads(json.dumps(OLD_STACK))
    old["stack"]["p1.jpg"]["SlicePosition"] = [1, 0, 0.002]
    with pytest.raises(MigrationError, match="offset"):
        migrate("stack.json", old)


def test_rotation():
    new, warnings = migrate("rotation.json", OLD_ROTATION)
    assert warnings == []
    # no PixelRatio: not calibrated; an empty thumbnails folder: none
    assert new == {**envelope("polaroptica", thumbnails=None, angle_unit="deg"), "acquisitions": [
        {"id": "rotation", "size": {"width": 490, "height": 490}, "pixelSize": None,
         "images": [{"file": "a01.jpg", "angle": 0.0}, {"file": "a02.jpg", "angle": 5.0}]},
    ]}


def test_calibration():
    new, warnings = migrate("calibration.json", OLD_CALIBRATION)
    assert warnings == []
    assert new == {**envelope("sphaeroptica", unit="m", angle_unit="deg"), "acquisitions": [
        {"id": "sphere", "size": {"width": 50, "height": 30}, "pixelSize": None,
         "calibration": {"cameraMatrix": [[100.0, 0, 25], [0, 100.0, 15], [0, 0, 1]], "distortion": [0.1, 0.2, 0.3, 0.4, 0.5]},
         "images": [{"file": "v1.jpg", "extrinsics": [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0.2]]}],
         "shortcuts": {"FRONT": {"longitude": 0, "latitude": 0}}},
    ]}


def test_unknown_keys_are_reported():
    old = {**OLD_ROTATION, "operator": "me"}
    _, warnings = migrate("rotation.json", old)
    assert warnings == ["rotation.json: unknown key 'operator' dropped"]


@pytest.mark.parametrize("filename, old", [
    ("depth.json", OLD_DEPTH), ("spectral.json", OLD_SPECTRAL), ("stack.json", OLD_STACK),
    ("rotation.json", OLD_ROTATION), ("calibration.json", OLD_CALIBRATION),
])
def test_migrated_manifests_follow_the_common_schema(filename, old):
    # each viewer checks its own fields against its own schema
    pytest.importorskip("jsonschema")
    from optica_core.schema import errors, validator
    assert errors(validator(), migrate(filename, old)[0]) == []


def test_migrate_file_keeps_the_old_one(tmp_path):
    path = tmp_path / "A1" / "rotation.json"
    path.parent.mkdir()
    path.write_text(json.dumps(OLD_ROTATION))

    assert main([str(tmp_path), "--dry-run"]) == 0
    assert json.loads(path.read_text()) == OLD_ROTATION

    assert main([str(tmp_path)]) == 0
    assert json.loads((tmp_path / "A1" / "rotation.v0.json").read_text()) == OLD_ROTATION
    assert json.loads(path.read_text())["format"] == "optica-manifest"

    # a second run leaves the new manifest as it is
    assert "already version 1" in migrate_file(str(path))


def test_migrate_file_never_overwrites_a_backup(tmp_path):
    path = tmp_path / "rotation.json"
    path.write_text(json.dumps(OLD_ROTATION))
    (tmp_path / "rotation.v0.json").write_text("{}")
    assert main([str(path)]) == 1
    assert json.loads(path.read_text()) == OLD_ROTATION
    assert (tmp_path / "rotation.v0.json").read_text() == "{}"
