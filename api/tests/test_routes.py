import json

import pytest

from optica_core import Dataset, create_app


class StackDataset(Dataset):
    manifest = "stack.json"

    def images(self, id):
        stack_file = self.load(id)
        return {"stackImages": [{"name": n, "label": n} for n in stack_file["stack"]]}

    def position(self, id, image_id, x, y):
        image_data = self.load(id)["stack"][image_id]
        return {
            "x": x * image_data["PixelRatio"][0],
            "y": y * image_data["PixelRatio"][1],
        }


class NoPositionDataset(StackDataset):
    position = Dataset.position


@pytest.fixture
def data_folder(tmp_path):
    obj = tmp_path / "A1"
    (obj / "thumbnails").mkdir(parents=True)
    (obj / "img.png").write_bytes(b"full")
    (obj / "thumbnails" / "img.png").write_bytes(b"thumb")
    (obj / "stack.json").write_text(json.dumps({"stack": {"img.png": {"PixelRatio": [2, 3]}}}))
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
            stack_file = self.load(id)
            return project(acquisition(
                "stack",
                size={"width": 2000, "height": 1000},
                images=[image(n, angle=0) for n in stack_file["stack"]],
                standalone_images=[image("result.png", "Result", size={"width": 10, "height": 5})],
                thumbnails=True,
            ))

    res = client(data_folder, ProjectDataset).get("/A1/images")
    assert res.json == {"acquisitions": [{
        "id": "stack", "label": "stack",
        "images": [{"name": "img.png", "label": "img.png", "angle": 0}],
        "standaloneImages": [{"name": "result.png", "label": "Result", "size": {"width": 10, "height": 5}}],
        "size": {"width": 2000, "height": 1000}, "thumbnails": True,
    }]}
