<script lang='ts' context='module'>
  export interface Checks {
    promise: Promise<{
      status: 'warning' | 'success' | 'error'
      text: string
      slot?: string
    }>
    title: string
    pending: string
  }
</script>

<script lang='ts'>
  import Check from 'lucide-svelte/icons/check'
  import X from 'lucide-svelte/icons/x'

  import { goto } from '$app/navigation'
  import { SETUP_VERSION } from '$lib'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Tooltip from '$lib/components/ui/tooltip'
  export let step = 0
  export let checks: Checks[] = []

  const NEXT = ['network', 'extensions', '../app/home']
  const PREV = ['', 'storage', 'network']

  $: settled = Promise.allSettled(checks.map(({ promise }) => promise))

  function checkNext () {
    if (step === 2) localStorage.setItem('setup-finished', SETUP_VERSION.toString())
    goto(`../${NEXT[step]}`, { replaceState: true })
  }
</script>

<div class='px-6 mt-auto w-full lg:max-w-4xl'>
  <div class='border-x border-t w-full rounded-t-lg bg-neutral-950 p-4 gap-3 flex flex-col'>
    {#each checks as { promise, title, pending } (promise)}
      <div class='flex items-center leading-none text-sm text-nowrap'>
        {#await promise}
          <div class='w-4 h-4 relative animate-spin mr-2.5'>
            <div class='w-4 h-4 border-2 rounded-[50%] border-neutral-700 border-b-border' />
          </div>
          {title} -&nbsp;<span class='text-muted-foreground text-xs text-wrap'>{pending}</span>
        {:then { status, text, slot }}
          <Badge variant={status} class='w-4 h-4 rounded-[50%] p-[3px] justify-center items-center mr-2.5'>
            {#if status === 'success'}
              <Check strokeWidth='4px' />
            {:else if status === 'warning'}
              <svg xmlns='http://www.w3.org/2000/svg' width='2' height='7' viewBox='0 0 2 7' fill='none'>
                <path d='M1 6V3.5' stroke='black' stroke-width='1.5' stroke-linecap='round' />
                <path d='M1.00098 1H1.00848' stroke='black' stroke-width='1.5' stroke-linecap='round' />
              </svg>
            {:else}
              <X strokeWidth='4px' />
            {/if}
          </Badge>
          {title} -&nbsp;<span class='text-muted-foreground text-xs text-wrap flex'>
            {text}
            {#if slot}
              <slot />
            {/if}
          </span>
        {/await}
      </div>
    {/each}
  </div>
</div>
<div class='flex flex-row items-center justify-between w-full bg-neutral-950 border-t md:border md:rounded-lg border-border py-4 px-8'>
  <Button variant='secondary' class='w-24' href='../{PREV[step]}' id='setup-prev-button' data-right='#setup-next-button'>Prev</Button>
  {#await settled}
    <Tooltip.Root>
      <Tooltip.Trigger let:builder>
        <Button builders={[builder]} class='font-semibold !pointer-events-auto cursor-wait' disabled id='setup-next-button' data-left='#setup-prev-button'>Waiting for checks...</Button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>Wait for all checks to settle</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {:then _}
    <Button class='font-semibold w-24' on:click={checkNext} id='setup-next-button' data-left='#setup-prev-button'>Next</Button>
  {/await}
</div>
