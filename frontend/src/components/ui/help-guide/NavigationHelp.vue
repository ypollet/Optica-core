<script setup lang="ts">
import { PhArrowsOut, PhMouseLeftClick, PhMouseScroll } from "@phosphor-icons/vue"
import HelpSection from "./HelpSection.vue"

// "Navigating the image": moving around in the ImageViewer
defineSlots<{
  // <li> after the shared ones, e.g. switching images
  default?(): any
}>()
</script>

<template>
  <HelpSection title="Navigating the image">
    <li><PhMouseScroll class="inline h-5 w-5 align-text-bottom" weight="fill" /> Mouse Wheel: zoom in/out</li>
    <li>
      <PhMouseLeftClick class="inline h-5 w-5 align-text-bottom" weight="fill" /> Left Click on empty space: drag to
      pan
    </li>
    <li>The thumbnail at the top of the sidebar shows the part of the image that is visible</li>
    <li><PhArrowsOut class="inline h-5 w-5 align-text-bottom" /> under the thumbnail: fits the image to the screen</li>
    <slot />
  </HelpSection>
</template>
