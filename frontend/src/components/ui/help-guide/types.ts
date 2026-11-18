// The annotation types of the shared tabs (see AnnotationsPanel)
export type HelpAnnotationType = "landmarks" | "distances" | "polygons" | "boxes"

export const HELP_ANNOTATION_TYPES: HelpAnnotationType[] = ["landmarks", "distances", "polygons", "boxes"]

// distances, polygons or boxes: drawn in the one selected in their list
export const hasMeasures = (types: HelpAnnotationType[]) =>
  types.includes("distances") || types.includes("polygons") || types.includes("boxes")
