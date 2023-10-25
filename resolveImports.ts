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
const REGEX =
  /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/g

function resolveImportsInFile(
  str: string,
  importMap: Record<string, string>,
): string {
  try {
    for (const match of str.matchAll(REGEX)) {
      const identifier = match[4]
      const quote = match[5] as '\'' | '"'

      if (importMap[identifier]) {
        str = str.replace(
          `from ${quote}${identifier}${quote}`,
          `from ${quote}${importMap[identifier]}${quote}`,
        )

        continue
      }
    }

    return str
  } catch (_err) {
    return str
  }
}

export async function resolveImports(p: string[], content: string) {
  try {
    const r = await getFileFromRepository([...p.slice(0, 3), 'deno.json'])

    if (!r.content)
      throw ''

    const denoConfig = JSON.parse(r.content)

    if (!denoConfig.imports || !Value.Check(Type.Record(Type.String(), Type.String()), denoConfig.imports))
      throw ''

    const importMap = denoConfig.imports as Record<string, string>
    
    const result = resolveImportsInFile(content, importMap)

    return result
  } catch (err) {
    return content
  }
}
