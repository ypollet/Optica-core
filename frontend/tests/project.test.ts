import { describe, expect, it } from "vitest"
import type { AxiosResponse } from "axios"
import { Acquisition, Project, ProjectRepository, type AcquisitionObject, type DataProvider, type ProjectImage } from "../src"

const size = { width: 2000, height: 1000 }
const img = (name: string, extra = {}): ProjectImage => ({ name, label: name, image: "", ...extra })

function acquisition(images: string[], standalone: string[] = []): Acquisition {
  return new Acquisition({ id: "a", images: images.map((n) => img(n)), standaloneImages: standalone.map((n) => img(n)), size })
}

describe("Acquisition", () => {
  it("shows the group first and clamps the index", () => {
    const a = acquisition(["s0", "s1", "s2"], ["result"])
    expect(a.selectedImage?.name).toBe("s0")
    a.setIndex(10)
    expect(a.selectedImage?.name).toBe("s2")
    a.moveIndex(-5)
    expect(a.index).toBe(0)
  })

  it("switches between standalone images and the group", () => {
    const a = acquisition(["s0", "s1"], ["result"])
    a.select("result")
    expect(a.selectedImage?.name).toBe("result")
    a.select("s1")
    expect(a.standalone).toBeNull()
    expect(a.selectedImage?.name).toBe("s1")
    a.selectStandalone("unknown")
    expect(a.selectedImage?.name).toBe("s1")
  })

  it("starts on a standalone image when the group is empty", () => {
    const a = acquisition([], ["d0", "d1"])
    expect(a.hasGroup).toBe(false)
    expect(a.selectedImage?.name).toBe("d0")
    a.setIndex(1)
    a.selectStandalone(null)
    expect(a.selectedImage?.name).toBe("d0")
    expect(acquisition([]).isEmpty).toBe(true)
    expect(acquisition([]).selectedImage).toBeUndefined()
  })

  it("uses the size of the image when it has one", () => {
    const a = new Acquisition({ id: "a", images: [], standaloneImages: [img("d0", { size: { width: 5, height: 5 } }), img("d1")], size })
    expect(a.sizeOf()).toEqual({ width: 5, height: 5 })
    expect(a.sizeOf(a.getImage("d1"))).toEqual(size)
  })
})

describe("Project", () => {
  it("selects acquisitions and finds images", () => {
    const vis = new Acquisition({ id: "VIS", images: [img("vis0")], size })
    const uv = new Acquisition({ id: "UV", images: [img("uv0")], standaloneImages: [img("uvRGB")], size })
    const p = new Project("A1", [vis, uv])
    expect(p.selectedImage?.name).toBe("vis0")
    p.selectAcquisition("UV")
    expect(p.acquisition?.id).toBe("UV")
    p.selectAcquisition("nope")
    expect(p.acquisition?.id).toBe("UV")
    expect(p.acquisitionOf("uvRGB")?.id).toBe("UV")
    expect(p.allImages.map((i) => i.name)).toEqual(["vis0", "uv0", "uvRGB"])
  })
})

function provider(data: unknown): DataProvider {
  return {
    getImages: async () => ({ data } as AxiosResponse),
    getFullImage: (o, n) => `S/${o}/${n}/full-image`,
    getThumbnail: (o, n) => `S/${o}/${n}/thumbnail`,
    computeLandmarkPosition: async () => ({ data: {} } as AxiosResponse),
    imageUrl: (o, n, a) => `S/${o}/${n}/${a}`,
  }
}

describe("ProjectRepository", () => {
  it("reads the standard payload and resolves the urls", async () => {
    const payload = { acquisitions: [{ id: "stack", images: [{ name: "s0", label: "s0", hasThumbnail: true }], standaloneImages: [{ name: "r", label: "Result" }], size }] }
    const project = await new ProjectRepository(provider(payload)).getImages("A1")
    const a = project.acquisition!
    expect(a.images[0]).toMatchObject({ image: "S/A1/s0/full-image", thumbnail: "S/A1/s0/thumbnail" })
    expect(a.standaloneImages[0]).toMatchObject({ label: "Result", image: "S/A1/r/full-image" })
  })

  it("resolves the thumbnail of the images marked with hasThumbnail only", async () => {
    const payload = { acquisitions: [{
      id: "stack", size,
      images: [{ name: "s0", label: "s0", hasThumbnail: true }, { name: "s1", label: "s1", hasThumbnail: false }, { name: "s2", label: "s2" }],
      standaloneImages: [{ name: "r", label: "Result", hasThumbnail: true }],
    }] }
    const a = (await new ProjectRepository(provider(payload)).getImages("A1")).acquisition!
    expect(a.images.map((image) => image.thumbnail)).toEqual(["S/A1/s0/thumbnail", undefined, undefined])
    expect(a.standaloneImages[0].thumbnail).toBe("S/A1/r/thumbnail")
  })

  it("adapts a legacy payload with a parser (spectral: one acquisition per group)", async () => {
    type SpectralImage = ProjectImage & { wavelength: { value: number } }
    const legacy = {
      VIS: { spectralImages: [{ name: "v450", label: "v450", wavelength: { value: 450 } }], individualImages: { RGB: { name: "vRGB", label: "RGB" } }, size },
      UV: { spectralImages: [], individualImages: { RGB: { name: "uRGB", label: "RGB" } }, size },
    }
    const parse = (data: any): AcquisitionObject<SpectralImage>[] => Object.entries<any>(data).map(([id, group]) => ({
      id, images: group.spectralImages, standaloneImages: Object.values(group.individualImages), size: group.size,
    }))
    const project = await new ProjectRepository<SpectralImage>(provider(legacy), parse).getImages("A1")
    expect(project.acquisitions.map((a) => a.id)).toEqual(["VIS", "UV"])
    expect(project.acquisition!.selectedImage!.wavelength.value).toBe(450)
    expect(project.getAcquisition("UV")!.selectedImage!.name).toBe("uRGB")
    expect(project.acquisitions[0].images[0].thumbnail).toBeUndefined()
  })

  it("adapts depth: no group, standalone images with their own size", async () => {
    const legacy = { images: [{ id: "d0", label: "D0", size: { width: 10, height: 20 } }] }
    const parse = (data: any): AcquisitionObject[] => [{
      id: "depth", images: [], size: data.images[0].size,
      standaloneImages: data.images.map((i: any) => ({ name: i.id, label: i.label, size: i.size })),
    }]
    const project = await new ProjectRepository(provider(legacy), parse).getImages("A1")
    expect(project.selectedImage).toMatchObject({ name: "d0", image: "S/A1/d0/full-image" })
    expect(project.acquisition!.sizeOf()).toEqual({ width: 10, height: 20 })
  })
})
