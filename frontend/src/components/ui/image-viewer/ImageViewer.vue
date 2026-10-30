<!--
Optica - Shared canvas viewer of the Optica apps
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

<script setup lang="ts" generic="L extends ViewerLandmark">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, type HTMLAttributes } from 'vue'
import { cn, DOT_RADIUS, ZOOM_MAX, ZOOM_MIN } from '../../../lib/utils'
import { interaction } from '../../../lib/interaction'
import type { Coordinates } from '../../../data/models/coordinates'
import type { ProjectImage, Ratio, Size } from '../../../data/models/image'
import type { Camera } from '../../../data/models/camera'
import type { Pose } from '../../../data/models/landmark'
import { drawDot, drawTarget, pointInsideCircle } from './drawing'
import type { ViewerDistance, ViewerDrawContext, ViewerLandmark } from './types'

const props = withDefaults(defineProps<{
  image: ProjectImage
  // size of the full image, all the coordinates are in its pixels
  size: Size
  // view state, owned by the app (usually a store) and updated in place by the viewer
  camera: Camera
  landmarks?: L[]
  distances?: ViewerDistance<L>[]
  // landmarks that can be dragged but are drawn by the `draw` hook
  extraLandmarks?: L[]
  // false: the viewer only pans and zooms
  editable?: boolean
  // true: right click emits `contextmenu` and lets the event reach a wrapping ContextMenuTrigger
  contextMenu?: boolean
  // refit the image each time a new image is shown
  fitOnImageChange?: boolean
  // where the landmark is on the shown image, undefined if it isn't (default: pose.marker)
  markerPosition?: (landmark: L) => Coordinates | undefined
  // outline of a landmark dot (default: black on its own image, white elsewhere)
  markerStroke?: (landmark: L) => string
  // false: the landmark can be selected but not moved on this image
  canDrag?: (landmark: L) => boolean
  // app overlay, drawn on top in the image space
  draw?: (ctx: CanvasRenderingContext2D, view: ViewerDrawContext<L>) => void
  class?: HTMLAttributes['class']
}>(), {
  landmarks: () => [],
  distances: () => [],
  extraLandmarks: () => [],
  editable: true,
  contextMenu: false,
  fitOnImageChange: false,
})

const emit = defineEmits<{
  // right click on the image, outside of any landmark
  place: [pos: Coordinates, event: MouseEvent]
  // right click on a landmark
  remove: [landmark: L]
  // left click on a landmark
  select: [landmark: L]
  // end of the drag of a landmark
  move: [landmark: L, pos: Coordinates]
  // right click on the image when `contextMenu` is set
  contextmenu: [pos: Coordinates, landmark: L | null, event: MouseEvent]
}>()

const imageContainer = useTemplateRef('imageContainer')
const canvas = useTemplateRef('canvas')

// image drawn on the canvas, the thumbnail first then the full image
let baseImage: HTMLImageElement = new Image()
// incremented on each image change so late loads of a previous image are ignored
let loadToken = 0

let shiftCanvas: Coordinates = { x: 0, y: 0 }
let dragging = false
const landmarkDragged = shallowRef<L | null>(null)
let draggedPos: Coordinates = { x: -1, y: -1 }

function loadImage() {
  const token = ++loadToken
  const image = props.image
  const first = new Image()
  first.alt = image.thumbnail ? 'Thumbnail of ' + image.name : image.name
  first.onload = () => {
    if (token != loadToken) {
      return
    }
    baseImage = first
    if (props.camera.zoom <= 0 || props.fitOnImageChange) {
      screenFit()
    }
    update()
    if (image.thumbnail && image.thumbnail != image.image) {
      // load the full image once the user stays on this one
      setTimeout(() => {
        if (token != loadToken) {
          return
        }
        const full = new Image()
        full.alt = image.name
        full.onload = () => {
          if (token == loadToken) {
            baseImage = full
            update()
          }
        }
        full.src = image.image
      }, 500)
    }
  }
  first.src = image.thumbnail || image.image
}

loadImage()

watch(() => [props.image.name, props.image.image, props.image.thumbnail], loadImage)
watch(() => [props.landmarks, props.distances, props.extraLandmarks], () => update(), { deep: true })
watch(() => [props.size.width, props.size.height, props.camera.zoom], () => update())
// a landmark pressed in a list is drawn bigger
watch(() => interaction.pressed, () => update())

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (imageContainer.value && canvas.value) {
      canvas.value.width = Math.floor(imageContainer.value.clientWidth)
      canvas.value.height = Math.floor(imageContainer.value.clientHeight)
      update()
    }
  })
  if (imageContainer.value) {
    resizeObserver.observe(imageContainer.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (landmarkDragged.value) {
    interaction.dragged = null
  }
  loadToken++
})

function imageReady(): boolean {
  return baseImage.complete && baseImage.naturalWidth > 0
}

function getRatio(): Ratio {
  if (imageReady()) {
    return {
      width: baseImage.naturalWidth / props.size.width,
      height: baseImage.naturalHeight / props.size.height
    }
  }
  return { width: 0, height: 0 }
}

// zoom showing the whole image
function fitZoom(): number {
  if (!imageContainer.value) {
    return 1
  }
  return Math.min(imageContainer.value.clientWidth / props.size.width, imageContainer.value.clientHeight / props.size.height)
}

function screenFit() {
  if (imageContainer.value && canvas.value) {
    canvas.value.width = Math.floor(imageContainer.value.clientWidth)
    canvas.value.height = Math.floor(imageContainer.value.clientHeight)
    props.camera.zoom = fitZoom()
    props.camera.offset = { x: 0, y: 0 }
  }
}

function defaultMarkerPosition(landmark: L): Coordinates | undefined {
  return (landmark as { pose?: Pose }).pose?.marker
}

function defaultMarkerStroke(landmark: L): string {
  const pose = (landmark as { pose?: Pose }).pose
  return (pose == undefined || pose.image.name == props.image.name) ? 'black' : 'white'
}

function markerOf(landmark: L): Coordinates | undefined {
  if (landmark === landmarkDragged.value) {
    return draggedPos
  }
  return (props.markerPosition ?? defaultMarkerPosition)(landmark)
}

function update() {
  const c = canvas.value
  if (!c || !imageReady()) {
    return
  }
  // clear canvas
  c.width = c.width

  if (props.camera.zoom <= 0) {
    screenFit()
  }

  // check offset values
  updateOffset(0, 0)

  drawImage(c)

  // visible part of the image, for the thumbnail viewer
  const rect = c.getBoundingClientRect()
  const topLeft = getPos({ x: rect.left, y: rect.top })
  const zoom = props.camera.zoom
  const shift = {
    x: Math.max(0, (c.width - props.size.width * zoom)) / zoom,
    y: Math.max(0, (c.height - props.size.height * zoom)) / zoom
  }
  props.camera.zoomRect = {
    top: Math.max(0, topLeft.y),
    left: Math.max(0, topLeft.x),
    width: c.width / zoom - shift.x,
    height: c.height / zoom - shift.y,
  }
}

function drawImage(c: HTMLCanvasElement) {
  if (props.camera.zoom <= 0) {
    return
  }
  const ratio = getRatio()
  const ctx = c.getContext('2d')!

  const zoomX = props.camera.zoom / ratio.width
  const zoomY = props.camera.zoom / ratio.height
  const radius = DOT_RADIUS / zoomX

  ctx.scale(zoomX, zoomY)
  ctx.translate(props.camera.offset.x * ratio.width, props.camera.offset.y * ratio.height)

  // center the image when it is smaller than the canvas
  shiftCanvas = {
    x: Math.max(0, (c.width - baseImage.naturalWidth * zoomX) / 2) / zoomX,
    y: Math.max(0, (c.height - baseImage.naturalHeight * zoomY) / 2) / zoomY
  }
  ctx.drawImage(baseImage, 0, 0, baseImage.naturalWidth, baseImage.naturalHeight,
    shiftCanvas.x, shiftCanvas.y, baseImage.naturalWidth, baseImage.naturalHeight)

  const toCanvas = (pos: Coordinates): Coordinates => ({
    x: pos.x * ratio.width + shiftCanvas.x,
    y: pos.y * ratio.height + shiftCanvas.y
  })

  const drawLandmark = (landmark: L, dotRadius: number = radius) => {
    if (landmark.show === false) {
      return
    }
    const marker = markerOf(landmark)
    if (marker == undefined) {
      return
    }
    if (landmark === landmarkDragged.value) {
      drawTarget(ctx, toCanvas(marker), dotRadius)
    } else {
      const stroke = (props.markerStroke ?? defaultMarkerStroke)(landmark)
      drawDot(ctx, toCanvas(marker), interaction.pressed == landmark.id ? dotRadius * 2 : dotRadius, landmark.getColorHEX(), stroke)
    }
  }

  // lines of the distances, dashed while one of their ends is dragged
  props.distances.forEach((distance) => {
    if (distance.show === false) {
      return
    }
    for (let i = 1; i < distance.landmarks.length; i++) {
      const previous = distance.landmarks[i - 1]
      const current = distance.landmarks[i]
      const from = markerOf(previous)
      const to = markerOf(current)
      if (from == undefined || to == undefined) {
        continue
      }
      const start = toCanvas(from)
      const end = toCanvas(to)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      const moving = previous === landmarkDragged.value || current === landmarkDragged.value
      ctx.setLineDash(moving ? [10 / zoomX, 5 / zoomX] : [])
      ctx.strokeStyle = distance.getColorHEX()
      ctx.lineWidth = radius / 4
      ctx.stroke()
      ctx.closePath()
    }
    ctx.setLineDash([])
  })

  props.landmarks.forEach((landmark) => drawLandmark(landmark))
  props.distances.forEach((distance) => {
    if (distance.show !== false) {
      distance.landmarks.forEach((landmark) => drawLandmark(landmark))
    }
  })

  props.draw?.(ctx, {
    radius,
    zoom: { x: zoomX, y: zoomY },
    toCanvas,
    markerOf,
    isDragged: (landmark: L) => landmark === landmarkDragged.value,
    drawLandmark,
  })
}

// client coordinates -> image pixels
function getPos(pos: Coordinates): Coordinates {
  const ratio = getRatio()
  const rect = canvas.value!.getBoundingClientRect()
  return {
    x: ((pos.x - rect.left) / props.camera.zoom) - props.camera.offset.x - (shiftCanvas.x / ratio.width),
    y: ((pos.y - rect.top) / props.camera.zoom) - props.camera.offset.y - (shiftCanvas.y / ratio.height)
  }
}

function eventPos(event: MouseEvent): Coordinates {
  return getPos({ x: event.clientX, y: event.clientY })
}

function clampToImage(pos: Coordinates): Coordinates {
  return {
    x: Math.max(0, Math.min(props.size.width, pos.x)),
    y: Math.max(0, Math.min(props.size.height, pos.y))
  }
}

function onImage(pos: Coordinates): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x <= props.size.width && pos.y <= props.size.height
}

function updateOffset(movementX: number, movementY: number) {
  if (canvas.value) {
    const camera = props.camera
    camera.offset.x = camera.offset.x + movementX / camera.zoom
    camera.offset.y = camera.offset.y + movementY / camera.zoom

    // keep the image in the canvas
    camera.offset.x = Math.min(0, Math.max(-((props.size.width * camera.zoom) - canvas.value.width) / camera.zoom, camera.offset.x))
    camera.offset.y = Math.min(0, Math.max(-((props.size.height * camera.zoom) - canvas.value.height) / camera.zoom, camera.offset.y))
  }
}

function updateZoom(zoomDelta: number) {
  const zoom = +(props.camera.zoom * (1 + zoomDelta / 20)).toFixed(5)
  props.camera.zoom = Math.max(ZOOM_MIN * fitZoom(), Math.min(ZOOM_MAX, zoom))
}

function zoomWithWheel(event: WheelEvent) {
  const oldZoom = props.camera.zoom
  updateZoom(Math.sign(-event.deltaY))
  const deltaZoom = props.camera.zoom / oldZoom

  // zoom around the mouse
  const rect = canvas.value!.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const deltaOffsetX = -((rect.width * deltaZoom) - rect.width) * (mouseX / rect.width)
  const deltaOffsetY = -((rect.height * deltaZoom) - rect.height) * (mouseY / rect.height)

  updateOffset(deltaOffsetX, deltaOffsetY)
  update()
}

// last landmark under pos, extra landmarks included
function hitLandmark(pos: Coordinates): L | null {
  let hit: L | null = null
  const check = (landmark: L) => {
    if (landmark.show === false) {
      return
    }
    const marker = markerOf(landmark)
    if (marker && pointInsideCircle(pos, marker, DOT_RADIUS / props.camera.zoom)) {
      hit = landmark
    }
  }
  props.landmarks.forEach(check)
  props.distances.forEach((distance) => {
    if (distance.show !== false) {
      distance.landmarks.forEach(check)
    }
  })
  props.extraLandmarks.forEach(check)
  return hit
}

function startDrag(event: MouseEvent) {
  const pos = eventPos(event)
  if (event.button == 0) {
    dragging = true
    if (props.editable) {
      const landmark = hitLandmark(pos)
      if (landmark) {
        emit('select', landmark)
        if (props.canDrag?.(landmark) ?? true) {
          interaction.dragged = landmark.id
          draggedPos = markerOf(landmark) ?? pos
          landmarkDragged.value = landmark
        }
      }
    }
  } else if (event.button == 2 && props.editable && !props.contextMenu) {
    if (!onImage(pos)) {
      return
    }
    const landmark = hitLandmark(pos)
    if (landmark) {
      emit('remove', landmark)
    } else {
      emit('place', pos, event)
    }
  }
  update()
}

function mousemove(event: MouseEvent) {
  if (dragging) {
    if (landmarkDragged.value == null) {
      // no landmark to drag => pan image
      updateOffset(event.movementX, event.movementY)
    } else {
      draggedPos = clampToImage(eventPos(event))
    }
    update()
  }
}

function stopDrag(event: MouseEvent) {
  dragging = false
  const landmark = landmarkDragged.value
  if (landmark != null) {
    const pos = clampToImage(eventPos(event))
    interaction.dragged = null
    landmarkDragged.value = null
    draggedPos = { x: -1, y: -1 }
    emit('move', landmark, pos)
  }
  update()
}

function onContextMenu(event: MouseEvent) {
  if (!props.contextMenu) {
    event.preventDefault()
    return
  }
  const pos = eventPos(event)
  if (!onImage(pos)) {
    // no menu outside of the image
    event.preventDefault()
    return
  }
  emit('contextmenu', pos, hitLandmark(pos), event)
}

defineExpose({ update, screenFit, getPos })
</script>

<template>
  <div ref="imageContainer"
    :class="cn('relative border w-full h-full flex justify-center items-center overflow-visible', props.class)"
    @wheel.prevent>
    <canvas ref="canvas" tabindex="1" :class="landmarkDragged ? 'cursor-none' : 'cursor-pointer'"
      @mousedown="startDrag" @mouseup="stopDrag" @mousemove="mousemove" @mouseout="stopDrag" @wheel="zoomWithWheel"
      @contextmenu="onContextMenu">
    </canvas>
  </div>
</template>
