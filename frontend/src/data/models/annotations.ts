import { round } from "mathjs"
import { adjustFactorFor, isScaleUnit, randomID, ROUNDING, Scale, type ScaleUnit } from "../../lib/utils"
import { is3D } from "./coordinates"
import { Distance, type DistanceObject } from "./distance"
import { Landmark, type LandmarkObject } from "./landmark"

// Saved form of a distance of the annotations: with its length shown in the scale of the annotations (not read back)
export type DistanceAnnotationObject = DistanceObject & {
    distance: number
}

// Saved form of the annotations of an acquisition (scale_factor: key of the first polar exports)
export type AnnotationsObject = {
    scale_factor: number
    scale?: ScaleUnit
    landmarks: LandmarkObject[]
    distances: DistanceAnnotationObject[]
}

// Sidebar state of the annotations: kept across reloads, not exported
export type AnnotationsSelection = {
    tab: string
    selectedDistanceIndex: number
}

// What a Project needs from the annotations of an acquisition (export, import, persistence):
// the core Annotations, or an app's own set when its landmarks differ (sphaer: one pose per view)
export interface AnnotationsSet {
    // saved form, also what merge and restore read back
    toJSON(): object
    // adds saved annotations (import)
    merge(object: any): void
    // replaces these annotations by saved ones (persistence)
    restore(object: any): void
    // sidebar state, kept across reloads but not exported
    getSelection(): object
    setSelection(selection: any): void
    // the header of toCSVRows
    csvHeader(): string[]
    toCSVRows(): string[][]
}

export const LANDMARK_CSV_HEADER =["Group", "Group Label", "Landmark Label", "Color"]
export const POSE_CSV_HEADER = ["Pose_X", "Pose_Y", "Image", "ImageLabel"]
export const POSITION_CSV_HEADER = ["X", "Y", "Z"]

export const DEFAULT_CSV_HEADER = [...LANDMARK_CSV_HEADER, ...POSE_CSV_HEADER, ...POSITION_CSV_HEADER]

// one CSV row (DEFAULT_CSV_HEADER), `group`: label of the distance or profile of the landmark
export function landmarkCSVRow(type: string, group: string, landmark: Landmark): string[] {
    const { marker, image } = landmark.pose
    const position = landmark.position
    return [type, group, landmark.label, landmark.getColorHEX(), marker.x.toFixed(5).toString(), marker.y.toFixed(5).toString(),
        image.name, image.label, position.x.toFixed(5).toString(), position.y.toFixed(5).toString(), is3D(position) ? position.z.toFixed(5).toString() : ""]
}

// Landmarks and distances of an acquisition: all its images (group and standalone) share
// one coordinate space, so one calibration. Apps with more annotations or rules extend it.
export class Annotations implements AnnotationsSet {
    landmarks: Landmark[] = []
    distances: Distance[] = []
    // calibration of the coordinate space
    adjustFactor: number = 1
    scale: ScaleUnit = "px"
    // sidebar state: shown tab (also what a right click creates) and selected distance (-1: the next one is new)
    tab: string = "landmarks"
    selectedDistanceIndex: number = -1

    get selectedDistance(): Distance | null {
        return this.distances[this.selectedDistanceIndex] ?? null
    }

    // landmarks on their own and the ones of the distances
    get allLandmarks(): Landmark[] {
        return [...this.landmarks, ...this.distances.flatMap((distance) => distance.landmarks)]
    }

    generateID(): string {
        const used = new Set(this.allLandmarks.map((landmark) => landmark.id))
        let id: string
        do {
            id = randomID()
        } while (used.has(id))
        return id
    }

    distanceOf(landmark: Landmark | string): Distance | undefined {
        return this.distances.find((distance) => distance.in(landmark))
    }

    // Adds a distance and selects it. Returns the stored one: called through a store it is
    // its reactive copy, so landmarks added to it reach the components.
    newDistance(): Distance {
        const index = this.distances.push(new Distance("Distance " + (this.distances.length + 1))) - 1
        this.selectedDistanceIndex = index
        return this.distances[index]!
    }

    // length of the distance shown in the current scale, corrected by the calibration and rounded (0 while it can't be measured)
    scaled(distance: Distance): number {
        return this.toUnit(distance.length(this.scale))
    }

    // length in image units -> in the current scale, corrected by the calibration.
    // Pixels for the "px" scale: the calibration is made on physical lengths, it doesn't apply to them
    protected inScale(length: number): number {
        return this.scale == "px" ? length : length * this.adjustFactor / Scale[this.scale]
    }

    // inScale rounded for display (0 while it can't be measured)
    protected toUnit(length: number | undefined): number {
        return length == undefined ? 0 : round(this.inScale(length), ROUNDING)
    }

    // typing a known length on a distance calibrates the coordinate space (not in pixels, see inScale)
    calibrate(distance: Distance, target: number) {
        const value = distance.length(this.scale)
        if (this.scale != "px" && value && target > 0) {
            this.adjustFactor = adjustFactorFor(value, target, this.scale)
        }
    }

    removeLandmark(id: string) {
        this.distances.forEach((distance) => distance.remove(id))
        this.landmarks = this.landmarks.filter((landmark) => !landmark.equals(id))
    }

    // Switch the sidebar to the tab owning the landmark and select its distance
    showInSidebar(landmark: Landmark) {
        if (this.landmarks.some((el) => el.equals(landmark))) {
            this.tab = "landmarks"
            return
        }
        const index = this.distances.findIndex((distance) => distance.in(landmark))
        if (index !== -1) {
            this.tab = "distances"
            this.selectedDistanceIndex = index
        }
    }

    toJSON(): AnnotationsObject {
        return {
            scale_factor: this.adjustFactor,
            scale: this.scale,
            landmarks: this.landmarks.map((landmark) => landmark.toJSON()),
            distances: this.distances.map((distance) => ({
                ...distance.toJSON(),
                distance: this.scaled(distance),
            })),
        }
    }

    // Gives a new id to the landmarks whose id is in `used` (importing a file twice), then marks them used.
    // Subclasses call it for their own landmarks (depth profiles) with the same set.
    protected claimIDs(landmarks: Landmark[], used: Set<string>) {
        landmarks.forEach((landmark) => {
            while (used.has(landmark.id)) {
                landmark.id = randomID()
            }
            used.add(landmark.id)
        })
    }

    // Adds saved annotations to these ones (import).
    // Landmarks of old exports have no position: recompute it with the repository.
    merge(object: Partial<AnnotationsObject>) {
        const used = new Set(this.allLandmarks.map((landmark) => landmark.id))
        const landmarks = (object.landmarks ?? []).map((landmark) => Landmark.fromJSON(landmark))
        const distances = (object.distances ?? []).map((distance) => Distance.fromJSON(distance))
        this.claimIDs([...landmarks, ...distances.flatMap((distance) => distance.landmarks)], used)
        this.landmarks.push(...landmarks)
        this.distances.push(...distances)
        if (typeof object.scale_factor === "number") {
            this.adjustFactor = object.scale_factor
        }
        if (isScaleUnit(object.scale)) {
            this.scale = object.scale
        }
    }

    // Replaces these annotations by saved ones (persistence)
    restore(object: Partial<AnnotationsObject>) {
        this.landmarks = []
        this.distances = []
        this.selectedDistanceIndex = -1
        this.merge(object)
    }

    // subclasses with more sidebar state (depth profiles) extend both
    getSelection(): AnnotationsSelection {
        return { tab: this.tab, selectedDistanceIndex: this.selectedDistanceIndex }
    }

    setSelection(selection: Partial<AnnotationsSelection>) {
        if (typeof selection.tab === "string") {
            this.tab = selection.tab
        }
        const index = selection.selectedDistanceIndex
        if (typeof index === "number" && index >= -1 && index < this.distances.length) {
            this.selectedDistanceIndex = index
        }
    }

    csvHeader(): string[] {
        return DEFAULT_CSV_HEADER
    }

    // one row per landmark, the ones of a distance carry its label (no header)
    toCSVRows(): string[][] {
        return [
            ...this.landmarks.map((landmark) => landmarkCSVRow("Landmark", "", landmark)),
            ...this.distances.flatMap((distance) => distance.landmarks.map((landmark) => landmarkCSVRow("Distance", distance.label, landmark))),
        ]
    }
}
