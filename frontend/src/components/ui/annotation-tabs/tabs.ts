import type { Component } from "vue"
import { PhMapPin, PhLineSegments } from "@phosphor-icons/vue"

// icon is shown in place of the label while the tab isn't selected (initials otherwise)
export type AnnotationTab = { value: string, label: string, icon?: Component }

// shared by every viewer, so they all look the same
export const LANDMARK_TAB: AnnotationTab = { value: "landmarks", label: "Landmarks", icon: PhMapPin }
export const DISTANCE_TAB: AnnotationTab = { value: "distances", label: "Distances", icon: PhLineSegments }
