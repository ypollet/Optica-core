import Color from "color"
import { Landmark, type LandmarkObject } from "./landmark"
import { distanceVector, type Position } from "./coordinates"
import { computeDistance, randomColorRGB, type ScaleUnit } from "../../lib/utils"

export type DistanceObject = {
    label: string
    landmarks: Array<LandmarkObject>
    color: string,
}

// sum of the segments between consecutive landmarks, `point`: where a landmark is. undefined under two landmarks
function sumOfSegments(landmarks: Landmark[], point: (landmark: Landmark) => Position) : number | undefined {
    if(landmarks.length < 2 ){
        return undefined
    }
    return computeDistance(landmarks.slice(1).map((landmark, i) => distanceVector(point(landmarks[i]!), point(landmark))))
}

export class Distance {
    label : string
    landmarks : Array<Landmark>
    color: Color
    edit_label: boolean
    edit_distance: boolean
    show : boolean

    constructor(label: string, landmarks : Array<Landmark> | null = null, color: Color | null = null){
        this.label = label
        this.landmarks = landmarks || new Array()
        this.edit_label = false
        this.edit_distance = false
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

    static fromJSON(jsonObject : DistanceObject) {
        let landmarks = jsonObject.landmarks.map((landmarkObject) => Landmark.fromJSON(landmarkObject))
        return new Distance(jsonObject.label, landmarks, Color(jsonObject.color))
    }
}
