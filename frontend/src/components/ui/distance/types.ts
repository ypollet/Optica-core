import type { ScaleUnit } from "../../../lib/utils"
import type { ListAnnotation, ListScale } from "../annotation-list/types"
import type { ListLandmark } from "../landmark/types"

// What the distance lists need, the core Distance fits
export interface ListDistance<L extends ListLandmark = ListLandmark> extends ListAnnotation<L> {
  // length in image units for a scale, undefined while it can't be measured
  length(scale?: ScaleUnit): number | undefined
}

// What the distance lists need from the annotations, the core Annotations fits
export interface ListAnnotations<D extends ListDistance = ListDistance> extends ListScale {
  // length of the distance shown in `scale`, calibrated and rounded
  scaled(distance: D): number
}
