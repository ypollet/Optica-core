import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as math from 'mathjs'
import type { Coordinates } from '../data/models/coordinates'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function degreesToRad(deg: number) {
  return (deg * math.pi) / 180.0
}

export function radToDegrees(rad: number) {
  return (rad * 180.0) / math.pi
}

// Sum of the euclidean norms of each interval (works for 2D and 3D intervals)
export function computeDistance(intervals: Coordinates[]): number {
  let dist = 0
  intervals.forEach((interval: Coordinates) => {
    const squared = math.map(Object.values(interval), math.square)
    const sum = math.sum(squared)
    // can't be a Complex number
    dist += math.sqrt(sum) as number
  })
  return dist
}

export function randomColorRGB(): [number, number, number] {
  return [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]
}

// short random base-36 id (landmarks)
export function randomID(): string {
  return (Math.random() + 1).toString(36).substring(7)
}

export enum Scale {
  px = 1,
  m = 1000,
  dm = 100,
  cm = 10,
  mm = 1,
  µm = 0.001,
  nm = 0.000001,
}

// Name of a unit ("px", "mm"...), what is stored and selected: the values can't be used
// to find the unit back, px and mm are both 1
export type ScaleUnit = keyof typeof Scale

export const SCALE_UNITS = Object.keys(Scale).filter((key) => isNaN(Number(key))) as ScaleUnit[]

// for values read from a file or the storage
export function isScaleUnit(value: unknown): value is ScaleUnit {
  return typeof value === "string" && (SCALE_UNITS as string[]).includes(value)
}

export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4
export const DOT_RADIUS = 4.5
export const SPACE_TARGET = 0.2
export const ROUNDING = 2

// length in image units -> length shown in `scale`, corrected by the calibration factor
export function toScale(length: number, adjustFactor: number): number {
  return length * adjustFactor
}

// calibration factor so that `length` is shown as `target` in `scale`
export function adjustFactorFor(length: number, target: number, scale: ScaleUnit): number {
  return target / length * Scale[scale]
}
