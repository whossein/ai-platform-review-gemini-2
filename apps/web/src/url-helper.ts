/**
 * Client-side URL normalization and repository identity parsing.
 * Matches the backend logic in @ai-review/git/url.ts.
 */

export interface ParsedRepoInfo {
  gitHost: string;
  repositoryPath: string;
  name: string;
  namespace: string;
  repositoryUrl: string;
  identityKey: string;
  mrNumber?: string | undefined;
  isMergeRequest: boolean;
}

export function parseRepositoryUrl(input: string): ParsedRepoInfo | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let protocol = "https:";
  let host = "";
  let rawPath = "";

  // Handle SSH format e.g. git@gitlab.com:group/subgroup/project.git
  const sshMatch = /^git@([^:]+):(.+)$/.exec(trimmed);
  if (sshMatch) {
    host = sshMatch[1];
    rawPath = "/" + sshMatch[2];
  } else {
    try {
      const urlToParse = /^[a-zA-Z]+:\/\//.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(urlToParse);
      protocol = parsed.protocol;
      host = parsed.host;
      rawPath = parsed.pathname;
    } catch {
      return null;
    }
  }

  if (!host) return null;

  let cleanPath = rawPath;
  let mrNumber: string | undefined = undefined;

  // Check GitLab MR: /-/merge_requests/123 or /merge_requests/123
  const glMrMatch = /\/(?:-\/)?merge_requests\/(\d+)/.exec(cleanPath);
  if (glMrMatch) {
    mrNumber = glMrMatch[1];
    const markerIndex = cleanPath.indexOf(glMrMatch[0]);
    if (markerIndex !== -1) {
      cleanPath = cleanPath.substring(0, markerIndex);
    }
  }

  // Check GitHub PR: /pull/123 or /pulls
  const ghPrMatch = /\/pull\/(\d+)/.exec(cleanPath);
  if (ghPrMatch) {
    mrNumber = ghPrMatch[1];
    const markerIndex = cleanPath.indexOf(ghPrMatch[0]);
    if (markerIndex !== -1) {
      cleanPath = cleanPath.substring(0, markerIndex);
    }
  } else {
    const ghPullsMatch = cleanPath.search(/\/pulls(?:\/|$)/);
    if (ghPullsMatch !== -1) {
      cleanPath = cleanPath.substring(0, ghPullsMatch);
    }
  }

  // Strip tree/blob subpaths
  const treeMatch = cleanPath.search(/\/(?:-\/)?(?:tree|blob)\//);
  if (treeMatch !== -1) {
    cleanPath = cleanPath.substring(0, treeMatch);
  }

  // Strip commit/commits subpaths
  const commitMatch = cleanPath.search(/\/(?:-\/)?(?:commit|commits)\//);
  if (commitMatch !== -1) {
    cleanPath = cleanPath.substring(0, commitMatch);
  }

  // Strip trailing slashes
  cleanPath = cleanPath.replace(/\/+$/, "");

  // Strip .git extension
  if (cleanPath.toLowerCase().endsWith(".git")) {
    cleanPath = cleanPath.slice(0, -4);
  }

  // Strip leading slashes
  cleanPath = cleanPath.replace(/^\/+/, "");
  if (!cleanPath) return null;

  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const name = segments[segments.length - 1];
  const namespace = segments.slice(0, -1).join("/");
  const gitHost = host.toLowerCase();
  const repositoryPath = cleanPath;
  const canonicalScheme = protocol === "http:" ? "http:" : "https:";
  const repositoryUrl = `${canonicalScheme}//${gitHost}/${repositoryPath}`;
  const identityKey = `${gitHost}/${repositoryPath.toLowerCase()}`;

  return {
    gitHost,
    repositoryPath,
    name,
    namespace,
    repositoryUrl,
    identityKey,
    mrNumber,
    isMergeRequest: Boolean(mrNumber),
  };
}
