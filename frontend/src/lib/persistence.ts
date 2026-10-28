import { watch } from "vue"
import type { Project } from "../data/models/project"

// What is stored: the annotations (same as an export) and the sidebar state, by acquisition id
type SavedAnnotations = {
    annotations: Record<string, object>
    selection: Record<string, object>
}

// Keeps the annotations of the loaded project in `storage`, by object, across reloads
// (any AnnotationsSet: the core Annotations or an app's own).
// The project itself is loaded again from the backend: only the annotations are saved.
// Call it in a component setup, `project` returns the project of the store.
export function usePersistedAnnotations(project: () => Project<any, any> | null | undefined, storage: Storage = sessionStorage) {
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
        }
    }, { immediate: true })

    // watch the annotations only, not the images of the project.
    // Registered after the restore: it saves the restored annotations, never empty ones over them.
    watch(() => project()?.acquisitions.map((acquisition) => acquisition.annotations), () => {
        const loaded = project()
        if (!loaded) {
            return
        }
        const saved: SavedAnnotations = {
            annotations: loaded.annotationsToJSON(),
            selection: Object.fromEntries(loaded.acquisitions.map((acquisition) => [acquisition.id, acquisition.annotations.getSelection()])),
        }
        storage.setItem(key(loaded.objectPath), JSON.stringify(saved))
    }, { deep: true })
}
