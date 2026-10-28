import type { DataProvider } from "../providers/providers";
import type { ProjectImage } from "../models/image";
import { Acquisition, Project, type AcquisitionObject } from "../models/project";
import type { AnnotationsSet } from "../models/annotations";
import { DataRepository } from "./data_repository";

// /images payload -> acquisitions; the default reads { acquisitions: [...] }
export type ProjectParser<TImage extends ProjectImage> = (data: any) => AcquisitionObject<TImage>[]

// builds the acquisitions, apps with their own Acquisition subclass pass one
export type AcquisitionFactory<TImage extends ProjectImage, TAcquisition extends Acquisition<TImage, AnnotationsSet>> =
    (object: AcquisitionObject<TImage>) => TAcquisition

export function parseAcquisitions<TImage extends ProjectImage>(data: any): AcquisitionObject<TImage>[] {
    return data.acquisitions as AcquisitionObject<TImage>[]
}

// Loads /images as a Project, apps whose payload differs pass a parser
export class ProjectRepository<TImage extends ProjectImage = ProjectImage, TAcquisition extends Acquisition<TImage, AnnotationsSet> = Acquisition<TImage>>
    extends DataRepository<Project<TImage, TAcquisition>> {
    parse: ProjectParser<TImage>
    createAcquisition: AcquisitionFactory<TImage, TAcquisition>

    constructor(
        provider: DataProvider,
        parse: ProjectParser<TImage> = parseAcquisitions,
        createAcquisition: AcquisitionFactory<TImage, TAcquisition> = (object) => new Acquisition<TImage>(object) as unknown as TAcquisition,
    ) {
        super(provider)
        this.parse = parse
        this.createAcquisition = createAcquisition
    }

    async getImages(objectPath: string): Promise<Project<TImage, TAcquisition>> {
        const res = await this.provider.getImages(objectPath)
        const acquisitions = this.parse(res.data).map((object) => {
            object.images = this.resolveUrls(objectPath, object.images, object.thumbnails)
            object.standaloneImages = this.resolveUrls(objectPath, object.standaloneImages ?? [], object.thumbnails)
            return this.createAcquisition(object)
        })
        return new Project<TImage, TAcquisition>(objectPath, acquisitions)
    }
}
