import { Octokit } from 'octokit'
import semver from 'semver'
import { DataCache } from './mod.ts'

const gh = new Octokit()

const fetchVersions = async (repo: string): Promise<string[]> => {
  const owner = repo.split('/')[0]
  repo = repo.split('/')[1]

  const releases = await gh.paginate(gh.rest.repos.listReleases, {
    owner,
    repo
  })

  if (releases.length > 0)
    return releases.map(release => release.tag_name)

  const tags = await gh.paginate(gh.rest.repos.listTags, {
    owner,
    repo
  })

  return tags.map(tag => tag.name)
}

export async function getLatestVersion(
  cache: DataCache,
  value: string // gh/user/repo | gl/user/repo
): Promise<string> {
  try {
    const repo = value.slice(3)

    if (value.startsWith('gh')) {
      const cachedVersion = await cache.get(`latest_version:${repo}`)

      if (cachedVersion)
        return cachedVersion

      const versions = await fetchVersions(repo)

      if (versions.length === 0)
        return 'main'

      const sortedVersions = [
        ...semver.rsort(versions.filter(version => semver.valid(version) !== null)),
        ...versions.filter(version => semver.valid(version) === null).sort()
      ]

      const latestVersion = sortedVersions[0]

      await cache.set(`latest_version:${repo}`, latestVersion, 900)

      return latestVersion
    } else {
      return 'main'
    }
  } catch (_err) {
    return 'main'
  }
}
