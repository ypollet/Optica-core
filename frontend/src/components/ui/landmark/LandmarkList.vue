<script setup lang="ts" generic="L extends ListLandmark">
import { ref, type HTMLAttributes } from "vue"
import draggable from "vuedraggable"
import { cn } from "../../../lib/utils"
import LandmarkIteration from "./LandmarkIteration.vue"
import type { ListLandmark } from "./types"

const landmarks = defineModel<L[]>({ required: true })

const props = withDefaults(defineProps<{
  colorPicker?: boolean
  visibilityToggle?: boolean
  highlighted?: (landmark: L) => boolean
  class?: HTMLAttributes['class']
}>(), {
  colorPicker: true,
  visibilityToggle: true,
})

const emit = defineEmits<{
  // after the landmark was removed from the list
  remove: [id: string]
  // double click on a row
  activate: [landmark: L]
}>()

defineSlots<{
  info?(props: { landmark: L }): any
  actions?(props: { landmark: L }): any
}>()

const scrollSnapType = ref<boolean>(true)

function removeLandmark(id: string) {
  landmarks.value = landmarks.value.filter((landmark) => landmark.getId() != id)
  emit('remove', id)
}
</script>

<template>
  <div :class="cn('overflow-auto min-h-16 max-h-96 w-full border', props.class, { 'scroll-snap-type': scrollSnapType })">
    <draggable v-model="landmarks" group="landmarks" item-key="id" :force-fallback="true" :animation="150"
      :scroll="true" :bubbleScroll="true" :handle="'.handle'" class="relative w-fit min-w-full"
      @start="scrollSnapType = false" @end="scrollSnapType = true">
      <template #item="{ element }: { element: L }">
        <LandmarkIteration :landmark="element" :color-picker="colorPicker" :visibility-toggle="visibilityToggle"
          :highlighted="highlighted?.(element) ?? false" @remove="removeLandmark" @dblclick="emit('activate', element)">
          <template v-if="$slots.info" #info="slotProps">
            <slot name="info" v-bind="slotProps" />
          </template>
          <template v-if="$slots.actions" #actions="slotProps">
            <slot name="actions" v-bind="slotProps" />
          </template>
        </LandmarkIteration>
      </template>
    </draggable>
  </div>
</template>
