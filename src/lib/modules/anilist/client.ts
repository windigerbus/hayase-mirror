import { queryStore, type OperationResultState, gql as _gql } from '@urql/svelte'
import Debug from 'debug'
import lavenshtein from 'js-levenshtein'
import { derived, readable, writable, type Writable } from 'svelte/store'

import { Comments, DeleteEntry, DeleteThreadComment, Entry, Following, IDMedia, SaveThreadComment, Schedule, Search, Threads, ToggleFavourite, ToggleLike, UserLists } from './queries'
import urqlClient from './urql-client'
import { currentSeason, currentYear, lastSeason, lastYear, nextSeason, nextYear } from './util'

import type { Media } from './types'
import type { ResultOf, VariablesOf } from 'gql.tada'
import type { AnyVariables, OperationContext, RequestPolicy, TypedDocumentNode } from 'urql'

import { arrayEqual } from '$lib/utils'

const debug = Debug('ui:anilist')

function getDistanceFromTitle (media: Media & {lavenshtein?: number}, name: string) {
  const titles = Object.values(media.title ?? {}).filter(v => v).map(title => lavenshtein(title?.toLowerCase() ?? '', name.toLowerCase()))
  const synonyms = (media.synonyms ?? []).filter(v => v).map(title => lavenshtein(title?.toLowerCase() ?? '', name.toLowerCase()) + 2)
  const distances = [...titles, ...synonyms]
  const min = distances.reduce((prev, curr) => prev < curr ? prev : curr)
  media.lavenshtein = min
  return media as Media & {lavenshtein: number}
}

class AnilistClient {
  client: typeof urqlClient = urqlClient
  constructor () {
    // hacky but prevents query from re-running
    // the debug logging is added after an empty useless subscription, don't delete this subscription!
    this.userlists.subscribe(ids => {
      debug('userlists: ', ids?.data?.MediaListCollection?.lists?.find(list => list?.status === 'CURRENT')?.entries?.map(entry => entry?.media?.id) ?? [])
    })
    this.continueIDs.subscribe(ids => {
      debug('continueIDs: ', ids)
    })
  }

  userlists = derived<typeof this.client.viewer, OperationResultState<ResultOf<typeof UserLists>>>(this.client.viewer, (store, set) => {
    return queryStore({ client: this.client, query: UserLists, variables: { id: store?.viewer?.id }, context: { requestPolicy: 'cache-and-network' } }).subscribe(set)
  })

  // WARN: these 3 sections are hacky, i use oldvalue to prevent re-running loops, I DO NOT KNOW WHY THE LOOPS HAPPEN!
  continueIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(values => {
      debug('continueIDs: checking for IDs')
      if (!values.data?.MediaListCollection?.lists) return
      const mediaList = values.data.MediaListCollection.lists.reduce<NonNullable<NonNullable<NonNullable<NonNullable<ResultOf<typeof UserLists>['MediaListCollection']>['lists']>[0]>['entries']>>((filtered, list) => {
        return (list?.status === 'CURRENT' || list?.status === 'REPEATING') ? filtered.concat(list.entries) : filtered
      }, [])

      const ids = mediaList.filter(entry => {
        if (entry?.media?.status === 'FINISHED') return true
        const progress = entry?.media?.mediaListEntry?.progress ?? 0
        // +2 is for series that don't have the next airing episode scheduled, but are still some-how airing, AL likes to fuck this up a lot, -1 is because we care about the latest aired available episode, not the next aired episode
        return progress < (entry?.media?.nextAiringEpisode?.episode ?? (progress + 2)) - 1
      }).map(entry => entry?.media?.id) as number[]

      debug('continueIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('continueIDs: updated IDs')
      set(ids)
    })
  })

  sequelIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(values => {
      debug('sequelIDs: checking for IDs')
      if (!values.data?.MediaListCollection?.lists) return
      const mediaList = values.data.MediaListCollection.lists.find(list => list?.status === 'COMPLETED')?.entries
      if (!mediaList) return []

      const ids = [...new Set(mediaList.flatMap(entry => {
        return entry?.media?.relations?.edges?.filter(edge => edge?.relationType === 'SEQUEL')
      }).map(edge => edge?.node?.id))] as number[]

      debug('sequelIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('sequelIDs: updated IDs')
      set(ids)
    })
  })

  planningIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(userLists => {
      debug('planningIDs: checking for IDs')
      if (!userLists.data?.MediaListCollection?.lists) return
      const mediaList = userLists.data.MediaListCollection.lists.find(list => list?.status === 'PLANNING')?.entries
      if (!mediaList) return []
      const ids = mediaList.map(entry => entry?.media?.id) as number[]

      debug('planningIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('planningIDs: updated IDs')
      set(ids)
    })
  })

  search (variables: VariablesOf<typeof Search>, pause?: boolean) {
    return queryStore({ client: this.client, query: Search, variables, pause })
  }

  async searchCompound (flattenedTitles: Array<{key: string, title: string, year?: string, isAdult: boolean}>) {
    if (!flattenedTitles.length) return []
    debug('searchCompound: searching for', flattenedTitles)
    // isAdult doesn't need an extra variable, as the title is the same regardless of type, so we re-use the same variable for adult and non-adult requests

    const requestVariables = flattenedTitles.reduce<Record<`v${number}`, string>>((obj, { title, isAdult }, i) => {
      if (isAdult && i !== 0) return obj
      obj[`v${i}`] = title
      return obj
    }, {})

    const queryVariables = flattenedTitles.reduce<string[]>((arr, { isAdult }, i) => {
      if (isAdult && i !== 0) return arr
      arr.push(`$v${i}: String`)
      return arr
    }, []).join(', ')
    const fragmentQueries = flattenedTitles.map(({ year, isAdult }, i) => /* js */`
    v${i}: Page(perPage: 10) {
      media(type: ANIME, search: $v${(isAdult && i !== 0) ? i - 1 : i}, status_in: [RELEASING, FINISHED], isAdult: ${!!isAdult} ${year ? `, seasonYear: ${year}` : ''}) {
        ...med
      }
    }`).join(',')

    const query = _gql/* gql */`
    query(${queryVariables}) {
      ${fragmentQueries}
    }
    
    fragment med on Media {
      id,
      title {
        romaji,
        english,
        native
      },
      synonyms
    }`

    const res = await this.client.query<Record<string, {media: Media[]}>>(query, requestVariables)

    debug('searchCompound: received response', res)

    if (!res.data) return []

    const searchResults: Record<string, number> = {}
    for (const [variableName, { media }] of Object.entries(res.data)) {
      if (!media.length) continue
      const titleObject = flattenedTitles[Number(variableName.slice(1))]!
      if (searchResults[titleObject.key]) continue
      searchResults[titleObject.key] = media.map(media => getDistanceFromTitle(media, titleObject.title)).reduce((prev, curr) => prev.lavenshtein <= curr.lavenshtein ? prev : curr).id
    }

    const ids = Object.values(searchResults)
    debug('searchCompound: found IDs', ids)
    const search = await this.client.query(Search, { ids, perPage: 50 })
    debug('searchCompound: search query result', search)
    if (!search.data?.Page?.media) return []
    return Object.entries(searchResults).map(([filename, id]) => [filename, search.data!.Page!.media!.find(media => media?.id === id)]) as Array<[string, Media | undefined]>
  }

  async malIdsCompound (ids: number[]) {
    if (!ids.length) return {}

    // chunk every 50
    let fragmentQueries = ''

    for (let i = 0; i < ids.length; i += 50) {
      fragmentQueries += /* gql */`
        v${i}: Page(perPage: 50, page: ${Math.floor(i / 50) + 1}) {
          media(idMal_in: $ids, type: ANIME) {
            ...med
          }
        },
      `
    }

    const query = _gql/* gql */`
    query($ids: [Int]) {
      ${fragmentQueries}
    }
    
    fragment med on Media {
      id,
      idMal
    }`

    const res = await this.client.query<Record<string, { media: Array<{ id: number, idMal: number }>}>>(query, { ids })

    return Object.fromEntries(Object.values(res.data ?? {}).flatMap(({ media }) => media).map(media => [media.idMal, media.id]))
  }

  schedule (ids?: number[], onList = true) {
    return queryStore({ client: this.client, query: Schedule, variables: { ids, onList, seasonCurrent: currentSeason, seasonYearCurrent: currentYear, seasonLast: lastSeason, seasonYearLast: lastYear, seasonNext: nextSeason, seasonYearNext: nextYear } })
  }

  async toggleFav (id: number) {
    debug('toggleFav: toggling favourite for ID', id)
    return await this.client.mutation(ToggleFavourite, { id })
  }

  async deleteEntry (media: Media) {
    debug('deleteEntry: deleting entry for media', media)
    if (!media.mediaListEntry?.id) return
    return await this.client.mutation(DeleteEntry, { id: media.mediaListEntry.id })
  }

  async entry (variables: VariablesOf<typeof Entry>) {
    debug('entry: updating entry for media', variables)
    return await this.client.mutation(Entry, variables)
  }

  async single (id: number, requestPolicy: RequestPolicy = 'cache-first') {
    debug('single: fetching media with ID', id)
    return await this.client.query(IDMedia, { id }, { requestPolicy })
  }

  following (animeID: number) {
    debug('following: fetching following for anime with ID', animeID)
    return queryStore({ client: this.client, query: Following, variables: { id: animeID } })
  }

  threads (animeID: number, page = 1) {
    debug('threads: fetching threads for anime with ID', animeID, 'on page', page)
    return queryStore({ client: this.client, query: Threads, variables: { id: animeID, page, perPage: 16 } })
  }

  comments (threadId: number, page = 1) {
    debug('comments: fetching comments for thread with ID', threadId, 'on page', page)
    return queryStore({ client: this.client, query: Comments, variables: { threadId, page } })
  }

  async toggleLike (id: number, type: 'THREAD' | 'THREAD_COMMENT' | 'ACTIVITY' | 'ACTIVITY_REPLY', wasLiked: boolean) {
    debug('toggleLike: toggling like for ID', id, 'type', type, 'wasLiked', wasLiked)
    return await this.client.mutation(ToggleLike, { id, type, wasLiked })
  }

  async comment (variables: VariablesOf<typeof SaveThreadComment> & { rootCommentId?: number }) {
    debug('comment: saving comment for thread', variables)
    return await this.client.mutation(SaveThreadComment, variables)
  }

  async deleteComment (id: number, rootCommentId: number) {
    debug('deleteComment: deleting comment with ID', id, 'rootCommentId', rootCommentId)
    return await this.client.mutation(DeleteThreadComment, { id, rootCommentId })
  }
}

// sveltekit/vite does the funny and evaluates at compile, this is a hack to fix development mode
const client = (typeof indexedDB !== 'undefined' && new AnilistClient()) as AnilistClient

export default client

export function asyncStore<Result, Variables = AnyVariables> (query: TypedDocumentNode<Result, Variables>, variables: AnyVariables, context?: Partial<OperationContext>): Promise<Writable<Result>> {
  return new Promise((resolve, reject) => {
    const store = writable<Result>(undefined, () => () => subscription.unsubscribe())

    const subscription = client.client.query(query, variables, context).subscribe(value => {
      if (value.error) {
        reject(value.error)
      } else if (value.data) {
        store.set(value.data)
        resolve(store)
      }
    })
  })
}
