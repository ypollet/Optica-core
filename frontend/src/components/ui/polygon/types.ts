import type { ScaleUnit } from "../../../lib/utils"
import type { ListAnnotation, ListScale } from "../annotation-list/types"
import type { ListLandmark } from "../landmark/types"

// What the polygon lists need, the core Polygon fits
export interface ListPolygon<L extends ListLandmark = ListLandmark> extends ListAnnotation<L> {
  // in image units for a scale, undefined under three landmarks
  perimeter(scale?: ScaleUnit): number | undefined
  area(scale?: ScaleUnit): number | undefined
}

// What the polygon lists need from the annotations, the core Annotations fits
export interface ListPolygonAnnotations<P extends ListPolygon = ListPolygon> extends ListScale {
  // perimeter and area of the polygon shown in `scale`, calibrated and rounded
  scaledPerimeter(polygon: P): number
  scaledArea(polygon: P): number
}
