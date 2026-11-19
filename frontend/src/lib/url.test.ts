import { describe, expect, it } from "vitest"
import { objectFromUrl } from "./url"

describe("objectFromUrl", () => {
    it("reads ?object=", () => {
        expect(objectFromUrl("?object=insect")).toBe("insect")
    })
    it("still reads the old ?series=, ?object= first", () => {
        expect(objectFromUrl("?series=insect")).toBe("insect")
        expect(objectFromUrl("?series=old&object=new")).toBe("new")
    })
    it("is empty without one", () => {
        expect(objectFromUrl("")).toBe("")
    })
})
