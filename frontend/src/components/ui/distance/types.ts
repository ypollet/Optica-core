import type { ScaleUnit } from "../../../lib/utils"
import type { ListLandmark } from "../landmark/types"

// What the distance lists need, the core Distance fits
export interface ListDistance<L extends ListLandmark = ListLandmark> {
  label: string
  edit_label: boolean
  edit_distance: boolean
  landmarks: L[]
  show: boolean
  getColorHEX(): string
  setColorHEX(color: string): void
  reset(): void
  remove(landmark: L | string): void
  // length in image units for a scale, undefined while it can't be measured
  length(scale?: ScaleUnit): number | undefined
}
