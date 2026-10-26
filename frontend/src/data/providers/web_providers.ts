import axios, { type AxiosResponse } from "axios";
import type { DataProvider } from "./providers";
import type { Coordinates } from "../models/coordinates";
import { routes } from "./routes";

export class WebProvider implements DataProvider {
    server: string;

    constructor(server: string) {
        this.server = server
    }

    // Absolute url of a backend route, apps use it for their own routes
    url(route: string): string {
        return this.server + "/" + route
    }

    imageUrl(objectPath: string, imageName: string, action: string): string {
        return this.url(routes.image(objectPath, imageName, action))
    }

    async getImages(objectPath: string): Promise<AxiosResponse> {
        return axios.get(this.url(routes.images(objectPath)))
    }

    getFullImage(objectPath: string, imageName : string): string {
        return this.url(routes.fullImage(objectPath, imageName))
    }

    getThumbnail(objectPath: string, imageName : string): string {
        return this.url(routes.thumbnail(objectPath, imageName))
    }

    async computeLandmarkPosition(objectPath: string, imageName : string, marker : Coordinates): Promise<AxiosResponse> {
        return axios.get(this.url(routes.position(objectPath, imageName)), {
            params: { x: marker.x, y: marker.y }
        })
    }
}
