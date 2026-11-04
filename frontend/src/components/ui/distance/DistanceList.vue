<script setup lang="ts" generic="D extends ListDistance">
import type { ScaleUnit } from "../../../lib/utils"
import { AnnotationList } from "../annotation-list"
import { Label } from "../label"
import type { ListAnnotations, ListDistance } from "./types"

const distances = defineModel<D[]>({ required: true })
// index of the selected distance, -1: the next landmark creates a new distance
const selectedIndex = defineModel<number>('selected', { required: true })
defineProps<{
  // scale of the measures and its calibration
  annotations: ListAnnotations<D>
  // units of the scale select
  units?: ScaleUnit[]
}>()

defineSlots<{
  // next to the buttons of the header, e.g. the image of the distance
  info?(props: { annotation: D }): any
  // right column of each landmark
  'landmark-info'?(props: { landmark: D["landmarks"][number] }): any
}>()
</script>

<template>
  <AnnotationList v-model="distances" v-model:selected="selectedIndex" :annotations="annotations" :units="units">
    <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
    <template v-if="$slots['landmark-info']" #landmark-info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
    <template #values="{ annotation }">
      <div class="flex row space-x-1">
        <Label class="flex whitespace-nowrap w-auto items-center">Distance :</Label>
        <Label class="flex whitespace-nowrap w-auto items-center">{{ annotations.scaled(annotation) }} {{ annotations.scale }}</Label>
      </div>
    </template>
  </AnnotationList>
</template>
