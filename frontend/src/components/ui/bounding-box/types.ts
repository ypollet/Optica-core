import type { Coordinates } from "../../../data/models/coordinates"
import type { ScaleUnit } from "../../../lib/utils"
import type { ListAnnotation, ListScale } from "../annotation-list/types"
import type { ListLandmark } from "../landmark/types"

// What the box lists need, the core BoundingBox fits (its landmarks are the two opposite corners)
export interface ListBox<L extends ListLandmark = ListLandmark> extends ListAnnotation<L> {
  // in image units for a scale, undefined under two corners
  width(scale?: ScaleUnit): number | undefined
  height(scale?: ScaleUnit): number | undefined
  center(scale?: ScaleUnit): Coordinates | undefined
  area(scale?: ScaleUnit): number | undefined
}

// What the box lists need from the annotations, the core Annotations fits
export interface ListBoxAnnotations<B extends ListBox = ListBox> extends ListScale {
  // sizes of the box shown in `scale`, calibrated and rounded
  scaledWidth(box: B): number
  scaledHeight(box: B): number
  scaledCenter(box: B): Coordinates
  scaledBoxArea(box: B): number
}
