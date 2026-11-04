<script setup lang="ts" generic="A extends ListAnnotation">
import { computed } from "vue"
import type { AcceptableValue } from "reka-ui"
import { PhCircle } from "@phosphor-icons/vue"
import type { ScaleUnit } from "../../../lib/utils"
import { Button } from "../button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../select"
import { SelectScale } from "../select-scale"
import AnnotationIteration from "./AnnotationIteration.vue"
import type { ListAnnotation, ListScale } from "./types"

// Distances, polygons or boxes: a select of the one being drawn ("New.." for the next landmark to start one),
// then the selected one and the others
const items = defineModel<A[]>({ required: true })
// index of the selected one, -1: the next landmark starts a new one
const selectedIndex = defineModel<number>('selected', { required: true })
withDefaults(defineProps<{
  // its scale select changes the scale of the annotations
  annotations: ListScale
  // units of the scale select
  units?: ScaleUnit[]
  // see AnnotationIteration
  reorderable?: boolean
}>(), {
  reorderable: true,
})

defineSlots<{
  info?(props: { annotation: A }): any
  'landmark-info'?(props: { landmark: A["landmarks"][number] }): any
  // the measures of each one
  values?(props: { annotation: A }): any
}>()

const selected = computed(() => items.value[selectedIndex.value])

const others = computed(() => items.value
  .map((annotation, index) => ({ annotation, index }))
  .filter(({ index }) => index != selectedIndex.value))

function select(payload: AcceptableValue) {
  selectedIndex.value = Number(payload)
}

function remove(index: number) {
  items.value.splice(index, 1)
  if (index == selectedIndex.value) {
    selectedIndex.value = -1
  } else if (index < selectedIndex.value) {
    selectedIndex.value -= 1
  }
}
</script>

<template>
  <div class="flex grow w-full flex-col space-y-5">
    <div class="flex space-x-2">
      <Select :model-value="selectedIndex.toString()" @update:model-value="select">
        <SelectTrigger class="w-full">
          <!-- Rendered from the model: reka-ui caches each item's text at mount,
               so its own label goes stale when items are removed or renamed -->
          <SelectValue>
            <span class="content-center">{{ selected ? selected.label : 'New..' }}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem class="h-8" value="-1">
              <div class="flex flex-row space-x-2 items-center">
                <PhCircle />
                <span class="content-center">New..</span>
              </div>
            </SelectItem>
            <SelectItem class="h-8" v-for="(annotation, index) in items" :key="index" :value="index.toString()">
              <div class="flex flex-row space-x-2 items-center">
                <PhCircle weight="fill" :color="annotation.getColorHEX()" />
                <span class="content-center">{{ annotation.label }}</span>
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="secondary" @click="select(-1)">New..</Button>
    </div>
    <AnnotationIteration v-if="selected" :annotation="selected" :index="selectedIndex" :selected="true"
      :annotations="annotations" :units="units" :reorderable="reorderable" @delete="remove">
      <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
      <template v-if="$slots['landmark-info']" #landmark-info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
      <template #values><slot name="values" :annotation="selected" /></template>
    </AnnotationIteration>
    <!-- with nothing selected, the first one shows the scale select -->
    <AnnotationIteration v-for="{ annotation, index } in others" :key="index" :annotation="annotation" :index="index"
      :selected="false" :scale-select="selectedIndex == -1 && index == 0" :annotations="annotations" :units="units"
      :reorderable="reorderable" @delete="remove" @select="select">
      <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
      <template #values><slot name="values" :annotation="annotation" /></template>
    </AnnotationIteration>
    <!-- nothing to show the scale select with -->
    <div v-if="items.length == 0" class="flex justify-end">
      <SelectScale v-model="annotations.scale" :units="units" />
    </div>
  </div>
</template>
