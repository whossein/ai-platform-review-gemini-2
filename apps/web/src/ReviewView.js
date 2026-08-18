import {
  jsx as _jsx,
  jsxs as _jsxs,
  Fragment as _Fragment,
} from "react/jsx-runtime";
import { useEffect, useState, useRef } from "react";
import {
  FileCode,
  GitPullRequest,
  Archive,
  Folder,
  GitBranch,
} from "lucide-react";
import { requestReview, requestEstimate, checkHealth } from "./api.js";
import { useAppConfig } from "./Settings.js";
const SAMPLE_DIFF = `diff --git a/src/UserList.tsx b/src/UserList.tsx
--- a/src/UserList.tsx
+++ b/src/UserList.tsx
@@ -1,3 +1,12 @@
+const API_KEY = "sk-live-abcdef123456";
+export function UserList({ users }: { users: any }) {
+  console.log("rendering", users);
+  return (
+    <ul>
+      {users.map((u) => <li>{u.name}</li>)}
+    </ul>
+  );
+}
+`;
const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
function IssueCard({ issue }) {
  return _jsxs("li", {
    className: `issue sev-${issue.severity}`,
    "data-accepted": issue.accepted,
    children: [
      _jsxs("div", {
        className: "issue-head",
        children: [
          _jsx("span", {
            className: `badge sev-${issue.severity}`,
            children: issue.severity,
          }),
          _jsx("span", { className: "issue-title", children: issue.title }),
          _jsxs("span", {
            className: "issue-confidence",
            children: [Math.round(issue.confidence * 100), "%"],
          }),
        ],
      }),
      _jsxs("div", {
        className: "issue-loc",
        children: [
          issue.location.file,
          issue.location.line ? `:${issue.location.line}` : "",
          " \u00B7 ",
          issue.category,
        ],
      }),
      _jsx("p", { className: "issue-why", children: issue.reason }),
      issue.suggestion
        ? _jsxs("p", {
            className: "issue-fix",
            children: [
              _jsx("strong", { children: "Suggestion:" }),
              " ",
              issue.suggestion.description,
            ],
          })
        : null,
    ],
  });
}
function buildEnvOverrides(config, language) {
  const envOverrides = {
    AI_REVIEW_LLM_PROVIDER: config.AI_REVIEW_LLM_PROVIDER || "gemini",
    AI_REVIEW_COMMENT_LANGUAGE: language,
  };
  if (config.AI_REVIEW_LLM_API_KEY)
    envOverrides.AI_REVIEW_LLM_API_KEY = config.AI_REVIEW_LLM_API_KEY;
  if (config.AI_REVIEW_LLM_MODEL)
    envOverrides.AI_REVIEW_LLM_MODEL = config.AI_REVIEW_LLM_MODEL;
  if (config.AI_REVIEW_LLM_BASE_URL)
    envOverrides.AI_REVIEW_LLM_BASE_URL = config.AI_REVIEW_LLM_BASE_URL;
  if (config.AI_PROVIDERS && config.AI_PROVIDERS.length > 0) {
    const enabledProviders = config.AI_PROVIDERS.filter(
      (p) => p.enabled !== false,
    );
    envOverrides.AI_PROVIDERS_JSON = JSON.stringify(enabledProviders);
    // Find the currently active provider if AI_REVIEW_LLM_PROVIDER matches an ID or provider name
    const active = config.AI_PROVIDERS.find(
      (p) =>
        p.id === config.AI_REVIEW_LLM_PROVIDER ||
        p.provider === config.AI_REVIEW_LLM_PROVIDER,
    );
    if (active && active.enabled !== false) {
      envOverrides.AI_REVIEW_LLM_PROVIDER = active.provider;
      if (active.apiKey) envOverrides.AI_REVIEW_LLM_API_KEY = active.apiKey;
      if (active.model) envOverrides.AI_REVIEW_LLM_MODEL = active.model;
      if (active.baseUrl) envOverrides.AI_REVIEW_LLM_BASE_URL = active.baseUrl;
      if (active.inputCostPer1M !== undefined)
        envOverrides.AI_REVIEW_INPUT_COST_PER_1M = String(
          active.inputCostPer1M,
        );
      if (active.outputCostPer1M !== undefined)
        envOverrides.AI_REVIEW_OUTPUT_COST_PER_1M = String(
          active.outputCostPer1M,
        );
    } else if (active && active.enabled === false) {
      // If active is disabled, fallback to the first enabled one
      const fallback = enabledProviders[0];
      if (fallback) {
        envOverrides.AI_REVIEW_LLM_PROVIDER = fallback.provider;
        if (fallback.apiKey)
          envOverrides.AI_REVIEW_LLM_API_KEY = fallback.apiKey;
        if (fallback.model) envOverrides.AI_REVIEW_LLM_MODEL = fallback.model;
        if (fallback.baseUrl)
          envOverrides.AI_REVIEW_LLM_BASE_URL = fallback.baseUrl;
        if (fallback.inputCostPer1M !== undefined)
          envOverrides.AI_REVIEW_INPUT_COST_PER_1M = String(
            fallback.inputCostPer1M,
          );
        if (fallback.outputCostPer1M !== undefined)
          envOverrides.AI_REVIEW_OUTPUT_COST_PER_1M = String(
            fallback.outputCostPer1M,
          );
      }
    }
    for (const p of enabledProviders) {
      const prefix = p.provider.toUpperCase();
      if (p.apiKey) envOverrides[`AI_REVIEW_${prefix}_API_KEY`] = p.apiKey;
      if (p.model) envOverrides[`AI_REVIEW_${prefix}_MODEL`] = p.model;
      if (p.baseUrl) envOverrides[`AI_REVIEW_${prefix}_BASE_URL`] = p.baseUrl;
    }
  }
  if (config.GITLAB_TOKEN) envOverrides.GITLAB_TOKEN = config.GITLAB_TOKEN;
  if (config.GITLAB_BASE_URL)
    envOverrides.GITLAB_BASE_URL = config.GITLAB_BASE_URL;
  if (config.GITHUB_TOKEN) envOverrides.GITHUB_TOKEN = config.GITHUB_TOKEN;
  return envOverrides;
}
export function ReviewView() {
  const [inputMode, setInputMode] = useState(
    () => localStorage.getItem("rv_inputMode") || "diff",
  );
  const [diff, setDiff] = useState(
    () => localStorage.getItem("rv_diff") || SAMPLE_DIFF,
  );
  const [prUrl, setPrUrl] = useState(
    () => localStorage.getItem("rv_prUrl") || "",
  );
  const [zipFile, setZipFile] = useState(null);
  const [localPath, setLocalPath] = useState(
    () => localStorage.getItem("rv_localPath") || "",
  );
  const [repoUrl, setRepoUrl] = useState(
    () => localStorage.getItem("rv_repoUrl") || "",
  );
  const [threshold, setThreshold] = useState(() => {
    const t = localStorage.getItem("rv_threshold");
    return t ? parseFloat(t) : 0.6;
  });
  const [result, setResult] = useState(() => {
    const r = localStorage.getItem("rv_result");
    if (r) {
      try {
        return JSON.parse(r);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [estimate, setEstimate] = useState(() => {
    const e = localStorage.getItem("rv_estimate");
    if (e) {
      try {
        return JSON.parse(e);
      } catch (err) {
        return null;
      }
    }
    return null;
  });
  const [selectedAgents, setSelectedAgents] = useState(() => {
    const a = localStorage.getItem("rv_selectedAgents");
    if (a) {
      try {
        return new Set(JSON.parse(a));
      } catch (err) {
        return new Set();
      }
    }
    return new Set();
  });
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState(null);
  const [apiUp, setApiUp] = useState(null);
  const abortControllerRef = useRef(null);
  const [config] = useAppConfig();
  const [reportMode, setReportMode] = useState(
    () => localStorage.getItem("rv_reportMode") || "visual",
  );
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("rv_language") || "en",
  );
  const [prepIssues, setPrepIssues] = useState(() => {
    const p = localStorage.getItem("rv_prepIssues");
    if (p) {
      try {
        return JSON.parse(p);
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  useEffect(() => {
    localStorage.setItem("rv_inputMode", inputMode);
  }, [inputMode]);
  useEffect(() => {
    localStorage.setItem("rv_diff", diff);
  }, [diff]);
  useEffect(() => {
    localStorage.setItem("rv_prUrl", prUrl);
  }, [prUrl]);
  useEffect(() => {
    localStorage.setItem("rv_localPath", localPath);
  }, [localPath]);
  useEffect(() => {
    localStorage.setItem("rv_repoUrl", repoUrl);
  }, [repoUrl]);
  useEffect(() => {
    localStorage.setItem("rv_threshold", threshold.toString());
  }, [threshold]);
  useEffect(() => {
    localStorage.setItem("rv_result", result ? JSON.stringify(result) : "");
  }, [result]);
  useEffect(() => {
    localStorage.setItem(
      "rv_estimate",
      estimate ? JSON.stringify(estimate) : "",
    );
  }, [estimate]);
  useEffect(() => {
    localStorage.setItem(
      "rv_selectedAgents",
      JSON.stringify(Array.from(selectedAgents)),
    );
  }, [selectedAgents]);
  useEffect(() => {
    localStorage.setItem("rv_reportMode", reportMode);
  }, [reportMode]);
  useEffect(() => {
    localStorage.setItem("rv_language", language);
  }, [language]);
  useEffect(() => {
    localStorage.setItem("rv_prepIssues", JSON.stringify(prepIssues));
  }, [prepIssues]);
  // Sync prepIssues when result changes
  useEffect(() => {
    if (result && result.issues) {
      setPrepIssues((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const i of result.issues) {
          if (!next[i.id]) {
            next[i.id] = {
              selected: i.accepted,
              editedReason: i.reason || "",
              editedSuggestion: i.suggestion?.description || "",
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [result]);
  useEffect(() => {
    let interval = null;
    if (loading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);
  const onCancelReview = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setError("Review process cancelled by user.");
  };
  const isInputValid =
    (inputMode === "diff" && diff.trim().length > 0) ||
    (inputMode === "pr" && prUrl.trim().length > 0) ||
    (inputMode === "zip" && zipFile !== null) ||
    (inputMode === "path" && localPath.trim().length > 0) ||
    (inputMode === "repo" && repoUrl.trim().length > 0);
  const canEstimate =
    (inputMode === "diff" && diff.trim().length > 0) ||
    (inputMode === "pr" && prUrl.trim().length > 0);
  // Budget calculations
  const budgetLimit = config.BUDGET_LIMIT
    ? parseFloat(config.BUDGET_LIMIT)
    : null;
  const currentTotalAgents = selectedAgents.size;
  const currentEstimatedCost =
    estimate && estimate.totalAgents > 0
      ? (estimate.estimatedCostUsd / estimate.totalAgents) * currentTotalAgents
      : 0;
  const isOverBudget =
    budgetLimit !== null && currentEstimatedCost > budgetLimit;
  useEffect(() => {
    void checkHealth().then(setApiUp);
  }, []);
  async function onApplyLocal() {
    if (!result || !result.issues || !localPath) return;
    setApplying(true);
    setError(null);
    setApplySuccess(false);
    try {
      const { requestApplyLocal } = await import("./api.js");
      await requestApplyLocal(localPath, result.issues);
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  }
  async function onPublish() {
    if (!result || !result.issues) return;
    setPublishing(true);
    setError(null);
    setPublishSuccess(false);
    let diffToPublish = diff;
    if (inputMode === "pr" && prUrl) diffToPublish = prUrl;
    try {
      const { requestPublish } = await import("./api.js");
      const issuesToPublish = result.issues
        .filter((i) => {
          const p = prepIssues[i.id];
          return p ? p.selected : i.accepted;
        })
        .map((i) => {
          const p = prepIssues[i.id];
          if (!p) return i;
          return {
            ...i,
            reason: p.editedReason,
            ...(i.suggestion
              ? {
                  suggestion: {
                    ...i.suggestion,
                    description: p.editedSuggestion || "",
                  },
                }
              : {}),
            accepted: true,
          };
        });
      await requestPublish(diffToPublish, issuesToPublish, config);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  }
  async function onEstimate() {
    setEstimating(true);
    setError(null);
    setEstimate(null);
    setResult(null);
    let diffToEstimate = diff;
    if (inputMode === "pr") {
      if (!prUrl.trim()) {
        setError("Please enter a valid Merge Request or Pull Request URL.");
        setEstimating(false);
        return;
      }
      diffToEstimate = prUrl.trim();
    } else if (inputMode !== "diff") {
      setError(
        "Estimation is currently supported for Raw Diff and PR/MR URL inputs.",
      );
      setEstimating(false);
      return;
    }
    try {
      const envOverrides = buildEnvOverrides(config, language);
      const res = await requestEstimate(diffToEstimate, envOverrides);
      setEstimate(res);
      setSelectedAgents(new Set(res.agents));
    } catch (e) {
      setError(e instanceof Error ? e.message : "estimation failed");
    } finally {
      setEstimating(false);
    }
  }
  async function onReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    let diffToReview = diff;
    if (inputMode === "pr") {
      if (!prUrl.trim()) {
        setError("Please enter a valid Merge Request or Pull Request URL.");
        setLoading(false);
        return;
      }
      diffToReview = prUrl.trim();
    }
    if (inputMode === "zip") {
      if (!zipFile) {
        setError("Please select a ZIP file to upload.");
        setLoading(false);
        return;
      }
      setError("ZIP file upload is not yet implemented in the backend.");
      setLoading(false);
      return;
    }
    if (inputMode === "path") {
      if (!localPath) {
        setError("Please select a local directory.");
        setLoading(false);
        return;
      }
      setError(
        "Local directory processing is not yet implemented in the backend.",
      );
      setLoading(false);
      return;
    }
    if (inputMode === "repo") {
      if (!repoUrl.trim()) {
        setError("Please enter a valid Git Repository URL.");
        setLoading(false);
        return;
      }
      setError("Git repository cloning is not yet implemented in the backend.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const envOverrides = buildEnvOverrides(config, language);
      const res = await requestReview(
        diffToReview,
        threshold,
        envOverrides,
        Array.from(selectedAgents),
        controller.signal,
      );
      setResult(res);
      try {
        const { saveReviewToHistory } = await import("./history.js");
        let target = "Custom diff snippet";
        // Cast inputMode to any to bypass TS narrowing from earlier early-returns
        const mode = inputMode;
        if (mode === "pr") target = prUrl;
        else if (mode === "path") target = localPath;
        else if (mode === "repo") target = repoUrl;
        else if (mode === "zip") target = zipFile?.name || "ZIP File";
        const usedModel =
          config.AI_REVIEW_LLM_MODEL ||
          config.AI_REVIEW_LLM_PROVIDER ||
          "Unknown Model";
        saveReviewToHistory(mode, target, usedModel, res);
      } catch (e) {
        console.warn("Failed to save to history", e);
      }
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) {
        setError("Review process cancelled.");
      } else {
        setError(e instanceof Error ? e.message : "review failed");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }
  const issues = result
    ? [...result.issues].sort(
        (a, b) =>
          (a.accepted === b.accepted ? 0 : a.accepted ? -1 : 1) ||
          (SEVERITY_ORDER[a.severity] ?? 9) -
            (SEVERITY_ORDER[b.severity] ?? 9) ||
          b.rankScore - a.rankScore,
      )
    : [];
  function generateInlineComments(iss) {
    if (iss.length === 0) return "No issues found to comment on.";
    let output = "";
    const byFile = iss.reduce((acc, issue) => {
      if (!acc[issue.location.file]) acc[issue.location.file] = [];
      acc[issue.location.file].push(issue);
      return acc;
    }, {});
    for (const [file, fileIssues] of Object.entries(byFile)) {
      output += `// ==================================================================\n`;
      output += `// File: ${file}\n`;
      output += `// ==================================================================\n\n`;
      for (const issue of fileIssues) {
        const lineStr = issue.location.line
          ? `Line ${issue.location.line}`
          : "Global Context";
        const prefix =
          issue.severity === "critical" || issue.severity === "high"
            ? "FIXME"
            : "TODO";
        output += `// ${prefix} [${issue.severity.toUpperCase()}] at ${lineStr}:\n`;
        output += `// ${issue.title} - ${issue.reason}\n`;
        if (issue.suggestion) {
          output += `// Suggestion: ${issue.suggestion.description}\n`;
        }
        output += `\n`;
      }
    }
    return output;
  }
  return _jsxs("div", {
    className: "review-view",
    style: { maxWidth: "1100px", margin: "0 auto" },
    children: [
      _jsxs("header", {
        className: "view-header",
        style: { marginBottom: "1.5rem" },
        children: [
          _jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: "1rem" },
            children: [
              _jsx("h1", {
                style: { margin: 0, fontSize: "1.5rem" },
                children: "Code Review",
              }),
              _jsx("span", {
                className: `api-status ${apiUp ? "up" : "down"}`,
                children:
                  apiUp == null
                    ? "checking API…"
                    : apiUp
                      ? "API online"
                      : "API offline",
              }),
              config.AI_REVIEW_LLM_PROVIDER === "mock" &&
                _jsx("span", {
                  style: {
                    background: "var(--accent)",
                    color: "white",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  },
                  children: "TEST MODE (MOCK)",
                }),
            ],
          }),
          _jsx("p", {
            className: "tagline",
            style: { marginTop: "0.5rem" },
            children:
              "Start a review by providing a diff or a Merge Request URL.",
          }),
        ],
      }),
      _jsxs("div", {
        className: "settings-card",
        style: {
          background: "var(--panel)",
          padding: "1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          marginBottom: "1.5rem",
        },
        children: [
          _jsxs("div", {
            className: "radio-cards-grid",
            children: [
              _jsxs("label", {
                className: `radio-card ${inputMode === "diff" ? "active" : ""}`,
                onClick: () => setInputMode("diff"),
                children: [
                  _jsx("input", {
                    type: "radio",
                    name: "inputMode",
                    value: "diff",
                    checked: inputMode === "diff",
                    onChange: () => setInputMode("diff"),
                  }),
                  _jsx("div", {
                    className: "radio-indicator",
                    children: _jsx("div", { className: "radio-indicator-dot" }),
                  }),
                  _jsxs("div", {
                    className: "radio-card-content",
                    children: [
                      _jsx("span", {
                        className: "radio-card-icon",
                        children: _jsx(FileCode, { size: 16 }),
                      }),
                      _jsx("span", { children: "Raw Diff" }),
                    ],
                  }),
                ],
              }),
              _jsxs("label", {
                className: `radio-card ${inputMode === "pr" ? "active" : ""}`,
                onClick: () => setInputMode("pr"),
                children: [
                  _jsx("input", {
                    type: "radio",
                    name: "inputMode",
                    value: "pr",
                    checked: inputMode === "pr",
                    onChange: () => setInputMode("pr"),
                  }),
                  _jsx("div", {
                    className: "radio-indicator",
                    children: _jsx("div", { className: "radio-indicator-dot" }),
                  }),
                  _jsxs("div", {
                    className: "radio-card-content",
                    children: [
                      _jsx("span", {
                        className: "radio-card-icon",
                        children: _jsx(GitPullRequest, { size: 16 }),
                      }),
                      _jsx("span", { children: "Merge Request URL" }),
                    ],
                  }),
                ],
              }),
              _jsxs("label", {
                className: `radio-card ${inputMode === "zip" ? "active" : ""}`,
                onClick: () => setInputMode("zip"),
                children: [
                  _jsx("input", {
                    type: "radio",
                    name: "inputMode",
                    value: "zip",
                    checked: inputMode === "zip",
                    onChange: () => setInputMode("zip"),
                  }),
                  _jsx("div", {
                    className: "radio-indicator",
                    children: _jsx("div", { className: "radio-indicator-dot" }),
                  }),
                  _jsxs("div", {
                    className: "radio-card-content",
                    children: [
                      _jsx("span", {
                        className: "radio-card-icon",
                        children: _jsx(Archive, { size: 16 }),
                      }),
                      _jsx("span", { children: "ZIP File" }),
                    ],
                  }),
                ],
              }),
              _jsxs("label", {
                className: `radio-card ${inputMode === "path" ? "active" : ""}`,
                onClick: () => setInputMode("path"),
                children: [
                  _jsx("input", {
                    type: "radio",
                    name: "inputMode",
                    value: "path",
                    checked: inputMode === "path",
                    onChange: () => setInputMode("path"),
                  }),
                  _jsx("div", {
                    className: "radio-indicator",
                    children: _jsx("div", { className: "radio-indicator-dot" }),
                  }),
                  _jsxs("div", {
                    className: "radio-card-content",
                    children: [
                      _jsx("span", {
                        className: "radio-card-icon",
                        children: _jsx(Folder, { size: 16 }),
                      }),
                      _jsx("span", { children: "Local Path" }),
                    ],
                  }),
                ],
              }),
              _jsxs("label", {
                className: `radio-card ${inputMode === "repo" ? "active" : ""}`,
                onClick: () => setInputMode("repo"),
                children: [
                  _jsx("input", {
                    type: "radio",
                    name: "inputMode",
                    value: "repo",
                    checked: inputMode === "repo",
                    onChange: () => setInputMode("repo"),
                  }),
                  _jsx("div", {
                    className: "radio-indicator",
                    children: _jsx("div", { className: "radio-indicator-dot" }),
                  }),
                  _jsxs("div", {
                    className: "radio-card-content",
                    children: [
                      _jsx("span", {
                        className: "radio-card-icon",
                        children: _jsx(GitBranch, { size: 16 }),
                      }),
                      _jsx("span", { children: "Git Repository" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          inputMode === "diff" &&
            _jsxs("div", {
              className: "form-group",
              style: { marginBottom: "1.25rem" },
              children: [
                _jsx("label", { children: "Unified Diff Content" }),
                _jsx("textarea", {
                  value: diff,
                  onChange: (e) => setDiff(e.target.value),
                  spellCheck: false,
                  rows: 12,
                  placeholder: "Paste a unified diff here\u2026",
                  style: {
                    width: "100%",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  },
                }),
              ],
            }),
          inputMode === "pr" &&
            _jsxs("div", {
              className: "form-group",
              style: { marginBottom: "1.25rem" },
              children: [
                _jsx("label", { children: "Merge Request / Pull Request URL" }),
                _jsx("input", {
                  type: "url",
                  value: prUrl,
                  onChange: (e) => setPrUrl(e.target.value),
                  placeholder:
                    "https://github.com/org/repo/pull/123 or GitLab MR url",
                  style: {
                    width: "100%",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                  },
                }),
              ],
            }),
          inputMode === "zip" &&
            _jsxs("div", {
              className: "form-group",
              style: { marginBottom: "1.25rem" },
              children: [
                _jsx("label", { children: "Source Code Archive (.zip)" }),
                _jsx("input", {
                  type: "file",
                  accept: ".zip",
                  onChange: (e) => setZipFile(e.target.files?.[0] || null),
                  style: {
                    width: "100%",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px dashed var(--border)",
                    borderRadius: "6px",
                    padding: "2rem 1rem",
                    textAlign: "center",
                    cursor: "pointer",
                  },
                }),
                zipFile &&
                  _jsxs("p", {
                    style: {
                      marginTop: "0.5rem",
                      fontSize: "0.85rem",
                      color: "var(--low)",
                    },
                    children: ["Selected: ", zipFile.name],
                  }),
              ],
            }),
          inputMode === "path" &&
            _jsxs("div", {
              className: "form-group",
              style: { marginBottom: "1.25rem" },
              children: [
                _jsx("label", { children: "Select Local Directory" }),
                _jsxs("div", {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  },
                  children: [
                    _jsx("input", {
                      type: "file",
                      // @ts-ignore - webkitdirectory is non-standard but widely supported
                      webkitdirectory: "",
                      directory: "",
                      multiple: true,
                      onChange: (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setLocalPath(
                            `Selected ${e.target.files.length} files from directory`,
                          );
                        } else {
                          setLocalPath("");
                        }
                      },
                      style: {
                        width: "100%",
                        background: "var(--bg)",
                        color: "var(--text)",
                        border: "1px dashed var(--border)",
                        borderRadius: "6px",
                        padding: "2rem 1rem",
                        textAlign: "center",
                        cursor: "pointer",
                      },
                    }),
                    localPath &&
                      _jsx("p", {
                        style: {
                          margin: 0,
                          fontSize: "0.85rem",
                          color: "var(--low)",
                        },
                        children: localPath,
                      }),
                  ],
                }),
                _jsx("p", {
                  style: {
                    marginTop: "0.5rem",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                  },
                  children:
                    "Note: The browser will ask for permission to read the directory.",
                }),
              ],
            }),
          inputMode === "repo" &&
            _jsxs("div", {
              className: "form-group",
              style: { marginBottom: "1.25rem" },
              children: [
                _jsx("label", { children: "Git Repository URL" }),
                _jsx("input", {
                  type: "url",
                  value: repoUrl,
                  onChange: (e) => setRepoUrl(e.target.value),
                  placeholder: "https://github.com/org/repo.git",
                  style: {
                    width: "100%",
                    background: "var(--bg)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                  },
                }),
              ],
            }),
          _jsxs("div", {
            className: "controls",
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "1rem",
              marginTop: "1rem",
            },
            children: [
              _jsxs("div", {
                className: "form-group",
                style: { flex: 1, maxWidth: "200px", margin: 0 },
                children: [
                  _jsxs("label", {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    },
                    children: [
                      _jsx("span", { children: "Confidence Threshold" }),
                      _jsx("strong", { children: threshold.toFixed(2) }),
                    ],
                  }),
                  _jsx("input", {
                    type: "range",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: threshold,
                    onChange: (e) => setThreshold(Number(e.target.value)),
                    style: { width: "100%", accentColor: "var(--accent)" },
                  }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                style: { flex: 1, maxWidth: "200px", margin: 0 },
                children: [
                  _jsx("label", {
                    style: { display: "block", marginBottom: "0.5rem" },
                    children: "Comment Language",
                  }),
                  _jsxs("select", {
                    value: language,
                    onChange: (e) => setLanguage(e.target.value),
                    style: {
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text)",
                    },
                    children: [
                      _jsx("option", {
                        value: "en",
                        children: "English (Default)",
                      }),
                      _jsx("option", {
                        value: "fa",
                        children: "Persian (\u0641\u0627\u0631\u0633\u06CC)",
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs("div", {
                style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
                children: [
                  !estimate
                    ? _jsx("button", {
                        onClick: () => void onEstimate(),
                        disabled: estimating || loading || !canEstimate,
                        className: "secondary-button",
                        style: {
                          minWidth: "150px",
                          background: "var(--panel)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                        },
                        children: estimating
                          ? "Analyzing..."
                          : "Run Pre-Review & Estimate",
                      })
                    : _jsx("button", {
                        onClick: () => void onEstimate(),
                        disabled: estimating || loading || !canEstimate,
                        className: "secondary-button",
                        style: {
                          minWidth: "130px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                        },
                        children: estimating ? "Recalculating…" : "Re-Estimate",
                      }),
                  _jsx("button", {
                    onClick: () => void onReview(),
                    disabled:
                      loading || estimating || isOverBudget || !isInputValid,
                    style: {
                      minWidth: "150px",
                      opacity: isOverBudget ? 0.5 : 1,
                      cursor: isOverBudget ? "not-allowed" : undefined,
                    },
                    title: isOverBudget
                      ? "Estimated cost exceeds your budget limit"
                      : undefined,
                    children: loading ? "Reviewing…" : "Start AI Code Review",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      loading &&
        _jsxs("div", {
          style: {
            background: "var(--panel)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.12)",
            position: "relative",
            overflow: "hidden",
          },
          children: [
            _jsx("div", {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background:
                  "linear-gradient(90deg, var(--accent) 0%, #a855f7 50%, var(--accent) 100%)",
                backgroundSize: "200% 100%",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              },
            }),
            _jsxs("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1.25rem",
              },
              children: [
                _jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  },
                  children: [
                    _jsx("div", {
                      style: {
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        background: "rgba(99, 102, 241, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                        fontSize: "1.2rem",
                      },
                      children: "\u26A1",
                    }),
                    _jsxs("div", {
                      children: [
                        _jsx("h3", {
                          style: {
                            margin: 0,
                            fontSize: "1.05rem",
                            color: "var(--text)",
                            fontWeight: 600,
                          },
                          children:
                            "AI Review In Progress / \u0641\u0631\u0622\u06CC\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u0641\u0639\u0627\u0644 \u0627\u0633\u062A",
                        }),
                        _jsx("p", {
                          style: {
                            margin: "0.2rem 0 0 0",
                            fontSize: "0.82rem",
                            color: "var(--muted)",
                          },
                          children:
                            "Deep multi-agent code analysis running without timeout",
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  },
                  children: [
                    _jsxs("div", {
                      style: {
                        background: "rgba(99, 102, 241, 0.1)",
                        border: "1px solid rgba(99, 102, 241, 0.25)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontFamily: "monospace",
                      },
                      children: [
                        "\u23F1 ",
                        Math.floor(elapsedSeconds / 60),
                        ":",
                        (elapsedSeconds % 60).toString().padStart(2, "0"),
                        "s",
                      ],
                    }),
                    _jsx("button", {
                      type: "button",
                      onClick: onCancelReview,
                      className: "secondary-button",
                      style: {
                        padding: "0.4rem 0.85rem",
                        fontSize: "0.8rem",
                        color: "var(--high)",
                        borderColor: "rgba(239, 68, 68, 0.3)",
                      },
                      children: "\u0644\u063A\u0648 (Cancel)",
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              },
              children: [
                _jsxs("div", {
                  style: {
                    background:
                      elapsedSeconds >= 0
                        ? "rgba(99, 102, 241, 0.08)"
                        : "var(--bg)",
                    border: `1px solid ${elapsedSeconds < 4 ? "var(--accent)" : "rgba(99, 102, 241, 0.3)"}`,
                    borderRadius: "8px",
                    padding: "0.75rem",
                  },
                  children: [
                    _jsx("div", {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "0.25rem",
                      },
                      children: "Phase 1",
                    }),
                    _jsx("div", {
                      style: {
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: "var(--text)",
                      },
                      children:
                        elapsedSeconds < 4
                          ? "🔄 Ingesting & Slicing Context"
                          : "✓ Context Slice Prepared",
                    }),
                  ],
                }),
                _jsxs("div", {
                  style: {
                    background:
                      elapsedSeconds >= 4
                        ? "rgba(99, 102, 241, 0.08)"
                        : "var(--bg)",
                    border: `1px solid ${elapsedSeconds >= 4 && elapsedSeconds < 10 ? "var(--accent)" : "rgba(99, 102, 241, 0.3)"}`,
                    borderRadius: "8px",
                    padding: "0.75rem",
                  },
                  children: [
                    _jsx("div", {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "0.25rem",
                      },
                      children: "Phase 2",
                    }),
                    _jsx("div", {
                      style: {
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: "var(--text)",
                      },
                      children:
                        elapsedSeconds < 4
                          ? "⏳ Static Analysis Pending"
                          : elapsedSeconds < 10
                            ? "🔄 Static Rules & Routing"
                            : "✓ Static Rules & Routing Done",
                    }),
                  ],
                }),
                _jsxs("div", {
                  style: {
                    background:
                      elapsedSeconds >= 10
                        ? "rgba(99, 102, 241, 0.08)"
                        : "var(--bg)",
                    border: `1px solid ${elapsedSeconds >= 10 && elapsedSeconds < 45 ? "var(--accent)" : "rgba(99, 102, 241, 0.3)"}`,
                    borderRadius: "8px",
                    padding: "0.75rem",
                  },
                  children: [
                    _jsx("div", {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "0.25rem",
                      },
                      children: "Phase 3",
                    }),
                    _jsx("div", {
                      style: {
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: "var(--text)",
                      },
                      children:
                        elapsedSeconds < 10
                          ? "⏳ Specialist Reviewers"
                          : elapsedSeconds < 45
                            ? "🧠 Parallel AI Agents Thinking..."
                            : "✓ Agent Analysis Complete",
                    }),
                  ],
                }),
                _jsxs("div", {
                  style: {
                    background:
                      elapsedSeconds >= 45
                        ? "rgba(99, 102, 241, 0.08)"
                        : "var(--bg)",
                    border: `1px solid ${elapsedSeconds >= 45 ? "var(--accent)" : "rgba(99, 102, 241, 0.2)"}`,
                    borderRadius: "8px",
                    padding: "0.75rem",
                  },
                  children: [
                    _jsx("div", {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "0.25rem",
                      },
                      children: "Phase 4",
                    }),
                    _jsx("div", {
                      style: {
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: "var(--text)",
                      },
                      children:
                        elapsedSeconds < 45
                          ? "⏳ Critic & Adjudication"
                          : "⚖️ Adjudicating & Rendering Report...",
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              style: {
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                fontSize: "0.82rem",
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              },
              children: [
                _jsx("span", {
                  style: { fontSize: "1rem" },
                  children: "\uD83D\uDEE1\uFE0F",
                }),
                _jsx("span", {
                  children:
                    "\u0627\u0631\u062A\u0628\u0627\u0637 \u0632\u0646\u062F\u0647 \u0627\u0633\u062A: \u0628\u0647 \u062F\u0644\u06CC\u0644 \u067E\u0631\u062F\u0627\u0632\u0634 \u0686\u0646\u062F\u0639\u0627\u0645\u0644\u06CC \u0648 \u062A\u062D\u0644\u06CC\u0644 \u062F\u0642\u06CC\u0642 \u06A9\u062F\u060C \u0627\u06CC\u0646 \u0641\u0631\u0622\u06CC\u0646\u062F \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u0628\u06CC\u0646 \u06F3\u06F0 \u062A\u0627 \u06F9\u06F0 \u062B\u0627\u0646\u06CC\u0647 \u0632\u0645\u0627\u0646 \u0628\u0628\u0631\u062F. \u0633\u06CC\u0633\u062A\u0645 \u0628\u0627 \u062A\u0627\u06CC\u0645\u200C\u0627\u0648\u062A \u06F1\u06F0 \u062F\u0642\u06CC\u0642\u0647\u200C\u0627\u06CC \u0648 \u0633\u0642\u0641 \u0645\u0646\u0627\u0628\u0639 \u0628\u0627\u0632 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0634\u062F\u0647 \u0648 \u0642\u0637\u0639 \u0646\u062E\u0648\u0627\u0647\u062F \u0634\u062F.",
                }),
              ],
            }),
          ],
        }),
      estimate &&
        _jsxs("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            marginBottom: "1.5rem",
          },
          children: [
            estimate.deterministicIssues &&
              estimate.deterministicIssues.length > 0 &&
              _jsxs("div", {
                style: {
                  background: "rgba(255, 171, 0, 0.05)",
                  border: "1px solid rgba(255, 171, 0, 0.3)",
                  padding: "1.25rem",
                  borderRadius: "12px",
                },
                children: [
                  _jsx("h3", {
                    style: {
                      margin: "0 0 1rem 0",
                      fontSize: "1.1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "#eab308",
                    },
                    children: "Pre-Review Findings (Static Analysis)",
                  }),
                  _jsx("p", {
                    style: {
                      fontSize: "0.85rem",
                      color: "var(--text)",
                      marginBottom: "1rem",
                    },
                    children:
                      "These issues were found instantly without using AI tokens.",
                  }),
                  _jsx("ul", {
                    className: "issue-list",
                    style: { marginTop: 0 },
                    children: estimate.deterministicIssues.map((issue) =>
                      _jsx(IssueCard, { issue: issue }, issue.id),
                    ),
                  }),
                ],
              }),
            _jsxs("div", {
              style: {
                background: "rgba(47, 129, 247, 0.05)",
                border: "1px solid rgba(47, 129, 247, 0.2)",
                padding: "1.25rem",
                borderRadius: "12px",
              },
              children: [
                _jsx("h3", {
                  style: {
                    margin: "0 0 1rem 0",
                    fontSize: "1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--text)",
                  },
                  children: "AI Review Estimation",
                }),
                (() => {
                  const inputTokensPerAgent =
                    estimate.totalAgents > 0 && estimate.estimatedInputTokens
                      ? estimate.estimatedInputTokens / estimate.totalAgents
                      : estimate.totalAgents > 0
                        ? estimate.estimatedTokens / estimate.totalAgents
                        : 0;
                  const outputTokensPerAgent =
                    estimate.totalAgents > 0 && estimate.estimatedOutputTokens
                      ? estimate.estimatedOutputTokens / estimate.totalAgents
                      : 1000;
                  const currentInputTokens = Math.round(
                    inputTokensPerAgent * currentTotalAgents,
                  );
                  const currentOutputTokens = Math.round(
                    outputTokensPerAgent * currentTotalAgents,
                  );
                  const allAgents = Array.from(
                    new Set([...estimate.agents, ...estimate.skipped]),
                  ).sort();
                  const inputRate =
                    estimate.inputCostPer1M !== undefined
                      ? `$${estimate.inputCostPer1M}`
                      : "$0.15";
                  const outputRate =
                    estimate.outputCostPer1M !== undefined
                      ? `$${estimate.outputCostPer1M}`
                      : "$0.60";
                  return _jsxs(_Fragment, {
                    children: [
                      _jsxs("div", {
                        style: {
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "1rem",
                          marginBottom: "1rem",
                        },
                        children: [
                          _jsxs("div", {
                            children: [
                              _jsx("div", {
                                style: {
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  marginBottom: "0.25rem",
                                },
                                children: "Agents Active",
                              }),
                              _jsx("div", {
                                style: {
                                  fontSize: "1.25rem",
                                  fontWeight: 600,
                                  color: "var(--text)",
                                },
                                children: currentTotalAgents,
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            children: [
                              _jsx("div", {
                                style: {
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  marginBottom: "0.25rem",
                                },
                                children: "Est. Input Tokens",
                              }),
                              _jsx("div", {
                                style: {
                                  fontSize: "1.25rem",
                                  fontWeight: 600,
                                  color: "var(--text)",
                                },
                                children: currentInputTokens.toLocaleString(),
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            children: [
                              _jsx("div", {
                                style: {
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  marginBottom: "0.25rem",
                                },
                                children: "Est. Output Tokens",
                              }),
                              _jsx("div", {
                                style: {
                                  fontSize: "1.25rem",
                                  fontWeight: 600,
                                  color: "var(--text)",
                                },
                                children: currentOutputTokens.toLocaleString(),
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            children: [
                              _jsx("div", {
                                style: {
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  marginBottom: "0.25rem",
                                },
                                children: "Rate / 1M Tokens",
                              }),
                              _jsx("div", {
                                style: {
                                  fontSize: "0.95rem",
                                  fontWeight: 600,
                                  color: "var(--text)",
                                  marginTop: "0.25rem",
                                },
                                children:
                                  config.AI_REVIEW_LLM_PROVIDER === "ollama"
                                    ? "Free (Local)"
                                    : `${inputRate} in / ${outputRate} out`,
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            children: [
                              _jsx("div", {
                                style: {
                                  fontSize: "0.8rem",
                                  color: "var(--muted)",
                                  marginBottom: "0.25rem",
                                },
                                children: "Est. Cost (USD)",
                              }),
                              _jsxs("div", {
                                style: {
                                  fontSize: "1.25rem",
                                  fontWeight: 600,
                                  color: isOverBudget
                                    ? "#f87171"
                                    : "var(--low)",
                                },
                                children: [
                                  "~$",
                                  currentEstimatedCost.toFixed(5),
                                  isOverBudget &&
                                    _jsxs("span", {
                                      style: {
                                        fontSize: "0.75rem",
                                        marginLeft: "0.5rem",
                                        color: "#f87171",
                                        fontWeight: "normal",
                                      },
                                      children: [
                                        "(Exceeds limit of $",
                                        budgetLimit?.toFixed(2),
                                        ")",
                                      ],
                                    }),
                                ],
                              }),
                            ],
                          }),
                          budgetLimit !== null &&
                            _jsxs("div", {
                              children: [
                                _jsx("div", {
                                  style: {
                                    fontSize: "0.8rem",
                                    color: "var(--muted)",
                                    marginBottom: "0.25rem",
                                  },
                                  children: "Max Budget",
                                }),
                                _jsxs("div", {
                                  style: {
                                    fontSize: "1.25rem",
                                    fontWeight: 600,
                                    color: "var(--text)",
                                  },
                                  children: ["$", budgetLimit.toFixed(2)],
                                }),
                              ],
                            }),
                        ],
                      }),
                      _jsxs("div", {
                        style: { fontSize: "0.85rem", marginTop: "1rem" },
                        children: [
                          _jsx("div", {
                            style: {
                              color: "var(--muted)",
                              marginBottom: "0.75rem",
                              fontWeight: 600,
                            },
                            children: "Select Specialists for Review:",
                          }),
                          _jsx("div", {
                            style: {
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fill, minmax(210px, 1fr))",
                              gap: "0.5rem",
                            },
                            children: allAgents.map((a) => {
                              const isChecked = selectedAgents.has(a);
                              return _jsxs(
                                "label",
                                {
                                  className: `agent-checkbox-pill ${isChecked ? "active" : ""}`,
                                  children: [
                                    _jsx("input", {
                                      type: "checkbox",
                                      checked: isChecked,
                                      onChange: () => {
                                        setSelectedAgents((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(a)) next.delete(a);
                                          else next.add(a);
                                          return next;
                                        });
                                      },
                                      style: {
                                        accentColor: "var(--accent)",
                                        cursor: "pointer",
                                      },
                                    }),
                                    _jsx("span", {
                                      style: {
                                        fontSize: "0.8rem",
                                        wordBreak: "break-all",
                                      },
                                      children: a,
                                    }),
                                  ],
                                },
                                a,
                              );
                            }),
                          }),
                        ],
                      }),
                    ],
                  });
                })(),
              ],
            }),
          ],
        }),
      error
        ? _jsxs("div", {
            className: "error",
            style: { marginBottom: "1.5rem" },
            children: ["\u26A0 ", error],
          })
        : null,
      result
        ? _jsxs("section", {
            className: "results",
            dir: language === "fa" ? "rtl" : "ltr",
            style: { textAlign: language === "fa" ? "right" : "left" },
            children: [
              _jsxs("div", {
                className: "summary",
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1.5rem",
                  flexWrap: "wrap",
                  gap: "1rem",
                  flexDirection: language === "fa" ? "row-reverse" : "row",
                },
                children: [
                  _jsxs("div", {
                    dir: "ltr",
                    children: [
                      _jsx("strong", { children: result.accepted }),
                      " accepted / ",
                      result.total,
                      " total findings",
                    ],
                  }),
                  _jsxs("div", {
                    style: {
                      display: "flex",
                      gap: "0.5rem",
                      background: "var(--panel)",
                      padding: "0.25rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    },
                    children: [
                      _jsx("button", {
                        onClick: () => setReportMode("visual"),
                        style: {
                          background:
                            reportMode === "visual"
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            reportMode === "visual" ? "white" : "var(--text)",
                          border: "none",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: reportMode === "visual" ? 600 : 400,
                        },
                        children: "Snippet Report",
                      }),
                      _jsx("button", {
                        onClick: () => setReportMode("markdown"),
                        style: {
                          background:
                            reportMode === "markdown"
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            reportMode === "markdown" ? "white" : "var(--text)",
                          border: "none",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: reportMode === "markdown" ? 600 : 400,
                        },
                        children: "PR Comment (MD)",
                      }),
                      _jsx("button", {
                        onClick: () => setReportMode("inline"),
                        style: {
                          background:
                            reportMode === "inline"
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            reportMode === "inline" ? "white" : "var(--text)",
                          border: "none",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: reportMode === "inline" ? 600 : 400,
                        },
                        children: "Inline Comments",
                      }),
                      _jsx("button", {
                        onClick: () => setReportMode("publish"),
                        style: {
                          background:
                            reportMode === "publish"
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            reportMode === "publish" ? "white" : "var(--text)",
                          border: "none",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: reportMode === "publish" ? 600 : 400,
                        },
                        children: "Review & Publish",
                      }),
                      _jsx("button", {
                        onClick: () => setReportMode("json"),
                        style: {
                          background:
                            reportMode === "json"
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            reportMode === "json" ? "white" : "var(--text)",
                          border: "none",
                          padding: "0.4rem 0.75rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: reportMode === "json" ? 600 : 400,
                        },
                        children: "JSON (CI/CD)",
                      }),
                    ],
                  }),
                ],
              }),
              reportMode === "visual" &&
                (issues.length === 0
                  ? _jsx("p", { className: "empty", children: "No findings." })
                  : _jsx("ul", {
                      className: "issues",
                      children: issues.map((issue) =>
                        _jsx(IssueCard, { issue: issue }, issue.id),
                      ),
                    })),
              reportMode === "markdown" &&
                _jsxs("div", {
                  children: [
                    _jsx("div", {
                      style: {
                        background: "var(--panel)",
                        padding: "1.25rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        overflowX: "auto",
                        marginBottom: "1rem",
                      },
                      children: _jsx("pre", {
                        style: {
                          margin: 0,
                          fontSize: "0.85rem",
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          color: "var(--text)",
                        },
                        children: result.markdown,
                      }),
                    }),
                    _jsxs("div", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      },
                      children: [
                        _jsx("button", {
                          onClick: onPublish,
                          disabled: publishing || inputMode !== "pr",
                          style: {
                            padding: "0.75rem 1.5rem",
                            background:
                              inputMode !== "pr"
                                ? "var(--border)"
                                : "var(--accent)",
                            color:
                              inputMode !== "pr" ? "var(--muted)" : "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor:
                              inputMode !== "pr" ? "not-allowed" : "pointer",
                          },
                          children: publishing
                            ? "Publishing..."
                            : "Publish to Merge Request",
                        }),
                        inputMode !== "pr" &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--muted)",
                            },
                            children:
                              "You must use a Merge Request URL to publish directly.",
                          }),
                        publishSuccess &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--low)",
                              fontWeight: 600,
                            },
                            children: "\u2713 Published Successfully!",
                          }),
                      ],
                    }),
                  ],
                }),
              reportMode === "inline" &&
                _jsxs("div", {
                  children: [
                    _jsxs("div", {
                      style: {
                        background: "var(--panel)",
                        padding: "1.25rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        overflowX: "auto",
                        marginBottom: "1rem",
                      },
                      children: [
                        _jsx("p", {
                          style: {
                            marginTop: 0,
                            marginBottom: "1rem",
                            fontSize: "0.85rem",
                            color: "var(--muted)",
                          },
                          children:
                            "Pseudo-code snippet representation of findings with inline comments. You can copy these to fix your code.",
                        }),
                        _jsx("pre", {
                          style: {
                            margin: 0,
                            fontSize: "0.85rem",
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            color: "var(--accent)",
                          },
                          children: generateInlineComments(
                            issues.filter((i) => i.accepted),
                          ),
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      },
                      children: [
                        _jsx("button", {
                          onClick: onPublish,
                          disabled: publishing || inputMode !== "pr",
                          style: {
                            padding: "0.75rem 1.5rem",
                            background:
                              inputMode !== "pr"
                                ? "var(--border)"
                                : "var(--accent)",
                            color:
                              inputMode !== "pr" ? "var(--muted)" : "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor:
                              inputMode !== "pr" ? "not-allowed" : "pointer",
                          },
                          children: publishing
                            ? "Publishing..."
                            : "Publish to Merge Request",
                        }),
                        _jsx("button", {
                          onClick: onApplyLocal,
                          disabled: applying || inputMode !== "path",
                          style: {
                            padding: "0.75rem 1.5rem",
                            background:
                              inputMode !== "path"
                                ? "var(--border)"
                                : "var(--low)",
                            color:
                              inputMode !== "path" ? "var(--muted)" : "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor:
                              inputMode !== "path" ? "not-allowed" : "pointer",
                          },
                          children: applying
                            ? "Applying..."
                            : "Apply to Local Files",
                        }),
                        inputMode !== "pr" &&
                          inputMode !== "path" &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--muted)",
                            },
                            children:
                              "Requires MR URL or Local Path input mode.",
                          }),
                        publishSuccess &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--low)",
                              fontWeight: 600,
                            },
                            children: "\u2713 Published Successfully!",
                          }),
                        applySuccess &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--low)",
                              fontWeight: 600,
                            },
                            children: "\u2713 Applied to Local Files!",
                          }),
                      ],
                    }),
                  ],
                }),
              reportMode === "publish" &&
                _jsxs("div", {
                  children: [
                    _jsx("p", {
                      style: {
                        marginTop: 0,
                        marginBottom: "1.5rem",
                        color: "var(--muted)",
                        fontSize: "0.9rem",
                      },
                      children:
                        "Review and edit comments before publishing them to your Merge Request. Uncheck items to skip them.",
                    }),
                    _jsx("div", {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                        marginBottom: "2rem",
                      },
                      children: result.issues
                        .filter((i) => prepIssues[i.id] !== undefined)
                        .map((issue) => {
                          const prep = prepIssues[issue.id];
                          return _jsx(
                            "div",
                            {
                              style: {
                                background: "var(--panel)",
                                border: `1px solid ${prep.selected ? "var(--accent)" : "var(--border)"}`,
                                borderRadius: "8px",
                                padding: "1rem",
                                opacity: prep.selected ? 1 : 0.6,
                                transition: "all 0.2s",
                              },
                              children: _jsxs("div", {
                                style: {
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "1rem",
                                },
                                children: [
                                  _jsx("input", {
                                    type: "checkbox",
                                    checked: prep.selected,
                                    onChange: (e) =>
                                      setPrepIssues((prev) => ({
                                        ...prev,
                                        [issue.id]: {
                                          ...prev[issue.id],
                                          selected: e.target.checked,
                                        },
                                      })),
                                    style: {
                                      marginTop: "0.25rem",
                                      width: "18px",
                                      height: "18px",
                                      cursor: "pointer",
                                    },
                                  }),
                                  _jsxs("div", {
                                    style: { flex: 1 },
                                    children: [
                                      _jsxs("div", {
                                        style: {
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.5rem",
                                          marginBottom: "0.5rem",
                                          flexWrap: "wrap",
                                        },
                                        children: [
                                          _jsx("span", {
                                            style: {
                                              fontWeight: 600,
                                              color: "var(--text)",
                                            },
                                            children: issue.title,
                                          }),
                                          _jsx("span", {
                                            style: {
                                              fontSize: "0.75rem",
                                              background: "var(--surface)",
                                              padding: "0.1rem 0.4rem",
                                              borderRadius: "4px",
                                            },
                                            children: issue.category,
                                          }),
                                          _jsx("span", {
                                            style: {
                                              fontSize: "0.75rem",
                                              background: "var(--surface)",
                                              padding: "0.1rem 0.4rem",
                                              borderRadius: "4px",
                                              color:
                                                issue.severity === "critical"
                                                  ? "#ef4444"
                                                  : "inherit",
                                            },
                                            children: issue.severity,
                                          }),
                                        ],
                                      }),
                                      _jsx("label", {
                                        style: {
                                          display: "block",
                                          fontSize: "0.85rem",
                                          fontWeight: 600,
                                          marginBottom: "0.25rem",
                                          color: "var(--muted)",
                                        },
                                        children: "Reason / Comment",
                                      }),
                                      _jsx("textarea", {
                                        value: prep.editedReason,
                                        onChange: (e) =>
                                          setPrepIssues((prev) => ({
                                            ...prev,
                                            [issue.id]: {
                                              ...prev[issue.id],
                                              editedReason: e.target.value,
                                            },
                                          })),
                                        style: {
                                          width: "100%",
                                          background: "var(--surface)",
                                          border: "1px solid var(--border)",
                                          color: "var(--text)",
                                          padding: "0.75rem",
                                          borderRadius: "6px",
                                          minHeight: "80px",
                                          fontFamily: "inherit",
                                          resize: "vertical",
                                          marginBottom: "1rem",
                                        },
                                      }),
                                      issue.suggestion &&
                                        _jsxs(_Fragment, {
                                          children: [
                                            _jsx("label", {
                                              style: {
                                                display: "block",
                                                fontSize: "0.85rem",
                                                fontWeight: 600,
                                                marginBottom: "0.25rem",
                                                color: "var(--muted)",
                                              },
                                              children:
                                                "Suggestion Description",
                                            }),
                                            _jsx("textarea", {
                                              value: prep.editedSuggestion,
                                              onChange: (e) =>
                                                setPrepIssues((prev) => ({
                                                  ...prev,
                                                  [issue.id]: {
                                                    ...prev[issue.id],
                                                    editedSuggestion:
                                                      e.target.value,
                                                  },
                                                })),
                                              style: {
                                                width: "100%",
                                                background: "var(--surface)",
                                                border:
                                                  "1px solid var(--border)",
                                                color: "var(--text)",
                                                padding: "0.75rem",
                                                borderRadius: "6px",
                                                minHeight: "60px",
                                                fontFamily: "inherit",
                                                resize: "vertical",
                                                marginBottom: "0.5rem",
                                              },
                                            }),
                                          ],
                                        }),
                                      issue.suggestion?.patch &&
                                        _jsx("div", {
                                          style: {
                                            background: "#1e1e1e",
                                            color: "#d4d4d4",
                                            padding: "1rem",
                                            borderRadius: "6px",
                                            fontSize: "0.85rem",
                                            fontFamily: "monospace",
                                            overflowX: "auto",
                                            marginTop: "0.5rem",
                                          },
                                          children: _jsx("pre", {
                                            style: { margin: 0 },
                                            children: issue.suggestion.patch,
                                          }),
                                        }),
                                    ],
                                  }),
                                ],
                              }),
                            },
                            issue.id,
                          );
                        }),
                    }),
                    _jsxs("div", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      },
                      children: [
                        _jsx("button", {
                          onClick: onPublish,
                          disabled: publishing || inputMode !== "pr",
                          style: {
                            padding: "0.75rem 1.5rem",
                            background:
                              inputMode !== "pr"
                                ? "var(--border)"
                                : "var(--accent)",
                            color:
                              inputMode !== "pr" ? "var(--muted)" : "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor:
                              inputMode !== "pr" ? "not-allowed" : "pointer",
                          },
                          children: publishing
                            ? "Publishing..."
                            : "Confirm & Publish Selected",
                        }),
                        inputMode !== "pr" &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--muted)",
                            },
                            children:
                              "You must use a Merge Request URL to publish.",
                          }),
                        publishSuccess &&
                          _jsx("span", {
                            style: {
                              fontSize: "0.85rem",
                              color: "var(--low)",
                              fontWeight: 600,
                            },
                            children: "\u2713 Published Successfully!",
                          }),
                      ],
                    }),
                  ],
                }),
              reportMode === "json" &&
                _jsx("div", {
                  style: {
                    background: "var(--panel)",
                    padding: "1.25rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    overflowX: "auto",
                  },
                  children: _jsx("pre", {
                    style: {
                      margin: 0,
                      fontSize: "0.85rem",
                      fontFamily: "monospace",
                      whiteSpace: "pre-wrap",
                      color: "var(--text)",
                    },
                    children: JSON.stringify(result.json, null, 2),
                  }),
                }),
            ],
          })
        : null,
    ],
  });
}
