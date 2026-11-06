import { watch } from "vue"
import type { Acquisition, Project } from "../data/models/project"

// What is stored: the annotations (same as an export) and the sidebar state, by acquisition id
type SavedAnnotations = {
    annotations: Record<string, object>
    selection: Record<string, object>
}

// Keeps the annotations of the loaded project in `storage`, by object, across reloads
// (any AnnotationsSet: the core Annotations or an app's own).
// The project itself is loaded again from the backend: only the annotations are saved.
// Call it in a component setup, `project` returns the project of the store.
// onRestored: called once saved annotations are put back (recompute the positions lost by a reload
// during their computation)
export function usePersistedAnnotations(project: () => Project<any, any> | null | undefined,
    { storage = sessionStorage, onRestored }: { storage?: Storage, onRestored?: () => void } = {}) {
    const key = (objectPath: string) => `annotations:${objectPath}`

    // a project was loaded: put its saved annotations back
    watch(project, (loaded) => {
        if (!loaded) {
            return
        }
        try {
            const saved = storage.getItem(key(loaded.objectPath))
            if (!saved) {
                return
            }
            const object = JSON.parse(saved) as Partial<SavedAnnotations>
            loaded.importAnnotations(object.annotations ?? {}, true)
            Object.entries(object.selection ?? {}).forEach(([id, selection]) => {
                loaded.getAcquisition(id)?.annotations.setSelection(selection)
            })
        } catch (error) {
            console.error("Saved annotations ignored:", error)
            return
        }
        onRestored?.()
    }, { immediate: true })

    // Watches what is saved, serialized: only a change of it writes the storage, not the
    // display state of the annotations (hover, drag) nor the images of the project.
    // Registered after the restore: it saves the restored annotations, never empty ones over them.
    watch(() => {
        const loaded = project()
        if (!loaded) {
            return undefined
        }
        const saved: SavedAnnotations = {
            annotations: loaded.annotationsToJSON(),
            selection: Object.fromEntries(loaded.acquisitions.map((acquisition) => [acquisition.id, acquisition.annotations.getSelection()])),
        }
        return { objectPath: loaded.objectPath, json: JSON.stringify(saved) }
    }, (saved, previous) => {
        if (saved && (saved.objectPath != previous?.objectPath || saved.json != previous.json)) {
            storage.setItem(key(saved.objectPath), saved.json)
        }
    })
}

// What the viewer is on: the image shown in each acquisition (its name), by acquisition id, and the selected acquisition
export type ShownImages = {
    acquisition?: string
    images: Record<string, string>
}

const shownKey = (objectPath: string) => `shown:${objectPath}`

// The saved ShownImages of an object, e.g. for images the app adds after the load (computed ones)
export function loadShownImages(objectPath: string, storage: Storage = sessionStorage): ShownImages {
    try {
        return { images: {}, ...JSON.parse(storage.getItem(shownKey(objectPath)) ?? "{}") }
    } catch (error) {
        console.error("Saved shown images ignored:", error)
        return { images: {} }
    }
}

// Keeps the shown image of each acquisition and the selected acquisition in `storage`, by object, across
// reloads, whatever changes them. Call it in a component setup, `project` returns the project of the store.
export function usePersistedView(project: () => Project<any, any> | null | undefined, storage: Storage = sessionStorage) {
    // a project was loaded: show what was shown (an image that isn't there anymore is skipped)
    watch(project, (loaded) => {
        if (!loaded) {
            return
        }
        const shown = loadShownImages(loaded.objectPath, storage)
        if (shown.acquisition != null) {
            loaded.selectAcquisition(shown.acquisition)
        }
        for (const acquisition of loaded.acquisitions) {
            const name = shown.images[acquisition.id]
            if (name != null) {
                acquisition.select(name)
            }
        }
    }, { immediate: true })

    // registered after the restore: it saves the restored view, never the first image over it
    watch(() => {
        const loaded = project()
        if (!loaded) {
            return undefined
        }
        const shown: ShownImages = {
            acquisition: loaded.acquisition?.id,
            images: Object.fromEntries(loaded.acquisitions.flatMap((acquisition: Acquisition<any, any>) =>
                acquisition.selectedImage ? [[acquisition.id, acquisition.selectedImage.name]] : [])),
        }
        return { objectPath: loaded.objectPath, json: JSON.stringify(shown) }
    }, (saved, previous) => {
        if (saved && (saved.objectPath != previous?.objectPath || saved.json != previous.json)) {
            storage.setItem(shownKey(saved.objectPath), saved.json)
        }
    })
}
