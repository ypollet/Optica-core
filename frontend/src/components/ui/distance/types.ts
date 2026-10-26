import type { ScaleUnit } from "../../../lib/utils"
import type { ListLandmark } from "../landmark/types"

// What the measures table needs from a distance
export interface MeasuredDistance {
  label: string
  edit_label: boolean
  edit_distance: boolean
  getColorHEX(): string
}

// What the distance lists need, the core Distance fits
export interface ListDistance<L extends ListLandmark = ListLandmark> extends MeasuredDistance {
  landmarks: L[]
  show: boolean
  setColorHEX(color: string): void
  reset(): void
  remove(landmark: L | string): void
}

// length of a distance in image units for a scale, undefined while it can't be measured
export type Measure<D> = (distance: D, scale: ScaleUnit) => number | undefined
