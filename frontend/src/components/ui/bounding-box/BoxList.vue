<script setup lang="ts" generic="B extends ListBox">
import type { ScaleUnit } from "../../../lib/utils"
import { AnnotationList } from "../annotation-list"
import { Label } from "../label"
import type { ListBoxAnnotations, ListBox } from "./types"

const boxes = defineModel<B[]>({ required: true })
// index of the selected box, -1: the next corner creates a new box (also once a box has its two corners)
const selectedIndex = defineModel<number>('selected', { required: true })
defineProps<{
  // scale of the measures and its calibration
  annotations: ListBoxAnnotations<B>
  // units of the scale select
  units?: ScaleUnit[]
}>()

defineSlots<{
  // next to the buttons of the header, e.g. the image of the box
  info?(props: { annotation: B }): any
  // right column of each landmark
  'landmark-info'?(props: { landmark: B["landmarks"][number] }): any
}>()
</script>

<template>
  <AnnotationList v-model="boxes" v-model:selected="selectedIndex" :annotations="annotations" :units="units"
    :reorderable="false">
    <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
    <template v-if="$slots['landmark-info']" #landmark-info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
    <template #values="{ annotation }">
      <div v-if="annotation.landmarks.length >= 2" class="flex flex-col space-y-1">
        <div class="flex row space-x-1">
          <Label class="flex whitespace-nowrap w-auto items-center">Size :</Label>
          <Label class="flex whitespace-nowrap w-auto items-center">{{ annotations.scaledWidth(annotation) }} × {{ annotations.scaledHeight(annotation) }} {{ annotations.scale }}</Label>
        </div>
        <div class="flex row space-x-1">
          <Label class="flex whitespace-nowrap w-auto items-center">Area :</Label>
          <Label class="flex whitespace-nowrap w-auto items-center">{{ annotations.scaledBoxArea(annotation) }} {{ annotations.scale }}²</Label>
        </div>
      </div>
      <!-- while the box is being created: what the next right click on the image does -->
      <Label v-else class="flex items-center font-normal text-muted-foreground">
        Right click on the image to place the {{ annotation.landmarks.length == 0 ? 'first' : 'second' }} corner
      </Label>
    </template>
  </AnnotationList>
</template>
