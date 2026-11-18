<script setup lang="ts">
import { computed } from "vue"
import HelpSection from "./HelpSection.vue"
import { HELP_ANNOTATION_TYPES, hasMeasures, type HelpAnnotationType } from "./types"

// "Measures": what the values of the lists are
const props = withDefaults(defineProps<{
  // the shared tabs of the viewer
  types?: HelpAnnotationType[]
}>(), {
  types: () => HELP_ANNOTATION_TYPES,
})

defineSlots<{
  // <li> at the start, e.g. how the values are computed
  intro?(): any
  // <li> right after the distance, e.g. other lengths of the app
  distance?(): any
  // <li> after the shared terms, e.g. the other measures of the app
  default?(): any
}>()

const has = (type: HelpAnnotationType) => props.types.includes(type)
const measures = computed(() => hasMeasures(props.types))
</script>

<template>
  <HelpSection title="Measures">
    <slot name="intro" />
    <li v-if="has('distances')">
      <strong>Distance</strong>: the straight distance between the landmarks, added up along the path
    </li>
    <slot name="distance" />
    <li v-if="has('polygons')"><strong>Perimeter</strong> and <strong>Area</strong>: of the closed polygon</li>
    <li v-if="has('boxes')"><strong>Size</strong> and <strong>Area</strong>: width × height of the box</li>
    <slot />
    <li v-if="measures">Values are shown in the unit chosen in the scale selector (m, cm, mm, µm...)</li>
  </HelpSection>
</template>
