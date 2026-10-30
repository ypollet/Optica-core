// At most two items in order of addition, adding a third one drops the first
// (sphaer: the two selected landmarks, depth: the ends of a profile).
// Items are compared with their equals, which also finds them by id (landmarks)
export class DequeMax2<T extends { equals(other: T | string): boolean }> {
    items: T[] = []

    constructor(items: T[] = []) {
        items.forEach((item) => this.add(item))
    }

    get length(): number {
        return this.items.length
    }

    get first(): T | undefined {
        return this.items[0]
    }

    get last(): T | undefined {
        return this.items[this.items.length - 1]
    }

    isEmpty(): boolean {
        return this.items.length == 0
    }

    isFull(): boolean {
        return this.items.length == 2
    }

    // an item already in is not added again
    add(item: T) {
        if (this.contains(item)) {
            return
        }
        if (this.isFull()) {
            this.items.shift()
        }
        this.items.push(item)
    }

    popFirst() {
        this.items.shift()
    }

    popLast() {
        this.items.pop()
    }

    permute() {
        this.items.reverse()
    }

    contains(item: T | string | null | undefined): boolean {
        if (item == null) {
            return false
        }
        return this.items.some((other) => other.equals(item))
    }

    remove(item: T | string) {
        this.items = this.items.filter((other) => !other.equals(item))
    }

    forEach(callback: (item: T) => void) {
        this.items.forEach(callback)
    }
}
