import type { Coordinates } from "../../../data/models/coordinates"
import { computeDistance, type ScaleUnit } from "../../../lib/utils"

// Measure of the core Distance: physical length, pixel length for the "px" scale
export function defaultMeasure(distance: unknown, scale: ScaleUnit): number | undefined {
  const d = distance as { distance?: Coordinates[], distancePx?: Coordinates[] }
  const intervals = scale == "px" ? d.distancePx : d.distance
  return Array.isArray(intervals) ? computeDistance(intervals) : undefined
}
