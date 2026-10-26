import type { Repository } from "./repository";
import type { DataProvider } from "../providers/providers";
import type { Position } from "../models/coordinates";
import type { ImageName, ProjectImage } from "../models/image";
import type { Pose } from "../models/landmark";

// Common part of every app repository, apps only have to parse their /images payload
export abstract class DataRepository<TData> implements Repository<TData> {
    provider: DataProvider;

    constructor(provider: DataProvider) {
        this.provider = provider
    }

    abstract getImages(objectPath: string): Promise<TData>

    computeLandmarkPosition(objectPath: string, pose: Pose) : Promise<Position> {
        return this.provider.computeLandmarkPosition(objectPath, pose.image.name, pose.marker).then((res) => {
            return res.data as Position
        })
    }

    getFullImage(objectPath: string, imageName: string): string {
        return this.provider.getFullImage(objectPath, imageName)
    }

    getThumbnail(objectPath: string, imageName: string): string {
        return this.provider.getThumbnail(objectPath, imageName)
    }

    // Fill the image and thumbnail urls of images sent by /images
    protected resolveUrls<T extends ImageName>(objectPath: string, images: T[], thumbnails: boolean): (T & ProjectImage)[] {
        return images.map((image) => Object.assign(image, {
            image: this.getFullImage(objectPath, image.name),
            thumbnail: thumbnails ? this.getThumbnail(objectPath, image.name) : undefined,
        }))
    }
}
