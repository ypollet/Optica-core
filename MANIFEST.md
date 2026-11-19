# Optica manifest, version 1

Each object of a viewer is a folder in its data folder, with one JSON manifest describing its images (`depth.json` for depthoptica, for example). Every manifest has the common part described here; each viewer adds its own fields and documents them in its `MANIFEST.md`, next to its `manifest.schema.json`.

Keys are camelCase. File paths are relative to the folder of the object.

## Envelope

```jsonc
{
  "format": "optica-manifest",
  "version": 1,
  "viewer": "depthoptica",       // which viewer reads it
  "unit": "mm",                  // unit of every physical value below: m, dm, cm, mm, µm, nm (the Scale names)
  "angleUnit": "deg",            // unit of every angle below: deg or rad; a viewer with angles requires it
  "thumbnails": "thumbnails",    // optional: folder of the thumbnails, named like their image
  "acquisitions": [ ... ]        // at least one
}
```

The API always sends angles in degrees, whatever `angleUnit` is. The `/<id>/images` payload sends `unit` with the acquisitions. The frontend can then convert with `Scale[unit]` instead of assuming a unit.

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

## Schemas

A new viewer adds a `manifest.schema.json` and a `MANIFEST.md` next to its app; nothing changes in core.

The common part is [`api/optica_core/manifest.schema.json`](api/optica_core/manifest.schema.json): the envelope, and the fields of every acquisition and image. It leaves acquisitions and images open.

Each viewer has its own `<viewer>/manifest.schema.json`. It refers to the common one (`urn:optica:manifest:1`), adds its fields and closes its acquisitions and images with `unevaluatedProperties: false`, so an unknown or misspelled key is refused.

A schema can't tell that an id is used twice, so `optica_core.schema` and the apps (when they load a manifest) also check that acquisition ids and image file names are unique in the manifest.

```bash
pip install -e 'core/api[test]'    # jsonschema, only to check manifests
python -m optica_core.schema depthoptica/manifest.schema.json depthoptica/data/*/depth.json
```

## Migrating old manifests

A one-off step for the manifests written before version 1, frozen: it only knows the five formats of that time (`depth.json`, `spectral.json`, `stack.json`, `rotation.json`, `calibration.json`), a new viewer starts with version 1 and has nothing to migrate.

```bash
python -m optica_core.migrate --dry-run <data folder>...   # show what would change
python -m optica_core.migrate <data folder>...             # rewrite, the old file is kept as <name>.v0.json
```

The viewers refuse an old manifest and name this command in the error.
