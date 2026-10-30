import { describe, expect, it } from "vitest"
import { effectScope, isReactive, nextTick, reactive, shallowRef } from "vue"
import Color from "color"
import {
  Acquisition, Annotations, DequeMax2, Distance, Landmark, Project, usePersistedAnnotations,
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
    expect(saved.scale).toBe("mm")

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
    expect(rows[1][rows[1].length - 1]).toBe("")
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
