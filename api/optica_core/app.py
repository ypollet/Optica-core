import os

from flask import Flask
from flask_cors import CORS

from optica_core.dataset import Dataset
from optica_core.routes import create_blueprint

OWNER = {
    "name": "Royal Belgian Institute of Natural Sciences",
}


def create_app(
    dataset_class: type[Dataset],
    logo: str,
    version: str,
    data_folder: str | None = None,
    static_folder: str = "dist/static",
    template_folder: str = "dist",
) -> Flask:
    """Build the Flask app of an Optica viewer with the common routes.

    `data_folder` defaults to $OPTICA_DATA_FOLDER, then to `<cwd>/data`.
    App specific routes are added afterwards on the returned app,
    the dataset is available as `app.extensions["optica_dataset"]`.
    """
    data_folder = data_folder or os.environ.get("OPTICA_DATA_FOLDER") or f"{os.getcwd()}/data"

    app = Flask(
        __name__,
        root_path=os.getcwd(),
        static_folder=static_folder,
        template_folder=template_folder,
        static_url_path="/static",
    )
    CORS(app)
    app.config["CORS_HEADERS"] = "Content-Type"
    app.config["DATA_FOLDER"] = data_folder

    # pass data to the frontend
    site_data = {"site": {"logo": logo, "version": version}, "owner": OWNER}

    dataset = dataset_class(data_folder)
    app.extensions["optica_dataset"] = dataset
    app.register_blueprint(create_blueprint(dataset, site_data))
    return app
