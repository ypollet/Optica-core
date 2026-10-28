import Color from "color"
import { Landmark, type LandmarkObject } from "./landmark"
import { distanceVector, type Coordinates, type Position } from "./coordinates"
import { computeDistance, randomColorRGB, type ScaleUnit } from "../../lib/utils"

export type DistanceObject = {
    label: string
    landmarks: Array<LandmarkObject>
    color: string,
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

    // Physical vector between each consecutive pair of landmarks
    get distance() : Position[] | undefined{
        if(this.landmarks.length < 2 ){
            return undefined
        }
        let distance : Position[] = new Array()
        for(let i = 1; i < this.landmarks.length; i++){
            distance.push(distanceVector(this.landmarks[i-1].position, this.landmarks[i].position))
        }
        return distance
    }

    // Pixel vector between each consecutive pair of landmarks
    get distancePx() : Coordinates[] | undefined{
        if(this.landmarks.length < 2 ){
            return undefined
        }
        let distance : Coordinates[] = new Array()
        for(let i = 1; i < this.landmarks.length; i++){
            distance.push(distanceVector(this.landmarks[i-1].pose.marker, this.landmarks[i].pose.marker))
        }
        return distance
    }

    // length in image units: pixel length for the "px" scale, physical length otherwise.
    // undefined while it can't be measured
    length(scale?: ScaleUnit) : number | undefined {
        const intervals = scale == "px" ? this.distancePx : this.distance
        return intervals === undefined ? undefined : computeDistance(intervals)
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
