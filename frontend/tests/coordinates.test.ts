import { describe, expect, it } from "vitest"
import Color from "color"
import { Distance, Landmark, Polygon, distanceVector, fillUnknownZ, fillUnknownZOnPlane, positionCSV, vectorToString, type Position, type ProjectImage } from "../src"

const image: ProjectImage = { name: "i0", label: "i0", image: "" }
const landmark = (position: Position | null) => new Landmark("l", "l", { marker: { x: 0, y: 0 }, image }, position, Color("#ff0000"))

// depth: a pixel outside the mask has a position without z
describe("unknown z", () => {
  it("is shown as … and left empty in the CSV", () => {
    expect(vectorToString({ x: 1, y: 2, z: null })).toBe("(1.00; 2.00; …)")
    expect(vectorToString({ x: 1, y: 2, z: 3 })).toBe("(1.00; 2.00; 3.00)")
    expect(vectorToString({ x: 1, y: 2 })).toBe("(1.00; 2.00)")
    expect(positionCSV({ x: 1, y: 2, z: null })[2]).toBe("")
  })

  it("makes the z of a distance vector unknown", () => {
    expect(distanceVector({ x: 0, y: 0, z: 1 }, { x: 3, y: 4, z: null })).toEqual({ x: 3, y: 4, z: null })
    expect(distanceVector({ x: 0, y: 0, z: 1 }, { x: 3, y: 4, z: 1 })).toEqual({ x: 3, y: 4, z: 0 })
  })
})

describe("fillUnknownZ", () => {
  it("interpolates between the known z, by the length in the image plane", () => {
    const filled = fillUnknownZ([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: null }, { x: 4, y: 0, z: null }, { x: 4, y: 0, z: 8 }])
    expect(filled).toEqual([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 2 }, { x: 4, y: 0, z: 8 }, { x: 4, y: 0, z: 8 }])
  })

  it("takes the nearest known z at the ends of an open path", () => {
    expect(fillUnknownZ([{ x: 0, y: 0, z: null }, { x: 1, y: 0, z: 3 }, { x: 2, y: 0, z: null }]))
      .toEqual([{ x: 0, y: 0, z: 3 }, { x: 1, y: 0, z: 3 }, { x: 2, y: 0, z: 3 }])
  })

  it("goes around a closed path", () => {
    // the last point is between the third (z 2) and the first (z 0), at the same length from both
    const filled = fillUnknownZ([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, { x: 2, y: 2, z: 2 }, { x: 0, y: 2, z: null }], true)
    expect(filled[3]).toEqual({ x: 0, y: 2, z: 1 })
  })

  it("gives 2D points without any known z, and leaves known ones as they are", () => {
    expect(fillUnknownZ([{ x: 1, y: 2, z: null }, { x: 3, y: 4, z: null }])).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
    const points: Position[] = [{ x: 1, y: 2, z: 3 }, { x: 3, y: 4 }]
    expect(fillUnknownZ(points)).toBe(points)
  })
})

describe("fillUnknownZOnPlane", () => {
  it("puts the unknown z on the plane of the known corners", () => {
    // plane z = 2x - y + 1
    const filled = fillUnknownZOnPlane([{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 3 }, { x: 1, y: 1, z: 2 }, { x: 0, y: 1, z: null }])
    expect((filled[3] as { z: number }).z).toBeCloseTo(0)
  })

  it("goes around the polygon under three known corners or when they are on a line", () => {
    const two = fillUnknownZOnPlane([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, { x: 2, y: 2, z: null }])
    expect(two).toEqual(fillUnknownZ([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, { x: 2, y: 2, z: null }], true))
    const line = fillUnknownZOnPlane([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }, { x: 1, y: 1, z: null }])
    expect(line).toEqual(fillUnknownZ([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }, { x: 1, y: 1, z: null }], true))
  })
})

describe("measures with an unknown z", () => {
  it("a distance ending outside the mask: its last segment is flat", () => {
    const distance = new Distance("d", [landmark({ x: 0, y: 0, z: 0 }), landmark({ x: 0, y: 0, z: 2 }), landmark({ x: 3, y: 4, z: null })])
    expect(distance.distance).toBe(2 + 5)
  })

  it("a distance through the mask: the same as on the straight line between its neighbours", () => {
    const through = new Distance("d", [landmark({ x: 0, y: 0, z: 0 }), landmark({ x: 3, y: 0, z: null }), landmark({ x: 6, y: 0, z: 8 })])
    const known = new Distance("d", [landmark({ x: 0, y: 0, z: 0 }), landmark({ x: 3, y: 0, z: 4 }), landmark({ x: 6, y: 0, z: 8 })])
    expect(through.distance).toBeCloseTo(known.distance!)
    expect(through.distance).toBeCloseTo(10)
  })

  it("a polygon on a plane keeps its area and perimeter", () => {
    // square of side 2 on the plane z = x, and a fifth corner to fit the plane through the four known ones
    const square = (z3: number | null) => new Polygon("p", [
      landmark({ x: 0, y: 0, z: 0 }), landmark({ x: 2, y: 0, z: 2 }), landmark({ x: 2, y: 2, z: 2 }),
      landmark({ x: 1, y: 3, z: 1 }), landmark({ x: 0, y: 2, z: z3 }),
    ])
    expect(square(null).area()).toBeCloseTo(square(0).area()!)
    expect(square(null).perimeter()).toBeCloseTo(square(0).perimeter()!)
  })
})
