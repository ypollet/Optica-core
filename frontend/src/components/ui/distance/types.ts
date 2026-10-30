import type { ScaleUnit } from "../../../lib/utils"
import type { ListLandmark } from "../landmark/types"

// What the distance lists need, the core Distance fits
export interface ListDistance<L extends ListLandmark = ListLandmark> {
  label: string
  landmarks: L[]
  show: boolean
  getColorHEX(): string
  setColorHEX(color: string): void
  reset(): void
  remove(landmark: L | string): void
  // length in image units for a scale, undefined while it can't be measured
  length(scale?: ScaleUnit): number | undefined
}

// What the distance lists need from the annotations, the core Annotations fits.
// The scale select changes `scale`
export interface ListAnnotations<D extends ListDistance = ListDistance> {
  scale: ScaleUnit
  // length of the distance shown in `scale`, calibrated and rounded
  scaled(distance: D): number
}
