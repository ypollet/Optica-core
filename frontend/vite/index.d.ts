import type { ManualChunkMeta } from 'rollup'

export interface ManualChunksOptions {
  /** groups smaller than this (in bytes of source) are packed into vendor chunks, default 100 KiB */
  minGroupSize?: number
  /** maximum size (in bytes of source) of a vendor chunk, default 500 KiB */
  maxVendorSize?: number
  /** package.json whose dependencies are the direct dependencies, default `<cwd>/package.json` */
  packageJson?: string
}

export function createManualChunks(
  options?: ManualChunksOptions,
): (id: string, meta: ManualChunkMeta) => string | undefined
