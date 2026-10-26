import type { ViewerLandmark } from "../image-viewer/types"

// What the lists need from a landmark, the core Landmark fits, so do the app ones
export interface ListLandmark extends ViewerLandmark {
  label: string
  getId(): string
  getEdit(): boolean
  setEdit(edit: boolean): void
  setLabel(label: string): void
  setColorHEX(color: string): void
}
