# Optica core

Code shared by the five Optica viewers (`depth`, `polar`, `spectral`, `sphaer`, `stack`).

```
core/
├── frontend/   @optica/core   Vue/TS: shadcn UI (reka-ui), assets, models, data layer
└── api/        optica_core    Flask app factory + common routes
```

## Common API

Every backend serves these routes; the frontend data layer (`src/data/providers/routes.ts`) targets the same ones.

| Route                           | Answer                                         |
| ------------------------------- | ---------------------------------------------- |
| `GET /<id>`                     | landing page (`dist/index.html`)               |
| `GET /<id>/images`              | project data, `Dataset.images()`               |
| `GET /<id>/<image>/full-image`  | image file, `Dataset.full_image()`             |
| `GET /<id>/<image>/thumbnail`   | thumbnail file, `Dataset.thumbnail()`          |
| `GET /<id>/<image>/position?x&y`| physical position, `Dataset.position()`        |

App-specific routes stay in each app and are added on the app returned by `create_app` (see `depth-core/app.py`). On the frontend, `provider.imageUrl(objectPath, image, "profile")` gives the url of a route about one image for both providers (WEB: `<id>/<image>/profile`, Orthanc: `/<plugin>/<image>/profile`).

### Backend usage

```bash
pip install -e ../core/api
```

```python
# polar/app.py
from optica_core import Dataset, create_app


class RotationDataset(Dataset):
    manifest = "rotation.json"

    def images(self, id):
        rotation_file = self.load(id)
        return {
            "rotationImages": [
                {"name": name, "label": name, "angle": round(image["angle"], 2)}
                for name, image in rotation_file["rotation"].items()
            ],
            "size": {"height": rotation_file["height"], "width": rotation_file["width"]},
            "thumbnails": len(rotation_file["thumbnails"]) != 0,
        }

    def position(self, id, image_id, x, y):
        pixel_ratio = self.load(id)["PixelRatio"]
        return {"x": x * pixel_ratio[0], "y": y * pixel_ratio[1]}


app = create_app(RotationDataset, logo="Polaroptica", version="1.0.0")

if __name__ == "__main__":
    app.run()
```

Override `full_image` / `thumbnail` when files aren't at `<id>/<image>` and `<id>/thumbnails/<image>` (depth maps ids through `depth.json`, sphaer reads the thumbnail folder from `calibration.json`). An unimplemented `position` answers 404.

The data folder is `$OPTICA_DATA_FOLDER`, else `<cwd>/data`, or `create_app(..., data_folder=...)`.

Tests: `cd api && python -m venv .venv && .venv/bin/pip install -e '.[test]' && .venv/bin/pytest`

## Frontend usage

Add the package to an app:

```json
"dependencies": { "@optica/core": "file:../core/frontend" }
```

```ts
import { Landmark, Distance, DataRepository, RepositoryFactory, ProviderFactory, OrthancProvider, cn } from "@optica/core"
import { Button } from "@optica/core/ui/button"
import "@optica/core/assets/index.css"   // Tailwind v4 theme, also scans the core components
```

An app keeps only its own payload type and parsing:

```ts
import { DataRepository, ProviderFactory, OrthancProvider, RepositoryFactory, type ImageName, type Size } from "@optica/core"

export type RotationImage = ImageName & { angle: number, image: string, thumbnail?: string }
export type ProjectData = { rotationImages: RotationImage[], size: Size, thumbnails: boolean }

export class RotationRepository extends DataRepository<ProjectData, RotationImage> {
    async getImages(objectPath: string) {
        const data = (await this.provider.getImages(objectPath)).data as ProjectData
        data.rotationImages = this.resolveUrls(objectPath, data.rotationImages, data.thumbnails)
        return data
    }
}

// main.ts
ProviderFactory.register("ORTHANC", (url) => new OrthancProvider(url, "polaroptica"))
RepositoryFactory.register("DATA", (provider) => new RotationRepository(provider))
```

A landmark's `pose.image` is an `ImageRef` (`name`, `label`, `details?`), not the full image: `Landmark` and `setPose` take any image and keep only `imageRef(image)`, whose `details` are the app fields that are a string or a number (polar: `angle`, read with `angleOf(landmark)`). `Position.z` is optional so 2D (polar, spectral) and 3D (stack, depth) apps share them. App rules on them go in an `Annotations` subclass (polar's `acceptsAngle(distance, angle)`).

Type-check and tests: `cd frontend && npm install && npm run type-check && npm test`

## Projects and acquisitions

A `Project` (an object) has one or many `Acquisition`s. An acquisition holds the images taken together, in order (`images`, may be empty) and the images on their own (`standaloneImages`), plus its viewer state: `camera`, the shown image (`index` in the group or a `standalone` name) and a default `size` (an image with its own `size` overrides it).

| App | Acquisitions | `images` | `standaloneImages` |
| --- | --- | --- | --- |
| stack | 1 | the stack, by slice | the stacked results (`individualImages`) |
| polar | 1 | the rotation, by angle | — |
| spectral | one per view | images ordered by the wavelength of the light | specific images (like "White" or "VIL") |
| sphaer | 1 | the sphere of views | — |
| depth | one per depth image (each its own coordinate space) | — | the depth image, with its `size` |

```ts
const project = await repository.getImages(objectPath)   // ProjectRepository
project.acquisition?.setIndex(3)                          // image of the group
project.acquisition?.select("result.png")                 // by name, group or standalone
project.selectedImage                                     // what the ImageViewer shows
project.acquisition?.sizeOf()                             // its size
```

App images extend `ProjectImage` (`RotationImage = ProjectImage & { angle: number }`) and get `Acquisition<RotationImage>`; extend the class for app getters (spectral's wavelength gradient, polar's angle map).

The backend returns the standard payload with the helpers of `optica_core`:

```python
from optica_core import acquisition, image, project

def images(self, id):
    stack_file = self.load(id)
    return project(acquisition(
        "stack", size={"width": stack_file["width"], "height": stack_file["height"]},
        images=[image(name) for name in stack_file["stack"]],
        standalone_images=[image(name, label) for label, name in stack_file["Stacked_images"].items()],
        thumbnails=bool(stack_file.get("thumbnails")),
    ))
```

`ProjectRepository` reads it as is. Until a backend is migrated, pass a parser for its old payload: `new ProjectRepository(provider, (data) => [{ id: "rotation", images: data.rotationImages, size: data.size, thumbnails: data.thumbnails }])` (see `frontend/tests/project.test.ts` for spectral and depth).

### Annotations

Each acquisition owns its `annotations`: all its images, grouped and standalone, share one coordinate space, so one set of landmarks and distances and one calibration (`adjustFactor`, `scale`, a `ScaleUnit` such as `"mm"`). They also keep the sidebar state (`tab`, `selectedDistanceIndex`).

```ts
const annotations = project.acquisition!.annotations     // through the store: reactive
annotations.landmarks.push(landmark)
const distance = annotations.selectedDistance ?? annotations.newDistance()   // the stored, reactive one
annotations.removeLandmark(id); annotations.showInSidebar(landmark)

project.annotationsToJSON()          // { [acquisition id]: { scale_factor, scale, landmarks, distances } }
project.importAnnotations(object)    // that, or a single set (old exports) for the selected acquisition
project.annotationsToCSVRows()       // header + one row per landmark, with its acquisition
usePersistedAnnotations(() => store.project)   // in a component: kept in sessionStorage across reloads
```

The sidebar state is saved across reloads (`getSelection`/`setSelection`) but not exported. An app with more annotations or rules extends `Annotations` and its `Acquisition` returns it from `createAnnotations()` with `declare annotations: …` (polar: `PolarAnnotations`, depth: `DepthAnnotations` with its profiles).

Watch the annotations, not the whole project: a deep watcher on the project walks through all its images.

## Viewers

`ImageViewer` (canvas: pan, wheel zoom, thumbnail → full image, landmarks and distances) and `ThumbnailViewer` (image + red box of the visible area) don't know any store: the app passes the data and reacts to events.

```vue
<script setup lang="ts">
import { ImageViewer } from "@optica/core/ui/image-viewer"
import { ThumbnailViewer } from "@optica/core/ui/thumbnail-viewer"
</script>

<ImageViewer :image="selectedImage" :size="size" :camera="camera"
  :landmarks="landmarks" :distances="distances"
  @place="addLandmark" @remove="deleteLandmark" @move="moveLandmark" @select="showInSidebar" />

<ThumbnailViewer :src="selectedImage.thumbnail || selectedImage.image" :size="size" :zoom-rect="camera.zoomRect" />
```

`camera` (`{ zoom, offset, zoomRect }`, `createCamera()`) is a reactive object owned by the app, the viewer updates it in place; `zoom <= 0` means fit to screen. `image` is a `ProjectImage` (`name`, `image`, `thumbnail?`), all coordinates are in pixels of the full image (`size`).

| Prop / event | Use |
| --- | --- |
| `@place(pos)` / `@remove(landmark)` | right click on the image / on a landmark |
| `@select(landmark)` / `@move(landmark, pos)` | left click on a landmark / end of its drag (pos clamped to the image) |
| `editable=false` | pan and zoom only |
| `contextMenu` + `@contextmenu(pos, landmark)` | right click opens a wrapping `ContextMenuTrigger` instead of place/remove |
| `markerPosition(landmark)` | where a landmark is on the shown image (default `pose.marker`) |
| `markerStroke(landmark)` | dot outline (default black on its own image, white elsewhere) |
| `canDrag(landmark)` | forbid moving some landmarks on this image |
| `extraLandmarks` + `draw(ctx, view)` | landmarks drawn by the app (`view.toCanvas`, `view.markerOf`, `view.drawLandmark`) |
| `fitOnImageChange` | refit on every image change |
| `ThumbnailViewer @drag(movement)` | drag on the thumbnail, as a fraction of its size |

How each app maps on it:

- **spectral**: .
- **stack**: as above, `:editable="imagesStore.image == 'stack'"`.
- **polar**: `:can-drag="(l) => annotations.canMoveTo(l, angle)"`, `@select` switches the sidebar tab.
- **depth** (see `depth-core/src/components/DepthViewer.vue`): profiles' ends go in `extraLandmarks` and are drawn with `draw` (line, triangle end, ticks, hover position); `@move` recomputes the profile when the landmark belongs to one; the profiles are watched to call the exposed `update()` (the hover of the chart is not a landmark change).
- **sphaer**: wrap in `ContextMenu`/`ContextMenuTrigger` with `context-menu fit-on-image-change`, `:marker-position="(l) => l.getPoses().get(image.name) ?? image.reprojections.get(l.id)"`, `:marker-stroke="(l) => l.getPoses().has(image.name) ? 'black' : 'white'"`. Its CameraViewer becomes `<ThumbnailViewer @drag="(m) => { cameraStore.moveLongitude(m.x * 180); cameraStore.moveLatitude(m.y * 180) }" />`.

## Sidebar and menu components

Same rule as the viewers: no store inside, the app binds its state with `v-model` and slots.

```vue
<AnnotationTabs v-model="landmarksStore.tab">            <!-- :tabs adds e.g. { value: 'profiles' } -->
  <template #landmarks>
    <LandmarkList v-model="landmarksStore.landmarks">
      <template #info="{ landmark }">{{ landmark.pose.image.label }}</template>
    </LandmarkList>
  </template>
  <template #distances>
    <DistanceList v-model="landmarksStore.distances" v-model:selected="landmarksStore.selectedDistanceIndex"
      v-model:scale="landmarksStore.scale" :adjust-factor="landmarksStore.adjustFactor" />
  </template>
</AnnotationTabs>

<AppMenu v-model:reverse="settingsStore.isLeft" app-name="Polaroptica" @import="importJSON" @export="exportAnnotations">
  <template #help-guide><HelpGuide /></template>
</AppMenu>

<ProjectLoader :load="getImages" v-slot="{ data }"> <ImageViewer ... /> </ProjectLoader>
```

| Component | Replaces | Variable parts |
| --- | --- | --- |
| `LandmarkList` / `LandmarkIteration` | `landmark/*` | `#info` (angle, image label, 3D pose), `#actions` (sphaer reset), `color-picker`, `visibility-toggle`, `highlighted`, `@activate` (row double click), `@remove` |
| `DistanceList` / `DistanceIteration` | `distance/DistanceList`, `DistanceIteration` | `#info` (polar angle), `#landmark-info` |
| `SelectScale` | `select-scale` | `v-model` unit |
| `ToggleImage` | image toggle of the depth and stack `Sidebar` | `v-model` value of the shown image, `items` (`{ value, label }[]`); clicking the active button keeps it |
| `AnnotationTabs` | tab block of every `Sidebar` | `tabs`, one slot per tab |
| `AppMenu` | `Menu.vue` | `@import(text)`, `@export('csv' \| 'json')`, `#help-guide`, `#menus`, `credits` (content of Help › Credits, `{ developers, projects, institutions }`, kept by each viewer in `src/config/credits.ts`; no item without it; the shared logos are in `@optica/core/assets/images/credits/`), `importable`/`exportable` (spectral: false) |
| `ProjectLoader` | `CameraViewer` loaders | `load`, `queryKey` (needs `VueQueryPlugin`) |

`units` (on `SelectScale`, `DistanceList`, `DistanceIteration`) restricts the units offered, depth leaves out `px`.

`distance.length(scale)` returns a length in image units (the core `Distance` reads `distance`, or `distancePx` for the `px` scale). Shown lengths are `toScale(length, adjustFactor) / Scale[scale]`; `Annotations.scaled(length)` gives the same, rounded, in the scale of the annotations, and `Annotations.calibrate(distance, target)` sets `adjustFactor` from a known length.

Export helpers (`lib/export.ts`): `downloadCSV`, `downloadJSON`, `exportFilename("polar", objectPath, "json")`, with the `Project` annotation methods above. They replace `file-saver`.

Kept per app: the logos (each app has its own artwork), the sidebar layouts around `AnnotationTabs` (slider, circular slider, toggle group), the stores and views. The `navbar` is an unused TailwindUI template and was left out.

## What is in the core

- **Viewers**: `image-viewer` (+ `drawing.ts` helpers: `drawDot`, `drawTarget`, `pointInsideCircle`), `thumbnail-viewer`.
- **Annotation UI**: `landmark`, `distance` (list, iteration), `select-scale`, `annotation-tabs`, `app-menu`, `project-loader`.
- **UI** (`frontend/src/components/ui`): button, card, carousel*, command, context-menu, credits, dialog, form*, input, input-group, label, menubar, scroll-area, select, separator, sheet, slider, switch, tabs, textarea, toggle, toggle-group — taken from polar (fully on reka-ui + Tailwind v4), card/carousel/credits from depth, form from sphaer. *optional peer deps (`embla-carousel-vue`, `vee-validate`; `@tanstack/vue-query` for `ProjectLoader`).
- **Assets**: `base.css`, `main.css`, `index.css` (theme), DejaVuSans font, target/dot icons, partner logos.
- **Lib**: `cn`, angle conversions, `computeDistance`, `Scale`, viewer constants.
- **Models**: `Project`, `Acquisition`, `Annotations`, `Coordinates`, `Position`, `ImageName`, `ProjectImage`, `Size`, `Camera`, `Marker`, `Landmark`, `Distance`, `DequeMax2`.
- **Data layer**: `DataProvider`, `WebProvider`, `OrthancProvider`, `DataRepository`, `ProjectRepository`, `ProviderFactory`, `RepositoryFactory` (both now cache their instances and accept registrations).

