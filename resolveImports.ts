import { Type } from 'typebox'
import { Value } from 'typebox/value'
import { getFileFromRepository } from './getFileFromRepository.ts'

/**
 * $1 = default import name (can be non-existent)\
 * $2 = destructured exports (can be non-existent)\
 * $3 = wildcard import name (can be non-existent)\
 * $4 = module identifier\
 * $5 = quotes used (either ' or ")
 */
// const REGEX =
//   /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/g

const REGEX =
  /(?:(?<=(?:import|export)[^`'"]*from\s+[`'"])(?<path1>[^`'"]+)(?=(?:'|"|`)))|(?:\b(?:import|export)(?:\s+|\s*\(\s*)[`'"](?<path2>[^`'"]+)[`'"])/g

function resolveImportsInFile(
  str: string,
  importMap: Record<string, string>,
): string {
  return str.replace(REGEX, str => {
    if (importMap[str])
      return str.replace(str, importMap[str])

    for (const key in importMap) {
      if (!key.endsWith('/'))
        continue

      if (str.startsWith(key))
        return str.replace(key, importMap[key])
    }

    return str
  })
}

export async function resolveImports(p: string[], content: string) {
  try {
    const r = await getFileFromRepository([...p.slice(0, 3), 'deno.json'])

    if (!r.content)
      throw ''

    const denoConfig = JSON.parse(r.content)

    // @ts-ignore: weird esm.sh issue
    if (!denoConfig.imports || !Value.Check(Type.Record(Type.String(), Type.String()), denoConfig.imports))
      throw ''

    const importMap = denoConfig.imports as Record<string, string>
    
    const result = resolveImportsInFile(content, importMap)

    return result
  } catch (_err) {
    return content
  }
}
