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

// Physical position returned by the backend: 2D (polar, spectral) or 3D (stack, depth).
// What is known to be 3D is typed Coords3D (the 3D repositories), the shared models keep a Position
export type Position = Coordinates | Coords3D

export function is3D(position: Position): position is Coords3D {
    return "z" in position && typeof position.z === "number"
}

export function vectorToString(vector: Position) {
    const values = is3D(vector) ? [vector.x, vector.y, vector.z] : [vector.x, vector.y]
    return `(${values.map((v) => v.toFixed(ROUNDING)).join("; ")})`
}

// 3D only if both are
export function distanceVector(first: Position, second: Position): Position {
    const x = math.abs(second.x - first.x)
    const y = math.abs(second.y - first.y)
    if (is3D(first) && is3D(second)) {
        return { x, y, z: math.abs(second.z - first.z) }
    }
    return { x, y }
}
