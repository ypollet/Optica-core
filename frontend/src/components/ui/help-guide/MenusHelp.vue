<script setup lang="ts">
import HelpSection from "./HelpSection.vue"

// "Menus": the shared menus of the AppMenu
withDefaults(defineProps<{
  // same as AppMenu
  importable?: boolean
  exportable?: boolean
}>(), {
  importable: true,
  exportable: true,
})

defineSlots<{
  // <li> after the shared ones, e.g. the menus of the app
  default?(): any
}>()
</script>

<template>
  <HelpSection title="Menus">
    <li v-if="importable"><strong>File › Import</strong>: loads the annotations of a JSON file exported before</li>
    <li v-if="exportable"><strong>File › Export</strong>: saves the annotations as CSV (spreadsheet) or JSON</li>
    <li><strong>Settings › Dark Mode</strong>: dark or light theme</li>
    <li><strong>Settings › Reverse Mode</strong>: puts the sidebar on the left</li>
    <slot />
    <li><strong>Help › Credits</strong>: the people and institutions behind the project</li>
  </HelpSection>
</template>
