<script setup lang="ts">
import { computed } from "vue"
import { PhEraser, PhEye, PhEyeSlash, PhMouseLeftClick, PhX } from "@phosphor-icons/vue"
import LandmarkIcon from "../../icons/LandmarkIcon.vue"
import HelpSection from "./HelpSection.vue"
import { HELP_ANNOTATION_TYPES, hasMeasures, type HelpAnnotationType } from "./types"

// "Managing annotations": the buttons of the lists in the sidebar
const props = withDefaults(defineProps<{
  // the shared tabs of the viewer
  types?: HelpAnnotationType[]
}>(), {
  types: () => HELP_ANNOTATION_TYPES,
})

defineSlots<{
  // <li> after the shared buttons, e.g. the buttons of the tabs of the app
  default?(): any
}>()

const measures = computed(() => hasMeasures(props.types))
</script>

<template>
  <HelpSection title="Managing annotations">
    <li>
      <PhMouseLeftClick class="inline h-5 w-5 align-text-bottom" weight="fill" /><span
        class="text-xs font-bold">x2</span>
      on a label: renames it<template v-if="measures"> (a distance, polygon or box is selected first)</template>
    </li>
    <li><LandmarkIcon class="inline h-5 w-5 align-text-bottom" /> drag to reorder the landmarks in the list</li>
    <li>
      <span class="inline-block h-4 w-4 align-middle bg-brand border border-black dark:border-white rounded-md"></span>
      changes the color
    </li>
    <li v-if="measures">
      <PhEraser class="inline h-5 w-5 align-text-bottom" /> clears the landmarks of a distance, polygon or box
    </li>
    <li>
      <PhEye class="inline h-5 w-5 align-text-bottom" /> / <PhEyeSlash class="inline h-5 w-5 align-text-bottom" />
      hides or shows it
    </li>
    <li>
      <span class="inline-flex items-center justify-center h-5 w-5 align-text-bottom rounded-md bg-destructive text-white">
        <PhX class="h-3.5 w-3.5" />
      </span>
      deletes it
    </li>
    <slot />
  </HelpSection>
</template>
