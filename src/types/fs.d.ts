declare module 'fs' {
  export const writeFileSync: (
    file: string | URL,
    data: string | Uint8Array,
    options?: { encoding?: string, mode?: number, flag?: string }
  ) => void

  export const readFileSync: (
    file: string | URL,
    options?: { encoding?: string, flag?: string }
  ) => string | Uint8Array
}

declare module 'node:fs' {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  import path = require('fs')
  export = path
}
