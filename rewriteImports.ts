const REGEX = /(?:(?<=(?:import|export)[^`'"]*from\s+[`'"])(?<path1>[^`'"]+)(?=(?:'|"|`)))|(?:\b(?:import|export)(?:\s+|\s*\(\s*)[`'"](?<path2>[^`'"]+)[`'"])/g

export function rewriteImports(p: string[], content: string) {
  try {
    const rewriteIdentifier = (str: string) => {
      if (str.startsWith('./'))
        return str.replace('./', `./${p.slice(0, 3).join('/')}/`)

      return str
    }

    content = content.replace(REGEX, (_, identifier) => rewriteIdentifier(identifier))

    return content
  } catch (_err) {
    throw new Error('invalid imports/exports for /' + p.join('/'))
  }
}
