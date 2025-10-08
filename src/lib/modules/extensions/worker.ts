import { finalizer } from 'abslink'
import { expose } from 'abslink/w3c'

import type { SearchFunction, TorrentSource, NZBorURLSource } from 'hayase-extensions'

export default expose({
  mod: null as unknown as Promise<TorrentSource | NZBorURLSource>,
  construct (code: string) {
    this.mod = this.load(code)
  },

  async load (code: string): Promise<TorrentSource | NZBorURLSource> {
    // WARN: unsafe eval
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
    const module = await import(/* @vite-ignore */url)
    URL.revokeObjectURL(url)
    return module.default
  },

  [finalizer] () {
    console.log('destroyed worker')
  },

  async single (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).single(...args)
  },

  async batch (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).batch(...args)
  },

  async movie (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).movie(...args)
  },

  async query (...args: Parameters<NZBorURLSource['query']>) {
    return await ((await this.mod) as NZBorURLSource).query(...args)
  },

  async test () {
    return await (await this.mod).test()
  }
})
