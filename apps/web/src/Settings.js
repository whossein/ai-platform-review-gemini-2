import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
const DEFAULT_CONFIG = {
  AI_REVIEW_LLM_PROVIDER: "gemini",
  AI_REVIEW_LLM_API_KEY: "",
  AI_REVIEW_LLM_MODEL: "",
  AI_REVIEW_LLM_BASE_URL: "",
  GITLAB_TOKEN: "",
  GITLAB_BASE_URL: "",
  GITHUB_TOKEN: "",
  BUDGET_LIMIT: "0.5",
};
export function useAppConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem("ai-review-config");
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  });
  useEffect(() => {
    localStorage.setItem("ai-review-config", JSON.stringify(config));
  }, [config]);
  return [config, setConfig];
}
export function SettingsModal({ config, onChange, onClose }) {
  const [local, setLocal] = useState(config);
  const handleSave = () => {
    onChange(local);
    onClose();
  };
  return _jsx("div", {
    className: "modal-backdrop",
    children: _jsxs("div", {
      className: "modal-content",
      children: [
        _jsx("h2", { children: "Configuration" }),
        _jsxs("div", {
          className: "form-group",
          children: [
            _jsx("label", { children: "LLM Provider" }),
            _jsxs("select", {
              value: local.AI_REVIEW_LLM_PROVIDER,
              onChange: (e) =>
                setLocal({ ...local, AI_REVIEW_LLM_PROVIDER: e.target.value }),
              children: [
                _jsx("option", {
                  value: "mock",
                  children: "Mock (Offline / Free)",
                }),
                _jsx("option", { value: "gemini", children: "Gemini" }),
                _jsx("option", { value: "openai", children: "OpenAI" }),
                _jsx("option", { value: "anthropic", children: "Anthropic" }),
                _jsx("option", { value: "openrouter", children: "OpenRouter" }),
                _jsx("option", {
                  value: "ollama",
                  children: "Ollama (Local / Free)",
                }),
                _jsx("option", { value: "deepseek", children: "DeepSeek" }),
              ],
            }),
          ],
        }),
        _jsxs("div", {
          className: "form-group",
          children: [
            _jsx("label", { children: "API Key" }),
            _jsx("input", {
              type: "password",
              value: local.AI_REVIEW_LLM_API_KEY,
              onChange: (e) =>
                setLocal({ ...local, AI_REVIEW_LLM_API_KEY: e.target.value }),
              placeholder:
                local.AI_REVIEW_LLM_PROVIDER === "mock" ||
                local.AI_REVIEW_LLM_PROVIDER === "ollama"
                  ? "Not required for this provider"
                  : "Defaults to server env if empty",
              disabled:
                local.AI_REVIEW_LLM_PROVIDER === "mock" ||
                local.AI_REVIEW_LLM_PROVIDER === "ollama",
            }),
          ],
        }),
        _jsxs("div", {
          className: "form-group",
          children: [
            _jsx("label", { children: "Model (Optional)" }),
            _jsx("input", {
              type: "text",
              value: local.AI_REVIEW_LLM_MODEL,
              onChange: (e) =>
                setLocal({ ...local, AI_REVIEW_LLM_MODEL: e.target.value }),
              placeholder: "Leave empty for default",
            }),
          ],
        }),
        _jsxs("div", {
          className: "form-group",
          children: [
            _jsx("label", { children: "Base URL (Optional)" }),
            _jsx("input", {
              type: "text",
              value: local.AI_REVIEW_LLM_BASE_URL,
              onChange: (e) =>
                setLocal({ ...local, AI_REVIEW_LLM_BASE_URL: e.target.value }),
              placeholder: "Custom gateway URL",
            }),
          ],
        }),
        _jsxs("div", {
          className: "form-group",
          children: [
            _jsx("label", { children: "Max Budget (USD)" }),
            _jsx("input", {
              type: "number",
              step: "0.001",
              min: "0",
              value: local.BUDGET_LIMIT,
              onChange: (e) =>
                setLocal({ ...local, BUDGET_LIMIT: e.target.value }),
              placeholder: "0.5 (Leave empty for no limit)",
            }),
          ],
        }),
        _jsxs("div", {
          className: "modal-actions",
          children: [
            _jsx("button", {
              onClick: onClose,
              style: {
                background: "var(--panel)",
                border: "1px solid var(--border)",
              },
              children: "Cancel",
            }),
            _jsx("button", { onClick: handleSave, children: "Save" }),
          ],
        }),
      ],
    }),
  });
}
