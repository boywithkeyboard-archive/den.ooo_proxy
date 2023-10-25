const IMPORTS_REGEX =
  /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ ]*(?:['"])([^'"\n]+)(['"])/g

const EXPORTS_REGEX =
  /export(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*(as[ \n\t]+([^ \n\t\{\}]+))?[ \n\t]+)from[ ]*(?:['"])([^'"\n]+)(['"])/g

export function rewriteImports(p: string[], content: string) {
  try {
    const rewriteIdentifier = (str: string) => {
      if (str.startsWith('./'))
        return str.replace('./', `./${p.slice(0, 3).join('/')}/`)

      return str
    }

    for (const match of content.matchAll(IMPORTS_REGEX)) {
      const identifier = match[4]
      const quote = match[5] as '\'' | '"'
    
      content = content.replace(
        `from ${quote}${identifier}${quote}`,
        `from ${quote}${rewriteIdentifier(identifier)}${quote}`,
      )
    }
    
    for (const match of content.matchAll(EXPORTS_REGEX)) {
      const identifier = match[5]
      const quote = match[6] as '\'' | '"'

      content = content.replace(
        `from ${quote}${identifier}${quote}`,
        `from ${quote}${rewriteIdentifier(identifier)}${quote}`,
      )
    }

    return content
  } catch (_err) {
    throw new Error('invalid imports/exports for /' + p.join('/'))
  }
}
