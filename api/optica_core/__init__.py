"""Shared backend core of the Optica viewers.

The payload helpers (`project`, `acquisition`, `image`) need nothing else: the Orthanc plugin uses them
without Flask. The Flask parts (`create_app`, `Dataset`...) are imported when they are first used.
"""

from optica_core.project import acquisition, image, project

# name -> module, imported on first use (PEP 562)
_FLASK = {
    "OWNER": "optica_core.app",
    "create_app": "optica_core.app",
    "Dataset": "optica_core.dataset",
    "ManifestError": "optica_core.dataset",
    "MANIFEST_FORMAT": "optica_core.dataset",
    "MANIFEST_VERSION": "optica_core.dataset",
}

__all__ = ["MANIFEST_FORMAT", "MANIFEST_VERSION", "OWNER", "Dataset", "ManifestError", "acquisition", "create_app", "image", "project"]


def __getattr__(name):
    if name in _FLASK:
        import importlib

        return getattr(importlib.import_module(_FLASK[name]), name)
    raise AttributeError(f"module 'optica_core' has no attribute {name!r}")
