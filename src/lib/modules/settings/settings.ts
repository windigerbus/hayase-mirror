import Debug from 'debug'
import { derived, type Readable } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'

import native from '../native'

import { defaults } from '.'

const _debug = Debug('ui:settings')

export const settings = persisted('settings', defaults, { beforeRead: value => ({ ...defaults, ...value }) })

export const debug = persisted('debug', '')

debug.subscribe((value) => {
  native.debug(value)
  Debug.enable(value)
})

settings.subscribe((value) => {
  _debug('settings changed', value)
})

function derivedDeep<T, U> (store: Readable<T>, fn: (value: T) => U) {
  let previousValue: U

  return derived<Readable<T>, U>(store, (value: T, set) => {
    const newValue = fn(value)

    if (!(JSON.stringify(previousValue) === JSON.stringify(newValue))) {
      previousValue = newValue
      set(newValue)
    }
  })
}

const torrentSettings = derivedDeep(settings, ($settings) => ({
  torrentPersist: $settings.torrentPersist,
  torrentDHT: $settings.torrentDHT,
  torrentStreamedDownload: $settings.torrentStreamedDownload,
  torrentSpeed: $settings.torrentSpeed,
  maxConns: $settings.maxConns,
  torrentPort: $settings.torrentPort,
  dhtPort: $settings.dhtPort,
  torrentPeX: $settings.torrentPeX
}))

const hideToTray = derived(settings, $settings => $settings.hideToTray)
const idleAnimation = derived(settings, $settings => $settings.idleAnimation)
const uiScale = derived(settings, $settings => $settings.uiScale)
const showDetailsInRPC = derived(settings, $settings => $settings.showDetailsInRPC)
const angle = derived(settings, $settings => $settings.angle)

const dohSettings = derivedDeep(settings, $settings => ({
  enableDoH: $settings.enableDoH,
  doHURL: $settings.doHURL
}))

torrentSettings.subscribe(native.updateSettings)
hideToTray.subscribe(native.setHideToTray)
idleAnimation.subscribe(native.transparency)
uiScale.subscribe(native.setZoom)
showDetailsInRPC.subscribe(native.toggleDiscordDetails)
angle.subscribe(native.setAngle)
dohSettings.subscribe(({ enableDoH, doHURL }) => {
  if (enableDoH) native.setDOH(doHURL)
})
