// An id is one segment of the route: encoded, so an object path or image name can't point to another route
export const segment = encodeURIComponent

// Routes exposed by every Optica backend (see core/api/optica_core/routes.py)
export const routes = {
    images: (objectPath: string) => `${segment(objectPath)}/images`,
    // a route about one image: the common ones below, and the app ones (depth: "profile")
    image: (objectPath: string, imageName: string, action: string) => `${segment(objectPath)}/${segment(imageName)}/${action}`,
    fullImage: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "full-image"),
    thumbnail: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "thumbnail"),
    position: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "position"),
}
