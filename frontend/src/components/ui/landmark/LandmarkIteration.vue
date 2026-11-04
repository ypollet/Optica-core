<script setup lang="ts" generic="L extends ListLandmark">
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue"
import { PhEye, PhEyeSlash, PhX } from "@phosphor-icons/vue"
import { Button } from "../button"
import { LabelInput } from "../input"
import { Separator } from "../separator"
import { interaction } from "../../../lib/interaction"
import type { ListLandmark } from "./types"
import LandmarkIcon from "../../icons/LandmarkIcon.vue"

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

const dragged = computed(() => interaction.dragged == props.landmark.id)

function changeColor(event: Event) {
  const target = event.currentTarget as HTMLInputElement | null
  if (target == null) {
    return
  }
  props.landmark.setColorHEX(target.value)
}

// The landmark stays pressed from pointer down until release, even while dragging the row.
// The release is listened on window: during a drag the pointer is no longer over this row.
function release() {
  if (interaction.pressed == props.landmark.id) {
    interaction.pressed = null
  }
  window.removeEventListener('pointerup', release)
  window.removeEventListener('pointercancel', release)
}

function press() {
  interaction.pressed = props.landmark.id
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

onBeforeUnmount(release)

// Scroll the row into view when its landmark is dragged in the image viewer.
// immediate: the row is often mounted after the drag started (sidebar tab/selection switch).
const row = useTemplateRef('row')
watch(dragged, (isDragged) => {
  if (isDragged) {
    nextTick(() => row.value?.scrollIntoView({ block: 'nearest' }))
  }
}, { immediate: true })
</script>

<template>
  <div ref="row" class="scroll-align border flex grow p-2" @pointerdown="press"
    :class="{ 'dark:bg-purple-800 bg-purple-400': dragged || highlighted }">
    <div class="h-12 flex grow flex-row justify-between items-center font-normal px-3 py-2">
      <div class="flex flex-row w-full items-center justify-start space-x-3 py-3 mr-3">
        <LandmarkIcon v-if="handle" class="flex-none mr-2 h-6 w-6 handle" />
        <input v-if="colorPicker" type="color"
          class="flex-none h-8 w-8 block bg-white border border-gray-950 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-300"
          :value="landmark.getColorHEX()" title="Choose your color" @change="changeColor($event)">
        <LabelInput v-model="landmark.label" class="whitespace-nowrap" input-class="flex grow h-auto" />
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
        <Button class="w-6 h-6 p-0" variant="destructive" @click="emit('remove', landmark.id)">
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
