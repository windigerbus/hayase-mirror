import Debug from 'debug'
import { writable } from 'simple-store-svelte'
import { get } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import client from '../auth/client'
import { extensions } from '../extensions'
import native from '../native'
import { SUPPORTS } from '../settings'
import { w2globby } from '../w2g/lobby'

import type { Media } from '../anilist'
import type { TorrentFile, TorrentInfo } from 'native'

const debug = Debug('ui:torrent-client')

const defaultTorrentInfo: TorrentInfo = {
  name: '',
  progress: 0,
  size: { total: 0, downloaded: 0, uploaded: 0 },
  speed: { down: 0, up: 0 },
  time: { remaining: 0, elapsed: 0 },
  peers: { seeders: 0, leechers: 0, wires: 0 },
  pieces: { total: 0, size: 0 },
  hash: ''
}

const defaultProtocolStatus = { dht: false, lsd: false, pex: false, nat: false, forwarding: false, persisting: false, streaming: false }

export const server = new class ServerClient {
  last = persisted<{ media: Media, id: string, episode: number } | null>('last-torrent', null)
  active = writable<Promise<{ media: Media, id: string, episode: number, files: TorrentFile[] } | null>>()
  downloaded = writable(this.cachedSet())

  stats = this._timedSafeStore(defaultTorrentInfo, native.torrentInfo, SUPPORTS.isUnderPowered ? 3000 : 200)

  protocol = this._timedSafeStore(defaultProtocolStatus, native.protocolStatus)

  peers = this._timedSafeStore([], native.peerInfo)

  files = this._timedSafeStore([], native.fileInfo)

  library = this._timedSafeStore([], native.library, 120_000)

  _timedSafeStore<T> (defaultData: T, fn: (id: string) => Promise<T>, duration = SUPPORTS.isUnderPowered ? 15000 : 5000) {
    return writable<T>(defaultData, set => {
      let listener = 0

      const update = async () => {
        try {
          const id = (await get(this.active))?.id
          if (id) set(await fn(id))
        } catch (error) {
          console.error(error)
        }
        listener = setTimeout(update, duration)
      }

      update()
      return () => clearTimeout(listener)
    })
  }

  constructor () {
    const last = get(this.last)
    if (last) {
      this.play(last.id, last.media, last.episode)
      debug('restored last torrent', last.id, last.media.title?.userPreferred, last.episode)
    }

    this.stats.subscribe((stats) => {
      native.downloadProgress(stats.progress)
    })
  }

  async updateLibrary () {
    const library = native.library()
    this.downloaded.value = library.then(lib => new Set(lib.map(({ hash }) => hash)))
    this.library.value = await library
  }

  async cachedSet () {
    debug('fetching cached torrents')
    return new Set(await native.cachedTorrents())
  }

  play (id: string, media: Media, episode: number) {
    if (!media || !id) return
    debug('playing torrent', id, media.id, episode)
    this.last.set({ id, media, episode })
    client.setInitialState(media, episode)
    this.active.value = this._play(id, media, episode)
    w2globby.value?.mediaChange({ episode, mediaId: media.id, torrent: id })
    return this.active.value
  }

  async _play (id: string, media: Media, episode: number) {
    const result = { id, media, episode, files: await native.playTorrent(id, media.id, episode) }
    debug('torrent play result', result)
    this.downloaded.value = this.cachedSet()
    this._addNZBs(result.files[0]!.hash)
    return result
  }

  async _addNZBs (hash: string) {
    const nzbs = await extensions.getNZBResultsFromExtensions(hash)

    for (const { nzb, options } of nzbs) {
      try {
        await native.createNZB(hash, nzb, options.domain!, Number(options.port!), options.username!, options.password!, Number(options.poolSize!) || 5)
      } catch (e) {
        toast.error('Failed to add NZB', { description: (e as Error).message })
      }
    }
  }
}()

requestIdleCallback(() => {
  get(server.library)
}, { timeout: 120_000 })
