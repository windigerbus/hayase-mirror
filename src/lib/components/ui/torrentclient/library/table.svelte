<script lang='ts'>
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSortBy } from 'svelte-headless-table/plugins'

  import Columnheader from '../columnheader.svelte'

  import { MediaCell, NameCell, StatusCell } from './cells'

  import type { LibraryEntry } from 'native'

  import { goto } from '$app/navigation'
  import * as Table from '$lib/components/ui/table'
  import { client } from '$lib/modules/anilist'
  import { server } from '$lib/modules/torrent'
  import { cn, fastPrettyBytes } from '$lib/utils'

  const lib = server.library

  const table = createTable(lib, {
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'mediaID',
      header: 'Series',
      id: 'series',
      plugins: { sort: { getSortValue: e => e ?? 0 } },
      cell: ({ value }) => value ? createRender(MediaCell, { value }) : '?'
    }),
    table.column({
      accessor: 'episode',
      header: 'Episode',
      id: 'episode',
      plugins: { sort: { getSortValue: e => e ?? 0 } },
      cell: ({ value }) => value?.toString() ?? '?'
    }),
    table.column({ accessor: 'files', header: 'Files', id: 'files' }),
    table.column({
      accessor: 'size',
      header: 'Size',
      id: 'size',
      plugins: { sort: { getSortValue: e => e ?? 0 } },
      cell: ({ value }) => value ? fastPrettyBytes(value) : '?'
    }),
    table.column({
      accessor: 'progress',
      header: 'Status',
      id: 'completed',
      plugins: { sort: { getSortValue: e => e ?? 0 } },
      cell: ({ value }) => value ? createRender(StatusCell, { value: value === 1 }) : '?'
    }),
    table.column({
      accessor: 'date',
      header: 'Date',
      id: 'date',
      plugins: { sort: { getSortValue: e => e ?? 0 } },
      cell: ({ value }) => value ? new Date(value).toLocaleDateString() : '?'
    }),
    table.column({
      accessor: e => e?.name ?? e.hash,
      header: 'Torrent Name',
      id: 'name',
      plugins: { sort: { getSortValue: e => e ?? '' } },
      cell: ({ value }) => createRender(NameCell, { value })
    })
  ])

  const tableModel = table.createViewModel(columns)

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs } = tableModel

  async function playEntry ({ mediaID, episode, hash }: LibraryEntry) {
    if (!mediaID || !hash) return
    const media = await client.single(mediaID)
    if (!media.data?.Media) return // TODO: log this?
    server.play(hash, media.data.Media, episode)
    goto('/app/player/')
  }

// TODO once new resolver is implemented
  // $: allIDsPromise = client.multiple($lib.map(e => e.mediaID))
</script>

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
            <Table.Row {...rowAttrs} class={cn('h-14', (row instanceof DataBodyRow) && row.original.mediaID ? 'cursor-pointer' : 'cursor-not-allowed')} on:click={() => { if (row instanceof DataBodyRow) playEntry(row.original) }}>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn('px-4 min-h-14 first:pl-6 last:pr-6 text-nowrap', (cell.id === 'episode') && 'text-muted-foreground', (cell.id === 'series' || cell.id === 'name') && 'min-w-80 text-wrap break-all')}>
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
