"""Standard /images payload, read by ProjectRepository on the frontend."""


def image(name: str, label: str | None = None, size: dict | None = None, **extra) -> dict:
    """One image, `extra` holds the app fields (angle, wavelength, coordinates...)."""
    data = {"name": name, "label": label if label is not None else name, **extra}
    if size is not None:
        data["size"] = size
    return data


def acquisition(
    id: str,
    size: dict,
    images: list[dict] = (),
    standalone_images: list[dict] = (),
    thumbnails: bool = False,
    label: str | None = None,
) -> dict:
    """Images taken together (`images`, in order) and images on their own (`standalone_images`)."""
    return {
        "id": id,
        "label": label if label is not None else id,
        "images": list(images),
        "standaloneImages": list(standalone_images),
        "size": size,
        "thumbnails": thumbnails,
    }


def project(*acquisitions: dict) -> dict:
    return {"acquisitions": list(acquisitions)}
