<script setup lang="ts" generic="A extends ListAnnotation">
import { ref } from "vue"
import draggable from "vuedraggable"
import { PhEraser, PhEye, PhEyeSlash, PhX } from "@phosphor-icons/vue"
import type { ScaleUnit } from "../../../lib/utils"
import { Button } from "../button"
import { LabelInput } from "../input"
import { LandmarkIteration } from "../landmark"
import { SelectScale } from "../select-scale"
import type { ListAnnotation, ListScale } from "./types"

// A distance, polygon or box: its header, its landmarks while selected and its values
const props = withDefaults(defineProps<{
  annotation: A
  // its scale select changes the scale of the annotations
  annotations: ListScale
  index: number
  // the selected one shows its landmarks and its scale select
  selected?: boolean
  // units of the scale select
  units?: ScaleUnit[]
  // shows the scale select even if not selected
  scaleSelect?: boolean
  // its landmarks can be reordered by dragging them (the sides of a distance or polygon follow their order)
  reorderable?: boolean
}>(), {
  selected: true,
  reorderable: true,
})

const emit = defineEmits<{
  // the delete button, or the last landmark was removed
  delete: [index: number]
  // double click on the label while not selected
  select: [index: number]
}>()

defineSlots<{
  // next to the buttons of the header, e.g. the angle of the annotation
  info?(props: { annotation: A }): any
  // right column of each landmark
  'landmark-info'?(props: { landmark: A["landmarks"][number] }): any
  // its measures, left of the scale select
  values?(): any
}>()

const scrollSnapType = ref<boolean>(true)

function changeColor(event: Event) {
  const target = event.currentTarget as HTMLInputElement | null
  if (target == null) {
    return
  }
  props.annotation.setColorHEX(target.value)
  props.annotation.landmarks.forEach((landmark) => landmark.setColorHEX(target.value))
}

function removeLandmark(id: string) {
  props.annotation.remove(id)
  if (props.annotation.landmarks.length == 0) {
    emit('delete', props.index)
  }
}

// Reorder the landmarks live while dragging. Sortable's own DOM move is cancelled
// (return false) so Vue is the only one moving the elements.
function onMoveLandmark(evt: any) {
  const landmarks = props.annotation.landmarks
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
</script>

<template>
  <div class="flex flex-col space-y-3">
    <div class="flex pr-2 border-transparent border-2">
      <div class="flex grow row justify-between items-center pr-3 py-2">
        <div class="flex grow row w-full justify-start items-center space-x-3 mr-3">
          <input type="color"
            class="h-8 w-8 block bg-white border border-gray-950 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-300"
            :value="annotation.getColorHEX()" title="Choose your color" @change="changeColor($event)">
          <LabelInput v-model="annotation.label" :editable="selected" class="flex whitespace-nowrap w-36 font-normal text-lg"
            input-class="flex h-auto w-full px-0" @dblclick="selected || emit('select', index)" />
        </div>
        <div class="flex row justify-end items-center space-x-3">
          <slot name="info" :annotation="annotation" />
          <Button class="relative w-6 h-6 p-0" v-show="annotation.show" variant="secondary" @click="annotation.show = false">
            <PhEye class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" v-show="!annotation.show" variant="secondary" @click="annotation.show = true">
            <PhEyeSlash class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" variant="secondary" @click="annotation.reset()">
            <PhEraser class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="relative w-6 h-6 p-0" variant="destructive" @click="emit('delete', index)">
            <PhX class="relative w-4 h-4 p-0" />
          </Button>
        </div>
      </div>
    </div>

    <div v-if="selected && annotation.landmarks.length > 0" class="overflow-auto min-h-16 max-h-64 w-full border"
      :class="{ 'scroll-snap-type': scrollSnapType }">
      <draggable v-if="reorderable" :model-value="annotation.landmarks" :move="onMoveLandmark"
        :group="annotation.label + '_landmarks_' + index" item-key="id" :force-fallback="true" :scroll="true"
        :bubbleScroll="true" :handle="'.handle'" class="relative w-fit min-w-full" @start="scrollSnapType = false"
        @end="onEndDrag">
        <template #item="{ element }: { element: A['landmarks'][number] }">
          <LandmarkIteration :landmark="element" :color-picker="false" :visibility-toggle="false"
            @remove="removeLandmark">
            <template v-if="$slots['landmark-info']" #info="slotProps">
              <slot name="landmark-info" v-bind="slotProps" />
            </template>
          </LandmarkIteration>
        </template>
      </draggable>
      <template v-else>
        <LandmarkIteration v-for="landmark in annotation.landmarks" :key="landmark.id" :landmark="landmark"
          :color-picker="false" :visibility-toggle="false" :handle="false" @remove="removeLandmark">
          <template v-if="$slots['landmark-info']" #info="slotProps">
            <slot name="landmark-info" v-bind="slotProps" />
          </template>
        </LandmarkIteration>
      </template>
    </div>
    <div class="flex row justify-between">
      <slot name="values" />
      <SelectScale v-if="selected || scaleSelect" v-model="annotations.scale" :units="units" />
      <div v-else />
    </div>
  </div>
</template>
