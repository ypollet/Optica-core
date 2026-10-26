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

// Physical position returned by the backend, z is only given by 3D-aware apps
export type Position = Coordinates & { z?: number }

export function vectorToString(vector: Position) {
    const values = [vector.x, vector.y, ...(vector.z === undefined ? [] : [vector.z])]
    return `(${values.map((v) => v.toFixed(ROUNDING)).join("; ")})`
}

export function distanceVector(first: Position, second: Position): Position {
    const distance: Position = {
        x: math.abs(second.x - first.x),
        y: math.abs(second.y - first.y),
    }
    if (first.z !== undefined && second.z !== undefined) {
        distance.z = math.abs(second.z - first.z)
    }
    return distance
}
