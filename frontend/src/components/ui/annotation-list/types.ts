import type { ScaleUnit } from "../../../lib/utils"
import type { ListLandmark } from "../landmark/types"

// What the annotation lists need from a distance, polygon or box, the core ones fit
export interface ListAnnotation<L extends ListLandmark = ListLandmark> {
  label: string
  landmarks: L[]
  show: boolean
  getColorHEX(): string
  setColorHEX(color: string): void
  reset(): void
  remove(landmark: L | string): void
}

// The scale select of the lists changes `scale`, the core Annotations fits
export interface ListScale {
  scale: ScaleUnit
}
