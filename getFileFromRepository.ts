import { getContentType } from './getContentType.ts'

export function getFileFromRepository(pieces: string[]) {
  return pieces[0] === 'gh'
    ? getFileFromGitHubRepository(pieces)
    : getFileFromGitLabRepository(pieces)
}

type ParseResult = {
  user: string
  repo: string
  tag: string | undefined
}

function parsePieces(pieces: string[]): ParseResult {
  return {
    user: pieces[1],
    repo: pieces[2].split('@')[0],
    tag: pieces[2].split('@')[1]
  }
}

export type FileData = {
    content: string | undefined
    contentType: string | undefined
  }

async function getFileFromGitHubRepository(pieces: string[]): Promise<FileData> {
  if (pieces.length < 4)
    return {
      content: undefined,
      contentType: undefined
    }

  const { user, repo, tag } = parsePieces(pieces)

  , res = await fetch(`https://raw.githubusercontent.com/${user}/${repo}/${tag}/${pieces.slice(3).join('/')}`)

  if (!res.ok)
    return {
      content: undefined,
      contentType: undefined
    }

  const text = await res.text()

  return {
    content: text,
    contentType: getContentType(pieces[pieces.length - 1])
  }
}

async function getFileFromGitLabRepository(pieces: string[]): Promise<FileData> {
  if (pieces.length < 4)
    return {
      content: undefined,
      contentType: undefined
    }

  const { user, repo, tag } = parsePieces(pieces)

  , res = await fetch(`https://gitlab.com/${user}/${repo}/-/raw/${tag}/${pieces.slice(3).join('/')}`)

  if (!res.ok)
    return {
      content: undefined,
      contentType: undefined
    }

  const text = await res.text()

  return {
    content: text,
    contentType: getContentType(pieces[pieces.length - 1])
  }
}
