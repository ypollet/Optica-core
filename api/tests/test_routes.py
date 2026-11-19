import json
import math

import pytest

from optica_core import MANIFEST_FORMAT, MANIFEST_VERSION, Dataset, ManifestError, create_app


def stack_manifest(**envelope):
    return {
        "format": MANIFEST_FORMAT, "version": MANIFEST_VERSION, "viewer": "stackoptica", "unit": "mm",
        "thumbnails": "thumbnails",
        "acquisitions": [{"id": "stack", "size": {"width": 4, "height": 2}, "pixelSize": [2, 3],
                          "images": [{"file": "img.png", "z": 0}]}],
        **envelope,
    }


class StackDataset(Dataset):
    manifest = "stack.json"
    viewer = "stackoptica"

    def images(self, id):
        manifest = self.load(id)
        return {"stackImages": [{"name": i["file"], "label": i["file"]} for i in manifest["acquisitions"][0]["images"]]}

    def position(self, id, image_id, x, y):
        pixel_size = self.pixel_size(*self.find_image(self.load(id), image_id))
        return {"x": x * pixel_size[0], "y": y * pixel_size[1]}


class NoPositionDataset(StackDataset):
    position = Dataset.position


@pytest.fixture
def data_folder(tmp_path):
    obj = tmp_path / "A1"
    (obj / "thumbnails").mkdir(parents=True)
    (obj / "img.png").write_bytes(b"full")
    (obj / "thumbnails" / "img.png").write_bytes(b"thumb")
    (obj / "stack.json").write_text(json.dumps(stack_manifest()))
    templates = tmp_path / "dist"
    templates.mkdir()
    (templates / "index.html").write_text("{{ site.logo }} {{ site.version }} {{ owner.name }}")
    return tmp_path


def client(data_folder, dataset_class=StackDataset):
    app = create_app(dataset_class, "Stackoptica", "2.0.0", data_folder=str(data_folder),
                     template_folder=str(data_folder / "dist"))
    return app.test_client()


def test_landing_page(data_folder):
    res = client(data_folder).get("/A1")
    assert res.status_code == 200
    assert res.text == "Stackoptica 2.0.0 Royal Belgian Institute of Natural Sciences"


def test_images(data_folder):
    res = client(data_folder).get("/A1/images")
    assert res.json == {"stackImages": [{"name": "img.png", "label": "img.png"}]}
    assert res.headers["Access-Control-Allow-Origin"] == "*"


def test_missing_object(data_folder):
    assert client(data_folder).get("/nope/images").status_code == 404


def test_object_outside_data_folder(tmp_path):
    data = tmp_path / "data"
    (data / "A1").mkdir(parents=True)
    (tmp_path / "secret.txt").write_text("secret")
    c = client(data)
    for id in ("%2E%2E", "..", "."):
        assert c.get(f"/{id}/secret.txt/full-image").status_code == 404
        assert c.get(f"/{id}/images").status_code == 404


def test_full_image_and_thumbnail(data_folder):
    c = client(data_folder)
    assert c.get("/A1/img.png/full-image").data == b"full"
    assert c.get("/A1/img.png/thumbnail").data == b"thumb"


def test_thumbnails_folder_from_the_manifest(data_folder):
    dataset = StackDataset(str(data_folder))
    folder = dataset.thumbnails_folder("A1", dataset.load("A1"))
    assert folder == str(data_folder / "A1" / "thumbnails")
    assert dataset.has_thumbnail(folder, "img.png")
    assert not dataset.has_thumbnail(folder, "missing.png")
    # no "thumbnails" in the manifest, or an empty one: no folder, no thumbnail route
    for manifest in ({}, {"thumbnails": ""}):
        assert dataset.thumbnails_folder("A1", manifest) is None
        assert not dataset.has_thumbnail(None, "img.png")
    manifest = stack_manifest()
    del manifest["thumbnails"]
    (data_folder / "A1" / "stack.json").write_text(json.dumps(manifest))
    assert client(data_folder).get("/A1/img.png/thumbnail").status_code == 404


def test_position(data_folder):
    res = client(data_folder).get("/A1/img.png/position?x=1.5&y=2")
    assert res.json == {"x": 3.0, "y": 6.0}


def test_position_bad_args(data_folder):
    assert client(data_folder).get("/A1/img.png/position?x=a").status_code == 400


def test_position_not_supported(data_folder):
    res = client(data_folder, NoPositionDataset).get("/A1/position?x=1&y=1")
    assert res.status_code == 404


def test_app_routes_can_be_added(data_folder):
    app = create_app(StackDataset, "Depthoptica", "1.0.0", data_folder=str(data_folder))

    @app.route("/<id>/<image_id>/profile")
    def profile(id, image_id):
        return {"dataset": type(app.extensions["optica_dataset"]).__name__}

    assert app.test_client().get("/A1/img.png/profile").json == {"dataset": "StackDataset"}


def test_project_payload(data_folder):
    from optica_core import acquisition, image, project

    class ProjectDataset(StackDataset):
        def images(self, id):
            manifest = self.load(id)
            return project(acquisition(
                "stack",
                size={"width": 2000, "height": 1000},
                images=[image(i["file"], angle=0, hasThumbnail=True) for i in manifest["acquisitions"][0]["images"]],
                standalone_images=[image("result.png", "Result", size={"width": 10, "height": 5})],
            ), unit=manifest["unit"])

    res = client(data_folder, ProjectDataset).get("/A1/images")
    assert res.json == {"acquisitions": [{
        "id": "stack", "label": "stack",
        "images": [{"name": "img.png", "label": "img.png", "angle": 0, "hasThumbnail": True}],
        "standaloneImages": [{"name": "result.png", "label": "Result", "size": {"width": 10, "height": 5}}],
        "size": {"width": 2000, "height": 1000},
    }], "unit": "mm"}


def test_position_unknown_image(data_folder):
    assert client(data_folder).get("/A1/nope.png/position?x=1&y=1").status_code == 404


def test_image_pixel_size_overrides_the_acquisition(data_folder):
    manifest = stack_manifest()
    manifest["acquisitions"][0]["images"].append({"file": "fine.png", "z": 1, "pixelSize": [0.5, 0.25]})
    (data_folder / "A1" / "stack.json").write_text(json.dumps(manifest))
    c = client(data_folder)
    assert c.get("/A1/img.png/position?x=2&y=2").json == {"x": 4.0, "y": 6.0}
    assert c.get("/A1/fine.png/position?x=2&y=2").json == {"x": 1.0, "y": 0.5}


@pytest.mark.parametrize("manifest, message", [
    # an old manifest, not migrated
    ({"stack": {"img.png": {"PixelRatio": [2, 3]}}}, "optica_core.migrate"),
    (stack_manifest(version=2), "version 1"),
    (stack_manifest(viewer="depthoptica"), "'depthoptica'"),
])
def test_manifest_not_in_the_current_format(data_folder, manifest, message):
    (data_folder / "A1" / "stack.json").write_text(json.dumps(manifest))
    with pytest.raises(ManifestError, match=message):
        StackDataset(str(data_folder)).load("A1")


@pytest.mark.parametrize("angle_unit, angle, degrees", [("deg", 90, 90), ("rad", math.pi / 2, 90)])
def test_angles_in_degrees(angle_unit, angle, degrees):
    assert Dataset.degrees({"angleUnit": angle_unit}, angle) == pytest.approx(degrees)
