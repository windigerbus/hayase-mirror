import Debug from 'debug'

import type { EpisodesResponse, MappingsResponse } from './types'

import { safefetch } from '$lib/utils'

const debug = Debug('ui:anizip')

// const episodes = safefetch<EpisodesResponse>(`https://hayase.ani.zip/v1/episodes?anilist_id=${params.id}`)
// const mappings = safefetch<MappingsResponse>(fetch, `https://hayase.ani.zip/v1/mappings?anilist_id=${params.id}`)

export async function episodes (id: number, _fetch = fetch) {
  debug('fetching episodes for id', id)
  return await safefetch<EpisodesResponse>(_fetch, `https://hayase.ani.zip/v1/episodes?anilist_id=${id}`)
}

export async function mappings (id: number, _fetch = fetch) {
  debug('fetching mappings for id', id)
  return await safefetch<MappingsResponse>(_fetch, `https://hayase.ani.zip/v1/mappings?anilist_id=${id}`)
}

export async function mappingsByKitsuId (kitsuId: number, _fetch = fetch) {
  debug('fetching mappings for kitsu id', kitsuId)
  return await safefetch<MappingsResponse>(_fetch, `https://hayase.ani.zip/v1/mappings?kitsu_id=${kitsuId}`)
}

export async function mappingsByMalId (malId: number, _fetch = fetch) {
  debug('fetching mappings for mal id', malId)
  return await safefetch<MappingsResponse>(_fetch, `https://hayase.ani.zip/v1/mappings?mal_id=${malId}`)
}
