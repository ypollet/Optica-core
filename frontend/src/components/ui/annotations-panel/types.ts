import type { ListBox, ListBoxAnnotations } from "../bounding-box/types"
import type { ListAnnotations, ListDistance } from "../distance/types"
import type { ListLandmark } from "../landmark/types"
import type { ListPolygon, ListPolygonAnnotations } from "../polygon/types"

// What the annotations panel needs, the core Annotations fits, so do the app ones
export interface PanelAnnotations<
  L extends ListLandmark = ListLandmark,
  D extends ListDistance<L> = ListDistance<L>,
  P extends ListPolygon<L> = ListPolygon<L>,
  B extends ListBox<L> = ListBox<L>,
> extends ListAnnotations<D>, ListPolygonAnnotations<P>, ListBoxAnnotations<B> {
  // shown tab
  tab: string
  landmarks: L[]
  distances: D[]
  polygons: P[]
  boxes: B[]
  selectedDistanceIndex: number
  selectedPolygonIndex: number
  selectedBoxIndex: number
}
