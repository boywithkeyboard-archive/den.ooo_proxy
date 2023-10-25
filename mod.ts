import { FileData, getFileFromRepository } from './getFileFromRepository.ts'
import { getLatestVersion } from './getLatestVersion.ts'
import { isDev } from './isDev.ts'
import { resolveImports } from './resolveImports.ts'

export async function createProxy({
  // cache,
  port = 3000,
  registries: {
    gh = true,
    gl = true
  } = {},
  features: {
    aliases = {},
    typesHeader = true,
    importMapResolution = true
  } = {}
}: {
  // cache?: {
  //   set: (key: string, value: string) => Promise<void> | void
  //   get: (key: string) => Promise<string | undefined> | (string | undefined)
  // }
  port?: number
  registries?: {
    gh?: boolean
    gl?: boolean
  }
  features?: {
    aliases?: Record<string, string>
    typesHeader?: boolean
    importMapResolution?: boolean
  }
} = {}) {
  await Deno.serve({
    port
  }, async req => {
    try {
      const url = new URL(req.url)
      , path = url.pathname.slice(1)

      let p = path.split('/')

      const notFound = new Response('NOT FOUND', {
        status: 404
      })

      if (p[0] === 'gh' || p[0] === 'gl') {
        if (p[0] === 'gh' && !gh || p[0] === 'gl' && !gl)
          return notFound

        if (/^\/(gh|gl)?\/[^\/]+\/[^\/]+(@[^\/]+)?(\/[^\/]+)*$/.test(url.pathname) === false)
          return notFound

        if (!p[2].includes('@')) {
          const latest = await getLatestVersion(p.slice(0, 3).join('/'))

          p[2] += `@${latest}`

          return Response.redirect(`${isDev ? 'http://localhost:3000' : 'https://den.ooo'}/${p.join('/')}`, 307)
        }
      } else {
        if (/^\/[^\/]+(@[^\/]+)?(\/[^\/]+)*$/.test(url.pathname) === false)
          return notFound

        // resolve alias
        if (p[0].includes('@')) {
          const name = p[0].split('@')[0]

          if (!aliases[name])
            return notFound

          p = p.join('/').replace(name, aliases[name]).split('/')
        // includes no version tag
        } else {
          if (!aliases[p[0]])
            return notFound

          const latest = await getLatestVersion(aliases[p[0]])

          p[0] += `@${latest}`

          return Response.redirect(`${isDev ? 'http://localhost:3000' : 'https://den.ooo'}/${p.join('/')}`, 307)
        }
      }

      let result: FileData

      if (/^.*\.(ts|js|mjs|json|wasm)$/.test(p.join('/')) === false) {
        p.push('mod.ts')

        result = await getFileFromRepository(p)

        if (!result.content) {
          p[p.length - 1] = 'mod.js'

          result = await getFileFromRepository(p)
        }
      } else {
        result = await getFileFromRepository(p)
      }

      let { content, contentType } = result

      if (!content)
        return notFound

      // resolve imports from import map
      if (importMapResolution && /^.*\.(ts|js|mjs)$/.test(p.join('/')))
        content = await resolveImports(p, content)

      let typeFile: string | undefined

      if (
        typesHeader &&
        (url.searchParams.has('dts') || /^Deno\/.+$/.test(req.headers.get('user-agent') ?? ''))
      ) {
        if (p[p.length - 1].endsWith('.js')) {
          p[p.length - 1] = p[p.length - 1].slice(0, p[p.length - 1].length - 3) + '.d.ts'
      
          if ((await getFileFromRepository(p)).content)
            typeFile = 'https://den.ooo/' + p.join('/')
        } else if (p[p.length - 1].endsWith('.mjs')) {
          p[p.length - 1] = p[p.length - 1].slice(0, p[p.length - 1].length - 4) + '.d.ts'
      
          if ((await getFileFromRepository(p)).content)
            typeFile = 'https://den.ooo/' + p.join('/')
        }
      }

      return new Response(content, {
        headers: {
          'cache-control': `public, max-age=${7*86400}`, // a week
          'content-type': `${contentType}; charset=utf-8`,
          ...(typeFile && { 'x-typescript-types': typeFile })
        }
      })
    } catch (_err) {
      return new Response('SOMETHING UNEXPECTED HAPPENED', {
        status: 500
      })
    }
  })
    .finished

  console.info(`den.ooo listening on :${port}`)
}
