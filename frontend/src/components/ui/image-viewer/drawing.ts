import type { Coordinates } from "../../../data/models/coordinates"
import { degreesToRad, SPACE_TARGET } from "../../../lib/utils"

export function posCircle(center: Coordinates, angle: number, radius: number): Coordinates {
  return {
    x: center.x + radius * Math.cos(degreesToRad(angle)),
    y: center.y + radius * Math.sin(degreesToRad(angle))
  }
}

export function pointInsideCircle(point: Coordinates, center: Coordinates, radius: number): boolean {
  return Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2) < radius
}

// Landmark dot
export function drawDot(ctx: CanvasRenderingContext2D, center: Coordinates, radius: number, fill: string, stroke: string) {
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = radius / 2
  ctx.strokeStyle = stroke
  ctx.stroke()
  ctx.closePath()
}

// Crosshair drawn instead of the dot of the landmark being dragged
export function drawTarget(ctx: CanvasRenderingContext2D, center: Coordinates, radius: number) {
  const targetRadius = radius * 4

  // circle
  ctx.beginPath()
  ctx.arc(center.x, center.y, targetRadius, 0, 2 * Math.PI)
  ctx.strokeStyle = 'white'
  ctx.lineWidth = radius / 2
  ctx.stroke()
  ctx.closePath()

  // white diagonals
  ctx.beginPath()
  for (const angle of [45, 135, 225, 315]) {
    const start = posCircle(center, angle, targetRadius)
    const end = posCircle(center, angle, targetRadius * SPACE_TARGET)
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
  }
  ctx.strokeStyle = 'white'
  ctx.lineWidth = radius / 3
  ctx.stroke()
  ctx.closePath()

  // black horizontal and vertical lines
  ctx.beginPath()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(center.x + dx * targetRadius * (1 - SPACE_TARGET), center.y + dy * targetRadius * (1 - SPACE_TARGET))
    ctx.lineTo(center.x + dx * targetRadius * SPACE_TARGET, center.y + dy * targetRadius * SPACE_TARGET)
  }
  ctx.strokeStyle = 'black'
  ctx.lineWidth = radius / 3
  ctx.stroke()
  ctx.closePath()
}
