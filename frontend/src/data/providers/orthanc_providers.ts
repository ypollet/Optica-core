import axios, { type AxiosResponse } from "axios";
import type { DataProvider } from "./providers";
import type { Coordinates } from "../models/coordinates";
import { segment } from "./routes";

// Orthanc plugins serve the images by instance id under /<plugin>/
export class OrthancProvider implements DataProvider {
    server: string;
    plugin: string;

    constructor(server: string, plugin: string) {
        this.server = server
        this.plugin = plugin
    }

    url(route: string): string {
        return this.server + "/" + this.plugin + "/" + route
    }

    // the instance id is enough to find the image
    imageUrl(objectPath: string, imageName: string, action: string): string {
        return this.url(segment(imageName) + "/" + action)
    }

    async getImages(objectPath: string): Promise<AxiosResponse> {
        return axios.get(this.url(segment(objectPath) + "/images"))
    }

    getFullImage(objectPath: string, imageName : string): string {
        return this.imageUrl(objectPath, imageName, "full-image")
    }

    getThumbnail(objectPath: string, imageName : string): string {
        return this.imageUrl(objectPath, imageName, "thumbnail")
    }

    async computeLandmarkPosition(objectPath: string, imageName : string, marker : Coordinates): Promise<AxiosResponse> {
        return axios.get(this.imageUrl(objectPath, imageName, "position"), {
            params: { x: marker.x, y: marker.y }
        })
    }
}
