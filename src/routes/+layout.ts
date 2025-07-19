import '$lib'

export const ssr = false
export const prerender = false
export const trailingSlash = 'always'

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function <T> () {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })
    return { promise, resolve, reject }
  }
}

if (typeof Object.groupBy === 'undefined') {
  Object.groupBy = <T, K extends string | number | symbol>(arr: T[], callback: (item: T, index: number) => K) => {
    return [...arr].reduce<Partial<Record<K, T[]>>>((acc: Partial<Record<K, T[]>>, currentValue, index) => {
      const key = callback(currentValue, index)
      acc[key] ??= []
      acc[key]!.push(currentValue)
      return acc
    }, {})
  }
}
