<script lang='ts'>
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSelectedRows, addSortBy, addTableFilter } from 'svelte-headless-table/plugins'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'
  import { toast } from 'svelte-sonner'

  import { Button } from '../../button'
  import Columnheader from '../columnheader.svelte'

  import { MediaCell, NameCell, StatusCell, DateCell, CheckboxCell } from './cells'

  import type { LibraryEntry } from 'native'

  import { goto } from '$app/navigation'
  import { FolderSync, Trash } from '$lib/components/icons/animated'
  import { Input } from '$lib/components/ui/input'
  import * as Table from '$lib/components/ui/table'
  import { client } from '$lib/modules/anilist'
  import native from '$lib/modules/native'
  import { server } from '$lib/modules/torrent'
  import { cn, fastPrettyBytes } from '$lib/utils'

  const lib = server.library

  const table = createTable(lib, {
    select: addSelectedRows(),
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] }),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase())
    })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'mediaID',
      header: 'Series',
      id: 'series',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(MediaCell, { value }) : '?'
    }),
    table.column({
      accessor: 'episode',
      header: 'Episode',
      id: 'episode',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value?.toString() ?? '?'
    }),
    table.column({ accessor: 'files', header: 'Files', id: 'files', plugins: { filter: { exclude: true } } }),
    table.column({
      accessor: 'size',
      header: 'Size',
      id: 'size',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? fastPrettyBytes(value) : '?'
    }),
    table.column({
      accessor: 'progress',
      header: 'Status',
      id: 'completed',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(StatusCell, { value: value === 1 }) : '?'
    }),
    table.column({
      accessor: 'date',
      header: 'Date',
      id: 'date',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(DateCell, { value }) : '?'
    }),
    table.column({
      accessor: e => e?.name ?? e.hash,
      header: 'Torrent Name',
      id: 'name',
      plugins: { sort: { getSortValue: e => e ?? '' } },
      cell: ({ value }) => createRender(NameCell, { value })
    }),
    table.display({
      id: 'select',
      header: (_, { pluginStates }) => {
        const { allPageRowsSelected } = pluginStates.select
        return createRender(CheckboxCell, {
          checked: allPageRowsSelected,
          'aria-label': 'Select all'
        })
      },
      cell: ({ row }, { pluginStates }) => {
        const { getRowState } = pluginStates.select
        const { isSelected } = getRowState(row)
        return createRender(CheckboxCell, {
          checked: isSelected,
          'aria-label': 'Select row'
        })
      },
      plugins: {
        sort: {
          disable: true
        }
      }
    })
  ])

  const tableModel = table.createViewModel(columns)

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates } = tableModel

  async function playEntry ({ mediaID, episode, hash }: LibraryEntry) {
    if (!mediaID || !hash) return
    const media = await client.single(mediaID)
    if (!media.data?.Media) return // TODO: log this?
    server.play(hash, media.data.Media, episode)
    goto('/app/player/')
  }

  const { filterValue } = pluginStates.filter
  const { selectedDataIds } = pluginStates.select

  function getSelected () {
    return Object.keys($selectedDataIds).map(id => $lib[id as unknown as number]?.hash).filter(e => e) as string[]
  }

  // TODO: enable
  function rescanTorrents () {
    return null
    // eslint-disable-next-line no-unreachable
    toast.promise(native.rescanTorrents(getSelected()), {
      loading: 'Rescanning torrents...',
      success: 'Rescan complete',
      error: e => {
        console.error(e)
        return 'Failed to rescan torrents\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
      },
      description: 'This may take a long while depending on the number of torrents.'
    })
  }
  function deleteTorrents () {
    return null
    // eslint-disable-next-line no-unreachable
    toast.promise(native.deleteTorrents(getSelected()), {
      loading: 'Deleting torrents...',
      success: 'Torrents deleted',
      error: e => {
        console.error(e)
        return 'Failed to delete torrents\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
      },
      description: 'This may take a while depending on the number of torrents.'
    })
  }

// TODO once new resolver is implemented
  // $: allIDsPromise = client.multiple($lib.map(e => e.mediaID))
</script>

<div class='flex gap-2'>
  <div class='flex items-center scale-parent relative pb-2 overflow-visible grow'>
    <Input
      class='pl-9 bg-black select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50'
      placeholder='Search by Torrent Name...'
      bind:value={$filterValue} />
    <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
  </div>
  <Button variant='secondary' size='icon' class='border-0 animated-icon !pointer-events-auto cursor-not-allowed' disabled on:click={rescanTorrents}>
    <FolderSync class={cn('size-4')} />
  </Button>
  <Button variant='destructive' size='icon' class='border-0 animated-icon !pointer-events-auto cursor-not-allowed' disabled on:click={deleteTorrents}>
    <Trash class={cn('size-4')} />
  </Button>
</div>
<div class='rounded-md border size-full overflow-clip contain-strict'>
  <Table.Root {...$tableAttrs} class='max-h-full'>
    <Table.Header class='px-5'>
      {#each $headerRows as headerRow, i (i)}
        <Subscribe rowAttrs={headerRow.attrs()}>
          <Table.Row class='sticky top-0 bg-black z-[2]'>
            {#each headerRow.cells as cell (cell.id)}
              <Subscribe
                attrs={cell.attrs()}
                props={cell.props()}
                let:attrs
                let:props>
                <Table.Head {...attrs} class={cn('px-0 first:pl-2 h-12 last:pr-2')}>
                  <Columnheader {props}>
                    <Render of={cell.render()} />
                  </Columnheader>
                </Table.Head>
              </Subscribe>
            {/each}
          </Table.Row>
        </Subscribe>
      {/each}
    </Table.Header>
    <Table.Body {...$tableBodyAttrs} class='max-h-full overflow-y-scroll'>
      {#if $pageRows.length}
        {#each $pageRows as row (row.id)}
          <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
            <Table.Row {...rowAttrs} class={cn('h-14 [content-visibility:auto] [contain-intrinsic-height:auto_56px] contain-strict', (row instanceof DataBodyRow) && row.original.mediaID ? 'cursor-pointer' : 'cursor-not-allowed')} on:click={() => { if (row instanceof DataBodyRow) playEntry(row.original) }}>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn(
                    'px-4 min-h-14 first:pl-6 last:pr-6 text-nowrap',
                    (cell.id === 'episode') && 'text-muted-foreground',
                    (cell.id === 'series' || cell.id === 'name') && 'min-w-80 text-wrap break-all',
                    cell.id === 'select' && 'p-0'
                  )}>
                    <Render of={cell.render()} />
                  </Table.Cell>
                </Subscribe>
              {/each}
            </Table.Row>
          </Subscribe>
        {/each}
      {:else}
        <Table.Row>
          <Table.Cell colspan={columns.length} class='h-40 text-center'>
            No torrents downloaded yet.
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
