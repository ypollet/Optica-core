// Build helpers for the vite.config.ts of the Optica plugins.
// Plain JS (+ index.d.ts): Node loads it from node_modules when Vite reads the config, and cannot strip types there.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageName = (id) => {
  if (!id.includes('node_modules/')) return undefined
  const parts = id.split('node_modules/').pop().split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

// Vendor chunking: every package of node_modules is grouped with the direct dependency
// (from package.json) that imports it, e.g. decimal.js goes with mathjs.
// Groups smaller than minGroupSize are then packed together into "vendor-N" chunks of at most maxVendorSize.
// Sizes are measured on the sources before tree-shaking, so they overestimate the output.
export const createManualChunks = ({
  minGroupSize = 100 * 1024,
  maxVendorSize = 500 * 1024,
  packageJson = resolve(process.cwd(), 'package.json'),
} = {}) => {
  const directDeps = new Set(Object.keys(JSON.parse(readFileSync(packageJson, 'utf-8')).dependencies ?? {}))
  let chunkOfPackage

  const computeChunks = ({ getModuleIds, getModuleInfo }) => {
    const modulesOfPackage = new Map()
    for (const id of getModuleIds()) {
      const pkg = packageName(id)
      if (pkg) modulesOfPackage.set(pkg, [...(modulesOfPackage.get(pkg) ?? []), id])
    }

    // walk up the importers until reaching a direct dependency or the app code
    const ownersOf = (pkg) => {
      const owners = new Set()
      const visited = new Set()
      const queue = [...modulesOfPackage.get(pkg)]
      while (queue.length) {
        const id = queue.pop()
        if (visited.has(id)) continue
        visited.add(id)
        const info = getModuleInfo(id)
        for (const importer of [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]) {
          const importerPkg = packageName(importer)
          if (!importerPkg) owners.add(pkg)
          else if (importerPkg === pkg) queue.push(importer)
          else if (directDeps.has(importerPkg)) owners.add(importerPkg)
          else queue.push(importer)
        }
      }
      return owners
    }

    const groupOfPackage = new Map()
    const groupSize = new Map()
    for (const [pkg, ids] of modulesOfPackage) {
      const owners = directDeps.has(pkg) ? new Set([pkg]) : ownersOf(pkg)
      const group = owners.size === 1 ? [...owners][0] : 'shared'
      groupOfPackage.set(pkg, group)
      const size = ids.reduce((total, id) => total + (getModuleInfo(id)?.code?.length ?? 0), 0)
      groupSize.set(group, (groupSize.get(group) ?? 0) + size)
    }

    // big groups get their own chunk, small ones are packed into vendor chunks
    const chunkOfGroup = new Map()
    const vendorSizes = []
    const smallGroups = [...groupSize].filter(([group, size]) => group === 'shared' || size < minGroupSize)
    for (const [group] of groupSize) chunkOfGroup.set(group, group.replace('/', '-'))
    for (const [group, size] of smallGroups.sort((a, b) => b[1] - a[1])) {
      let index = vendorSizes.findIndex((total) => total + size <= maxVendorSize)
      if (index === -1) index = vendorSizes.push(0) - 1
      vendorSizes[index] += size
      chunkOfGroup.set(group, `vendor-${index}`)
    }

    return new Map([...groupOfPackage].map(([pkg, group]) => [pkg, chunkOfGroup.get(group)]))
  }

  return (id, meta) => {
    const pkg = packageName(id)
    if (!pkg) return undefined
    chunkOfPackage ??= computeChunks(meta)
    return chunkOfPackage.get(pkg)
  }
}
