import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { glob } from 'glob'

const TS_NOCHECK_STRING = '// @ts-nocheck\n\n'

const main = (args: string[]) => {
  /**
   * glob patterns
   */
  const patterns = args[0]!.split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean)

  /**
   * ['path/to/file.ts', 'path/to/file2.ts']
   */
  const files = patterns.flatMap((pattern) =>
    glob.sync(pattern)
  )

  const addTsNoCheck = async (file: string) => {
    const resolvedFilePath = path.resolve(process.cwd(), file)

    const content = fs.readFileSync(resolvedFilePath).toString()

    if (content.includes(TS_NOCHECK_STRING)) {
      console.log(
        JSON.stringify(TS_NOCHECK_STRING),
        'is already in',
        resolvedFilePath
      )
    } else {
      fs.writeFileSync(resolvedFilePath, TS_NOCHECK_STRING + content)
      console.log(
        JSON.stringify(TS_NOCHECK_STRING),
        'added into',
        resolvedFilePath
      )
    }
  }

  Promise.allSettled(files.map(addTsNoCheck)).then((results) => {
    let hasErrors = false

    results.forEach((result) => {
      if (result.status === 'rejected') {
        hasErrors = true
        console.error(result.reason)
      }
    })

    if (hasErrors) {
      process.exit(1)
    }
  })
}

main(process.argv.slice(2))
