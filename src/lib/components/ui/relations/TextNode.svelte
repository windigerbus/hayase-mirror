<script lang='ts'>
  import { Handle, Position } from '@xyflow/svelte'

  import { cn } from '$lib/utils'

  export let data: { label: string, id: number, current?: boolean }
  export let id: string
  export let targetPosition: Position = Position.Left
  export let sourcePosition: Position = Position.Right

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  $$restProps
</script>

<a class={cn('node p-2.5 w-[150px] text-xs text-center border bg-[#1e1e1e] rounded-sm cursor-pointer block font-semibold transition-colors', data.current ? 'border-custom text-custom' : 'border-border text-white')} href='/app/anime/{data.id}'>
  <div class='relative'>
    <Handle type='target' position={targetPosition} />
    {data?.label}
    <Handle type='source' position={sourcePosition} />
  </div>
</a>

<style>
  .node {
    --xy-handle-background-color: none;
    --xy-handle-border-color: none;
  }
</style>
