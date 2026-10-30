import type { Position } from "../models/coordinates";
import type { Pose } from "../models/landmark";

// TPosition: Coords3D for the apps whose backend gives 3D positions (stack, depth)
export interface Repository<TData = unknown, TPosition extends Position = Position> {
    getImages : (objectPath:string) => Promise<TData>;
    getFullImage : (objectPath:string, imageName : string) => string;
    getThumbnail : (objectPath:string, imageName : string) => string;
    computeLandmarkPosition : (objectPath:string, pose : Pose) => Promise<TPosition>;
}
