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

    # folder of the thumbnails, named by "thumbnails" in the manifest, None when the object has none
    def thumbnails_folder(self, id: str, manifest: dict) -> str | None:
        folder = manifest.get("thumbnails")
        return os.path.join(self.directory(id), folder) if folder else None

    # true when the thumbnail `filename` is in `folder` (None: the object has no thumbnails),
    # apps send it as `hasThumbnail` with each image
    @staticmethod
    def has_thumbnail(folder: str | None, filename: str) -> bool:
        return folder is not None and os.path.isfile(os.path.join(folder, filename))

    # (directory, filename) of the thumbnail
    def thumbnail(self, id: str, image_id: str) -> tuple[str, str]:
        folder = self.thumbnails_folder(id, self.load(id))
        if folder is None:
            abort(404)
        return folder, image_id

    # payload of /<id>/images
    def images(self, id: str) -> dict:
        raise NotImplementedError

    # physical position of the pixel (x, y) of an image
    def position(self, id: str, image_id: str | None, x: float, y: float) -> dict:
        raise NotImplementedError
