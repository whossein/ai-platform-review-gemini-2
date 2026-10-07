/**
 * Change-request URL parsing tests.
 *
 * Covers the provider-agnostic `--pr`/`--mr` resolution: GitLab MR URLs and
 * GitHub PR URLs (including Enterprise hosts and subgroup namespaces).
 */

import { describe, it, expect } from "vitest";
import {
  parseGitLabMrUrl,
  parseGitHubPrUrl,
  parseChangeRequestUrl,
  baseUrlFromChangeRequestUrl,
  extractRepositoryIdentity,
  isSameRepository,
  extractMergeRequestNumber,
} from "./url.js";

describe("parseGitLabMrUrl", () => {
  it("parses a self-hosted MR URL with a subgroup namespace", () => {
    const ref = parseGitLabMrUrl(
      "https://git.acme.internal:8443/group/sub/app/-/merge_requests/42",
    );
    expect(ref).toEqual({
      provider: "gitlab",
      projectId: "group/sub/app",
      id: "42",
    });
  });

  it("returns undefined for a non-MR URL", () => {
    expect(
      parseGitLabMrUrl("https://gitlab.com/group/app/-/issues/1"),
    ).toBeUndefined();
  });
});

describe("parseGitHubPrUrl", () => {
  it("parses a github.com PR URL", () => {
    const ref = parseGitHubPrUrl("https://github.com/owner/repo/pull/123");
    expect(ref).toEqual({
      provider: "github",
      projectId: "owner/repo",
      id: "123",
    });
  });

  it("parses a GitHub Enterprise PR URL (any host)", () => {
    const ref = parseGitHubPrUrl(
      "https://github.enterprise.corp/team/service/pull/7/files",
    );
    expect(ref).toEqual({
      provider: "github",
      projectId: "team/service",
      id: "7",
    });
  });

  it("returns undefined for a non-PR URL", () => {
    expect(
      parseGitHubPrUrl("https://github.com/owner/repo/issues/9"),
    ).toBeUndefined();
  });
});

describe("parseChangeRequestUrl", () => {
  it("dispatches GitLab MR URLs to the GitLab parser", () => {
    expect(
      parseChangeRequestUrl("https://gitlab.com/g/p/-/merge_requests/5")
        ?.provider,
    ).toBe("gitlab");
  });

  it("dispatches GitHub PR URLs to the GitHub parser", () => {
    expect(
      parseChangeRequestUrl("https://github.com/o/r/pull/5")?.provider,
    ).toBe("github");
  });

  it("returns undefined for an unrecognized URL", () => {
    expect(
      parseChangeRequestUrl("https://example.com/whatever"),
    ).toBeUndefined();
  });
});

describe("baseUrlFromChangeRequestUrl", () => {
  it("extracts the origin including a non-default port", () => {
    expect(
      baseUrlFromChangeRequestUrl(
        "https://git.acme.internal:8443/g/p/-/merge_requests/1",
      ),
    ).toBe("https://git.acme.internal:8443");
  });
});

describe("extractRepositoryIdentity", () => {
  it("extracts identity from a GitLab MR URL with nested namespace", () => {
    const id = extractRepositoryIdentity(
      "https://gitlab.company.com/frontend/storefront-pwa/-/merge_requests/123",
    );
    expect(id).toBeDefined();
    expect(id?.gitHost).toBe("gitlab.company.com");
    expect(id?.repositoryPath).toBe("frontend/storefront-pwa");
    expect(id?.name).toBe("storefront-pwa");
    expect(id?.namespace).toBe("frontend");
    expect(id?.repositoryUrl).toBe(
      "https://gitlab.company.com/frontend/storefront-pwa",
    );
    expect(id?.identityKey).toBe(
      "gitlab.company.com/frontend/storefront-pwa",
    );
  });

  it("extracts identity from plain repository URL", () => {
    const id = extractRepositoryIdentity(
      "https://gitlab.company.com/frontend/storefront-pwa",
    );
    expect(id).toBeDefined();
    expect(id?.gitHost).toBe("gitlab.company.com");
    expect(id?.repositoryPath).toBe("frontend/storefront-pwa");
    expect(id?.name).toBe("storefront-pwa");
    expect(id?.namespace).toBe("frontend");
  });

  it("normalizes .git suffix, trailing slashes, and query params", () => {
    const id = extractRepositoryIdentity(
      "https://gitlab.company.com/frontend/storefront-pwa.git/?ref=master#section",
    );
    expect(id?.identityKey).toBe(
      "gitlab.company.com/frontend/storefront-pwa",
    );
    expect(id?.name).toBe("storefront-pwa");
  });

  it("extracts identity from a GitHub PR URL", () => {
    const id = extractRepositoryIdentity(
      "https://github.com/facebook/react/pull/456",
    );
    expect(id).toBeDefined();
    expect(id?.gitHost).toBe("github.com");
    expect(id?.repositoryPath).toBe("facebook/react");
    expect(id?.name).toBe("react");
    expect(id?.namespace).toBe("facebook");
  });
});

describe("isSameRepository duplicate prevention", () => {
  it("recognizes repository URL and its MR URL as the same project", () => {
    const same = isSameRepository(
      "https://gitlab.company.com/frontend/storefront-pwa",
      "https://gitlab.company.com/frontend/storefront-pwa/-/merge_requests/123",
    );
    expect(same).toBe(true);
  });

  it("recognizes different hosts with same path as DIFFERENT projects", () => {
    const same = isSameRepository(
      "https://git.company-a.com/team/my-app",
      "https://git.company-b.com/team/my-app",
    );
    expect(same).toBe(false);
  });

  it("recognizes different branches / MRs from same repo as same project", () => {
    const same = isSameRepository(
      "https://gitlab.company.com/frontend/storefront-pwa/-/merge_requests/123",
      "https://gitlab.company.com/frontend/storefront-pwa/-/merge_requests/456",
    );
    expect(same).toBe(true);
  });
});

describe("extractMergeRequestNumber", () => {
  it("extracts MR number from GitLab MR URL", () => {
    expect(
      extractMergeRequestNumber(
        "https://gitlab.company.com/frontend/storefront-pwa/-/merge_requests/123",
      ),
    ).toBe("123");
  });

  it("extracts PR number from GitHub PR URL", () => {
    expect(
      extractMergeRequestNumber("https://github.com/facebook/react/pull/456"),
    ).toBe("456");
  });
});

