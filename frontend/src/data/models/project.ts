import { ANNOTATIONS_CSV_HEADER, Annotations, type AnnotationsObject } from "./annotations"
import { createCamera, type Camera } from "./camera"
import type { ProjectImage, Size } from "./image"

// One acquisition as sent by the backend
export type AcquisitionObject<TImage extends ProjectImage> = {
    id: string
    label?: string
    // images taken together, in order: the stack, the rotation, the spectral images, the sphere of views
    images: TImage[]
    // images on their own: the stacked results, the depth maps...
    standaloneImages?: TImage[]
    size: Size
    thumbnails: boolean
}

// Images taken together, with the viewer state and the annotations of the acquisition
export class Acquisition<TImage extends ProjectImage> {
    id: string
    label: string
    images: TImage[]
    standaloneImages: TImage[]
    size: Size
    thumbnails: boolean
    camera: Camera
    // shared by the images of the group and the standalone ones
    annotations: Annotations
    // position in images
    index: number
    // name of the shown standalone image, null when an image of the group is shown
    standalone: string | null

    constructor(object: AcquisitionObject<TImage>) {
        this.id = object.id
        this.label = object.label ?? object.id
        this.images = object.images
        this.standaloneImages = object.standaloneImages ?? []
        this.size = object.size
        this.thumbnails = object.thumbnails
        this.camera = createCamera()
        this.annotations = this.createAnnotations()
        this.index = 0
        // nothing to show in the group: start on the first standalone image
        this.standalone = (this.images.length == 0) ? (this.standaloneImages[0]?.name ?? null) : null
    }

    // apps with their own Annotations subclass override it (and `declare` the annotations type)
    protected createAnnotations(): Annotations {
        return new Annotations()
    }

    get hasGroup(): boolean {
        return this.images.length > 0
    }

    get isEmpty(): boolean {
        return this.images.length == 0 && this.standaloneImages.length == 0
    }

    get allImages(): TImage[] {
        return [...this.images, ...this.standaloneImages]
    }

    get selectedImage(): TImage | undefined {
        if (this.standalone != null) {
            return this.getStandalone(this.standalone)
        }
        return this.images[this.index]
    }

    // size of an image, its own one if it has it
    sizeOf(image: TImage | undefined = this.selectedImage): Size {
        return image?.size ?? this.size
    }

    getImage(name: string): TImage | undefined {
        return this.images.find((image) => image.name == name) ?? this.getStandalone(name)
    }

    getStandalone(name: string): TImage | undefined {
        return this.standaloneImages.find((image) => image.name == name)
    }

    // show an image of the group, clamped to the group
    setIndex(index: number) {
        if (!this.hasGroup) {
            return
        }
        this.standalone = null
        this.index = Math.min(Math.max(0, index), this.images.length - 1)
    }

    moveIndex(move: number) {
        this.setIndex(this.index + move)
    }

    // show a standalone image, null goes back to the group
    selectStandalone(name: string | null) {
        if (name == null) {
            this.standalone = this.hasGroup ? null : this.standalone
        } else if (this.getStandalone(name)) {
            this.standalone = name
        }
    }

    // show an image of the group or a standalone one by its name
    select(name: string) {
        const index = this.images.findIndex((image) => image.name == name)
        if (index >= 0) {
            this.setIndex(index)
        } else {
            this.selectStandalone(name)
        }
    }

    toJSON(): AcquisitionObject<TImage> {
        return {
            id: this.id,
            label: this.label,
            images: this.images,
            standaloneImages: this.standaloneImages,
            size: this.size,
            thumbnails: this.thumbnails,
        }
    }
}

// An object and its acquisitions
export class Project<TImage extends ProjectImage = ProjectImage, TAcquisition extends Acquisition<TImage> = Acquisition<TImage>> {
    objectPath: string
    acquisitions: TAcquisition[]
    // position in acquisitions
    selectedIndex: number

    constructor(objectPath: string, acquisitions: TAcquisition[]) {
        this.objectPath = objectPath
        this.acquisitions = acquisitions
        this.selectedIndex = 0
    }

    get acquisition(): TAcquisition | undefined {
        return this.acquisitions[this.selectedIndex]
    }

    // shortcut to the image shown in the selected acquisition
    get selectedImage(): TImage | undefined {
        return this.acquisition?.selectedImage
    }

    getAcquisition(id: string): TAcquisition | undefined {
        return this.acquisitions.find((acquisition) => acquisition.id == id)
    }

    selectAcquisition(id: string) {
        const index = this.acquisitions.findIndex((acquisition) => acquisition.id == id)
        if (index >= 0) {
            this.selectedIndex = index
        }
    }

    // acquisition holding an image, images are named uniquely in a project
    acquisitionOf(name: string): TAcquisition | undefined {
        return this.acquisitions.find((acquisition) => acquisition.getImage(name) != undefined)
    }

    get allImages(): TImage[] {
        return this.acquisitions.flatMap((acquisition) => acquisition.allImages)
    }

    // annotations of every acquisition, by acquisition id (export and persistence)
    annotationsToJSON(): Record<string, AnnotationsObject> {
        return Object.fromEntries(this.acquisitions.map((acquisition) => [acquisition.id, acquisition.annotations.toJSON()]))
    }

    // Reads annotationsToJSON(), or the annotations of a single acquisition (exports made before
    // the acquisitions) which go to the selected one. replace: restore instead of adding.
    importAnnotations(object: Record<string, Partial<AnnotationsObject>> | Partial<AnnotationsObject>, replace: boolean = false) {
        const apply = (acquisition: TAcquisition | undefined, annotations: Partial<AnnotationsObject>) => {
            if (replace) {
                acquisition?.annotations.restore(annotations)
            } else {
                acquisition?.annotations.merge(annotations)
            }
        }
        if ("landmarks" in object || "distances" in object) {
            apply(this.acquisition, object as Partial<AnnotationsObject>)
            return
        }
        Object.entries(object as Record<string, Partial<AnnotationsObject>>).forEach(([id, annotations]) => {
            apply(this.getAcquisition(id), annotations)
        })
    }

    // one row per landmark of every acquisition, with a header
    annotationsToCSVRows(): string[][] {
        return [
            ["Acquisition", ...ANNOTATIONS_CSV_HEADER],
            ...this.acquisitions.flatMap((acquisition) => acquisition.annotations.toCSVRows().map((row) => [acquisition.id, ...row])),
        ]
    }

    toJSON() {
        return { objectPath: this.objectPath, acquisitions: this.acquisitions.map((acquisition) => acquisition.toJSON()) }
    }
}
