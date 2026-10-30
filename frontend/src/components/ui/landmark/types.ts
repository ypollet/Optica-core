import type { ViewerLandmark } from "../image-viewer/types"

// What the lists need from a landmark, the core Landmark fits, so do the app ones
export interface ListLandmark extends ViewerLandmark {
  label: string
  setColorHEX(color: string): void
}
