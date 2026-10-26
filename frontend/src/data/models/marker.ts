import Color from "color"
import type { Coordinates } from "./coordinates"

export type Marker = {
    id : string,
    pos : Coordinates,
    color : Color
}
