import { isScaleUnit, type ScaleUnit } from "../../lib/utils"
import { Distance, type DistanceObject } from "./distance"
import { Landmark, type LandmarkObject } from "./landmark"

// Saved form of the annotations of an acquisition (scale_factor: key of the first polar exports)
export type AnnotationsObject = {
    scale_factor: number
    scale?: ScaleUnit
    landmarks: LandmarkObject[]
    distances: DistanceObject[]
}

// Sidebar state of the annotations: kept across reloads, not exported
export type AnnotationsSelection = {
    tab: string
    selectedDistanceIndex: number
}

export const ANNOTATIONS_CSV_HEADER = ["Group", "Group Label", "LandmarkLabel", "Color", "Pose_X", "Pose_Y", "Image", "ImageLabel", "X", "Y", "Z"]

// one CSV row (ANNOTATIONS_CSV_HEADER), `group`: label of the distance or profile of the landmark
export function landmarkCSVRow(type: string, group: string, landmark: Landmark): string[] {
    const { marker, image } = landmark.pose
    const position = landmark.position
    return [type, group, landmark.label, landmark.getColorHEX(), marker.x.toString(), marker.y.toString(),
        image.name, image.label, position.x.toString(), position.y.toString(), position.z?.toString() ?? ""]
}

// Landmarks and distances of an acquisition: all its images (group and standalone) share
// one coordinate space, so one calibration. Apps with more annotations or rules extend it.
export class Annotations {
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
            id = (Math.random() + 1).toString(36).substring(2)
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
            distances: this.distances.map((distance) => distance.toJSON()),
        }
    }

    // Gives a new id to the landmarks whose id is in `used` (importing a file twice), then marks them used.
    // Subclasses call it for their own landmarks (depth profiles) with the same set.
    protected claimIDs(landmarks: Landmark[], used: Set<string>) {
        landmarks.forEach((landmark) => {
            while (used.has(landmark.id)) {
                landmark.id = (Math.random() + 1).toString(36).substring(2)
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

    // one row per landmark, the ones of a distance carry its label (no header)
    toCSVRows(): string[][] {
        console.log("toCSVRows", this.landmarks, this.distances)
        return [
            ...this.landmarks.map((landmark) => landmarkCSVRow("Landmark", "", landmark)),
            ...this.distances.flatMap((distance) => distance.landmarks.map((landmark) => landmarkCSVRow("Distance", distance.label, landmark))),
        ]
    }
}
