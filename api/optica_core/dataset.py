import json
import os

from flask import abort


class Dataset:
    """What an app has to describe about its data folder.

    Each object lives in `<data_folder>/<id>/` with a JSON manifest
    (`stack.json`, `rotation.json`, `depth.json`, ...). Subclasses set
    `manifest` and implement `images` and, if the app supports it, `position`.
    """

    manifest: str = ""

    def __init__(self, data_folder: str):
        self.data_folder = data_folder

    # folder of an object: a folder directly in the data folder ("..", "." or a path is refused)
    def directory(self, id: str) -> str:
        root = os.path.abspath(self.data_folder)
        directory = os.path.normpath(os.path.join(root, id))
        if os.path.dirname(directory) != root or not os.path.isdir(directory):
            abort(404)
        return directory

    def load(self, id: str) -> dict:
        path = os.path.join(self.directory(id), self.manifest)
        if not os.path.isfile(path):
            abort(404)
        with open(path, "r") as f:
            return json.load(f)

    # (directory, filename) of the full image
    def full_image(self, id: str, image_id: str) -> tuple[str, str]:
        return self.directory(id), image_id

    # (directory, filename) of the thumbnail
    def thumbnail(self, id: str, image_id: str) -> tuple[str, str]:
        return os.path.join(self.directory(id), "thumbnails"), image_id

    # payload of /<id>/images
    def images(self, id: str) -> dict:
        raise NotImplementedError

    # physical position of the pixel (x, y) of an image
    def position(self, id: str, image_id: str | None, x: float, y: float) -> dict:
        raise NotImplementedError
