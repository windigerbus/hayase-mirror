import anitomyscript, { type AnitomyResult } from 'anitomyscript'
import { get } from 'svelte/store'

import { dedupeAiring, episodeByAirDate, episodes, isMovie, type Media, getParentForSpecial, isSingleEpisode } from '../anilist'
import { episodes as _episodes } from '../anizip'
import native from '../native'
import { settings, type videoResolutions } from '../settings'

import { storage } from './storage'

import type { EpisodesResponse, Titles } from '../anizip/types'
import type { TorrentResult } from 'hayase-extensions'

import { dev } from '$app/environment'
import { options as extensionOptions, saved } from '$lib/modules/extensions'

const exclusions = ['DTS', 'TrueHD']

const video = document.createElement('video')

if (!dev && !video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')) {
  exclusions.push('HEVC', 'x265', 'H.265')
}
if (!dev && !video.canPlayType('audio/mp4; codecs="ac-3"')) {
  exclusions.push('AC3', 'AC-3')
}
if (!('audioTracks' in HTMLVideoElement.prototype)) {
  exclusions.push('DUAL')
  exclusions.push('MULTI')
}
video.remove()

const debug = console.log

export let fillerEpisodes: Record<number, number[] | undefined> = {}

fetch('https://raw.githubusercontent.com/ThaUnknown/filler-scrape/master/filler.json').then(async res => {
  fillerEpisodes = await res.json()
})

// TODO: these 2 exports need to be moved to a better place
export interface SingleEpisode {
  episode: number
  image?: string
  summary?: string
  rating?: string
  title?: Titles
  length?: number
  airdate?: string
  airingAt?: Date
  filler: boolean
  anidbEid?: number
}

// TODO: https://anilist.co/anime/13055/
export function makeEpisodeList (media: Media, episodesRes?: EpisodesResponse | null) {
  const count = episodes(media) ?? episodesRes?.episodeCount ?? 0
  const alSchedule: Record<number, Date | undefined> = {}

  for (const { a: airingAt, e: episode } of dedupeAiring(media)) {
    alSchedule[episode] = new Date(airingAt * 1000)
  }

  if (!alSchedule[1] && isSingleEpisode(media) && media.startDate) {
    alSchedule[1] = new Date(media.startDate.year ?? 0, (media.startDate.month ?? 1) - 1, media.startDate.day ?? 1)
  }

  const episodeList: SingleEpisode[] = []
  const filtered = { ...episodesRes?.episodes ?? {} }
  const hasSpecial = !!episodesRes?.specialCount
  const hasCountMatch = (episodes(media) ?? 0) === (episodesRes?.episodeCount ?? 0)
  // this code... doesn't scale well into the thousands, it takes almost a second or two to run for one piece
  for (let episode = 1; episode <= count; episode++) {
    const airingAt = alSchedule[episode]

    const hasEpisode = episodesRes?.episodes?.[Number(episode)]

    // If there are special episodes AND (no episode data exists OR episode count doesn't match),
    // then we need to validate by matching episodes with air dates
    const needsValidation = !(!hasSpecial || (hasEpisode && hasCountMatch))
    // handle special cases where anilist reports that 3 episodes aired at the same time because of pre-releases, simply don't allow the same episode to be re-used, but only walk forwards in dates
    // const filtered = Object.fromEntries(Object.entries(episodesRes?.episodes ?? {}).filter(([_, ep]) => !episodeList.some(e => {
    //   if (ep.anidbEid != null && e.anidbEid === ep.anidbEid) return true
    //   if (ep.airdate != null && new Date(ep.airdate) < new Date(e.airdate ?? Date.now())) return true
    //   return false
    // })))

    const resolvedEpisode = (needsValidation ? episodeByAirDate(airingAt, filtered, episode) : episodesRes?.episodes?.[Number(episode)])
    // we want to exclude episodes which were previously consumed
    if (needsValidation && resolvedEpisode) {
      for (const [key, value] of Object.entries(filtered)) {
        if (
          (value.anidbEid != null && value.anidbEid === resolvedEpisode.anidbEid) ||
          (value.airdate != null && new Date(value.airdate) < new Date(resolvedEpisode.airdate ?? Date.now()))
        ) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete filtered[key as keyof typeof filtered]
        }
      }
    }

    const { image, summary, overview, rating, title, length, airdate, anidbEid } = resolvedEpisode ?? {}
    const res = {
      episode, image, summary: summary ?? overview, rating, title, length, airdate, airingAt, filler: !!fillerEpisodes[media.id]?.includes(episode + 1), anidbEid
    }
    episodeList.push(res)
  }
  return episodeList
}

export const extensions = new class Extensions {
  // this is for the most part useless, but some extensions might need it
  createTitles (media: Media) {
    // group and de-duplicate
    const grouped = [...new Set(
      Object.values(media.title ?? {})
        .concat(media.synonyms)
        .filter(name => name != null && name.length > 3) as string[]
    )]
    const titles: string[] = []
    const appendTitle = (title: string) => {
      // replace & with encoded
      // title = title.replace(/&/g, '%26').replace(/\?/g, '%3F').replace(/#/g, '%23')
      titles.push(title)

      // replace Season 2 with S2, else replace 2nd Season with S2, but keep the original title
      const match1 = title.match(/(\d)(?:nd|rd|th) Season/i)
      const match2 = title.match(/Season (\d)/i)

      if (match2) {
        titles.push(title.replace(/Season \d/i, `S${match2[1]}`))
      } else if (match1) {
        titles.push(title.replace(/(\d)(?:nd|rd|th) Season/i, `S${match1[1]}`))
      }
    }
    for (const t of grouped) {
      appendTitle(t)
      if (t.includes('-')) appendTitle(t.replaceAll('-', ''))
    }
    return titles
  }

  async getResultsFromExtensions ({ media, episode, resolution }: { media: Media, episode: number, resolution: keyof typeof videoResolutions }) {
    await storage.modules
    const workers = storage.workers
    if (!Object.values(workers).length) {
      debug('No torrent sources configured')
      throw new Error('No torrent sources configured. Add extensions in settings.')
    }

    const movie = isMovie(media)
    const singleEp = isSingleEpisode(media)

    debug(`Fetching sources for ${media.id}:${media.title?.userPreferred} ${episode} ${movie} ${resolution}`)

    const aniDBMeta = await this.ALToAniDB(media)
    const anidbAid = aniDBMeta?.mappings?.anidb_id
    const anidbEid = anidbAid && (await this.ALtoAniDBEpisode({ media, episode }, aniDBMeta))?.anidbEid
    debug(`AniDB Mapping: ${anidbAid} ${anidbEid}`)

    const options = {
      anilistId: media.id,
      episodeCount: episodes(media) ?? undefined,
      episode,
      anidbAid,
      anidbEid,
      titles: this.createTitles(media),
      resolution,
      exclusions: get(settings).enableExternal ? [] : exclusions
    }

    const results: Array<TorrentResult & { parseObject: AnitomyResult, extension: Set<string> }> = []
    const errors: Array<{ error: Error, extension: string }> = []

    const extopts = get(extensionOptions)
    const configs = get(saved)

    for (const [id, worker] of Object.entries(workers)) {
      if (!extopts[id]!.enabled) continue
      if (configs[id]!.type !== 'torrent') continue
      try {
        const promises: Array<Promise<TorrentResult[]>> = []
        promises.push(worker.single(options))
        if (!singleEp && (movie || media.status === 'FINISHED')) promises.push(movie ? worker.movie(options) : worker.batch(options))

        for (const result of await Promise.allSettled(promises)) {
          if (result.status === 'fulfilled') {
            results.push(...result.value.map(v => ({ ...v, extension: new Set([id]), parseObject: {} as unknown as AnitomyResult })))
          } else {
            console.error(result.reason, id)
            errors.push({ error: result.reason as unknown as Error, extension: id })
          }
        }
      } catch (error) {
        errors.push({ error: error as Error, extension: id })
      }
    }

    if (!navigator.onLine) {
      const library = await native.library()
      const entry = library.find(lib => lib.mediaID === media.id && lib.episode === episode)
      if (entry) {
        results.push({ accuracy: 'high', date: new Date(entry.date), downloads: 0, hash: entry.hash, extension: new Set(['local']), leechers: 0, link: entry.hash, seeders: 0, size: entry.size, title: entry.name ?? entry.hash, type: entry.files > 1 ? 'batch' : undefined, parseObject: {} as unknown as AnitomyResult })
      }
    }

    debug(`Found ${results.length} results`)

    const deduped = this.dedupe(results)

    if (!deduped.length) return { results: [], errors }

    const parseObjects = await anitomyscript(deduped.map(({ title }) => title))
    parseObjects.forEach((parseObject, index) => {
      deduped[index]!.parseObject = parseObject
    })

    return { results: navigator.onLine ? await this.updatePeerCounts(deduped) : deduped, errors }
  }

  async updatePeerCounts <T extends TorrentResult[]> (entries: T): Promise<T> {
    debug(`Updating peer counts for ${entries.length} entries`)

    try {
      const updated = await native.updatePeerCounts(entries.map(({ hash }) => hash))
      debug('Scrape complete')
      for (const { hash, complete, downloaded, incomplete } of updated) {
        const found = entries.find(mapped => mapped.hash === hash)
        if (!found) continue
        found.downloads = Number(downloaded)
        found.leechers = Number(incomplete)
        found.seeders = Number(complete)
      }

      debug(`Found ${updated.length} entries: ${JSON.stringify(updated)}`)
    } catch (err) {
      const error = err as Error
      debug('Failed to scrape\n' + error.stack)
    }
    return entries
  }

  async ALToAniDB (media: Media) {
    const json = await _episodes(media.id)
    if (json?.mappings?.anidb_id) return json

    const parentID = getParentForSpecial(media)
    if (!parentID) return

    return await _episodes(parentID)
  }

  async ALtoAniDBEpisode ({ media, episode }: {media: Media, episode: number}, episodesRes: EpisodesResponse) {
    return makeEpisodeList(media, episodesRes)[episode - 1] ?? undefined
  }

  dedupe <T extends TorrentResult & { extension: Set<string> }> (entries: T[]): T[] {
    const deduped: Record<string, T> = {}
    for (const entry of entries) {
      if (entry.hash in deduped) {
        const dupe = deduped[entry.hash]!
        for (const ext of entry.extension) dupe.extension.add(ext)
        dupe.accuracy = (['high', 'medium', 'low'].indexOf(entry.accuracy) <= ['high', 'medium', 'low'].indexOf(dupe.accuracy)
          ? entry.accuracy
          : dupe.accuracy)
        dupe.title = entry.title.length > dupe.title.length ? entry.title : dupe.title
        dupe.link ??= entry.link
        dupe.id ??= entry.id
        dupe.seeders ||= entry.seeders >= 30000 ? 0 : entry.seeders
        dupe.leechers ||= entry.leechers >= 30000 ? 0 : entry.leechers
        dupe.downloads ||= entry.downloads
        dupe.size ||= entry.size
        dupe.date ||= entry.date
        dupe.type ??= entry.type === 'best' ? 'best' : entry.type === 'alt' ? 'alt' : entry.type
      } else {
        deduped[entry.hash] = entry
      }
    }

    return Object.values(deduped)
  }
}()
