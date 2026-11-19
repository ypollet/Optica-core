// The object a viewer opens, from its url: `?object=<id>`. The id is the backend's own (a folder of the
// Flask apps, an Orthanc study, series or instance); the viewer only passes it back to it (routes).
// `?series=` is the name it had before, still read for the links made with it.
export function objectFromUrl(search: string = window.location.search): string {
    const params = new URLSearchParams(search)
    return params.get("object") ?? params.get("series") ?? ""
}
