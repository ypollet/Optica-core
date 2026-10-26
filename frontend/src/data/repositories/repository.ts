import type { Position } from "../models/coordinates";
import type { Pose } from "../models/landmark";

export interface Repository<TData = unknown> {
    getImages : (objectPath:string) => Promise<TData>;
    getFullImage : (objectPath:string, imageName : string) => string;
    getThumbnail : (objectPath:string, imageName : string) => string;
    computeLandmarkPosition : (objectPath:string, pose : Pose) => Promise<Position>;
}
