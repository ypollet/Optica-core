# Optica manifest, version 1

Each object of a viewer is a folder in its data folder, with one JSON manifest describing its images:

| Viewer         | Manifest           | `unit` |
| -------------- | ------------------ | ------ |
| depthoptica    | `depth.json`       | `mm`   |
| spectraloptica | `spectral.json`    | `mm`   |
| stackoptica    | `stack.json`       | `mm`   |
| polaroptica    | `rotation.json`    | `mm`   |
| sphaeroptica   | `calibration.json` | `m`    |

The JSON Schema is [`api/optica_core/manifest.schema.json`](api/optica_core/manifest.schema.json). Keys are camelCase. File paths are relative to the folder of the object.

## Envelope

```jsonc
{
  "format": "optica-manifest",
  "version": 1,
  "viewer": "depthoptica",       // which viewer reads it
  "unit": "mm",                  // unit of every physical value below: m, dm, cm, mm, µm, nm (the Scale names)
  "angleUnit": "deg",            // unit of every angle below: deg or rad; required by polaroptica and sphaeroptica
  "thumbnails": "thumbnails",    // optional: folder of the thumbnails, named like their image
  "acquisitions": [ ... ]        // at least one
}
```

The API always sends angles in degrees, whatever `angleUnit` is. The `/<id>/images` payload sends `unit` with the acquisitions. The frontend can then convert with `Scale[unit]` instead of assuming mm, or m for sphaeroptica.

## Acquisition

Images taken together, with the same size and calibration:

```jsonc
{
  "id": "Dorsal",                // unique in the manifest
  "label": "Dorsal view",        // optional, defaults to the id
  "size": { "width": 6000, "height": 4000 },   // pixels
  "pixelSize": [0.006, 0.006],   // [x, y] size of a pixel in `unit`; null: not calibrated
  "images": [ ... ],             // the series (slices, wavelengths, angles, views)
  "standaloneImages": [ ... ]    // images on their own (stacked results, white light...)
}
```

An image of `images` or `standaloneImages` has a `file`, an optional `label` (defaults to the file name) and an optional `pixelSize` that overrides the acquisition's. The file name is the id of the image in the API routes (`/<id>/<image>/full-image`, `/position`...), so it must be unique in the manifest.

When `pixelSize` is `null`, positions are returned in pixels.

Each viewer adds its own fields:

### depthoptica

An acquisition is one stacked image and its height map. Its `id` is also the id of the image in the API.

```jsonc
{
  "id": "x25", "size": { ... }, "pixelSize": [0.0117, 0.0185],   // pixelSize is required
  "image":     { "file": "x25_color.png" },
  "heightmap": { "file": "x25_depth.png", "zMin": -5.938, "zMax": 0 },
  "mask":      { "file": "x25_mask.png" },                                     // optional
  "edges":     { "file": "x25_sobel.png", "thresholds": { "light": 5, "strong": 25 } }  // optional
}
```

- **heightmap**: a gray image (8 or 16 bits) of the size of the image. Value 0 is `zMin` and the highest value of the type (255 or 65535) is `zMax`, linearly in between. A higher value is a higher point. Z is in the frame of the scanner, so it can be negative.
- **mask**: same size, 0 outside the object. The height profiles skip masked pixels.
- **edges**: same size. A profile is cut where an edge is above the chosen threshold. Thresholds are per image; their names are what the viewer offers.

### spectraloptica

An acquisition is a view of the object. `images` is its wavelength series (the viewer sorts it by `wavelength.value`). `standaloneImages` are images on their own, and each needs a `label`.

```jsonc
{
  "file": "UV_365.jpg", "label": "UV",
  "wavelength":   { "type": "UV", "value": 365, "bandwidth": 10 },
  "cameraFilter": { "type": "UV", "description": "ZWB2" },
  "lightFilter":  { "type": "IR", "min": 720, "max": null }
}
```

A band has `type` (UV, VIS, IR…) and optional `value`, `bandwidth`, `min`, `max` (nm, `null`: no limit) and `description`.

### stackoptica

`images` are the slices, each at its height `z` in `unit`. `standaloneImages` are the images stacked from them, labelled by their method. The pixel size of the acquisition applies to every slice; a slice gives its own `pixelSize` if the magnification changed.

```jsonc
"images": [{ "file": "Plane000.jpg", "z": 0 }, { "file": "Plane001.jpg", "z": 0.002 }],
"standaloneImages": [{ "file": "dorsal.jpg", "label": "Dorsal" }]
```

### polaroptica

`images` are the images taken while the polarizers rotate, each at its `angle` in `angleUnit`.

```jsonc
"images": [{ "file": "isrnbel001_r1_ppl01.jpg", "angle": 0 }, { "file": "isrnbel001_r1_ppl02.jpg", "angle": 5 }]
```

### sphaeroptica

There is one acquisition, the views around the object. `unit` is `m`, and `pixelSize` is `null` because positions come from the calibration.

```jsonc
{
  "id": "sphere", "size": { "width": 5472, "height": 3648 }, "pixelSize": null,
  "calibration": {
    "cameraMatrix": [[fx, 0, cx], [0, fy, cy], [0, 0, 1]],   // pixels
    "distortion": [k1, k2, p1, p2, k3]                       // OpenCV
  },
  "images": [{ "file": "_x_00000_y_00000_.jpg", "extrinsics": [[r11, r12, r13, tx], [...], [...]] }],  // [R|t] world -> camera
  "shortcuts": { "FRONT": { "longitude": 0, "latitude": 0 } }   // optional, in angleUnit
}
```

## Migrating old manifests

```bash
python -m optica_core.migrate --dry-run <data folder>...   # show what would change
python -m optica_core.migrate <data folder>...             # rewrite, the old file is kept as <name>.v0.json
```

The viewers refuse an old manifest and name this command in the error.
