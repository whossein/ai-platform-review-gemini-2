import { parseChangeRequestUrl, baseUrlFromChangeRequestUrl } from "./url.js";
import { GitLabProvider } from "./gitlab.js";
import { FetchHttpClient } from "./http.js";

/**
 * Pure function to parse unified diff text into simulated file representations
 * for static rule and deterministic analysis.
 */
export function parseDiffToFiles(
  diffText: string,
): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  const lines = diffText.split("\n");
  let currentFile = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      if (currentFile) {
        files.push({ path: currentFile, text: currentContent.join("\n") });
      }
      currentFile = line.substring(4).replace(/^b\//, "").trim();
      currentContent = [];
    } else if (line.startsWith("@@ ")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match && match[1]) {
        const nextLine = parseInt(match[1], 10);
        while (currentContent.length + 1 < nextLine) {
          currentContent.push("");
        }
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      currentContent.push(line.substring(1));
    } else if (line.startsWith(" ")) {
      currentContent.push(line.substring(1));
    }
  }
  if (currentFile) {
    files.push({ path: currentFile, text: currentContent.join("\n") });
  }
  return files;
}

/**
 * Resolves a diff input string, which can be either a raw unified diff text
 * or a remote GitLab / GitHub change request URL.
 */
export async function resolveDiffInput(
  input: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  const ref = parseChangeRequestUrl(trimmed);
  if (!ref) {
    throw new Error(
      "Unsupported URL format. Please provide a valid GitLab Merge Request or GitHub Pull Request URL.",
    );
  }

  if (ref.provider === "gitlab") {
    const token = env.GITLAB_TOKEN || env.GIT_TOKEN || "";
    const baseUrl =
      env.GITLAB_BASE_URL ||
      baseUrlFromChangeRequestUrl(trimmed) ||
      "https://gitlab.com";
    const provider = new GitLabProvider(new FetchHttpClient(fetchImpl), {
      baseUrl,
      token,
    });
    const diffRes = await provider.getDiff(ref);
    if (!diffRes.ok) {
      throw new Error(
        `Failed to fetch GitLab MR diff: ${diffRes.error.message}${!token ? " (A GITLAB_TOKEN may be required in Settings)" : ""}`,
      );
    }
    let metadataHeader = "";
    try {
      const crRes = await provider.getChangeRequest(ref);
      if (crRes.ok) {
        metadataHeader = `# Merge Request Metadata:\n# Source Branch: ${crRes.value.sourceBranch}\n# Target Branch: ${crRes.value.targetBranch}\n# MR Title: ${crRes.value.title}\n\n`;
      }
    } catch {
      // ignore metadata error
    }
    return metadataHeader + diffRes.value;
  }

  if (ref.provider === "github") {
    const token = env.GITHUB_TOKEN || env.GIT_TOKEN;
    const diffUrl = trimmed.endsWith(".diff")
      ? trimmed
      : `${trimmed.replace(/\/+$/, "")}.diff`;
    const headers: Record<string, string> = {
      "User-Agent": "AI-Review-Platform",
      Accept: "text/plain, application/vnd.github.v3.diff",
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }
    const response = await fetchImpl(diffUrl, { headers });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch GitHub PR diff (HTTP ${response.status})${!token ? " - if private, please configure GITHUB_TOKEN in Settings" : ""}`,
      );
    }
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("The pull request diff is empty.");
    }

    let metadataHeader = "";
    try {
      const apiUrl = `https://api.github.com/repos/${ref.projectId}/pulls/${ref.id}`;
      const apiRes = await fetchImpl(apiUrl, {
        headers: {
          "User-Agent": "AI-Review-Platform",
          Accept: "application/vnd.github.v3+json",
          ...(token ? { Authorization: `token ${token}` } : {}),
        },
      });
      if (apiRes.ok) {
        const prData = (await apiRes.json()) as any;
        metadataHeader = `# Pull Request Metadata:\n# Source Branch: ${prData.head?.ref || ""}\n# Target Branch: ${prData.base?.ref || ""}\n# PR Title: ${prData.title || ""}\n\n`;
      }
    } catch {
      // ignore metadata error
    }

    return metadataHeader + text;
  }

  throw new Error(
    `Provider ${ref.provider} is not supported for fetching diffs.`,
  );
}
