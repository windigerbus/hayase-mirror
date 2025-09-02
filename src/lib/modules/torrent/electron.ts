import { proxy, type Remote } from 'abslink'
import { wrap } from 'abslink/w3c'

import type { Native } from 'native'
import type TorrentClient from 'torrent-client'

const torrent = new Promise<Remote<TorrentClient>>(resolve => {
  window.addEventListener('message', ({ data, ports, source }) => {
    if (data === 'TORRENT_PORT' && ports[0] && source === window) {
      ports[0].start()
      resolve(wrap<TorrentClient>(ports[0]) as unknown as Remote<TorrentClient>)
    }
  })
  // @ts-expect-error custom
  window.sendPort?.()
})

const electronNative: Partial<Native> =
// @ts-expect-error custom
window.sendPort
  ? {
      checkAvailableSpace: async () => await (await torrent).checkAvailableSpace(),
      checkIncomingConnections: async (port) => await (await torrent).checkIncomingConnections(port),
      updatePeerCounts: async (hashes) => await (await torrent).scrape(hashes),
      playTorrent: async (id, mediaID, episode) => await (await torrent).playTorrent(id, mediaID, episode),
      rescanTorrents: async (hashes) => await (await torrent).rescanTorrents(hashes),
      deleteTorrents: async (hashes) => await (await torrent).deleteTorrents(hashes),
      library: async () => await (await torrent).library(),
      attachments: async (hash, id) => await (await torrent).attachments.attachments(hash, id),
      tracks: async (hash, id) => await (await torrent).attachments.tracks(hash, id),
      subtitles: async (hash, id, cb) => await (await torrent).attachments.subtitle(hash, id, proxy(cb)),
      errors: async (cb) => await (await torrent).errors(proxy(cb)),
      chapters: async (hash, id) => await (await torrent).attachments.chapters(hash, id),
      torrentInfo: async (hash) => await (await torrent).torrentInfo(hash),
      peerInfo: async (hash) => await (await torrent).peerInfo(hash),
      fileInfo: async (hash) => await (await torrent).fileInfo(hash),
      protocolStatus: async (hash) => await (await torrent).protocolStatus(hash),
      cachedTorrents: async () => await (await torrent).cached(),
      debug: async (levels) => await (await torrent).debug(levels)
    }
  : {}

export default electronNative
