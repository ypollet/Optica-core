<script setup lang="ts" generic="P extends ListPolygon">
import type { ScaleUnit } from "../../../lib/utils"
import { AnnotationList } from "../annotation-list"
import { Label } from "../label"
import type { ListPolygonAnnotations, ListPolygon } from "./types"

const polygons = defineModel<P[]>({ required: true })
// index of the polygon being drawn, -1: the next landmark creates a new polygon
const selectedIndex = defineModel<number>('selected', { required: true })
defineProps<{
  // scale of the measures and its calibration
  annotations: ListPolygonAnnotations<P>
  // units of the scale select
  units?: ScaleUnit[]
}>()

defineSlots<{
  // next to the buttons of the header, e.g. the image of the polygon
  info?(props: { annotation: P }): any
  // right column of each landmark
  'landmark-info'?(props: { landmark: P["landmarks"][number] }): any
}>()
</script>

<template>
  <AnnotationList v-model="polygons" v-model:selected="selectedIndex" :annotations="annotations" :units="units">
    <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
    <template v-if="$slots['landmark-info']" #landmark-info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
    <template #values="{ annotation }">
      <div class="flex flex-col space-y-1">
        <div class="flex row space-x-1">
          <Label class="flex whitespace-nowrap w-auto items-center">Perimeter :</Label>
          <Label class="flex whitespace-nowrap w-auto items-center">{{ annotations.scaledPerimeter(annotation) }} {{ annotations.scale }}</Label>
        </div>
        <div class="flex row space-x-1">
          <Label class="flex whitespace-nowrap w-auto items-center">Area :</Label>
          <Label class="flex whitespace-nowrap w-auto items-center">{{ annotations.scaledArea(annotation) }} {{ annotations.scale }}²</Label>
        </div>
      </div>
    </template>
  </AnnotationList>
</template>
