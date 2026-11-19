import type { Project } from "../data/models/project"
import { Scale, readScaleUnit, type ScaleUnit } from "./utils"
import { readRecord } from "./saved"

// Envelope of the exported annotations (JSON), see core/MANIFEST.md for the same idea on the data side
export const ANNOTATIONS_FORMAT = "optica-annotations"
export const ANNOTATIONS_VERSION = 1

export type AnnotationsFile = {
    format: typeof ANNOTATIONS_FORMAT
    version: number
    // the viewer that wrote it (depthoptica...), absent from what the session storage keeps
    viewer?: string
    // the object the annotations are on
    object?: string
    // the annotations of each acquisition (AnnotationsSet.toJSON), by acquisition id
    acquisitions: Record<string, object>
}

export function isAnnotationsFile(object: unknown): object is AnnotationsFile {
    return typeof object == "object" && object != null && (object as { format?: unknown }).format == ANNOTATIONS_FORMAT
}

// The file of the annotations of every acquisition of the project
export function annotationsFile(project: Project<any, any>, viewer?: string): AnnotationsFile {
    return {
        format: ANNOTATIONS_FORMAT,
        version: ANNOTATIONS_VERSION,
        ...(viewer ? { viewer } : {}),
        object: project.objectPath,
        acquisitions: project.annotationsToJSON(),
    }
}

export type ReadOptions = {
    // refuses the file of another viewer
    viewer?: string
    // where the annotations of the exports made before the acquisitions go (the selected one)
    acquisition?: string
    // the sizes of the units of the viewer (Scale, sphaeroptica: its own in meters), for the old scales saved as a factor
    scales?: Record<ScaleUnit, number>
}

// The annotations by acquisition id of a file: the current format, or an export made before it (upgraded
// once here, the annotations themselves only read the current format)
export function readAnnotationsFile(object: unknown, { viewer, acquisition, scales = Scale }: ReadOptions = {}): Record<string, object> {
    if (typeof object != "object" || object == null || Array.isArray(object)) {
        throw new Error("Not an annotations file")
    }
    if (isAnnotationsFile(object)) {
        if (viewer && object.viewer && object.viewer != viewer) {
            throw new Error(`Annotations of ${object.viewer}, not of ${viewer}`)
        }
        // a newer version is read for what this one knows: its new sections are ignored
        if (typeof object.version == "number" && object.version > ANNOTATIONS_VERSION) {
            console.warn(`Annotations of version ${object.version}, read as version ${ANNOTATIONS_VERSION}: what this viewer doesn't know is ignored`)
        }
        return readRecord(object.acquisitions, "acquisitions") as Record<string, object>
    }
    return upgradeAnnotations(object as Record<string, unknown>, acquisition, scales)
}

// ---------------------------------------------------------------- exports made before the format

// one set of annotations of an old export: scale_factor, and the scale as a unit, a factor or { unit, factor }
function upgradeSet(old: Record<string, unknown>, scales: Record<ScaleUnit, number>): object {
    const { scale_factor, scale, ...rest } = old
    const set: Record<string, unknown> = { ...rest }
    if (typeof scale_factor == "number") {
        set.scaleFactor = scale_factor
    }
    const unit = readScaleUnit(scale, scales)
    if (unit) {
        set.scale = { unit, factor: scales[unit] }
    }
    return set
}

// a single set (exported before the acquisitions, told by its "landmarks" or "distances") goes to `acquisition`,
// else the sets by acquisition id
function upgradeAnnotations(old: Record<string, unknown>, acquisition: string | undefined, scales: Record<ScaleUnit, number>): Record<string, object> {
    if ("landmarks" in old || "distances" in old) {
        return acquisition == undefined ? {} : { [acquisition]: upgradeSet(old, scales) }
    }
    return Object.fromEntries(Object.entries(old)
        .filter(([, set]) => typeof set == "object" && set != null)
        .map(([id, set]) => [id, upgradeSet(set as Record<string, unknown>, scales)]))
}
