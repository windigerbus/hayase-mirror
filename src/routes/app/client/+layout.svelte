<script lang='ts'>
  import { page } from '$app/stores'
  import SettingsNav from '$lib/components/SettingsNav.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import { Globe } from '$lib/components/ui/torrentclient'
  import { dragScroll } from '$lib/modules/navigate'
  import { SUPPORTS } from '$lib/modules/settings'

  const items = [
    {
      title: 'Overview',
      href: '/app/client/'
    },
    {
      title: 'Files',
      href: '/app/client/files/',
      overview: {
        title: 'File List',
        desc: 'Files in the currently active torrent, their download progress, and amount of active stream selections.'
      }
    },
    {
      title: 'Peers',
      href: '/app/client/peers/',
      overview: {
        title: 'Peer List',
        desc: 'Peers connected to the currently active torrent, their statistics, region etc.'
      }
    },
    {
      title: 'Library',
      href: '/app/client/library/',
      overview: {
        title: 'Torrent Library',
        desc: 'All of your downloaded torrents. If Persist Files is enabled then your previously downloaded torrents will show up here.'
      }
    },
    {
      title: 'Settings',
      href: '/app/settings/client/'
    }
  ]

  $: overview = items.find(({ href }) => href === $page.url.pathname)?.overview ?? {
    title: 'Torrent Client',
    desc: 'Monitor your torrents, and configure settings for your torrent client.'
  }
</script>

<div class='p-3 md:p-10 md:pb-0 pb-0 w-full h-full flex flex-col min-w-0'>
  <div class='space-y-0.5'>
    <h2 class='text-2xl font-bold'>{overview.title}</h2>
    <p class='text-muted-foreground'>
      {overview.desc}
    </p>
  </div>
  <Separator class='my-3 md:my-6' />
  <div class='flex flex-col lg:flex-row gap-x-12 grow min-h-0'>
    <aside class='lg:grow lg:max-w-60 flex flex-col'>
      <SettingsNav {items} />
      <div class='mt-auto text-xs text-muted-foreground px-4 sm:px-2 py-3 md:py-5 flex-row lg:flex-col font-light gap-0.5 gap-x-4 flex-wrap hidden sm:flex'>
        <div>WebTorrent v2.8.4</div>
      </div>
    </aside>
    <div class='flex-1' use:dragScroll>
      {#if !SUPPORTS.isUnderPowered}
        <Globe />
      {/if}
      <slot />
    </div>
  </div>
</div>
