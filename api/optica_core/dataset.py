import json
import math
import os

from flask import abort

from optica_core.schema import duplicates

# envelope of every manifest, see core/MANIFEST.md
MANIFEST_FORMAT = "optica-manifest"
MANIFEST_VERSION = 1


class ManifestError(ValueError):
    """A manifest that isn't in the current format (an old one to migrate, or the one of another viewer)."""


class Dataset:
    """What an app has to describe about its data folder.

    Each object lives in `<data_folder>/<id>/` with a JSON manifest (`stack.json`, `rotation.json`,
    `depth.json`...) in the format of core/MANIFEST.md. Subclasses set `manifest` and `viewer` and
    implement `images` and, if the app supports it, `position`.
    """

    manifest: str = ""
    viewer: str = ""

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
            manifest = json.load(f)
        self.check(manifest, path)
        return manifest

    def check(self, manifest: dict, path: str) -> None:
        if manifest.get("format") != MANIFEST_FORMAT or manifest.get("version") != MANIFEST_VERSION:
            raise ManifestError(f"{path}: not an {MANIFEST_FORMAT} version {MANIFEST_VERSION}, "
                                "convert it with `python -m optica_core.migrate`")
        if manifest.get("viewer") != self.viewer:
            raise ManifestError(f"{path}: manifest of {manifest.get('viewer')!r}, not of {self.viewer!r}")
        # the routes find acquisitions and images by id: a second one would never be reached
        found = duplicates(manifest)
        if found:
            raise ManifestError(f"{path}: {'; '.join(found)}")

    # the acquisition `acquisition_id`, 404 when there is none
    @staticmethod
    def acquisition(manifest: dict, acquisition_id: str) -> dict:
        for acquisition in manifest["acquisitions"]:
            if acquisition["id"] == acquisition_id:
                return acquisition
        abort(404)

    # (acquisition, image) of the image whose file is `file`, in `images` or `standaloneImages`, 404 when there is none
    @staticmethod
    def find_image(manifest: dict, file: str) -> tuple[dict, dict]:
        for acquisition in manifest["acquisitions"]:
            for image in acquisition.get("images", []) + acquisition.get("standaloneImages", []):
                if image["file"] == file:
                    return acquisition, image
        abort(404)

    # an angle of the manifest (in its "angleUnit") in degrees, what the API sends
    @staticmethod
    def degrees(manifest: dict, angle: float) -> float:
        return math.degrees(angle) if manifest["angleUnit"] == "rad" else angle

    # size of a pixel in the unit of the manifest: the image's own, else its acquisition's,
    # None when the image isn't calibrated
    @staticmethod
    def pixel_size(acquisition: dict, image: dict | None = None) -> list[float] | None:
        if image is not None and image.get("pixelSize") is not None:
            return image["pixelSize"]
        return acquisition.get("pixelSize")

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
