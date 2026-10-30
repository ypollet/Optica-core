import type { Coordinates } from "../../../data/models/coordinates"

// What the viewer needs from a landmark, the core Landmark fits, so do the app ones
export interface ViewerLandmark {
  id: string
  show?: boolean
  getColorHEX(): string
}

export interface ViewerDistance<L extends ViewerLandmark = ViewerLandmark> {
  landmarks: L[]
  show?: boolean
  getColorHEX(): string
}

// Given to the `draw` hook so apps can draw their own overlays (e.g. depth profiles)
export interface ViewerDrawContext<L extends ViewerLandmark = ViewerLandmark> {
  // radius of a landmark dot in canvas units
  radius: number
  zoom: Coordinates
  // image pixel -> canvas coordinates
  toCanvas(pos: Coordinates): Coordinates
  // marker of a landmark on the current image, following the drag
  markerOf(landmark: L): Coordinates | undefined
  isDragged(landmark: L): boolean
  drawLandmark(landmark: L, radius?: number): void
}
