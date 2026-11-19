import Color from "color"
import { Landmark, type LandmarkObject } from "./landmark"
import { readColor, readLabel, readList } from "../../lib/saved"
import { distanceVector, fillUnknownZ, fillUnknownZOnPlane, type Position } from "./coordinates"
import { computeDistance, randomColorRGB, type ScaleUnit } from "../../lib/utils"

export type DistanceObject = {
    label: string
    landmarks: Array<LandmarkObject>
    color: string,
}

// sum of the segments between consecutive landmarks, `point`: where a landmark is, back to the first one when
// `closed` (a polygon). Unknown z are filled along the path (fillUnknownZ), or on the plane of the polygon
// (fillUnknownZOnPlane) when closed. undefined under two landmarks or while a position isn't known
export function sumOfSegments(landmarks: Landmark[], point: (landmark: Landmark) => Position | null, closed = false) : number | undefined {
    const known = landmarks.map(point)
    if(known.length < 2 || known.some((point) => point == null)){
        return undefined
    }
    const points = closed ? fillUnknownZOnPlane(known as Position[]) : fillUnknownZ(known as Position[])
    if (closed) {
        points.push(points[0]!)
    }
    return computeDistance(points.slice(1).map((current, i) => distanceVector(points[i]!, current)))
}

export class Distance {
    label : string
    landmarks : Array<Landmark>
    color: Color
    show : boolean

    constructor(label: string, landmarks : Array<Landmark> | null = null, color: Color | null = null){
        this.label = label
        this.landmarks = landmarks || new Array()
        this.show = true
        this.color = color || Color.rgb(randomColorRGB())
    }

    // physical length: sum of the segments between consecutive landmarks, undefined under two landmarks
    get distance() : number | undefined {
        return sumOfSegments(this.landmarks, (landmark) => landmark.position)
    }

    // pixel length: sum of the segments between consecutive markers, undefined under two landmarks
    get distancePx() : number | undefined {
        return sumOfSegments(this.landmarks, (landmark) => landmark.pose.marker)
    }

    // length in image units: pixel length for the "px" scale, physical length otherwise
    length(scale?: ScaleUnit) : number | undefined {
        return scale == "px" ? this.distancePx : this.distance
    }

    in(landmark : Landmark | string) : boolean{
        return this.landmarks.some(e => e.equals(landmark))
    }

    reset() : void {
        this.landmarks = new Array<Landmark>()
    }

    remove(landmark : Landmark | string){
        this.landmarks = this.landmarks.filter(e => !e.equals(landmark))
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

    // the value (shown length) needs the calibration: Annotations.toJSON adds it
    toJSON() : DistanceObject {
        return { label: this.label, color: this.color.hex(), landmarks : this.landmarks.map((x) => x.toJSON())}
    }

    // a saved distance: its landmarks that can be read, a random color when it has none
    static fromJSON(jsonObject: DistanceObject | Record<string, any>) {
        const landmarks = readList(jsonObject.landmarks, Landmark.fromJSON, "landmark")
        return new Distance(readLabel(jsonObject.label), landmarks, readColor(jsonObject.color))
    }
}
