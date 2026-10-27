<script setup lang="ts" generic="D extends ListDistance">
import { computed, ref, useTemplateRef } from "vue"
import { round } from "mathjs"
import draggable from "vuedraggable"
import { PhEraser, PhEye, PhEyeSlash, PhX } from "@phosphor-icons/vue"
import { ROUNDING, toScale, type ScaleUnit } from "../../../lib/utils"
import { Button } from "../button"
import { Input } from "../input"
import { Label } from "../label"
import { LandmarkIteration } from "../landmark"
import { SelectScale } from "../select-scale"
import { defaultMeasure } from "./measure"
import type { ListDistance, Measure } from "./types"

const scale = defineModel<ScaleUnit>('scale', { required: true })

const props = withDefaults(defineProps<{
  distance: D
  index: number
  // the selected distance shows its landmarks and its length
  selected?: boolean
  adjustFactor?: number
  measure?: Measure<D>
  // units of the scale select
  units?: ScaleUnit[]
}>(), {
  selected: true,
  adjustFactor: 1,
})

const emit = defineEmits<{
  // the delete button, or the last landmark was removed
  delete: [index: number]
  // double click on the label of a distance that isn't selected
  select: [index: number]
}>()

defineSlots<{
  // next to the buttons of the header, e.g. the angle of the distance
  info?(props: { distance: D }): any
  // right column of each landmark
  'landmark-info'?(props: { landmark: D["landmarks"][number] }): any
}>()

const input = useTemplateRef('input')
const scrollSnapType = ref<boolean>(true)

const length = computed(() => {
  const value = (props.measure ?? defaultMeasure)(props.distance, scale.value)
  return value == undefined ? 0 : round(toScale(value, props.adjustFactor, scale.value), ROUNDING)
})

function changeColor(event: Event) {
  const target = event.currentTarget as HTMLInputElement | null
  if (target == null) {
    return
  }
  props.distance.setColorHEX(target.value)
  props.distance.landmarks.forEach((landmark) => landmark.setColorHEX(target.value))
}

function changeLabel(payload: string | number) {
  props.distance.label = payload.toString()
}

function removeLandmark(id: string) {
  props.distance.remove(id)
  if (props.distance.landmarks.length == 0) {
    emit('delete', props.index)
  }
}

// Reorder the landmarks live while dragging. Sortable's own DOM move is cancelled
// (return false) so Vue is the only one moving the elements.
function onMoveLandmark(evt: any) {
  const landmarks = props.distance.landmarks
  const from = landmarks.indexOf(evt.draggedContext.element)
  const to = evt.draggedContext.futureIndex
  if (from !== -1 && from !== to && to < landmarks.length) {
    landmarks.splice(to, 0, landmarks.splice(from, 1)[0]!)
  }
  return false
}

// On drop, vuedraggable puts the dragged element back at its original DOM index
// (its model update is ignored, the list is already in order): put it back at
// evt.newIndex, where Vue had rendered it.
function onEndDrag(evt: any) {
  scrollSnapType.value = true
  evt.item.remove()
  evt.from.insertBefore(evt.item, evt.from.children[evt.newIndex] ?? null)
}

function showInput(event: MouseEvent) {
  event.preventDefault()
  if (!props.selected) {
    emit('select', props.index)
    return
  }
  props.distance.edit_label = true
  input.value?.$el?.focus?.()
}
</script>

<template>
  <div class="flex flex-col space-y-3">
    <div class="flex pr-2 border-transparent border-2">
      <div class="flex grow row justify-between items-center pr-3 py-2">
        <div class="flex grow row w-full justify-start items-center space-x-3 mr-3">
          <input type="color"
            class="h-8 w-8 block bg-white border border-gray-950 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-300"
            :value="distance.getColorHEX()" title="Choose your color" @change="changeColor($event)">
          <Label v-show="!distance.edit_label" class="flex whitespace-nowrap w-36 font-normal text-lg"
            @dblclick.stop="showInput">
            {{ distance.label }}
          </Label>
          <Input v-show="distance.edit_label" ref="input" type="text" :model-value="distance.label"
            class="flex h-auto w-full px-0" @focusout="distance.edit_label = false"
            @keyup.enter="distance.edit_label = false" @update:model-value="changeLabel($event)" />
        </div>
        <div class="flex row justify-end items-center space-x-3">
          <slot name="info" :distance="distance" />
          <Button class="relative w-6 h-6 p-0" v-show="distance.show" variant="secondary" @click="distance.show = false">
            <PhEye class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" v-show="!distance.show" variant="secondary" @click="distance.show = true">
            <PhEyeSlash class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" variant="secondary" @click="distance.reset()">
            <PhEraser class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" variant="destructive" @click="emit('delete', index)">
            <PhX class="relative w-4 h-4 p-0" />
          </Button>
        </div>
      </div>
    </div>

    <div v-if="selected" class="overflow-auto min-h-16 max-h-96 w-full border"
      :class="{ 'scroll-snap-type': scrollSnapType }">
      <draggable :model-value="distance.landmarks" :move="onMoveLandmark" :group="distance.label + '_landmarks_' + index"
        item-key="id" :force-fallback="true" :scroll="true" :bubbleScroll="true" :handle="'.handle'"
        class="relative w-fit min-w-full" @start="scrollSnapType = false" @end="onEndDrag">
        <template #item="{ element }: { element: D['landmarks'][number] }">
          <LandmarkIteration :landmark="element" :color-picker="false" :visibility-toggle="false"
            @remove="removeLandmark">
            <template v-if="$slots['landmark-info']" #info="slotProps">
              <slot name="landmark-info" v-bind="slotProps" />
            </template>
          </LandmarkIteration>
        </template>
      </draggable>
    </div>
    <div class="flex row justify-between">
      <div class="flex row space-x-1">
        <Label class="flex whitespace-nowrap w-auto items-center">Distance :</Label>
        <Label class="flex whitespace-nowrap w-auto items-center">{{ length }} {{ scale }}</Label>
      </div>
      <SelectScale v-if="selected" v-model="scale" :units="units" />
      <div v-else />
      
    </div>
  </div>
</template>
