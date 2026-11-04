import Color from "color"
import { Landmark, type LandmarkObject } from "./landmark"
import { is3D, type Position } from "./coordinates"
import { sumOfSegments } from "./distance"
import { randomColorRGB, type ScaleUnit } from "../../lib/utils"

export type PolygonObject = {
    label: string
    landmarks: Array<LandmarkObject>
    color: string,
}

// area enclosed by the points in order: shoelace formula in 2D, Newell's method in 3D
// (the norm of the vector area, exact for a planar polygon). undefined under three points or while a position isn't known
function enclosedArea(known: (Position | null)[]): number | undefined {
    if (known.length < 3 || known.some((point) => point == null)) {
        return undefined
    }
    const points = known as Position[]
    const normal = { x: 0, y: 0, z: 0 }
    points.forEach((current, i) => {
        const next = points[(i + 1) % points.length]!
        const z = (p: Position) => is3D(p) ? p.z : 0
        normal.x += (current.y - next.y) * (z(current) + z(next))
        normal.y += (z(current) - z(next)) * (current.x + next.x)
        normal.z += (current.x - next.x) * (current.y + next.y)
    })
    return Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2) / 2
}

// the landmarks with the first one again at the end, undefined under three landmarks
function closed(landmarks: Landmark[]): Landmark[] | undefined {
    return landmarks.length < 3 ? undefined : [...landmarks, landmarks[0]!]
}

// Always closed: the last landmark is linked back to the first one. Built like a Distance,
// each landmark placed while it is selected adds a side
export class Polygon {
    label: string
    landmarks: Array<Landmark>
    color: Color
    show: boolean

    constructor(label: string, landmarks: Array<Landmark> | null = null, color: Color | null = null) {
        this.label = label
        this.landmarks = landmarks || new Array()
        this.show = true
        this.color = color || Color.rgb(randomColorRGB())
    }

    // perimeter in image units: pixels for the "px" scale, physical otherwise. undefined under three landmarks
    perimeter(scale?: ScaleUnit): number | undefined {
        const loop = closed(this.landmarks)
        if (loop == undefined) {
            return undefined
        }
        return sumOfSegments(loop, scale == "px" ? (landmark) => landmark.pose.marker : (landmark) => landmark.position)
    }

    // area in squared image units: pixels for the "px" scale, physical otherwise. undefined under three landmarks
    area(scale?: ScaleUnit): number | undefined {
        return enclosedArea(this.landmarks.map((landmark) => scale == "px" ? landmark.pose.marker : landmark.position))
    }

    in(landmark: Landmark | string): boolean {
        return this.landmarks.some(e => e.equals(landmark))
    }

    reset(): void {
        this.landmarks = new Array<Landmark>()
    }

    remove(landmark: Landmark | string) {
        this.landmarks = this.landmarks.filter(e => !e.equals(landmark))
    }

    getColorHEX(): string {
        return this.color.hex()
    }
    setColorHEX(color: string) {
        this.color = Color(color)
    }

    // the values (shown perimeter and area) need the calibration: Annotations.toJSON adds them
    toJSON(): PolygonObject {
        return { label: this.label, color: this.color.hex(), landmarks: this.landmarks.map((x) => x.toJSON()) }
    }

    static fromJSON(jsonObject: PolygonObject) {
        let landmarks = jsonObject.landmarks.map((landmarkObject) => Landmark.fromJSON(landmarkObject))
        return new Polygon(jsonObject.label, landmarks, Color(jsonObject.color))
    }
}
