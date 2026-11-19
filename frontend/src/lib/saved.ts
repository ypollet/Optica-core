import Color from "color"
import { randomColorRGB } from "./utils"

// Readers of saved annotations (imported files, session storage) that never fail on a part they can't read:
// a section that is missing, null or of another type is empty, an item that can't be read is skipped,
// and what a reader doesn't know (a section added by a newer version) is ignored.

// the items of a saved list: [] for anything but an array; an item that can't be read is skipped with a warning
export function readList<T>(value: unknown, read: (item: any) => T, what: string): T[] {
    if (!Array.isArray(value)) {
        if (value != null) {
            console.warn(`Saved ${what} ignored: not a list`, value)
        }
        return []
    }
    return value.flatMap((item) => {
        const result = readItem(item, read, what)
        return result === undefined ? [] : [result]
    })
}

// the entries of a saved record (an object by key): {} for anything else
export function readRecord(value: unknown, what: string): Record<string, unknown> {
    if (isRecord(value)) {
        return value
    }
    if (value != null) {
        console.warn(`Saved ${what} ignored: not an object`, value)
    }
    return {}
}

// one saved item, undefined (with a warning) when it can't be read
export function readItem<T>(item: unknown, read: (item: any) => T, what: string): T | undefined {
    if (!isRecord(item)) {
        console.warn(`Saved ${what} skipped: not an object`, item)
        return undefined
    }
    try {
        return read(item)
    } catch (error) {
        console.warn(`Saved ${what} skipped:`, error, item)
        return undefined
    }
}

export function isRecord(value: unknown): value is Record<string, any> {
    return typeof value == "object" && value != null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
    return typeof value == "number" && isFinite(value)
}

// a saved color, a random one when it is missing or can't be read
export function readColor(value: unknown): Color {
    if (typeof value == "string" || isRecord(value)) {
        try {
            return Color(value)
        } catch {
            // falls through to a random color
        }
    }
    return Color.rgb(randomColorRGB())
}

// a saved label, `fallback` when it isn't a string
export function readLabel(value: unknown, fallback: string = ""): string {
    return typeof value == "string" ? value : fallback
}
