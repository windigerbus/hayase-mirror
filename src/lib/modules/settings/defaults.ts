import native from '../native'

import SUPPORTS from './supports'

import type { languageCodes, subtitleResolutions, videoResolutions } from './util'

export default {
  volume: 1,
  playerAutoplay: true,
  playerAutoPiP: false,
  playerPause: true,
  playerAutocomplete: true,
  playerDeband: false,
  subtitleStyle: 'none' as 'none' | 'gandhisans' | 'notosans' | 'roboto',
  searchQuality: '1080' as keyof typeof videoResolutions,
  searchAutoSelect: true,
  lookupPreference: 'quality' as 'quality' | 'size' | 'seeders',
  torrentSpeed: 40,
  torrentPersist: false,
  torrentDHT: false,
  torrentPeX: false,
  torrentPort: 0,
  torrentStreamedDownload: true,
  dhtPort: 0,
  missingFont: true,
  maxConns: 50,
  subtitleRenderHeight: SUPPORTS.isAndroid ? '720' : '0' as keyof typeof subtitleResolutions,
  subtitleLanguage: 'eng' as keyof typeof languageCodes,
  audioLanguage: 'jpn' as keyof typeof languageCodes,
  enableDoH: false,
  hideToTray: false,
  doHURL: 'https://cloudflare-dns.com/dns-query',
  disableSubtitleBlur: SUPPORTS.isAndroid,
  showDetailsInRPC: true,
  torrentPath: '',
  angle: 'default' as 'default' | 'd3d11'| 'd3d9' | 'warp' | 'gl' | 'gles' | 'swiftshader' | 'vulkan' | 'metal',
  idleAnimation: native.defaultTransparency(),
  uiScale: 1,
  enableExternal: false,
  playerPath: '',
  playerSeek: '2',
  playerSkip: false,
  playerSkipFiller: false,
  minimalPlayerUI: false,
  androidStorageType: 'cache'
}
