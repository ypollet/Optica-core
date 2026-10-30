import { reactive } from "vue"

// What the user is doing with the landmarks right now, shared by the lists and the ImageViewer.
// Not part of the models: never saved, one landmark at a time (by id).
export const interaction = reactive({
    // pressed in a list, until the pointer is released: the viewer draws it bigger
    pressed: null as string | null,
    // dragged in the viewer: its row in the lists is highlighted and scrolled to
    dragged: null as string | null,
})
