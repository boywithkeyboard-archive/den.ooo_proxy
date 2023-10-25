import { FileData, getFileFromRepository } from './getFileFromRepository.ts'
import { getLatestVersion } from './getLatestVersion.ts'
import { isDev } from './isDev.ts'
import { resolveImports } from './resolveImports.ts'

export async function createProxy({
  // cache,
  domain = 'den.ooo',
  port = Deno.env.get('PORT') ? parseInt(Deno.env.get('PORT') as string) : 3000,
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
  domain?: string
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
    hostname: '0.0.0.0',
    port
  }, async req => {
    try {
      const url = new URL(req.url)
      , path = url.pathname.slice(1)

      if (path === '')
        return new Response('POWERED BY DEN.OOO | LEARN MORE: https://github.com/dendotooo/template')

      if (path === 'health')
        return new Response('OK')

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

          return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${p.join('/')}`, 307)
        }
      } else {
        if (/^\/[^\/]+(@[^\/]+)?(\/[^\/]+)*$/.test(url.pathname) === false)
          return notFound

        // resolve alias
        if (p[0].includes('@')) {
          const name = p[0].split('@')[0]

          if (!aliases[name])
            return notFound

          wasAlias = true

          p = p.join('/').replace(name, aliases[name]).split('/')

          return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${p.join('/')}`, 307)
        // includes no version tag
        } else {
          if (!aliases[p[0]])
            return notFound

          const latest = await getLatestVersion(aliases[p[0]])

          p[0] += `@${latest}`

          const name = p[0].split('@')[0]

          p = p.join('/').replace(name, aliases[name]).split('/')

          return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${p.join('/')}`, 307)
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
            typeFile = `https://${domain}/` + p.join('/')
        } else if (p[p.length - 1].endsWith('.mjs')) {
          p[p.length - 1] = p[p.length - 1].slice(0, p[p.length - 1].length - 4) + '.d.ts'
      
          if ((await getFileFromRepository(p)).content)
            typeFile = `https://${domain}/` + p.join('/')
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

  console.info(`den.ooo is listening on :${port}`)
}
