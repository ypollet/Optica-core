import type { Component } from "vue"
import { PhBoundingBox, PhLineSegments, PhPolygon } from "@phosphor-icons/vue"
import LandmarkIcon from "../../icons/LandmarkIcon.vue"

// icon is shown before the label, alone while the tab isn't selected (initials without icon)
export type AnnotationTab = { value: string, label: string, icon?: Component }

// shared by every viewer, so they all look the same
export const LANDMARK_TAB: AnnotationTab = { value: "landmarks", label: "Landmarks", icon: LandmarkIcon }
export const DISTANCE_TAB: AnnotationTab = { value: "distances", label: "Distances", icon: PhLineSegments }
export const POLYGON_TAB: AnnotationTab = { value: "polygons", label: "Polygons", icon: PhPolygon }
export const BOX_TAB: AnnotationTab = { value: "boxes", label: "Boxes", icon: PhBoundingBox }
