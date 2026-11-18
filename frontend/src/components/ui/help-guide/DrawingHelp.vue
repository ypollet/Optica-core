<script setup lang="ts">
import { computed } from "vue"
import { PhMouseLeftClick, PhMouseRightClick } from "@phosphor-icons/vue"
import HelpSection from "./HelpSection.vue"
import { HELP_ANNOTATION_TYPES, hasMeasures, type HelpAnnotationType } from "./types"

// "Drawing annotations": the shared tabs of the AnnotationsPanel and the mouse on the image
const props = withDefaults(defineProps<{
  // the shared tabs of the viewer
  types?: HelpAnnotationType[]
}>(), {
  types: () => HELP_ANNOTATION_TYPES,
})

defineSlots<{
  // <li> after the shared types, e.g. the tabs of the app
  types?(): any
  // <li> after the shared ones
  default?(): any
}>()

const has = (type: HelpAnnotationType) => props.types.includes(type)
const measures = computed(() => hasMeasures(props.types))
// a landmark can be inserted in the middle of a side
const insert = computed(() => has("distances") || has("polygons"))
</script>

<template>
  <HelpSection title="Drawing annotations">
    <li>
      <PhMouseRightClick class="inline h-5 w-5 align-text-bottom" weight="fill" /> Right Click on the image: adds a
      landmark to the annotation selected in the tab opened in the sidebar<template v-if="measures">,
        <strong>New..</strong> starts a new one</template>
    </li>
    <li v-if="has('landmarks')"><strong>Landmarks</strong>: single points placed on the image</li>
    <li v-if="has('distances')"><strong>Distances</strong>: a path made of several landmarks</li>
    <li v-if="has('polygons')">
      <strong>Polygons</strong>: a closed shape made of several landmarks, closed with a right click on its first
      landmark (or <kbd class="rounded border px-1 text-xs">Enter</kbd> /
      <kbd class="rounded border px-1 text-xs">Esc</kbd>)
    </li>
    <li v-if="has('boxes')">
      <strong>Boxes</strong>: a rectangle given by two opposite corners, the next corner starts a new box
    </li>
    <slot name="types" />
    <li>
      <PhMouseLeftClick class="inline h-5 w-5 align-text-bottom" weight="fill" /> Left Click on a landmark: drag to
      move it
    </li>
    <li v-if="insert">
      <PhMouseLeftClick class="inline h-5 w-5 align-text-bottom" weight="fill" /> Left Click on the middle of a side of
      the distance or polygon being drawn: drag (or click) to insert a landmark
    </li>
    <li>
      <PhMouseRightClick class="inline h-5 w-5 align-text-bottom" weight="fill" /> Right Click on a landmark: deletes
      it
    </li>
    <slot />
  </HelpSection>
</template>
