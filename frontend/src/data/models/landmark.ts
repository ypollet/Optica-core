import Color from "color"
import type { Coordinates, Position } from "./coordinates"
import { imageRef, type ImageRef } from "./image"
import { randomColorRGB, randomID } from "../../lib/utils"
import { isFiniteNumber, isRecord, readColor, readLabel } from "../../lib/saved"

export type Pose = {
    marker: Coordinates
    image: ImageRef
}

export type LandmarkObject = {
    id: string
    label: string
    pose: Pose
    position : Position | null
    color: string
}

export class Landmark {
    id: string
    label: string
    pose: Pose
    position : Position | null
    color: Color
    show: boolean

    // pose.image may be the full image, only its reference is kept
    constructor(id: string, label: string, pose: Pose, position : Position | null, color: Color | null = null) {
        this.id = id
        this.label = label
        this.pose = { marker: pose.marker, image: imageRef(pose.image) }
        this.position = position
        this.color = color || Color.rgb(randomColorRGB())
        this.show = true
    }

    equals(other : Landmark | string | null | undefined){
        if(other == null){
            return false
        }
        if(typeof other === "string"){
            return this.id == other
        }
        return this.id == other.id
    }

    // A saved landmark. Only its pose is needed (throws without it): a new id when it has none, the id as label,
    // a random color, and no position when it has none (null, to be recomputed: Annotations.recomputePositions)
    static fromJSON(landmark : LandmarkObject | Record<string, any>){
        const pose = landmark.pose
        if (!isRecord(pose) || !isRecord(pose.marker) || !isFiniteNumber(pose.marker.x) || !isFiniteNumber(pose.marker.y)
            || !isRecord(pose.image) || typeof pose.image.name != "string") {
            throw new Error("landmark without a pose")
        }
        const id = typeof landmark.id == "string" && landmark.id != "" ? landmark.id : randomID()
        const image = { ...pose.image, label: readLabel(pose.image.label, pose.image.name) } as ImageRef
        return new Landmark(id, readLabel(landmark.label, id), { marker: { x: pose.marker.x, y: pose.marker.y }, image },
            readPosition(landmark.position), readColor(landmark.color))
    }

    toJSON() : LandmarkObject {
        return { id: this.id, label: this.label, pose: this.pose, position : this.position, color: this.color.hex() }
    }

    getColorHEX() : string{
        return this.color.hex()
    }
    setColorHEX(color: string) {
        this.color = Color(color)
    }
    setColorRGB(color: number[]) {
        if (color.length < 3) {
            return
        }
        this.color = Color.rgb(color[0], color[1], color[2])
    }

    setPose(image : ImageRef, pose: Coordinates) {
        this.pose = {
            marker : pose,
            image : imageRef(image)
        }
    }
}

// a saved position: x, y and an optional z (null: unknown), null when it can't be read
function readPosition(value: unknown): Position | null {
    if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
        return null
    }
    if (isFiniteNumber(value.z)) {
        return { x: value.x, y: value.y, z: value.z }
    }
    return value.z === null ? { x: value.x, y: value.y, z: null } : { x: value.x, y: value.y }
}
