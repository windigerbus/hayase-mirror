import { readable } from 'simple-store-svelte'
import { derived, get } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'

import { client, episodes, type Media } from '../anilist'

import kitsu from './kitsu'
import local from './local'
import mal from './mal'

import type { Entry, UserFrag } from '../anilist/queries'
import type { ResultOf, VariablesOf } from 'gql.tada'

export default new class AuthAggregator {
  hasAuth = readable(this.checkAuth(), set => {
    // add other subscriptions here for MAL, kitsu, tvdb, etc
    const unsub = [
      client.client.viewer.subscribe(() => set(this.checkAuth())),
      kitsu.viewer.subscribe(() => set(this.checkAuth())),
      mal.viewer.subscribe(() => set(this.checkAuth()))
    ]

    return () => unsub.forEach(fn => fn())
  })

  syncSettings = persisted('syncSettings', { al: true, local: true, kitsu: true, mal: true })
  // AUTH

  anilist () {
    return !!client.client.viewer.value?.viewer?.id
  }

  kitsu () {
    return !!kitsu.id()
  }

  mal () {
    return !!mal.id()
  }

  checkAuth () {
    return this.anilist() || this.kitsu() || this.mal()
  }

  id () {
    if (this.anilist()) return client.client.viewer.value!.viewer?.id
    if (this.kitsu()) return kitsu.id()

    return -1
  }

  profile (): ResultOf<typeof UserFrag> | undefined {
    if (this.anilist()) return client.client.viewer.value?.viewer ?? undefined
    if (this.kitsu()) return kitsu.profile()
    if (this.mal()) return mal.profile()
  }

  mediaListEntry (media: Pick<Media, 'mediaListEntry' | 'id'>) {
    if (this.anilist()) return media.mediaListEntry
    if (this.kitsu()) return kitsu.userlist.value[media.id]
    if (this.mal()) return mal.userlist.value[media.id]

    return local.get(media.id)?.mediaListEntry
  }

  isFavourite (media: Pick<Media, 'isFavourite' | 'id'>) {
    if (this.anilist()) return media.isFavourite
    if (this.kitsu()) return kitsu.isFav(media.id)

    return local.get(media.id)?.isFavourite
  }

  // QUERIES/MUTATIONS

  schedule (onList = true) {
    if (this.anilist()) return client.schedule(undefined, onList)
    if (this.kitsu()) return kitsu.schedule(onList)
    if (this.mal()) return mal.schedule(onList)

    return local.schedule(onList)
  }

  toggleFav (id: number) {
    return Promise.allSettled([
      this.anilist() && client.toggleFav(id),
      this.kitsu() && kitsu.toggleFav(id),
      local.toggleFav(id)
    ])
  }

  following (id: number) {
    if (this.anilist()) return client.following(id)
    if (this.kitsu()) return kitsu.following(id)
    return null
  }

  planningIDs = derived([client.planningIDs, kitsu.planningIDs, local.planningIDs, mal.planningIDs], ([$client, $kitsu, $local, $mal]) => {
    if (this.anilist()) return $client
    if (this.kitsu()) return $kitsu
    if (this.mal()) return $mal
    if ($local.length) return $local
    return null
  })

  continueIDs = derived([client.continueIDs, kitsu.continueIDs, local.continueIDs, mal.continueIDs], ([$client, $kitsu, $local, $mal]) => {
    if (this.anilist()) return $client
    if (this.kitsu()) return $kitsu
    if (this.mal()) return $mal
    if ($local.length) return $local
    return null
  })

  sequelIDs = derived([client.sequelIDs], ([$client]) => {
    if (this.anilist()) return $client
    return null
  })

  async watch (outdated: Media, progress: number) {
    const media = (await client.single(outdated.id)).data?.Media ?? outdated
    // TODO: auto re-watch status
    const totalEps = episodes(media) ?? 1 // episodes or movie which is single episode
    if (totalEps < progress) return // woah, bad data from resolver?!

    const mediaList = this.mediaListEntry(media)

    const currentProgress = mediaList?.progress ?? 0
    if (currentProgress >= progress) return

    // there's an edge case here that episodes returns 1, because anilist doesn't have episode count for an airing show without an expected end date
    // this can set a media to completed when it shouldn't be, so we check if the media is finished or has episodes
    const canBeCompleted = media.status === 'FINISHED' || media.episodes != null

    const status =
      totalEps === progress && canBeCompleted
        ? 'COMPLETED'
        : mediaList?.status === 'REPEATING' ? 'REPEATING' : 'CURRENT'

    const lists = (mediaList?.customLists as Array<{enabled: boolean, name: string}> | undefined)?.filter(({ enabled }) => enabled).map(({ name }) => name) ?? []

    return await this.entry({ id: media.id, progress, status, lists })
  }

  delete (media: Media) {
    const sync = get(this.syncSettings)

    return Promise.allSettled([
      sync.al && this.anilist() && client.deleteEntry(media),
      sync.kitsu && this.kitsu() && kitsu.deleteEntry(media),
      sync.mal && this.mal() && mal.deleteEntry(media),
      sync.local && local.deleteEntry(media)
    ])
  }

  entry (variables: VariablesOf<typeof Entry>) {
    const sync = get(this.syncSettings)
    variables.lists ??= []
    if (!variables.lists.includes('Watched using Hayase')) {
      variables.lists.push('Watched using Hayase')
    }

    return Promise.allSettled([
      sync.al && this.anilist() && client.entry(variables),
      sync.kitsu && this.kitsu() && kitsu.entry(variables),
      sync.mal && this.mal() && mal.entry(variables),
      sync.local && local.entry(variables)
    ])
  }
}()
