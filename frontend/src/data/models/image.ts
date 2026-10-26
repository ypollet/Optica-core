// Minimal image identity shared by every app (stack, rotation, spectral, ...)
export type ImageName = {
    name: string,
    label: string
}

// What an annotation keeps of its image: the name to find it back, the label and the
// details an app shows with it (polar: angle). Saved with the annotations, so no urls.
export type ImageRef = ImageName & {
    details?: Record<string, string | number>
}

// Reference of an image, full (an app image, a save made when the whole image was stored) or
// already a reference: its fields other than the urls and size that are a string or a number
// go to the details (polar: angle).
export function imageRef(image: ImageRef): ImageRef {
    const { name, label, details, image: _url, thumbnail: _thumbnail, size: _size, ...rest } = image as ImageRef & Partial<ProjectImage>
    const own = Object.fromEntries(Object.entries(rest).filter(([, value]) => typeof value === "string" || typeof value === "number"))
    const merged = { ...own, ...details } as Record<string, string | number>
    return Object.keys(merged).length > 0 ? { name, label, details: merged } : { name, label }
}

export type Size = {
    height: number,
    width: number
}

// Image with resolved urls, filled by the repository
export type ProjectImage = ImageName & {
    image: string,
    thumbnail?: string,
    // only when it differs from the size of its acquisition (depth)
    size?: Size
}

export type Ratio = {
    height: number,
    width: number
}
