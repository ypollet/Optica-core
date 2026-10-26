<script setup lang="ts" generic="L extends ListLandmark">
import { nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue"
import { PhEye, PhEyeSlash, PhX } from "@phosphor-icons/vue"
import { Button } from "../button"
import { Input } from "../input"
import { Label } from "../label"
import { Separator } from "../separator"
import type { ListLandmark } from "./types"

const props = withDefaults(defineProps<{
  landmark: L
  colorPicker?: boolean
  visibilityToggle?: boolean
  // show the drag handle (inside a vuedraggable list)
  handle?: boolean
  // highlight the row (e.g. sphaer selection)
  highlighted?: boolean
}>(), {
  colorPicker: true,
  visibilityToggle: true,
  handle: true,
  highlighted: false,
})

const emit = defineEmits<{
  remove: [id: string]
}>()

defineSlots<{
  // right column, e.g. angle, image label or 3D position
  info?(props: { landmark: L }): any
  // buttons before the remove button
  actions?(props: { landmark: L }): any
}>()

function changeColor(event: Event) {
  const target = event.currentTarget as HTMLInputElement | null
  if (target == null) {
    return
  }
  props.landmark.setColorHEX(target.value)
}

function changeLabel(payload: string | number) {
  props.landmark.setLabel(payload.toString())
}

// isClicked stays true from pointer down until release, even while dragging the row.
// The release is listened on window: during a drag the pointer is no longer over this row.
function release() {
  props.landmark.isClicked = false
  window.removeEventListener('pointerup', release)
  window.removeEventListener('pointercancel', release)
}

function press() {
  props.landmark.isClicked = true
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

onBeforeUnmount(release)

// Scroll the row into view when its landmark is dragged in the image viewer.
// immediate: the row is often mounted after isDragged is set (sidebar tab/selection switch).
const row = useTemplateRef('row')
watch(() => props.landmark.isDragged, (isDragged) => {
  if (isDragged) {
    nextTick(() => row.value?.scrollIntoView({ block: 'nearest' }))
  }
}, { immediate: true })
</script>

<template>
  <div ref="row" class="scroll-align border flex grow p-2" @pointerdown="press"
    :class="{ 'dark:bg-purple-800 bg-purple-400': landmark.isDragged || highlighted }">
    <div class="h-12 flex grow flex-row justify-between items-center font-normal px-3 py-2">
      <div class="flex flex-row w-full items-center justify-start space-x-3 py-3 mr-3">
        <svg v-if="handle" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          xmlns="http://www.w3.org/2000/svg" class="flex-none mr-2 h-6 w-6 handle">
          <path
            d="M7.49985 0.877045C3.84216 0.877045 0.877014 3.84219 0.877014 7.49988C0.877014 11.1575 3.84216 14.1227 7.49985 14.1227C11.1575 14.1227 14.1227 11.1575 14.1227 7.49988C14.1227 3.84219 11.1575 0.877045 7.49985 0.877045ZM1.82701 7.49988C1.82701 4.36686 4.36683 1.82704 7.49985 1.82704C10.6328 1.82704 13.1727 4.36686 13.1727 7.49988C13.1727 10.6329 10.6328 13.1727 7.49985 13.1727C4.36683 13.1727 1.82701 10.6329 1.82701 7.49988ZM7.49999 9.49999C8.60456 9.49999 9.49999 8.60456 9.49999 7.49999C9.49999 6.39542 8.60456 5.49999 7.49999 5.49999C6.39542 5.49999 5.49999 6.39542 5.49999 7.49999C5.49999 8.60456 6.39542 9.49999 7.49999 9.49999Z"
            fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
        </svg>
        <input v-if="colorPicker" type="color"
          class="flex-none h-8 w-8 block bg-white border border-gray-950 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-300"
          :value="landmark.getColorHEX()" title="Choose your color" @change="changeColor($event)">
        <Label v-show="!landmark.getEdit()" class="whitespace-nowrap" @dblclick.stop="landmark.setEdit(true)">
          {{ landmark.label }}
        </Label>
        <Input v-show="landmark.getEdit()" @dblclick.stop="" type="text" :model-value="landmark.label"
          class="flex grow h-auto" @focusout="landmark.setEdit(false)" @keyup.enter="landmark.setEdit(false)"
          @update:model-value="changeLabel($event)" />
      </div>
      <div v-if="$slots.info" class="flex items-center h-full w-auto justify-end space-x-3 pr-3">
        <Separator orientation="vertical" class="h-full w-0.5" />
        <slot name="info" :landmark="landmark" />
      </div>
      <div class="flex items-center justify-end space-x-3">
        <template v-if="visibilityToggle">
          <Button class="w-6 h-6 p-0" v-show="landmark.show !== false" variant="secondary"
            @click="landmark.show = false">
            <PhEye class="relative w-4 h-4 p-0" />
          </Button>
          <Button class="w-6 h-6 p-0" v-show="landmark.show === false" variant="secondary"
            @click="landmark.show = true">
            <PhEyeSlash class="relative w-4 h-4 p-0" />
          </Button>
        </template>
        <slot name="actions" :landmark="landmark" />
        <Button class="w-6 h-6 p-0" variant="destructive" @click="emit('remove', landmark.getId())">
          <PhX class="relative w-4 h-4 p-0" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style>
.scroll-align {
  scroll-snap-align: start;
  scroll-behavior: auto;
}

.scroll-snap-type {
  scroll-snap-type: y mandatory;
}
</style>
