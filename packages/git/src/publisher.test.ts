import { describe, expect, it } from "vitest";
import type {
  AdjudicatedIssue,
  AgentId,
  ChangeRequestRef,
  ContentHash,
  Discussion,
  GitProvider,
  IssueId,
} from "@ai-review/core";
import {
  ReviewPublisher,
  publishReview,
  renderIssueComment,
  renderSummaryComment,
} from "./publisher.js";

const sampleIssue: AdjudicatedIssue = {
  id: "sec-1" as IssueId,
  title: "Hardcoded API secret found",
  description: "A secret API key was found in source code.",
  category: "security",
  severity: "high",
  confidence: 0.95,
  location: { file: "src/auth.ts", line: 42 },
  references: [],
  producedBy: "security-agent" as AgentId,
  fingerprint: "hash-1" as ContentHash,
  reason: "High risk credential leak",
  suggestion: {
    description: "Move API key to environment variables.",
  },
  accepted: true,
  adjudicationReason: "Valid security issue",
  rankScore: 0.95,
};

const cleanIssue: AdjudicatedIssue = {
  id: "info-1" as IssueId,
  title: "Formatting nit",
  description: "Extra whitespace",
  category: "code",
  severity: "info",
  confidence: 0.8,
  location: { file: "src/app.ts", line: 10 },
  references: [],
  producedBy: "code-agent" as AgentId,
  fingerprint: "hash-2" as ContentHash,
  reason: "Style suggestion",
  accepted: true,
  adjudicationReason: "Minor style recommendation",
  rankScore: 0.8,
};

describe("renderIssueComment", () => {
  it("renders expected markdown with emoji, severity, reason and marker", () => {
    const comment = renderIssueComment(sampleIssue);
    expect(comment).toContain("🟠 **HIGH: Hardcoded API secret found**");
    expect(comment).toContain("A secret API key was found in source code.");
    expect(comment).toContain("_Why:_ High risk credential leak");
    expect(comment).toContain("_Suggestion:_ Move API key to environment variables.");
    expect(comment).toContain("security · confidence 95%");
    expect(comment).toContain("<!-- ai-review:issue-comment -->");
  });
});

describe("renderSummaryComment", () => {
  it("renders summary with category breakdown and blocking counts", () => {
    const summary = renderSummaryComment([sampleIssue, cleanIssue]);
    expect(summary).toContain("## 🤖 AI Code Review");
    expect(summary).toContain("Found **2** issue(s) (**1** blocking).");
    expect(summary).toContain("- security: 1");
    expect(summary).toContain("- code: 1");
  });

  it("renders clean message when issue list is empty", () => {
    const summary = renderSummaryComment([]);
    expect(summary).toContain("No issues met the publish threshold.");
  });
});

describe("ReviewPublisher", () => {
  const ref: ChangeRequestRef = {
    provider: "gitlab",
    projectId: "my-group/my-project",
    id: "123",
  };

  it("publishes accepted issues and summary comment", async () => {
    const createdDiscussions: Discussion[] = [];
    let approved = false;

    const mockProvider: GitProvider = {
      kind: "gitlab",
      getChangeRequest: async (r) => ({
        ok: true,
        value: {
          ref: r,
          title: "Feature",
          description: "Desc",
          sourceBranch: "feat",
          targetBranch: "main",
          author: "dev",
          state: "open",
        },
      }),
      getDiff: async () => ({ ok: true, value: "" }),
      listDiscussions: async () => ({ ok: true, value: [] }),
      createDiscussion: async (_ref, body, location) => {
        const disc: Discussion = {
          id: `disc-${createdDiscussions.length}`,
          body,
          ...(location ? { location } : {}),
          resolved: false,
        };
        createdDiscussions.push(disc);
        return { ok: true, value: disc };
      },
      replyDiscussion: async (_ref, discId, body) => ({
        ok: true,
        value: { id: discId, body, resolved: false },
      }),
      resolveDiscussion: async () => ({ ok: true, value: undefined }),
      approve: async () => {
        approved = true;
        return { ok: true, value: undefined };
      },
      getPipelineStatus: async () => ({ ok: true, value: "success" }),
    };

    const publisher = new ReviewPublisher(mockProvider);
    const result = await publisher.publish(ref, [sampleIssue, cleanIssue], {
      approveWhenClean: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.published).toBe(2);
      expect(result.value.blockingCount).toBe(1);
      // Not approved because sampleIssue is high severity (blocking)
      expect(result.value.approved).toBe(false);
      expect(approved).toBe(false);
    }
    // 2 inline discussions + 1 summary discussion
    expect(createdDiscussions).toHaveLength(3);
  });

  it("skips duplicate comments when marker already exists", async () => {
    const createdDiscussions: Discussion[] = [];

    const mockProvider: GitProvider = {
      kind: "gitlab",
      getChangeRequest: async (r) => ({
        ok: true,
        value: {
          ref: r,
          title: "Feature",
          description: "Desc",
          sourceBranch: "feat",
          targetBranch: "main",
          author: "dev",
          state: "open",
        },
      }),
      getDiff: async () => ({ ok: true, value: "" }),
      listDiscussions: async () => ({
        ok: true,
        value: [
          {
            id: "existing-1",
            body: "Previous comment <!-- ai-review:issue-comment -->",
            location: { file: "src/auth.ts", line: 42 },
            resolved: false,
          },
        ],
      }),
      createDiscussion: async (_ref, body, location) => {
        const disc: Discussion = {
          id: `disc-${createdDiscussions.length}`,
          body,
          ...(location ? { location } : {}),
          resolved: false,
        };
        createdDiscussions.push(disc);
        return { ok: true, value: disc };
      },
      replyDiscussion: async (_ref, discId, body) => ({
        ok: true,
        value: { id: discId, body, resolved: false },
      }),
      resolveDiscussion: async () => ({ ok: true, value: undefined }),
      approve: async () => ({ ok: true, value: undefined }),
      getPipelineStatus: async () => ({ ok: true, value: "success" }),
    };

    const publisher = new ReviewPublisher(mockProvider);
    const result = await publisher.publish(ref, [sampleIssue]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.published).toBe(0);
      expect(result.value.skipped).toBe(1);
    }
    // Only summary was created because inline comment was skipped
    expect(createdDiscussions).toHaveLength(1);
  });

  it("approves when clean and approveWhenClean is set", async () => {
    let approved = false;

    const mockProvider: GitProvider = {
      kind: "gitlab",
      getChangeRequest: async (r) => ({
        ok: true,
        value: {
          ref: r,
          title: "Feature",
          description: "Desc",
          sourceBranch: "feat",
          targetBranch: "main",
          author: "dev",
          state: "open",
        },
      }),
      getDiff: async () => ({ ok: true, value: "" }),
      listDiscussions: async () => ({ ok: true, value: [] }),
      createDiscussion: async (_ref, body, location) => ({
        ok: true,
        value: {
          id: "d-1",
          body,
          ...(location ? { location } : {}),
          resolved: false,
        },
      }),
      replyDiscussion: async (_ref, discId, body) => ({
        ok: true,
        value: { id: discId, body, resolved: false },
      }),
      resolveDiscussion: async () => ({ ok: true, value: undefined }),
      approve: async () => {
        approved = true;
        return { ok: true, value: undefined };
      },
      getPipelineStatus: async () => ({ ok: true, value: "success" }),
    };

    const publisher = new ReviewPublisher(mockProvider);
    const result = await publisher.publish(ref, [cleanIssue], {
      approveWhenClean: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.blockingCount).toBe(0);
      expect(result.value.approved).toBe(true);
      expect(approved).toBe(true);
    }
  });
});

describe("publishReview", () => {
  it("returns error for invalid MR URL", async () => {
    const res = await publishReview({
      diffUrl: "https://example.com/not/an/mr",
      issues: [sampleIssue],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("not a recognized Merge Request URL");
    }
  });

  it("returns error when GITLAB_TOKEN is missing", async () => {
    const res = await publishReview({
      diffUrl: "https://gitlab.com/org/repo/-/merge_requests/42",
      issues: [sampleIssue],
      env: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("GITLAB_TOKEN is not configured");
    }
  });

  it("publishes to GitLab MR with mocked fetch", async () => {
    const mockFetch = (async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/discussions")) {
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ id: "disc-1" }),
        };
      }
      return { ok: false, status: 404, text: async () => "Not Found" };
    }) as any;

    const res = await publishReview({
      diffUrl: "https://gitlab.com/org/repo/-/merge_requests/42",
      issues: [sampleIssue],
      env: { GITLAB_TOKEN: "mock-token" },
      fetchImpl: mockFetch,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.published).toBe(1);
    }
  });
});
