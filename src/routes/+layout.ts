import '$lib'

export const ssr = false
export const prerender = false
export const trailingSlash = 'always'

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function <T> () {
    let resolve: (value: T | PromiseLike<T>) => void
    let reject: (reason?: unknown) => void
    const promise = new Promise<T>((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })
    return { promise, resolve: resolve!, reject: reject! }
  }
}
