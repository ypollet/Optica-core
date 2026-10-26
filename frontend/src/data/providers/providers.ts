import type { AxiosResponse } from "axios";
import type { Coordinates } from "../models/coordinates";

export interface DataProvider {
        getImages: (objectPath: string) => Promise<AxiosResponse>;
        getFullImage : (objectPath:string, imageName : string) => string;
        getThumbnail : (objectPath:string, imageName : string) => string;
        computeLandmarkPosition : (objectPath:string, imageName : string, marker : Coordinates) => Promise<AxiosResponse>;
        // absolute url of a route about one image, for the app routes (depth: "profile")
        imageUrl : (objectPath: string, imageName: string, action: string) => string;
}
