import * as math from "mathjs"
import { ROUNDING } from "../../lib/utils"

export type Coordinates = {
    x: number,
    y: number
}

export type Coords3D = {
    x: number,
    y: number,
    z: number
}

// 3D position whose z is unknown (depth: a pixel outside the mask)
export type UnknownZ = {
    x: number,
    y: number,
    z: null
}

// Physical position returned by the backend: 2D (polar, spectral) or 3D (stack, depth).
// What is known to be 3D is typed Coords3D (the 3D repositories), the shared models keep a Position
export type Position = Coordinates | Coords3D | UnknownZ

export function is3D(position: Position): position is Coords3D {
    return "z" in position && typeof position.z === "number"
}

export function hasUnknownZ(position: Position): position is UnknownZ {
    return "z" in position && position.z == null
}

// "…" while the position isn't known (waiting for the backend), and for an unknown z
export function vectorToString(vector: Position | null) {
    if (vector == null) {
        return "…"
    }
    const values = [vector.x, vector.y].map((v) => v.toFixed(ROUNDING))
    if (is3D(vector)) {
        values.push(vector.z.toFixed(ROUNDING))
    } else if (hasUnknownZ(vector)) {
        values.push("…")
    }
    return `(${values.join("; ")})`
}

// The points of a path with their unknown z (depth: outside the mask) filled so they add no height change of
// their own: linear between the nearest known z before and after, by the length along the path in the image
// plane (around the path when `closed`); the nearest known z at an end of an open path, whose last segment is
// then flat. Without any known z, the points are 2D.
export function fillUnknownZ(points: Position[], closed = false): Position[] {
    if (!points.some(hasUnknownZ)) {
        return points
    }
    if (!points.some(is3D)) {
        return points.map(({ x, y }) => ({ x, y }))
    }
    const n = points.length
    // length in the image plane from point i to point i + 1
    const step = (i: number) => Math.hypot(points[(i + 1) % n]!.x - points[i]!.x, points[(i + 1) % n]!.y - points[i]!.y)
    // nearest known z from point i, going `direction` (-1 / +1), with the length to it
    const nearest = (i: number, direction: -1 | 1) => {
        let length = 0
        for (let k = 1; k < n; k++) {
            const j = i + direction * k
            if (!closed && (j < 0 || j >= n)) {
                return undefined
            }
            const index = (j + n) % n
            length += step(direction == 1 ? (index - 1 + n) % n : index)
            const point = points[index]!
            if (is3D(point)) {
                return { z: point.z, length }
            }
        }
        return undefined
    }
    return points.map((point, i) => {
        if (!hasUnknownZ(point)) {
            return point
        }
        const before = nearest(i, -1)
        const after = nearest(i, 1)
        let z: number
        if (before && after) {
            const total = before.length + after.length
            z = total == 0 ? (before.z + after.z) / 2 : before.z + (after.z - before.z) * before.length / total
        } else {
            z = (before ?? after)!.z
        }
        return { x: point.x, y: point.y, z }
    })
}

// The corners of a polygon with their unknown z filled on the plane fitted (least squares) through the known
// ones, so a planar polygon keeps its area and perimeter. Under three known corners, or when they are on a
// line of the image plane, filled around the polygon like a closed path (fillUnknownZ).
export function fillUnknownZOnPlane(points: Position[]): Position[] {
    if (!points.some(hasUnknownZ)) {
        return points
    }
    const known = points.filter(is3D)
    const plane = known.length >= 3 ? fitPlane(known) : undefined
    if (plane == undefined) {
        return fillUnknownZ(points, true)
    }
    return points.map((point) => hasUnknownZ(point)
        ? { x: point.x, y: point.y, z: plane.a * point.x + plane.b * point.y + plane.c }
        : point)
}

// z = a x + b y + c through the points (least squares), undefined when they are on a line of the image plane
function fitPlane(points: Coords3D[]): { a: number, b: number, c: number } | undefined {
    // centered, so the system is better conditioned
    const mean = (f: (p: Coords3D) => number) => points.reduce((sum, p) => sum + f(p), 0) / points.length
    const mx = mean((p) => p.x), my = mean((p) => p.y), mz = mean((p) => p.z)
    let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0
    for (const p of points) {
        const x = p.x - mx, y = p.y - my, z = p.z - mz
        sxx += x * x; sxy += x * y; syy += y * y; sxz += x * z; syz += y * z
    }
    const det = sxx * syy - sxy * sxy
    if (Math.abs(det) <= 1e-12 * Math.max(sxx * syy, Number.MIN_VALUE)) {
        return undefined
    }
    const a = (sxz * syy - syz * sxy) / det
    const b = (syz * sxx - sxz * sxy) / det
    return { a, b, c: mz - a * mx - b * my }
}

// 3D only if both are, z unknown if one of them has an unknown z
export function distanceVector(first: Position, second: Position): Position {
    const x = math.abs(second.x - first.x)
    const y = math.abs(second.y - first.y)
    if (is3D(first) && is3D(second)) {
        return { x, y, z: math.abs(second.z - first.z) }
    }
    if (hasUnknownZ(first) || hasUnknownZ(second)) {
        return { x, y, z: null }
    }
    return { x, y }
}
