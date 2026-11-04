import Color from "color"
import { Landmark, type LandmarkObject } from "./landmark"
import type { Coordinates } from "./coordinates"
import { randomColorRGB, type ScaleUnit } from "../../lib/utils"

export type BoundingBoxObject = {
    label: string
    landmarks: Array<LandmarkObject>
    color: string,
}

// the two first landmarks in image units: pixels for the "px" scale, physical otherwise. undefined under two landmarks
function corners(landmarks: Landmark[], scale?: ScaleUnit): [Coordinates, Coordinates] | undefined {
    const [first, second] = landmarks
    if (first == undefined || second == undefined) {
        return undefined
    }
    const point = (landmark: Landmark) => scale == "px" ? landmark.pose.marker : landmark.position
    return [point(first), point(second)]
}

// extent along x and y between the two corners
function extent(landmarks: Landmark[], scale?: ScaleUnit): Coordinates | undefined {
    const [first, second] = corners(landmarks, scale) ?? []
    return first && second && { x: Math.abs(second.x - first.x), y: Math.abs(second.y - first.y) }
}

// Rectangle along the image axes between two opposite corners (any two), measured in the
// image plane: the z of 3D positions is ignored
export class BoundingBox {
    label: string
    // at most two
    landmarks: Array<Landmark>
    color: Color
    show: boolean

    constructor(label: string, landmarks: Array<Landmark> | null = null, color: Color | null = null) {
        this.label = label
        this.landmarks = landmarks || new Array()
        this.show = true
        this.color = color || Color.rgb(randomColorRGB())
    }

    // both corners are placed
    isComplete(): boolean {
        return this.landmarks.length >= 2
    }

    width(scale?: ScaleUnit): number | undefined {
        return extent(this.landmarks, scale)?.x
    }

    height(scale?: ScaleUnit): number | undefined {
        return extent(this.landmarks, scale)?.y
    }

    // middle of the two corners in image units for a scale (see width)
    center(scale?: ScaleUnit): Coordinates | undefined {
        const [first, second] = corners(this.landmarks, scale) ?? []
        return first && second && { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    }

    // in squared image units
    area(scale?: ScaleUnit): number | undefined {
        const size = extent(this.landmarks, scale)
        return size && size.x * size.y
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

    // the values (shown sizes) need the calibration: Annotations.toJSON adds them
    toJSON(): BoundingBoxObject {
        return { label: this.label, color: this.color.hex(), landmarks: this.landmarks.map((x) => x.toJSON()) }
    }

    static fromJSON(jsonObject: BoundingBoxObject) {
        let landmarks = jsonObject.landmarks.map((landmarkObject) => Landmark.fromJSON(landmarkObject))
        return new BoundingBox(jsonObject.label, landmarks, Color(jsonObject.color))
    }
}
