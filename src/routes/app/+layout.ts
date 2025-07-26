import { error, redirect } from '@sveltejs/kit'

import { dev } from '$app/environment'
import { SETUP_VERSION } from '$lib'
import { storagePromise } from '$lib/modules/anilist/urql-client'
import native from '$lib/modules/native'
import { outdatedComponent } from '$lib/modules/update'

export async function load () {
  if (!dev && !native.isApp) return error(401, 'How did you get here?')
  if (Number(localStorage.getItem('setup-finished')) < SETUP_VERSION) redirect(307, '/setup')

  if (await outdatedComponent) redirect(307, '/update/')

  // hydrating the cache re-starts all queries, it's better to wait for cache to hydrate, than waste rate limit on requests which are dumped anyways
  // this was previously in anilist/client but it was a top level await, which isn't a great solution, this *should* be better?
  await storagePromise.promise
}
