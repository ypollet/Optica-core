import type { Coordinates } from "./coordinates"

// Part of the image (in image pixels) visible in the viewer
export type ZoomRect = {
    top: number,
    left: number,
    width: number,
    height: number
}

// View state of an ImageViewer, zoom <= 0 means "fit to screen"
export type Camera = {
    zoom: number,
    offset: Coordinates,
    zoomRect: ZoomRect
}

// The ImageViewer showing this camera fits the whole image on its next update
export function fitCamera(camera: Camera) {
    camera.zoom = 0
}

export function createCamera(): Camera {
    return {
        zoom: 0,
        offset: { x: 0, y: 0 },
        zoomRect: { top: 0, left: 0, width: 0, height: 0 }
    }
}
