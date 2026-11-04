import { describe, expect, it } from "vitest"
import { effectScope, isReactive, nextTick, reactive, shallowRef, watchEffect } from "vue"
import Color from "color"
import {
  Acquisition, Annotations, BoundingBox, DequeMax2, Distance, Landmark, Polygon, Project, usePersistedAnnotations,
  usePersistedView,
  type ProjectImage,
} from "../src"

const size = { width: 100, height: 100 }
const image = (name: string): ProjectImage => ({ name, label: name, image: "" })
const landmark = (id: string, img = image("i0")) => new Landmark(id, id, { marker: { x: 1, y: 2 }, image: img }, { x: 10, y: 20 }, Color("#ff0000"))
const acquisition = (id: string, names: string[] = ["i0"]) => new Acquisition({ id, images: names.map(image), size })

describe("Annotations", () => {
  it("creates a selected distance and returns the reactive copy through a store", () => {
    const annotations = reactive(new Annotations())
    const distance = annotations.newDistance()
    expect(annotations.selectedDistanceIndex).toBe(0)
    expect(distance.label).toBe("Distance 1")
    // the landmarks pushed on it must be seen by the components
    expect(isReactive(distance)).toBe(true)
    distance.landmarks.push(landmark("a"))
    expect(annotations.selectedDistance?.landmarks.length).toBe(1)
  })

  it("keeps only the reference of the image of a landmark", () => {
    const rotation = { ...image("r30"), thumbnail: "t", size, angle: 30, wavelength: { value: 400 } }
    expect(landmark("a", rotation).pose.image).toEqual({ name: "r30", label: "r30", details: { angle: 30 } })
    expect(landmark("b").toJSON().pose.image).toEqual({ name: "i0", label: "i0" })
    // saves made when the whole image was stored
    const saved = { ...landmark("c").toJSON(), pose: { marker: { x: 1, y: 2 }, image: rotation } }
    expect(Landmark.fromJSON(saved).pose.image.details).toEqual({ angle: 30 })
  })

  it("removes a landmark everywhere and finds its tab", () => {
    const annotations = new Annotations()
    annotations.landmarks.push(landmark("a"))
    annotations.newDistance().landmarks.push(landmark("b"), landmark("c"))
    annotations.newDistance()
    annotations.showInSidebar(annotations.distances[0].landmarks[1])
    expect([annotations.tab, annotations.selectedDistanceIndex]).toEqual(["distances", 0])
    annotations.showInSidebar(annotations.landmarks[0])
    expect(annotations.tab).toBe("landmarks")
    annotations.removeLandmark("b")
    annotations.removeLandmark("a")
    expect(annotations.allLandmarks.map((l) => l.id)).toEqual(["c"])
    expect(annotations.distanceOf("c")).toBe(annotations.distances[0])
    expect(annotations.allLandmarks.map((l) => l.id)).not.toContain(annotations.generateID())
  })

  it("saves, merges and restores, ignoring an unknown unit", () => {
    const annotations = new Annotations()
    annotations.landmarks.push(landmark("a"))
    annotations.newDistance().landmarks.push(landmark("b"))
    annotations.adjustFactor = 2
    annotations.scale = "mm"
    const saved = JSON.parse(JSON.stringify(annotations.toJSON()))
    expect(saved.scale).toEqual({ unit: "mm", factor: 1 })
    // landmark(): marker (1, 2), position (10, 20); positions × scale_factor 2 in mm, the markers in px
    expect(saved.landmarks[0].scaled_position).toEqual({ x: 20, y: 40 })
    expect(saved.distances[0].landmarks[0].scaled_position).toEqual({ x: 20, y: 40 })
    expect(annotations.toCSVRows()[0].slice(-4)).toEqual(["20.00000", "40.00000", "", "mm"])
    annotations.scale = "px"
    expect(annotations.toJSON().landmarks[0]).toMatchObject({ scaled_position: { x: 1, y: 2 } })

    const other = new Annotations()
    other.merge(saved)
    other.merge(saved)
    expect([other.landmarks.length, other.distances.length, other.adjustFactor, other.scale]).toEqual([2, 2, 2, "mm"])
    expect(other.distances[0]).toBeInstanceOf(Distance)
    expect(other.landmarks[0].getColorHEX()).toBe("#FF0000")

    // importing the same file twice gave each copy a new id: removing one keeps the other
    const ids = other.allLandmarks.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    other.removeLandmark("a")
    expect(other.landmarks.length).toBe(1)

    other.restore({ ...saved, scale: "parsec" })
    expect([other.landmarks.length, other.distances.length, other.scale]).toEqual([1, 1, "mm"])
    // the saves before SavedScale have only the unit
    other.restore({ ...saved, scale: "cm" })
    expect(other.scale).toBe("cm")
  })
})

class TaggedAnnotations extends Annotations {
  tagged = true
}

class TaggedAcquisition extends Acquisition<ProjectImage> {
  declare annotations: TaggedAnnotations
  protected createAnnotations() {
    return new TaggedAnnotations()
  }
}

describe("Project annotations", () => {
  it("lets an app use its own Annotations", () => {
    const a = new TaggedAcquisition({ id: "a", images: [image("i0")], size })
    expect(a.annotations.tagged).toBe(true)
    a.annotations.restore({ distances: [{ label: "d", color: "#00ff00", landmarks: [], distance: 0 }] })
    expect(a.annotations.distances[0]).toBeInstanceOf(Distance)
  })

  it("exports by acquisition and imports both formats", () => {
    const project = new Project("A1", [acquisition("VIS"), acquisition("UV")])
    project.acquisitions[1].annotations.landmarks.push(landmark("u"))
    const exported = JSON.parse(JSON.stringify(project.annotationsToJSON()))
    expect(Object.keys(exported)).toEqual(["VIS", "UV"])

    const copy = new Project("A1", [acquisition("VIS"), acquisition("UV")])
    copy.importAnnotations(exported)
    expect(copy.getAcquisition("UV")!.annotations.landmarks.map((l) => l.id)).toEqual(["u"])

    // single acquisition export (first polar files): goes to the selected acquisition
    copy.selectAcquisition("VIS")
    copy.importAnnotations({ scale_factor: 3, landmarks: [landmark("old").toJSON()], distances: [] })
    expect(copy.getAcquisition("VIS")!.annotations.landmarks.map((l) => l.id)).toEqual(["old"])
    expect(copy.getAcquisition("VIS")!.annotations.adjustFactor).toBe(3)

    copy.importAnnotations(exported, true)
    expect(copy.getAcquisition("VIS")!.annotations.landmarks).toEqual([])
  })

  it("writes CSV rows with the acquisition", () => {
    const project = new Project("A1", [acquisition("VIS"), acquisition("UV")])
    project.acquisitions[1].annotations.landmarks.push(landmark("u"))
    const rows = project.annotationsToCSVRows()
    expect(rows[0].slice(0, 4)).toEqual(["Acquisition", "Group", "Group Label", "Landmark Label"])
    expect(rows[1].slice(0, 4)).toEqual(["UV", "Landmark", "", "u"])
    // as long as the header, no z for a 2D position, then the scaled position (px: the marker)
    expect(rows[1].length).toBe(rows[0].length)
    expect(rows[1][rows[0].indexOf("Z")]).toBe("")
    expect(rows[1].slice(-4)).toEqual(["1.00000", "2.00000", "", "px"])
  })
})

class MemoryStorage implements Storage {
  items = new Map<string, string>()
  get length() { return this.items.size }
  clear() { this.items.clear() }
  getItem(key: string) { return this.items.get(key) ?? null }
  key(index: number) { return [...this.items.keys()][index] ?? null }
  removeItem(key: string) { this.items.delete(key) }
  setItem(key: string, value: string) { this.items.set(key, value) }
}

describe("usePersistedAnnotations", () => {
  it("saves the annotations and puts them back on the next load", async () => {
    const storage = new MemoryStorage()

    // first visit
    const current = shallowRef<Project | null>(null)
    const scope = effectScope()
    scope.run(() => usePersistedAnnotations(() => current.value, storage))
    current.value = reactive(new Project("A1", [acquisition("rotation")])) as Project
    await nextTick()
    const annotations = current.value.acquisition!.annotations
    annotations.landmarks.push(landmark("kept"))
    annotations.newDistance()
    annotations.newDistance()
    annotations.tab = "distances"
    annotations.selectedDistanceIndex = 0
    await nextTick()
    expect(storage.getItem("annotations:A1")).toContain("kept")
    scope.stop()

    // reload: a new project comes from the backend with empty annotations
    const reloaded = shallowRef<Project | null>(null)
    const scope2 = effectScope()
    scope2.run(() => usePersistedAnnotations(() => reloaded.value, storage))
    reloaded.value = reactive(new Project("A1", [acquisition("rotation")])) as Project
    await nextTick()
    const restored = reloaded.value.acquisition!.annotations
    expect(restored.landmarks.map((l) => l.id)).toEqual(["kept"])
    // the sidebar state comes back too, but is not part of the export
    expect([restored.tab, restored.selectedDistanceIndex, restored.distances.length]).toEqual(["distances", 0, 2])
    expect(JSON.stringify(reloaded.value.annotationsToJSON())).not.toContain("selectedDistanceIndex")
    await nextTick()
    expect(storage.getItem("annotations:A1")).toContain("kept")
    scope2.stop()
  })

  it("doesn't write the storage for what isn't saved", async () => {
    const storage = new MemoryStorage()
    const current = shallowRef<Project | null>(null)
    const scope = effectScope()
    scope.run(() => usePersistedAnnotations(() => current.value, storage))
    current.value = reactive(new Project("A1", [acquisition("rotation")])) as Project
    await nextTick()
    const annotations = current.value.acquisition!.annotations
    annotations.landmarks.push(landmark("kept"))
    await nextTick()
    let writes = 0
    const setItem = storage.setItem.bind(storage)
    storage.setItem = (key, value) => { writes++; setItem(key, value) }
    annotations.landmarks[0]!.show = false
    await nextTick()
    expect(writes).toBe(0)
    annotations.landmarks[0]!.label = "renamed"
    await nextTick()
    expect(writes).toBe(1)
    scope.stop()
  })

  it("ignores a saved selection that doesn't fit the annotations", () => {
    const annotations = new Annotations()
    annotations.newDistance()
    annotations.setSelection({ tab: "distances", selectedDistanceIndex: 5 })
    expect([annotations.tab, annotations.selectedDistanceIndex]).toEqual(["distances", 0])
    annotations.setSelection({ selectedDistanceIndex: -1 })
    expect(annotations.selectedDistanceIndex).toBe(-1)
  })
})

describe("usePersistedView", () => {
  it("shows again the image and the acquisition shown before the reload", async () => {
    const storage = new MemoryStorage()
    const load = () => reactive(new Project("S1", [acquisition("a", ["i0", "i1", "i2"]), acquisition("b", ["j0", "j1"])])) as Project

    const current = shallowRef<Project | null>(null)
    const scope = effectScope()
    scope.run(() => usePersistedView(() => current.value, storage))
    current.value = load()
    await nextTick()
    current.value.acquisition!.setIndex(2)
    current.value.selectAcquisition("b")
    current.value.acquisition!.setIndex(1)
    await nextTick()
    scope.stop()

    const reloaded = shallowRef<Project | null>(null)
    const scope2 = effectScope()
    scope2.run(() => usePersistedView(() => reloaded.value, storage))
    reloaded.value = load()
    await nextTick()
    expect([reloaded.value.acquisition!.id, reloaded.value.acquisition!.index, reloaded.value.getAcquisition("a")!.index]).toEqual(["b", 1, 2])
    scope2.stop()
  })
})

describe("scale", () => {
  const distance = () => new Distance("d", [
    new Landmark("a", "a", { marker: { x: 0, y: 0 }, image: image("i0") }, { x: 0, y: 0 }),
    new Landmark("b", "b", { marker: { x: 3, y: 4 }, image: image("i0") }, { x: 30, y: 40 }),
  ])

  it("applies the calibration to physical lengths, not to pixels", () => {
    const annotations = new Annotations()
    annotations.adjustFactor = 2
    annotations.scale = "cm"
    expect(annotations.scaled(distance())).toBe(10)
    annotations.scale = "px"
    expect(annotations.scaled(distance())).toBe(5)
  })

  it("doesn't calibrate in pixels", () => {
    const annotations = new Annotations()
    annotations.scale = "px"
    annotations.calibrate(distance(), 10)
    expect(annotations.adjustFactor).toBe(1)
    annotations.scale = "mm"
    annotations.calibrate(distance(), 10)
    expect(annotations.adjustFactor).toBe(0.2)
  })
})

describe("Polygon", () => {
  // 3 x 4 rectangle in pixels, twice as big in physical units
  const corner = (id: string, x: number, y: number, z?: number) =>
    new Landmark(id, id, { marker: { x, y }, image: image("i0") }, z == undefined ? { x: 2 * x, y: 2 * y } : { x: 2 * x, y: 2 * y, z })
  const rectangle = () => new Polygon("p", [corner("a", 0, 0), corner("b", 3, 0), corner("c", 3, 4), corner("d", 0, 4)])

  it("is closed: measures the side back to the first landmark", () => {
    expect([rectangle().perimeter("px"), rectangle().area("px")]).toEqual([14, 12])
    expect([rectangle().perimeter("mm"), rectangle().area("mm")]).toEqual([28, 48])
    const open = new Polygon("p", [corner("a", 0, 0), corner("b", 3, 0)])
    expect([open.perimeter("px"), open.area("px")]).toEqual([undefined, undefined])
  })

  it("measures the area of a tilted polygon in 3D", () => {
    // the rectangle raised along its height: its sides are 6 and 10 (8 along y, 6 along z)
    const tilted = new Polygon("p", [corner("a", 0, 0, 0), corner("b", 3, 0, 0), corner("c", 3, 4, 6), corner("d", 0, 4, 6)])
    expect(tilted.area("mm")).toBeCloseTo(60)
  })

  it("scales the area with the square of the calibration", () => {
    const annotations = new Annotations()
    annotations.adjustFactor = 2
    annotations.scale = "cm"
    expect([annotations.scaledPerimeter(rectangle()), annotations.scaledArea(rectangle())]).toEqual([5.6, 1.92])
    annotations.scale = "px"
    expect([annotations.scaledPerimeter(rectangle()), annotations.scaledArea(rectangle())]).toEqual([14, 12])
  })

  it("is drawn, finished, found, saved and restored like a distance", () => {
    const annotations = new Annotations()
    annotations.newPolygon().landmarks.push(...rectangle().landmarks)
    expect([annotations.selectedPolygon?.label, annotations.selectedPolygonIndex]).toEqual(["Polygon 1", 0])
    annotations.finishPolygon()
    expect(annotations.selectedPolygon).toBeNull()
    annotations.showInSidebar(annotations.polygons[0].landmarks[2])
    expect([annotations.tab, annotations.selectedPolygonIndex]).toEqual(["polygons", 0])
    expect(annotations.polygonOf("c")).toBe(annotations.polygons[0])

    const saved = JSON.parse(JSON.stringify(annotations.toJSON()))
    expect([saved.polygons[0].perimeter, saved.polygons[0].area]).toEqual([14, 12])
    expect(annotations.toCSVRows().filter((row) => row[0] == "Polygon").length).toBe(4)
    const other = new Annotations()
    other.merge(saved)
    other.merge(saved)
    expect(other.polygons[1]).toBeInstanceOf(Polygon)
    const ids = other.allLandmarks.map((l) => l.id)
    expect(new Set(ids).size).toBe(8)
    other.removeLandmark("a")
    expect(other.polygons.map((polygon) => polygon.landmarks.length)).toEqual([3, 4])

    // saves made before the polygons
    other.restore({ landmarks: [], distances: [] })
    expect([other.polygons.length, other.selectedPolygonIndex]).toEqual([0, -1])
    other.setSelection({ selectedPolygonIndex: 3 })
    expect(other.selectedPolygonIndex).toBe(-1)
  })
})

describe("BoundingBox", () => {
  // markers (1, 2) and (4, 6), positions twice as big
  const corner = (id: string, x: number, y: number) =>
    new Landmark(id, id, { marker: { x, y }, image: image("i0") }, { x: 2 * x, y: 2 * y, z: x })

  it("measures along the image axes from any two opposite corners", () => {
    const box = new BoundingBox("b", [corner("a", 4, 2), corner("b", 1, 6)])
    expect([box.width("px"), box.height("px"), box.area("px")]).toEqual([3, 4, 12])
    expect([box.width("mm"), box.height("mm"), box.area("mm")]).toEqual([6, 8, 48])
    expect([box.center("px"), box.center("mm")]).toEqual([{ x: 2.5, y: 4 }, { x: 5, y: 8 }])
    expect(new BoundingBox("b", [corner("a", 4, 2)]).area("px")).toBeUndefined()
  })

  it("is deselected with its second corner, so the next one starts a new box", () => {
    const annotations = new Annotations()
    const first = annotations.openBox()
    annotations.addCorner(first, corner("a", 1, 2))
    expect(annotations.openBox()).toBe(first)
    annotations.addCorner(first, corner("b", 4, 6))
    expect([annotations.selectedBoxIndex, first.isComplete()]).toEqual([-1, true])
    // a third corner never goes to a complete box
    annotations.addCorner(first, corner("c", 0, 0))
    expect(first.landmarks.length).toBe(2)

    const second = annotations.openBox()
    annotations.addCorner(second, corner("d", 0, 0))
    expect([annotations.boxes.length, annotations.selectedBoxIndex, second.label]).toEqual([2, 1, "Box 2"])
    // a complete box selected in the list: the next corner starts a new box
    annotations.selectedBoxIndex = 0
    annotations.addCorner(annotations.openBox(), corner("e", 0, 0))
    expect(annotations.boxes.map((box) => box.landmarks.length)).toEqual([2, 1, 1])
    expect(annotations.selectedBoxIndex).toBe(2)
  })

  it("is found, scaled, saved and restored", () => {
    const annotations = new Annotations()
    annotations.addCorner(annotations.openBox(), corner("a", 1, 2))
    annotations.addCorner(annotations.selectedBox ?? annotations.openBox(), corner("b", 4, 6))
    annotations.showInSidebar(annotations.boxes[0].landmarks[1])
    expect([annotations.tab, annotations.selectedBoxIndex]).toEqual(["boxes", 0])
    expect(annotations.boxOf("a")).toBe(annotations.boxes[0])

    annotations.adjustFactor = 2
    annotations.scale = "cm"
    const saved = JSON.parse(JSON.stringify(annotations.toJSON()))
    expect([saved.boxes[0].width, saved.boxes[0].height, saved.boxes[0].area]).toEqual([1.2, 1.6, 1.92])
    expect(saved.boxes[0].center).toEqual({ x: 1, y: 1.6 })
    expect(annotations.toCSVRows().filter((row) => row[0] == "Box").length).toBe(2)

    const other = new Annotations()
    other.merge(saved)
    other.merge(saved)
    expect(other.boxes[1]).toBeInstanceOf(BoundingBox)
    expect(new Set(other.allLandmarks.map((l) => l.id)).size).toBe(4)
    other.removeLandmark("a")
    expect(other.boxes.map((box) => box.landmarks.length)).toEqual([1, 2])
    other.restore({ landmarks: [], distances: [] })
    expect([other.boxes.length, other.selectedBoxIndex]).toEqual([0, -1])
  })
})

describe("BoundingBox images", () => {
  it("keeps both corners on the image of the first one", () => {
    const annotations = new Annotations()
    const on = (id: string, name: string) => new Landmark(id, id, { marker: { x: 1, y: 1 }, image: image(name) }, { x: 1, y: 1, z: 0 })
    const box = annotations.openBox()
    annotations.addCorner(box, on("a", "i0"))
    expect([annotations.accepts(box, image("i0")), annotations.accepts(box, image("i1"))]).toEqual([true, false])
    annotations.addCorner(box, on("b", "i1"))
    expect([box.landmarks.length, annotations.selectedBoxIndex]).toEqual([1, 0])
    annotations.addCorner(box, on("c", "i0"))
    expect([box.landmarks.length, annotations.selectedBoxIndex]).toEqual([2, -1])
  })
})

describe("placing", () => {
  const on = (id: string, name: string) => new Landmark(id, id, { marker: { x: 1, y: 1 }, image: image(name) }, { x: 1, y: 1, z: 0 })

  it("adds to the selected distance, polygon or box of the shown tab, a new one otherwise", () => {
    const annotations = new Annotations()
    expect(annotations.target()).toBeNull()
    annotations.tab = "distances"
    const distance = annotations.target()!
    annotations.add(distance, on("a", "i0"))
    expect(annotations.target()).toBe(distance)
    annotations.tab = "boxes"
    const box = annotations.target()!
    annotations.add(box, on("b", "i0"))
    annotations.add(box, on("c", "i0"))
    expect([box.landmarks.length, annotations.target() === box, annotations.boxes.length]).toEqual([2, false, 2])
  })

  it("keeps the measures on one image when asked, boxes always", () => {
    const annotations = new Annotations()
    const distance = annotations.newDistance()
    annotations.add(distance, on("a", "i0"))
    expect([annotations.accepts(distance, image("i1")), annotations.canMoveTo(distance.landmarks[0]!, image("i1"))]).toEqual([true, true])
    annotations.singleImageMeasures = true
    expect([annotations.accepts(distance, image("i1")), annotations.canMoveTo(distance.landmarks[0]!, image("i1"))]).toEqual([false, false])
    expect(annotations.canMoveTo(on("free", "i0"), image("i1"))).toBe(true)
  })
})

describe("opened", () => {
  it("is the selection of the shown tab", () => {
    const annotations = new Annotations()
    const distance = annotations.newDistance()
    const polygon = annotations.newPolygon()
    const box = annotations.openBox()
    expect(annotations.opened).toBeNull()
    annotations.tab = "distances"
    expect(annotations.opened).toBe(distance)
    annotations.tab = "polygons"
    expect(annotations.opened).toBe(polygon)
    annotations.tab = "boxes"
    expect(annotations.opened).toBe(box)
    annotations.selectedBoxIndex = -1
    expect(annotations.opened).toBeNull()
  })
})

describe("DequeMax2", () => {
  it("keeps the last two items, finds them with equals", () => {
    const deque = new DequeMax2([landmark("a"), landmark("b"), landmark("c")])
    expect(deque.items.map((l) => l.id)).toEqual(["b", "c"])
    deque.add(landmark("c"))
    expect(deque.items.map((l) => l.id)).toEqual(["b", "c"])
    expect([deque.contains("b"), deque.contains(landmark("a")), deque.contains(null)]).toEqual([true, false, false])
    deque.remove("unknown")
    deque.remove("b")
    expect([deque.first?.id, deque.last?.id, deque.isFull()]).toEqual(["c", "c", false])
  })
})

describe("createLandmark", () => {
  it("shows the landmark at once, its position comes later", async () => {
    const annotations = reactive(new Annotations())
    // physical: the px scale measures the markers
    annotations.scale = "mm"
    const distance = annotations.newDistance()
    distance.landmarks.push(landmark("a"))
    let resolve: (position: { x: number, y: number }) => void = () => {}
    const created = annotations.createLandmark({ marker: { x: 3, y: 4 }, image: image("i0") }, () => new Promise((r) => { resolve = r }))
    distance.landmarks.push(created)
    expect(distance.landmarks[1]!.position).toBeNull()
    // measures and exports wait for the position
    expect(annotations.scaled(distance)).toBe(0)
    expect(annotations.scaledPositionCSV(created)).toEqual(["", "", "", annotations.scale])
    let seen: unknown = null
    const scope = effectScope()
    scope.run(() => watchEffect(() => { seen = distance.landmarks[1]!.position }, { flush: "sync" }))
    resolve({ x: 13, y: 20 })
    await nextTick()
    expect(distance.landmarks[1]!.position).toEqual({ x: 13, y: 20 })
    expect(seen).toEqual({ x: 13, y: 20 })
    expect(distance.distance).toBe(3)
    scope.stop()
  })

  it("leaves the position to the caller without computePosition", () => {
    const created = new Annotations().createLandmark({ marker: { x: 3, y: 4 }, image: image("i0") }, null)
    expect(created.position).toBeNull()
  })
})
