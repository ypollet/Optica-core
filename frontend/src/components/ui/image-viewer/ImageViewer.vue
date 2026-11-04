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

<script setup lang="ts" generic="L extends ViewerLandmark, P extends ViewerPolygon<L> = ViewerPolygon<L>, D extends ViewerDistance<L> = ViewerDistance<L>, B extends ViewerBox<L> = ViewerBox<L>">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, type HTMLAttributes } from 'vue'
import { cn, DOT_RADIUS, ZOOM_MAX, ZOOM_MIN } from '../../../lib/utils'
import { interaction } from '../../../lib/interaction'
import type { Coordinates } from '../../../data/models/coordinates'
import type { ProjectImage, Ratio, Size } from '../../../data/models/image'
import type { Camera } from '../../../data/models/camera'
import type { Pose } from '../../../data/models/landmark'
import { drawDot, drawLine, drawRect, drawRing, drawTarget, fillPolygon, pointInsideCircle } from './drawing'
import type { ViewerBox, ViewerDistance, ViewerDrawContext, ViewerLandmark, ViewerPolygon } from './types'

const props = withDefaults(defineProps<{
  image: ProjectImage
  // size of the full image, all the coordinates are in its pixels
  size: Size
  // view state, owned by the app (usually a store) and updated in place by the viewer
  camera: Camera
  landmarks?: L[]
  distances?: D[]
  polygons?: P[]
  boxes?: B[]
  // distance, polygon or box being drawn (one of the above), at most one at a time:
  // - distance: its last landmark is ringed, dragging the middle of one of its segments inserts a landmark there
  // - polygon: its closing side is dashed, a right click on its first landmark or Enter/Escape finishes it,
  //   dragging the middle of one of its sides inserts a landmark there
  // - box: once its first corner is placed, a dashed rectangle follows the mouse to show the box
  opened?: D | P | B | null
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
  // false: the landmark can be selected but not moved on this image (e.g. Annotations.canMoveTo)
  canDrag?: (landmark: L) => boolean
  // app overlay, drawn on top in the image space
  draw?: (ctx: CanvasRenderingContext2D, view: ViewerDrawContext<L>) => void
  class?: HTMLAttributes['class']
}>(), {
  landmarks: () => [],
  distances: () => [],
  polygons: () => [],
  boxes: () => [],
  opened: null,
  extraLandmarks: () => [],
  editable: true,
  contextMenu: false,
  fitOnImageChange: false,
})

const emit = defineEmits<{
  // right click on the image, outside of any landmark
  place: [pos: Coordinates, event: MouseEvent]
  // right click on a landmark (but the first one of the opened polygon)
  remove: [landmark: L]
  // the opened polygon is done: right click on its first landmark, Enter or Escape
  finish: [polygon: P]
  // end of the drag of the middle of a side of the opened polygon (or a segment of the opened distance):
  // a new landmark at `pos` goes at `index` of its landmarks
  insert: [annotation: P | D, index: number, pos: Coordinates]
  // left click on a landmark
  select: [landmark: L]
  // double click on a landmark, e.g. to go to its image
  activate: [landmark: L]
  // end of the drag of a landmark
  move: [landmark: L, pos: Coordinates]
  // right click on the image when `contextMenu` is set
  contextmenu: [pos: Coordinates, landmark: L | null, event: MouseEvent]
}>()

const imageContainer = useTemplateRef('imageContainer')
const canvas = useTemplateRef('canvas')

// image drawn on the canvas, the thumbnail first then the full image
let baseImage: HTMLImageElement = new Image()
// halved copies of baseImage (level i is 1/2^i of its size), drawn when zoomed out
// so the noise is averaged instead of aliased
let pyramid: CanvasImageSource[] = []
// no more halving below this size, in pixels
const PYRAMID_MIN_SIZE = 512
// incremented on each image change so late loads of a previous image are ignored
let loadToken = 0

let shiftCanvas: Coordinates = { x: 0, y: 0 }
let dragging = false
const landmarkDragged = shallowRef<L | null>(null)
let draggedPos: Coordinates = { x: -1, y: -1 }
// the dragged landmark left its place: a click (or double click) on a landmark doesn't move it
let landmarkMoved = false
// side of the opened polygon or distance split by dragging its middle (the new landmark goes at `index`), drawn at draggedPos
const inserting = shallowRef<{ annotation: P | D, index: number, moved: boolean } | null>(null)
// mouse on the image while a box waits for its second corner (drawn as a target), null when it is out of the image
const hoverPos = shallowRef<Coordinates | null>(null)
// last mouse position on the canvas in client coordinates, null when it is out of it.
// hoverPos is computed from it: the image under the mouse also changes with the zoom
let mouseClient: Coordinates | null = null

// `opened` according to the list it belongs to, null in the others
const openDistance = computed(() => props.distances.find((distance) => distance === props.opened) ?? null)
const openPolygon = computed(() => props.polygons.find((polygon) => polygon === props.opened) ?? null)
const openBox = computed(() => props.boxes.find((box) => box === props.opened) ?? null)

// first corner of the box being created while it waits for the second one, on the shown image only:
// a box lies on a single image
const boxStart = computed(() => {
  const box = openBox.value
  if (!props.editable || box == null || box.show === false || box.landmarks.length != 1 || !onShownImage(box.landmarks[0]!)) {
    return null
  }
  return box.landmarks[0]!
})

// a box starts or ends: its preview starts from where the mouse is now, not from where it was the last time
watch(boxStart, () => {
  update()
})

function loadImage() {
  const token = ++loadToken
  const image = props.image
  const first = new Image()
  first.alt = image.thumbnail ? 'Thumbnail of ' + image.name : image.name
  first.onload = () => {
    if (token != loadToken) {
      return
    }
    setBaseImage(first)
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
            setBaseImage(full)
            update()
          }
        }
        full.src = image.image
      }, 500)
    }
  }
  first.src = image.thumbnail || image.image
}

function setBaseImage(image: HTMLImageElement) {
  baseImage = image
  pyramid = [image]
  let prev: CanvasImageSource = image
  let width = image.naturalWidth
  let height = image.naturalHeight
  while (width > PYRAMID_MIN_SIZE && height > PYRAMID_MIN_SIZE) {
    width = Math.ceil(width / 2)
    height = Math.ceil(height / 2)
    const level = document.createElement('canvas')
    level.width = width
    level.height = height
    const ctx = level.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(prev, 0, 0, width, height)
    pyramid.push(level)
    prev = level
  }
}

loadImage()

watch(() => [props.image.name, props.image.image, props.image.thumbnail], loadImage)
watch(() => [props.landmarks, props.distances, props.polygons, props.boxes, props.opened, props.extraLandmarks],
  () => update(), { deep: true })
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
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeydown)
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

// placed on the shown image (or without a pose)
function onShownImage(landmark: L): boolean {
  const pose = (landmark as { pose?: Pose }).pose
  return pose == undefined || pose.image.name == props.image.name
}

function defaultMarkerStroke(landmark: L): string {
  return onShownImage(landmark) ? 'black' : 'white'
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
  // the smallest level still at least as detailed as the screen, the last downscale stays under 2x
  const level = Math.max(0, Math.min(pyramid.length - 1, Math.floor(Math.log2(1 / Math.max(zoomX, zoomY)))))
  const source = pyramid[level]
  const sourceWidth = level == 0 ? baseImage.naturalWidth : (source as HTMLCanvasElement).width
  const sourceHeight = level == 0 ? baseImage.naturalHeight : (source as HTMLCanvasElement).height
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight,
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

  // sides of the annotations
  const lineWidth = radius / 4
  const dashOf = (dashed: boolean) => dashed ? [10 / zoomX, 5 / zoomX] : []

  // line between two image positions, nothing if one of them isn't on this image
  const drawLink = (from: Coordinates | undefined, to: Coordinates | undefined, color: string, dashed: boolean) => {
    if (from != undefined && to != undefined) {
      drawLine(ctx, toCanvas(from), toCanvas(to), color, lineWidth, dashOf(dashed))
    }
  }

  // line between two landmarks, dashed while one of them is dragged or when asked
  const drawSegment = (previous: L, current: L, color: string, dashed: boolean = false) => {
    const moving = previous === landmarkDragged.value || current === landmarkDragged.value
    drawLink(markerOf(previous), markerOf(current), color, dashed || moving)
  }

  props.distances.forEach((distance) => {
    if (distance.show === false) {
      return
    }
    const color = distance.getColorHEX()
    const split = inserting.value?.annotation === distance ? inserting.value.index : -1
    for (let i = 1; i < distance.landmarks.length; i++) {
      if (i == split) {
        drawLink(markerOf(distance.landmarks[i - 1]), draggedPos, color, true)
        drawLink(draggedPos, markerOf(distance.landmarks[i]), color, true)
      } else {
        drawSegment(distance.landmarks[i - 1], distance.landmarks[i], color)
      }
    }
  })

  // polygons: filled once they have an area, the closing side dashed while being drawn,
  // the side being split goes through the dragged new landmark
  props.polygons.forEach((polygon) => {
    if (polygon.show === false) {
      return
    }
    const color = polygon.getColorHEX()
    const open = polygon === openPolygon.value
    const split = inserting.value?.annotation === polygon ? inserting.value.index : -1
    const markers = polygon.landmarks.map(markerOf)
    if (split != -1) {
      markers.splice(split, 0, draggedPos)
    }
    if (markers.length >= 3 && markers.every((marker) => marker != undefined)) {
      fillPolygon(ctx, markers.map((marker) => toCanvas(marker!)), color)
    }
    const count = polygon.landmarks.length
    const sides = count >= 3 ? count : count - 1
    for (let i = 0; i < sides; i++) {
      const previous = polygon.landmarks[i]
      const current = polygon.landmarks[(i + 1) % count]
      if (i + 1 == split) {
        drawLink(markerOf(previous), draggedPos, color, true)
        drawLink(draggedPos, markerOf(current), color, true)
      } else {
        drawSegment(previous, current, color, open && i == count - 1)
      }
    }
  })

  // boxes, dashed while one of their corners is dragged. The one being created follows the mouse
  props.boxes.forEach((box) => {
    if (box.show === false) {
      return
    }
    const [first, second] = box.landmarks
    const from = first && markerOf(first)
    if (from == undefined) {
      return
    }
    const to = second ? markerOf(second) : (first === boxStart.value ? hoverPos.value : null)
    if (to != undefined) {
      const moving = first === landmarkDragged.value || (second != undefined && second === landmarkDragged.value)
      drawRect(ctx, toCanvas(from), toCanvas(to), box.getColorHEX(), lineWidth, dashOf(moving || second == undefined))
    }
  })

  props.landmarks.forEach((landmark) => drawLandmark(landmark))
  props.distances.forEach((distance) => {
    if (distance.show !== false) {
      distance.landmarks.forEach((landmark) => drawLandmark(landmark))
    }
  })
  props.polygons.forEach((polygon) => {
    if (polygon.show !== false) {
      polygon.landmarks.forEach((landmark) => drawLandmark(landmark))
    }
  })
  props.boxes.forEach((box) => {
    if (box.show !== false) {
      box.landmarks.forEach((landmark) => drawLandmark(landmark))
    }
  })

  // middles of the sides of the polygon or distance being drawn, or the new landmark dragged from one of them
  if (inserting.value) {
    drawTarget(ctx, toCanvas(draggedPos), radius)
  } else {
    midpoints().forEach(({ annotation, pos }) => drawDot(ctx, toCanvas(pos), radius * 0.6, 'white', annotation.getColorHEX()))
  }

  // ring emphasizing a landmark, not while it is dragged
  const ringLandmark = (landmark: L | null | undefined, color: string) => {
    const marker = landmark && markerOf(landmark)
    if (marker != undefined && landmark !== landmarkDragged.value) {
      drawRing(ctx, toCanvas(marker), radius, color)
    }
  }
  // around the landmark a right click on finishes the polygon being drawn
  if (openPolygon.value) {
    ringLandmark(closingLandmark(), openPolygon.value.getColorHEX())
  }
  // around the last landmark of the distance being drawn, the next one is linked to it
  if (openDistance.value && openDistance.value.show !== false) {
    const landmarks = openDistance.value.landmarks
    ringLandmark(landmarks[landmarks.length - 1], openDistance.value.getColorHEX())
  }
  // and around the first corner of the box being created
  if (openBox.value) {
    ringLandmark(boxStart.value, openBox.value.getColorHEX())
  }
  // where the second corner of the box being created goes, the same target as a dragged landmark
  if (boxStart.value && hoverPos.value && landmarkDragged.value == null && inserting.value == null) {
    drawTarget(ctx, toCanvas(hoverPos.value), radius)
  }

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
  updateHover()
  update()
}

// where the second corner of the box being created would go, nothing out of the image where no corner can be placed
function updateHover() {
  const pos = boxStart.value && mouseClient ? getPos(mouseClient) : null
  hoverPos.value = pos && onImage(pos) ? pos : null
}

// middle of each segment of the distance/polygon being drawn,
// `index`: where a landmark dragged from it is inserted. None when their landmarks can't be moved on this image (canDrag)
function midpoints(): { annotation: P | D, index: number, pos: Coordinates }[] {
  if (!props.editable) {
    return []
  }
  const result: { annotation: P | D, index: number, pos: Coordinates }[] = []
  const add = (annotation: P | D | null, closed: boolean) => {
    if (annotation == null || annotation.show === false || annotation.landmarks.length < 2
      || !(props.canDrag?.(annotation.landmarks[0]) ?? true)) {
      return
    }
    const count = annotation.landmarks.length
    const sides = closed && count >= 3 ? count : count - 1
    for (let i = 0; i < sides; i++) {
      const from = markerOf(annotation.landmarks[i])
      const to = markerOf(annotation.landmarks[(i + 1) % count])
      if (from && to) {
        result.push({ annotation, index: i + 1, pos: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } })
      }
    }
  }
  add(openPolygon.value, true)
  add(openDistance.value, false)
  return result
}

// first landmark of the polygon being drawn once it has an area, undefined otherwise
function closingLandmark(): L | undefined {
  const polygon = openPolygon.value
  if (polygon == null || polygon.show === false || polygon.landmarks.length < 3) {
    return undefined
  }
  return polygon.landmarks[0]
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
  props.polygons.forEach((polygon) => {
    if (polygon.show !== false) {
      polygon.landmarks.forEach(check)
    }
  })
  props.boxes.forEach((box) => {
    if (box.show !== false) {
      box.landmarks.forEach(check)
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
          landmarkMoved = false
        }
      } else {
        const midpoint = midpoints().find((midpoint) => pointInsideCircle(pos, midpoint.pos, DOT_RADIUS / props.camera.zoom))
        if (midpoint) {
          inserting.value = { annotation: midpoint.annotation, index: midpoint.index, moved: false }
          draggedPos = midpoint.pos
        }
      }
    }
  } else if (event.button == 2 && props.editable && !props.contextMenu) {
    if (!onImage(pos)) {
      return
    }
    const landmark = hitLandmark(pos)
    if (landmark && landmark === closingLandmark()) {
      emit('finish', openPolygon.value!)
    } else if (landmark) {
      emit('remove', landmark)
    } else {
      emit('place', pos, event)
    }
  }
  update()
}

function mousemove(event: MouseEvent) {
  mouseClient = { x: event.clientX, y: event.clientY }
  // followed while panning too
  updateHover()
  if (dragging) {
    if (landmarkDragged.value == null && inserting.value == null) {
      // no landmark to drag => pan image
      updateOffset(event.movementX, event.movementY)
    } else {
      draggedPos = clampToImage(eventPos(event))
      if (inserting.value) {
        inserting.value.moved = true
      } else {
        landmarkMoved = true
      }
    }
    update()
  } else if (boxStart.value) {
    update()
  }
}

function stopDrag(event: MouseEvent) {
  dragging = false
  if (event.type == 'mouseout') {
    mouseClient = null
    updateHover()
  }
  const landmark = landmarkDragged.value
  if (landmark != null) {
    const pos = clampToImage(eventPos(event))
    interaction.dragged = null
    landmarkDragged.value = null
    draggedPos = { x: -1, y: -1 }
    if (landmarkMoved) {
      emit('move', landmark, pos)
    }
  }
  if (inserting.value != null) {
    // a click without moving inserts at the middle of the side
    const pos = inserting.value.moved ? clampToImage(eventPos(event)) : draggedPos
    emit('insert', inserting.value.annotation, inserting.value.index, pos)
    inserting.value = null
    draggedPos = { x: -1, y: -1 }
  }
  update()
}

function onDoubleClick(event: MouseEvent) {
  const landmark = hitLandmark(eventPos(event))
  if (landmark) {
    emit('activate', landmark)
  }
}

// Enter or Escape finishes the polygon being drawn, unless typing (a label in the sidebar)
function onKeydown(event: KeyboardEvent) {
  if (!props.editable || openPolygon.value == null || event.defaultPrevented || (event.key != 'Enter' && event.key != 'Escape')) {
    return
  }
  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
    return
  }
  emit('finish', openPolygon.value)
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
    <canvas ref="canvas" tabindex="1"
      :class="landmarkDragged || inserting || (boxStart && hoverPos) ? 'cursor-none' : 'cursor-pointer'"
      @mousedown="startDrag" @mouseup="stopDrag" @mousemove="mousemove" @mouseout="stopDrag" @wheel="zoomWithWheel"
      @dblclick="onDoubleClick" @contextmenu="onContextMenu">
    </canvas>
  </div>
</template>
