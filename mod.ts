import { decodeBase64 } from 'https://deno.land/std@0.204.0/encoding/base64.ts'
import * as asciiArt from './asciiArt.ts'
import { FileData, getFileFromRepository } from './getFileFromRepository.ts'
import { getLatestVersion } from './getLatestVersion.ts'
import { isDev } from './isDev.ts'
import { resolveImports } from './resolveImports.ts'

export type DataCache = {
  /**
   * @param maxAge (seconds)
   */
  set: (key: string, value: string, maxAge: number) => Promise<void> | void
  get: (key: string) => Promise<string | undefined> | (string | undefined)
}

export async function createProxy({
  cache,
  domain = 'den.ooo',
  port = Deno.env.get('PORT') ? parseInt(Deno.env.get('PORT') as string) : 3000,
  registries: {
    gh = true,
    gl = true
  } = {},
  features: {
    aliases,
    typesHeader = true,
    importMapResolution = true
  } = {}
}: {
  cache?: DataCache
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

      // just a stupid polyfill which does nothing
      cache ??= {
        set() {},

        get() {
          return undefined
        }
      }

      if (path === 'health' || path === '' && url.searchParams.has('health'))
        return new Response(null)

      if (aliases && path === '' && url.searchParams.has('aliases'))
        return Response.json(aliases, {
          headers: {
            'cache-control': `public, max-age=${300}`,
            'content-type': 'application/json; charset=utf-8'
          }
        })

      if (path === '')
        return new Response(`
          <html>
            <head>
              <meta name="color-scheme" content="dark">

              <style>
                body {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-direction: column;
                  padding: 30px 0;
                }

                pre {
                  margin: 0;
                  margin-top: 10px;
                }

                pre:nth-child(2) {
                  margin-top: 30px;
                }
              </style>
            </head>

            <body>
              <pre>${new TextDecoder().decode(decodeBase64(asciiArt.logo))}</pre><br><br><br>
              <pre>Powered by den.ooo - https://github.com/dendotooo</pre>
            </body>
          </html>
        `, {
          headers: {
            'cache-control': `public, max-age=${300}`,
            'content-type': 'text/html; charset=utf-8'
          }
        })
        
        // return new Response(
        //   center([
        //     ...new TextDecoder().decode(decodeBase64(asciiArt.logo)).split('\n'),
        //     '',
        //     '',
        //     ...new TextDecoder().decode(decodeBase64(asciiArt.name)).split('\n'),
        //     '',
        //     'Powered by den.ooo - Learn more: https://github.com/dendotooo'
        //   ]).join('\n')
        // )

      aliases ??= {}

      let p = path.split('/')

      const notFound = new Response('NOT FOUND', {
        status: 404
      })

      let str = p.join('/')

      if (p[0] === 'gh' || p[0] === 'gl') {
        if (p[0] === 'gh' && !gh || p[0] === 'gl' && !gl)
          return notFound

        if (/^\/(gh|gl)\/[^\/]+\/[^\/]+(@[^\/]+)?(\/[^\/]+)*$/.test(url.pathname) === false)
          return notFound

        if (!p[2].includes('@')) {
          const latest = await getLatestVersion(cache, p.slice(0, 3).join('/'))

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

          p = p.join('/').replace(name, aliases[name]).split('/')

          // return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${p.join('/')}`, 307)
        // includes no version tag
        } else {
          if (!aliases[p[0]])
            return notFound

          const latest = await getLatestVersion(cache, aliases[p[0]])

          p[0] += `@${latest}`

          // const name = p[0].split('@')[0]

          // p = p.join('/').replace(name, aliases[name]).split('/')

          return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${p.join('/')}`, 307)
        }
      }

      let result: FileData

      if (/^.*\.(ts|js|mjs|json|wasm)$/.test(p.join('/')) === false) {
        p.push('mod.ts')

        str = [...str.split('/'), 'mod.ts'].join('/')

        result = await getFileFromRepository(p)

        if (result.content)
          return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${str}`, 307)

        // if (!result.content) {
        //   p[p.length - 1] = 'mod.js'

        //   str = [...str.split('/').slice(0, str.split('/').length - 1), 'mod.js'].join('/')

        //   result = await getFileFromRepository(p)

        //   if (result.content)
        //     return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${str}`, 307)
        // }

        p[p.length - 1] = 'mod.js'

        str = [...str.split('/').slice(0, str.split('/').length - 1), 'mod.js'].join('/')

        // result = await getFileFromRepository(p)

        // if (result.content)
        return Response.redirect(`${isDev ? `http://localhost:${port}` : `https://${domain}`}/${str}`, 307)
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
