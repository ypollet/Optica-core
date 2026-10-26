// Routes exposed by every Optica backend (see core/api/optica_core/routes.py)
export const routes = {
    images: (objectPath: string) => `${objectPath}/images`,
    // a route about one image: the common ones below, and the app ones (depth: "profile")
    image: (objectPath: string, imageName: string, action: string) => `${objectPath}/${imageName}/${action}`,
    fullImage: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "full-image"),
    thumbnail: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "thumbnail"),
    position: (objectPath: string, imageName: string) => routes.image(objectPath, imageName, "position"),
}
