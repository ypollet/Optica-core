import type Color from "color"
import { round } from "mathjs"
import { reactive } from "vue"
import { adjustFactorFor, randomID, readScaleUnit, ROUNDING, Scale, type ScaleUnit } from "../../lib/utils"
import { is3D, type Coordinates, type Position } from "./coordinates"
import { Distance, type DistanceObject } from "./distance"
import { Landmark, type LandmarkObject, type Pose } from "./landmark"
import { Polygon, type PolygonObject } from "./polygon"
import { BoundingBox, type BoundingBoxObject } from "./boundingBox"
import type { ImageRef } from "./image"

// Saved form of a distance of the annotations: with its length shown in the scale of the annotations (not read back)
export type DistanceAnnotationObject = DistanceObject & {
    distance: number
}

// Saved form of a polygon of the annotations: with its perimeter and area shown in the scale of the annotations (not read back)
export type PolygonAnnotationObject = PolygonObject & {
    perimeter: number
    area: number
}

// Saved form of a bounding box of the annotations: with its sizes shown in the scale of the annotations (not read back)
export type BoundingBoxAnnotationObject = BoundingBoxObject & {
    width: number
    height: number
    center: Coordinates
    area: number
}

// Unit of the measures of a save, with its size in the unit of the positions (Scale), so a reader doesn't
// need the Scale values: a position in the unit is position × scale_factor / factor (px: the pose markers)
export type SavedScale = {
    unit: ScaleUnit
    factor: number
}

// Saved form of the annotations of an acquisition. merge reads any part of it: only the fields a file has
// (scale_factor: key of the first polar exports; scale: SavedScale, or only its unit or its factor in
// older saves, see readScaleUnit)
export type AnnotationsObject = {
    scale_factor: number
    scale?: SavedScale | ScaleUnit | number
    landmarks: LandmarkObject[]
    distances: DistanceAnnotationObject[]
    // missing from the saves made before the polygons
    polygons?: PolygonAnnotationObject[]
    boxes?: BoundingBoxAnnotationObject[]
}

// Sidebar state of the annotations: kept across reloads, not exported
export type AnnotationsSelection = {
    tab: string
    selectedDistanceIndex: number
    selectedPolygonIndex: number
    selectedBoxIndex: number
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
// Annotations.scaledPositionCSV: the position in the unit of the measures
export const SCALED_POSITION_CSV_HEADER = ["Scaled_X", "Scaled_Y", "Scaled_Z", "Scale"]

export const DEFAULT_CSV_HEADER = [...LANDMARK_CSV_HEADER, ...POSE_CSV_HEADER, ...POSITION_CSV_HEADER, ...SCALED_POSITION_CSV_HEADER]

// a landmark saved with its position in the unit of the measures (ignored when loaded)
export type ScaledLandmarkObject = LandmarkObject & {
    scaled_position: Position | null
}

// one CSV row (DEFAULT_CSV_HEADER), `group`: label of the distance, polygon, box or profile of the landmark
export function landmarkCSVRow(type: string, group: string, landmark: Landmark): string[] {
    const { marker, image } = landmark.pose
    return [type, group, landmark.label, landmark.getColorHEX(), marker.x.toFixed(5).toString(), marker.y.toFixed(5).toString(),
        image.name, image.label, ...positionCSV(landmark.position)]
}

// the columns of POSITION_CSV_HEADER, empty while the position isn't known
export function positionCSV(position: Position | null): string[] {
    if (position == null) {
        return ["", "", ""]
    }
    return [position.x.toFixed(5), position.y.toFixed(5), is3D(position) ? position.z.toFixed(5) : ""]
}

// Landmarks, distances, polygons and bounding boxes of an acquisition: all its images (group and standalone) share
// one coordinate space, so one calibration. Apps with more annotations or rules extend it.
export class Annotations implements AnnotationsSet {
    landmarks: Landmark[] = []
    distances: Distance[] = []
    polygons: Polygon[] = []
    boxes: BoundingBox[] = []
    // calibration of the coordinate space
    adjustFactor: number = 1
    scale: ScaleUnit = "px"
    // sidebar state: shown tab (also what a right click creates) and selected distance, polygon and box (-1: the next one is new)
    tab: string = "landmarks"
    selectedDistanceIndex: number = -1
    selectedPolygonIndex: number = -1
    selectedBoxIndex: number = -1
    // distances and polygons are measured on a single image, the one of their first landmark (boxes always are)
    singleImageMeasures: boolean = false

    get selectedDistance(): Distance | null {
        return this.distances[this.selectedDistanceIndex] ?? null
    }

    // the polygon being drawn: the next landmark adds a side to it
    get selectedPolygon(): Polygon | null {
        return this.polygons[this.selectedPolygonIndex] ?? null
    }

    get selectedBox(): BoundingBox | null {
        return this.boxes[this.selectedBoxIndex] ?? null
    }

    // selected distance, polygon or box of the shown tab: the one being drawn in the viewer
    get opened(): Distance | Polygon | BoundingBox | null {
        switch (this.tab) {
            case "distances": return this.selectedDistance
            case "polygons": return this.selectedPolygon
            case "boxes": return this.selectedBox
            default: return null
        }
    }

    // The distance, polygon or box the next landmark of the shown tab goes to, created if needed:
    // the selected one (a box only while it misses a corner) or a new selected one.
    // null in the landmarks tab or a tab of the app
    target(): Distance | Polygon | BoundingBox | null {
        switch (this.tab) {
            case "distances": return this.selectedDistance ?? this.newDistance()
            case "polygons": return this.selectedPolygon ?? this.newPolygon()
            case "boxes": return this.openBox()
            default: return null
        }
    }

    // Adds the landmark to the distance or polygon, or as a corner of the box (see addCorner)
    add(measure: Distance | Polygon | BoundingBox, landmark: Landmark) {
        if (measure instanceof BoundingBox) {
            this.addCorner(measure, landmark)
        } else {
            measure.landmarks.push(landmark)
        }
    }

    // What makes two images the same one for measures on a single image (default: their name)
    imageKey(image: ImageRef): string | number {
        return image.name
    }

    // image of the first landmark of the distance, polygon or box, null while it has none
    imageOf(measure: Distance | Polygon | BoundingBox): ImageRef | null {
        return measure.landmarks[0]?.pose.image ?? null
    }

    // the distance, polygon or box stays on the image of its first landmark: a box, or any when singleImageMeasures
    onOneImage(measure: Distance | Polygon | BoundingBox): boolean {
        return this.singleImageMeasures || measure instanceof BoundingBox
    }

    // true if a landmark of the distance, polygon or box can be placed on this image (see onOneImage)
    accepts(measure: Distance | Polygon | BoundingBox, image: ImageRef): boolean {
        const own = this.imageOf(measure)
        if (own == null || !this.onOneImage(measure)) {
            return true
        }
        return this.imageKey(own) == this.imageKey(image)
    }

    // true if the landmark can be moved on this image (see accepts)
    canMoveTo(landmark: Landmark, image: ImageRef): boolean {
        const measure = this.distanceOf(landmark) ?? this.polygonOf(landmark) ?? this.boxOf(landmark)
        return measure ? this.accepts(measure, image) : true
    }

    

    // landmarks on their own and the ones of the distances, polygons and boxes: each gets its position
    // by itself from the backend (not extended by subclasses: depth profiles get their ends with the profile)
    get coreLandmarks(): Landmark[] {
        return [
            ...this.landmarks,
            ...this.distances.flatMap((distance) => distance.landmarks),
            ...this.polygons.flatMap((polygon) => polygon.landmarks),
            ...this.boxes.flatMap((box) => box.landmarks),
        ]
    }

    // every landmark: the ones below, and the ones subclasses add (depth profiles)
    get allLandmarks(): Landmark[] {
        return this.coreLandmarks
    }

    generateID(): string {
        const used = new Set(this.allLandmarks.map((landmark) => landmark.id))
        let id: string
        do {
            id = randomID()
        } while (used.has(id))
        return id
    }

    // New landmark at the pose, to be shown at once: its position is null until computePosition (the backend) gives it.
    // Reactive, so the late position updates the views once it is stored
    createLandmark(pose: Pose, computePosition: ((pose: Pose) => Promise<Position>) | null, color?: Color): Landmark {
        const id = this.generateID()
        const landmark = reactive(new Landmark(id, id, pose, null, color)) as Landmark
        computePosition?.(pose).then((position) => {
            landmark.position = position
        })
        return landmark
    }

    // Computes the positions that aren't known (old exports have none, a reload during a computation loses one)
    // with computePosition (the backend). An answer is dropped if the landmark moved meanwhile: the move computes its own
    recomputePositions(computePosition: (pose: Pose) => Promise<Position>) {
        this.coreLandmarks.filter((landmark) => landmark.position == null).forEach((stored) => {
            // through the reactive landmark, so the views update
            const landmark = reactive(stored) as Landmark
            const pose = landmark.pose
            computePosition(pose).then((position) => {
                if (landmark.pose === pose) {
                    landmark.position = position
                }
            }).catch((error) => console.error("Position not computed:", error))
        })
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

    // Adds a polygon and selects it, returns the stored one (see newDistance)
    newPolygon(): Polygon {
        const index = this.polygons.push(new Polygon("Polygon " + (this.polygons.length + 1))) - 1
        this.selectedPolygonIndex = index
        return this.polygons[index]!
    }

    // the selected polygon is done: the next landmark starts a new one
    finishPolygon() {
        this.selectedPolygonIndex = -1
    }

    polygonOf(landmark: Landmark | string): Polygon | undefined {
        return this.polygons.find((polygon) => polygon.in(landmark))
    }

    // The box the next corner goes to: the selected one while it misses a corner, a new selected one otherwise.
    // Returns the stored one (see newDistance)
    openBox(): BoundingBox {
        const selected = this.selectedBox
        if (selected && !selected.isComplete()) {
            return selected
        }
        const index = this.boxes.push(new BoundingBox("Box " + (this.boxes.length + 1))) - 1
        this.selectedBoxIndex = index
        return this.boxes[index]!
    }

    // Adds a corner to the box, ignored if it is on another image than the first one (see accepts).
    // With its two corners the box is done and deselected: the next corner starts a new box
    addCorner(box: BoundingBox, landmark: Landmark) {
        if (box.isComplete() || !this.accepts(box, landmark.pose.image)) {
            return
        }
        box.landmarks.push(landmark)
        if (box.isComplete() && this.boxes.indexOf(box) == this.selectedBoxIndex) {
            this.selectedBoxIndex = -1
        }
    }

    boxOf(landmark: Landmark | string): BoundingBox | undefined {
        return this.boxes.find((box) => box.in(landmark))
    }

    // length of the distance shown in the current scale, corrected by the calibration and rounded (0 while it can't be measured)
    scaled(distance: Distance): number {
        return this.toUnit(distance.length(this.scale))
    }

    // perimeter of the polygon shown in the current scale, corrected by the calibration and rounded (0 under three landmarks)
    scaledPerimeter(polygon: Polygon): number {
        return this.toUnit(polygon.perimeter(this.scale))
    }

    // sizes of the box shown in the current scale (0 under two landmarks)
    scaledWidth(box: BoundingBox): number {
        return this.toUnit(box.width(this.scale))
    }

    scaledHeight(box: BoundingBox): number {
        return this.toUnit(box.height(this.scale))
    }

    // center of the box shown in the current scale ((0, 0) under two landmarks)
    scaledCenter(box: BoundingBox): Coordinates {
        const center = box.center(this.scale)
        return { x: this.toUnit(center?.x), y: this.toUnit(center?.y) }
    }

    // areas of the polygon and box shown in the current scale (0 while they can't be measured)
    scaledArea(polygon: Polygon): number {
        return this.areaToUnit(polygon.area(this.scale))
    }

    scaledBoxArea(box: BoundingBox): number {
        return this.areaToUnit(box.area(this.scale))
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

    // area in squared image units -> in the current scale, rounded (0 while it can't be measured).
    // An area scales with the square of the lengths
    protected areaToUnit(area: number | undefined): number {
        return area == undefined ? 0 : round(area * this.inScale(1) ** 2, ROUNDING)
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
        this.polygons.forEach((polygon) => polygon.remove(id))
        this.boxes.forEach((box) => box.remove(id))
        this.landmarks = this.landmarks.filter((landmark) => !landmark.equals(id))
    }

    // Switch the sidebar to the tab owning the landmark and select its distance, polygon or box
    showInSidebar(landmark: Landmark) {
        if (this.landmarks.some((el) => el.equals(landmark))) {
            this.tab = "landmarks"
            return
        }
        const index = this.distances.findIndex((distance) => distance.in(landmark))
        if (index !== -1) {
            this.tab = "distances"
            this.selectedDistanceIndex = index
            return
        }
        const polygonIndex = this.polygons.findIndex((polygon) => polygon.in(landmark))
        if (polygonIndex !== -1) {
            this.tab = "polygons"
            this.selectedPolygonIndex = polygonIndex
            return
        }
        const boxIndex = this.boxes.findIndex((box) => box.in(landmark))
        if (boxIndex !== -1) {
            this.tab = "boxes"
            this.selectedBoxIndex = boxIndex
        }
    }

    // position of the landmark in the current scale, calibrated, not rounded (px: its marker on its image).
    // null while its position isn't known
    scaledPosition(landmark: Landmark): Position | null {
        if (this.scale == "px") {
            return { ...landmark.pose.marker }
        }
        const position = landmark.position
        if (position == null) {
            return null
        }
        const x = this.inScale(position.x)
        const y = this.inScale(position.y)
        return is3D(position) ? { x, y, z: this.inScale(position.z) } : { x, y }
    }

    // the columns of SCALED_POSITION_CSV_HEADER
    scaledPositionCSV(landmark: Landmark): string[] {
        return [...positionCSV(this.scaledPosition(landmark)), this.scale]
    }

    // the landmark saved with its scaled position
    protected landmarkToJSON(landmark: Landmark): ScaledLandmarkObject {
        return { ...landmark.toJSON(), scaled_position: this.scaledPosition(landmark) }
    }

    toJSON(): AnnotationsObject {
        const landmarks = (measure: { landmarks: Landmark[] }) => measure.landmarks.map((landmark) => this.landmarkToJSON(landmark))
        return {
            scale_factor: this.adjustFactor,
            scale: { unit: this.scale, factor: Scale[this.scale] },
            landmarks: this.landmarks.map((landmark) => this.landmarkToJSON(landmark)),
            distances: this.distances.map((distance) => ({
                ...distance.toJSON(),
                landmarks: landmarks(distance),
                distance: this.scaled(distance),
            })),
            polygons: this.polygons.map((polygon) => ({
                ...polygon.toJSON(),
                landmarks: landmarks(polygon),
                perimeter: this.scaledPerimeter(polygon),
                area: this.scaledArea(polygon),
            })),
            boxes: this.boxes.map((box) => ({
                ...box.toJSON(),
                landmarks: landmarks(box),
                width: this.scaledWidth(box),
                height: this.scaledHeight(box),
                center: this.scaledCenter(box),
                area: this.scaledBoxArea(box),
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
    // Landmarks of old exports have no position: recompute it with the repository (recomputePositions).
    // Only what the file has is read, the rest is kept
    merge(object: Partial<AnnotationsObject>) {
        const used = new Set(this.allLandmarks.map((landmark) => landmark.id))
        const landmarks = (object.landmarks ?? []).map((landmark) => Landmark.fromJSON(landmark))
        const distances = (object.distances ?? []).map((distance) => Distance.fromJSON(distance))
        const polygons = (object.polygons ?? []).map((polygon) => Polygon.fromJSON(polygon))
        const boxes = (object.boxes ?? []).map((box) => BoundingBox.fromJSON(box))
        this.claimIDs([
            ...landmarks,
            ...distances.flatMap((distance) => distance.landmarks),
            ...polygons.flatMap((polygon) => polygon.landmarks),
            ...boxes.flatMap((box) => box.landmarks),
        ], used)
        this.landmarks.push(...landmarks)
        this.distances.push(...distances)
        this.polygons.push(...polygons)
        this.boxes.push(...boxes)
        if (typeof object.scale_factor === "number") {
            this.adjustFactor = object.scale_factor
        }
        const unit = readScaleUnit(object.scale)
        if (unit) {
            this.scale = unit
        }
    }

    // Replaces these annotations by saved ones (persistence)
    restore(object: Partial<AnnotationsObject>) {
        this.landmarks = []
        this.distances = []
        this.polygons = []
        this.boxes = []
        this.selectedDistanceIndex = -1
        this.selectedPolygonIndex = -1
        this.selectedBoxIndex = -1
        this.merge(object)
    }

    // subclasses with more sidebar state (depth profiles) extend both
    getSelection(): AnnotationsSelection {
        return {
            tab: this.tab,
            selectedDistanceIndex: this.selectedDistanceIndex,
            selectedPolygonIndex: this.selectedPolygonIndex,
            selectedBoxIndex: this.selectedBoxIndex,
        }
    }

    setSelection(selection: Partial<AnnotationsSelection>) {
        if (typeof selection.tab === "string") {
            this.tab = selection.tab
        }
        const index = selection.selectedDistanceIndex
        if (typeof index === "number" && index >= -1 && index < this.distances.length) {
            this.selectedDistanceIndex = index
        }
        const polygonIndex = selection.selectedPolygonIndex
        if (typeof polygonIndex === "number" && polygonIndex >= -1 && polygonIndex < this.polygons.length) {
            this.selectedPolygonIndex = polygonIndex
        }
        const boxIndex = selection.selectedBoxIndex
        if (typeof boxIndex === "number" && boxIndex >= -1 && boxIndex < this.boxes.length) {
            this.selectedBoxIndex = boxIndex
        }
    }

    csvHeader(): string[] {
        return DEFAULT_CSV_HEADER
    }

    // one row per landmark, the ones of a distance, polygon or box carry its label (no header)
    toCSVRows(): string[][] {
        const row = (type: string, group: string, landmark: Landmark) => [...landmarkCSVRow(type, group, landmark), ...this.scaledPositionCSV(landmark)]
        return [
            ...this.landmarks.map((landmark) => row("Landmark", "", landmark)),
            ...this.distances.flatMap((distance) => distance.landmarks.map((landmark) => row("Distance", distance.label, landmark))),
            ...this.polygons.flatMap((polygon) => polygon.landmarks.map((landmark) => row("Polygon", polygon.label, landmark))),
            ...this.boxes.flatMap((box) => box.landmarks.map((landmark) => row("Box", box.label, landmark))),
        ]
    }
}
