<!--
Optica - Shared thumbnail viewer of the Optica apps
Copyright (C) 2024-2026 Yann Pollet, Royal Belgian Institute of Natural Sciences

This program is free software: you can redistribute it and/or
modify it under the terms of the GNU General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.


This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, type HTMLAttributes } from 'vue'
import { round } from 'mathjs'
import { cn } from '../../../lib/utils'
import type { Coordinates } from '../../../data/models/coordinates'
import type { Size } from '../../../data/models/image'
import type { ZoomRect } from '../../../data/models/camera'

const props = defineProps<{
  src: string
  alt?: string
  // size of the full image, zoomRect is in its pixels
  size: Size
  // visible part of the image in the ImageViewer (camera.zoomRect)
  zoomRect: ZoomRect
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  // mouse drag on the thumbnail, as a fraction of its size (sphaer turns it into a rotation)
  drag: [movement: Coordinates]
}>()

const imageContainer = useTemplateRef('imageContainer')
const container = ref<Size>({ width: 0, height: 0 })
const loaded = ref<boolean>(false)
let pressed = false

function measure() {
  if (imageContainer.value) {
    container.value = { width: imageContainer.value.clientWidth, height: imageContainer.value.clientHeight }
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(measure)
  if (imageContainer.value) {
    resizeObserver.observe(imageContainer.value)
  }
  measure()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// the image is contained in the box, find where it is drawn
const scaledZoomRect = computed<ZoomRect>(() => {
  const scale = Math.min(container.value.width / props.size.width, container.value.height / props.size.height)
  const left = (container.value.width - props.size.width * scale) / 2
  const top = (container.value.height - props.size.height * scale) / 2
  return {
    top: top + props.zoomRect.top * scale,
    left: left + props.zoomRect.left * scale,
    width: props.zoomRect.width * scale,
    height: props.zoomRect.height * scale
  }
})

const isZoomedIn = computed<boolean>(() => {
  return loaded.value && (round(props.zoomRect.width, 3) != round(props.size.width, 3) || round(props.zoomRect.height, 3) != round(props.size.height, 3))
})

function onLoad() {
  loaded.value = true
  measure()
}

function mouseDown(event: MouseEvent) {
  event.preventDefault()
  pressed = true
}

function mouseMove(event: MouseEvent) {
  event.preventDefault()
  if (pressed && container.value.width > 0 && container.value.height > 0) {
    emit('drag', { x: event.movementX / container.value.width, y: event.movementY / container.value.height })
  }
}

function mouseUp(event: MouseEvent) {
  event.preventDefault()
  pressed = false
}
</script>

<template>
  <div ref="imageContainer" :class="cn('w-full h-auto border flex justify-center items-center relative', props.class)"
    @mousedown="mouseDown" @mouseup="mouseUp" @mousemove="mouseMove" @mouseleave="mouseUp">
    <div class="absolute bottom-0 left-0 w-full h-full">
      <svg v-if="isZoomedIn" class="w-full h-full">
        <rect class="zoom-box" :x="scaledZoomRect.left" :y="scaledZoomRect.top" :width="scaledZoomRect.width"
          :height="scaledZoomRect.height" />
      </svg>
    </div>
    <img class="object-fit" :src="props.src" :alt="props.alt" aspect-ratio="auto" draggable="false" @load="onLoad">
  </div>
</template>

<style scoped>
.object-fit {
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  display: block;
}

.zoom-box {
  fill: transparent;
  stroke: red;
  stroke-width: 3;
}
</style>
