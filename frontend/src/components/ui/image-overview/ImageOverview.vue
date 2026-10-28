<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PhArrowsOut } from "@phosphor-icons/vue"
import { cn } from "../../../lib/utils"
import { fitCamera, type Camera } from "../../../data/models/camera"
import type { ProjectImage, Size } from "../../../data/models/image"
import { Button } from "../button"
import { Label } from "../label"
import { ThumbnailViewer } from "../thumbnail-viewer"

// Top of the sidebars: the thumbnail of the shown image with the visible part of the viewer,
// and under it its label, its position in the group and the fit to screen button
const props = defineProps<{
  image: ProjectImage
  // size of the full image, the zoom rect of the camera is in its pixels
  size: Size
  // camera of the ImageViewer: the thumbnail shows its zoom rect, the button refits it
  camera: Camera
  // position of the image in its group (stack: "3/12"), hidden without it
  counter?: string
  class?: HTMLAttributes["class"]
  thumbnailClass?: HTMLAttributes["class"]
}>()

const slots = defineSlots<{
  // shown left of the thumbnail, which then takes half of the width (polar: the circular slider)
  aside?(): any
}>()
</script>

<template>
  <div :class="cn('flex justify-center', props.class)">
    <div class="flex flex-col gap-2" :class="slots.aside ? 'w-[350px] max-w-full' : 'w-4/5'">
      <div class="flex items-center">
        <div v-if="slots.aside" class="w-1/2">
          <slot name="aside" />
        </div>
        <ThumbnailViewer :class="cn(slots.aside ? 'w-1/2 shrink' : 'w-full', props.thumbnailClass)"
          :src="image.thumbnail || image.image" :alt="image.label" :size="size" :zoom-rect="camera.zoomRect" />
      </div>
      <div class="flex items-center gap-2">
        <Label class="min-w-0 truncate" :title="image.label">{{ image.label }}</Label>
        <Label v-if="counter" class="ml-auto flex-none tabular-nums text-muted-foreground">{{ counter }}</Label>
        <Button variant="ghost" size="icon-sm" class="flex-none" :class="{ 'ml-auto': !counter }" title="Fit to screen"
          aria-label="Fit to screen" @click="fitCamera(camera)">
          <PhArrowsOut />
        </Button>
      </div>
    </div>
  </div>
</template>
