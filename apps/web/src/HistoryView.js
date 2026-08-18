import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import {
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  History,
  Cpu,
  Zap,
} from "lucide-react";
import { getHistory, clearHistory, deleteHistoryItem } from "./history.js";
function IssueItem({ issue }) {
  return _jsxs("div", {
    style: {
      padding: "0.75rem",
      background: "var(--bg)",
      borderRadius: "6px",
      border: "1px solid var(--border)",
      marginBottom: "0.5rem",
    },
    children: [
      _jsxs("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        },
        children: [
          _jsxs("strong", {
            style: { display: "flex", alignItems: "center", gap: "0.5rem" },
            children: [
              issue.severity === "critical"
                ? "🔴"
                : issue.severity === "high"
                  ? "🟠"
                  : issue.severity === "medium"
                    ? "🟡"
                    : issue.severity === "low"
                      ? "🔵"
                      : "⚪",
              issue.title,
            ],
          }),
          _jsxs("span", {
            style: {
              fontSize: "0.8rem",
              color: "var(--muted)",
              background: "var(--panel)",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
            },
            children: [issue.location.file, ":", issue.location.line ?? "*"],
          }),
        ],
      }),
      _jsx("p", {
        style: {
          margin: "0 0 0.5rem 0",
          fontSize: "0.9rem",
          color: "var(--text)",
        },
        children: issue.description,
      }),
      issue.suggestion &&
        _jsxs("div", {
          style: {
            background: "var(--panel)",
            padding: "0.5rem",
            borderRadius: "4px",
            borderLeft: "3px solid var(--accent)",
          },
          children: [
            _jsx("strong", {
              style: { fontSize: "0.85rem", color: "var(--accent)" },
              children: "Suggestion:",
            }),
            _jsx("pre", {
              style: {
                margin: "0.25rem 0 0 0",
                whiteSpace: "pre-wrap",
                fontSize: "0.85rem",
                fontFamily: "monospace",
              },
              children: issue.suggestion.description,
            }),
          ],
        }),
    ],
  });
}
function HistoryCard({ record, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(record.timestamp);
  return _jsxs("div", {
    className: "settings-card",
    style: {
      background: "var(--panel)",
      padding: "1.25rem",
      borderRadius: "12px",
      border: "1px solid var(--border)",
      marginBottom: "1rem",
    },
    children: [
      _jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        },
        children: [
          _jsxs("div", {
            style: { flex: 1, minWidth: "250px" },
            children: [
              _jsxs("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                },
                children: [
                  _jsx("span", {
                    style: {
                      background:
                        record.inputMode === "pr"
                          ? "rgba(59, 130, 246, 0.15)"
                          : "rgba(16, 185, 129, 0.15)",
                      color: record.inputMode === "pr" ? "#3b82f6" : "#10b981",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    },
                    children: record.inputMode,
                  }),
                  _jsxs("span", {
                    style: {
                      color: "var(--muted)",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    },
                    children: [
                      _jsx(Calendar, { size: 14 }),
                      " ",
                      date.toLocaleDateString(),
                      " ",
                      date.toLocaleTimeString(),
                    ],
                  }),
                ],
              }),
              _jsx("h3", {
                style: {
                  margin: "0 0 0.5rem 0",
                  fontSize: "1.1rem",
                  wordBreak: "break-all",
                },
                children: record.target,
              }),
              _jsxs("div", {
                style: {
                  display: "flex",
                  gap: "1rem",
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                  marginTop: "0.5rem",
                  flexWrap: "wrap",
                },
                children: [
                  _jsxs("span", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    },
                    children: [
                      _jsx(AlertTriangle, {
                        size: 14,
                        style: { color: "var(--warning)" },
                      }),
                      record.result.total,
                      " Issues Found",
                    ],
                  }),
                  _jsxs("span", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    },
                    children: [
                      _jsx(CheckCircle, {
                        size: 14,
                        style: { color: "var(--low)" },
                      }),
                      record.result.accepted,
                      " Accepted",
                    ],
                  }),
                  _jsxs("span", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    },
                    children: [
                      _jsx(Cpu, { size: 14 }),
                      record.model || "Unknown Model",
                    ],
                  }),
                  record.result.metrics &&
                    _jsxs("span", {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      },
                      children: [
                        _jsx(Zap, { size: 14, style: { color: "#eab308" } }),
                        (
                          record.result.metrics.totalPromptTokens +
                          record.result.metrics.totalCompletionTokens
                        ).toLocaleString(),
                        " Tokens",
                      ],
                    }),
                ],
              }),
            ],
          }),
          _jsxs("div", {
            style: { display: "flex", gap: "0.5rem" },
            children: [
              _jsxs("button", {
                className: "secondary-button",
                onClick: () => setExpanded(!expanded),
                style: {
                  padding: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                },
                children: [
                  expanded ? "Hide Details" : "View Details",
                  expanded
                    ? _jsx(ChevronUp, { size: 16 })
                    : _jsx(ChevronDown, { size: 16 }),
                ],
              }),
              _jsx("button", {
                onClick: onDelete,
                style: {
                  background: "transparent",
                  border: "1px solid var(--error)",
                  color: "var(--error)",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                },
                title: "Delete record",
                children: _jsx(Trash2, { size: 16 }),
              }),
            ],
          }),
        ],
      }),
      expanded &&
        _jsxs("div", {
          style: {
            marginTop: "1.5rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border)",
          },
          children: [
            _jsx("div", {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              },
              children: _jsx("h4", {
                style: { margin: 0 },
                children: "Review Findings",
              }),
            }),
            record.result.issues.length === 0
              ? _jsx("p", {
                  style: { color: "var(--muted)" },
                  children: "No issues found in this review.",
                })
              : _jsx("div", {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  },
                  children: record.result.issues.map((issue, idx) =>
                    _jsx(IssueItem, { issue: issue }, `${issue.id}-${idx}`),
                  ),
                }),
          ],
        }),
    ],
  });
}
export function HistoryView() {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    setHistory(getHistory());
  }, []);
  function handleClearAll() {
    if (confirm("Are you sure you want to clear all review history?")) {
      clearHistory();
      setHistory([]);
    }
  }
  function handleDelete(id) {
    deleteHistoryItem(id);
    setHistory(history.filter((h) => h.id !== id));
  }
  const totalTokens = history.reduce((sum, record) => {
    if (record.result.metrics) {
      return (
        sum +
        record.result.metrics.totalPromptTokens +
        record.result.metrics.totalCompletionTokens
      );
    }
    return sum;
  }, 0);
  return _jsxs("div", {
    className: "view-container",
    style: { maxWidth: "1100px", margin: "0 auto" },
    children: [
      _jsxs("header", {
        className: "view-header",
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        },
        children: [
          _jsxs("div", {
            children: [
              _jsx("h2", { children: "Review History" }),
              _jsx("p", {
                children:
                  "Past code reviews and analysis results saved locally.",
              }),
            ],
          }),
          history.length > 0 &&
            _jsxs("div", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              },
              children: [
                _jsxs("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "var(--panel)",
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "0.9rem",
                  },
                  children: [
                    _jsx(Zap, { size: 16, style: { color: "#eab308" } }),
                    _jsxs("span", {
                      children: [
                        _jsx("strong", {
                          style: { color: "var(--text)" },
                          children: totalTokens.toLocaleString(),
                        }),
                        " Tokens Used",
                      ],
                    }),
                  ],
                }),
                _jsxs("button", {
                  onClick: handleClearAll,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "transparent",
                    color: "var(--error)",
                    border: "1px solid var(--error)",
                  },
                  children: [_jsx(Trash2, { size: 16 }), "Clear All"],
                }),
              ],
            }),
        ],
      }),
      _jsx("div", {
        style: { marginTop: "2rem" },
        children:
          history.length === 0
            ? _jsxs("div", {
                style: {
                  textAlign: "center",
                  padding: "4rem 2rem",
                  background: "var(--panel)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border)",
                },
                children: [
                  _jsx(History, {
                    size: 48,
                    style: {
                      margin: "0 auto",
                      color: "var(--muted)",
                      marginBottom: "1rem",
                    },
                  }),
                  _jsx("h3", { children: "No history yet" }),
                  _jsx("p", {
                    style: { color: "var(--muted)" },
                    children: "Run a code review to see it saved here.",
                  }),
                ],
              })
            : history.map((record) =>
                _jsx(
                  HistoryCard,
                  { record: record, onDelete: () => handleDelete(record.id) },
                  record.id,
                ),
              ),
      }),
    ],
  });
}
