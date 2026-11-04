<script setup lang="ts" generic="L extends ListLandmark, D extends ListDistance<L>, P extends ListPolygon<L>, B extends ListBox<L>">
import { computed } from "vue"
import type { ScaleUnit } from "../../../lib/utils"
import { AnnotationTabs, BOX_TAB, DISTANCE_TAB, LANDMARK_TAB, POLYGON_TAB, type AnnotationTab } from "../annotation-tabs"
import { BoxList, type ListBox } from "../bounding-box"
import { DistanceList, type ListDistance } from "../distance"
import { LandmarkList, type ListLandmark } from "../landmark"
import { PolygonList, type ListPolygon } from "../polygon"
import type { PanelAnnotations } from "./types"

// The tabs of the landmarks, distances, polygons and boxes, then the ones of the app
const props = withDefaults(defineProps<{
  annotations: PanelAnnotations<L, D, P, B>
  // after the shared tabs, one slot each (#profiles...)
  extraTabs?: AnnotationTab[]
  // units of the scale selects
  units?: ScaleUnit[]
}>(), {
  extraTabs: () => [],
})

const emit = defineEmits<{
  // double click on a landmark of the landmarks tab
  activate: [landmark: L]
}>()

defineSlots<{
  // right column of the landmarks of the landmarks tab
  'landmark-info'?(props: { landmark: L }): any
  // next to the buttons of a distance, polygon or box, e.g. its image
  'measure-info'?(props: { annotation: D | P | B }): any
  // right column of the landmarks of a distance, polygon or box
  'measure-landmark-info'?(props: { landmark: L }): any
  // content of the extra tabs
  [tab: string]: ((props: any) => any) | undefined
}>()

const tabs = computed(() => [LANDMARK_TAB, DISTANCE_TAB, POLYGON_TAB, BOX_TAB, ...props.extraTabs])
</script>

<template>
  <AnnotationTabs v-model="annotations.tab" :tabs="tabs">
    <template #landmarks>
      <LandmarkList v-model="annotations.landmarks" @activate="(landmark) => emit('activate', landmark)">
        <template v-if="$slots['landmark-info']" #info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
      </LandmarkList>
    </template>
    <template #distances>
      <DistanceList v-model="annotations.distances" v-model:selected="annotations.selectedDistanceIndex"
        :annotations="annotations" :units="units">
        <template v-if="$slots['measure-info']" #info="slotProps"><slot name="measure-info" v-bind="slotProps" /></template>
        <template v-if="$slots['measure-landmark-info']" #landmark-info="slotProps"><slot name="measure-landmark-info" v-bind="slotProps" /></template>
      </DistanceList>
    </template>
    <template #polygons>
      <PolygonList v-model="annotations.polygons" v-model:selected="annotations.selectedPolygonIndex"
        :annotations="annotations" :units="units">
        <template v-if="$slots['measure-info']" #info="slotProps"><slot name="measure-info" v-bind="slotProps" /></template>
        <template v-if="$slots['measure-landmark-info']" #landmark-info="slotProps"><slot name="measure-landmark-info" v-bind="slotProps" /></template>
      </PolygonList>
    </template>
    <template #boxes>
      <BoxList v-model="annotations.boxes" v-model:selected="annotations.selectedBoxIndex"
        :annotations="annotations" :units="units">
        <template v-if="$slots['measure-info']" #info="slotProps"><slot name="measure-info" v-bind="slotProps" /></template>
        <template v-if="$slots['measure-landmark-info']" #landmark-info="slotProps"><slot name="measure-landmark-info" v-bind="slotProps" /></template>
      </BoxList>
    </template>
    <template v-for="tab in extraTabs" :key="tab.value" #[tab.value]>
      <slot :name="tab.value" />
    </template>
  </AnnotationTabs>
</template>
