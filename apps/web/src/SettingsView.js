import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Plus,
  Trash2,
  Star,
  Pencil,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Download,
  Upload,
  Globe,
  Key,
  Cpu,
  ShieldCheck,
  DollarSign,
  X,
  Power,
} from "lucide-react";
import { useAppConfig } from "./Settings.js";
import { requestTestProvider } from "./api.js";
const PRESET_DEFAULTS = {
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-1.5-flash",
    requiresKey: true,
    defaultInputCost: 0.075,
    defaultOutputCost: 0.3,
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
    defaultInputCost: 0.15,
    defaultOutputCost: 0.6,
  },
  anthropic: {
    label: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
    requiresKey: true,
    defaultInputCost: 0.8,
    defaultOutputCost: 4.0,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    requiresKey: true,
    defaultInputCost: 3.0,
    defaultOutputCost: 15.0,
  },
  ollama: {
    label: "Ollama (Local / Free)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5-coder",
    requiresKey: false,
    defaultInputCost: 0,
    defaultOutputCost: 0,
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    requiresKey: true,
    defaultInputCost: 0.14,
    defaultOutputCost: 0.28,
  },
  azure: {
    label: "Azure OpenAI",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
    defaultInputCost: 0.15,
    defaultOutputCost: 0.6,
  },
  custom: {
    label: "Custom / Proxy Gateway",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    requiresKey: false,
    defaultInputCost: 0.15,
    defaultOutputCost: 0.6,
  },
};
export function SettingsView() {
  const [config, setConfig] = useAppConfig();
  const [local, setLocal] = useState(config);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [showKeyNew, setShowKeyNew] = useState(false);
  const [showKeyEdit, setShowKeyEdit] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [testStates, setTestStates] = useState({});
  const [modelLists, setModelLists] = useState({});
  const fileInputRef = useRef(null);
  const handleFetchModels = async (key, pConfig) => {
    setModelLists((prev) => ({
      ...prev,
      [key]: { loading: true, models: [] },
    }));
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: pConfig.provider,
          apiKey: pConfig.apiKey,
          baseUrl: pConfig.baseUrl,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch models");
      setModelLists((prev) => ({
        ...prev,
        [key]: { loading: false, models: data.models },
      }));
    } catch (err) {
      setModelLists((prev) => ({
        ...prev,
        [key]: { loading: false, models: [], error: err.message },
      }));
    }
  };
  const [newProvider, setNewProvider] = useState({
    id: "",
    provider: "gemini",
    apiKey: "",
    model: "",
    baseUrl: "",
    tier: "cheap",
    inputCostPer1M: PRESET_DEFAULTS.gemini.defaultInputCost,
    outputCostPer1M: PRESET_DEFAULTS.gemini.defaultOutputCost,
  });
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(local) !== JSON.stringify(config);
  }, [local, config]);
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
  const handleSave = () => {
    setConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const handleDiscard = () => {
    setLocal(config);
    setEditingProviderId(null);
    setEditForm(null);
  };
  const handleTest = async (testKey, pConfig) => {
    setTestStates((prev) => ({ ...prev, [testKey]: { loading: true } }));
    try {
      const res = await requestTestProvider({
        provider: pConfig.provider,
        apiKey: pConfig.apiKey,
        model: pConfig.model,
        baseUrl: pConfig.baseUrl,
      });
      setTestStates((prev) => ({
        ...prev,
        [testKey]: { loading: false, result: res },
      }));
    } catch (err) {
      setTestStates((prev) => ({
        ...prev,
        [testKey]: {
          loading: false,
          result: { ok: false, error: err.message || "Connection test failed" },
        },
      }));
    }
  };
  const handleAddProvider = () => {
    const id = Date.now().toString();
    const p = { ...newProvider, id };
    const providers = local.AI_PROVIDERS ? [...local.AI_PROVIDERS] : [];
    // Auto-set as default if it's the first one
    if (
      providers.length === 0 ||
      !local.AI_REVIEW_LLM_PROVIDER ||
      local.AI_REVIEW_LLM_PROVIDER === "mock"
    ) {
      setLocal({
        ...local,
        AI_PROVIDERS: [...providers, p],
        AI_REVIEW_LLM_PROVIDER: p.id,
      });
    } else {
      setLocal({
        ...local,
        AI_PROVIDERS: [...providers, p],
      });
    }
    setNewProvider({
      id: "",
      provider: "gemini",
      apiKey: "",
      model: "",
      baseUrl: "",
      tier: "cheap",
      inputCostPer1M: PRESET_DEFAULTS.gemini.defaultInputCost,
      outputCostPer1M: PRESET_DEFAULTS.gemini.defaultOutputCost,
    });
    setShowKeyNew(false);
  };
  const handleStartEdit = (p) => {
    setEditingProviderId(p.id);
    setEditForm({ ...p });
    setShowKeyEdit(false);
  };
  const handleCancelEdit = () => {
    setEditingProviderId(null);
    setEditForm(null);
    setShowKeyEdit(false);
  };
  const handleSaveEdit = () => {
    if (!editForm) return;
    const providers = (local.AI_PROVIDERS || []).map((p) =>
      p.id === editForm.id ? editForm : p,
    );
    setLocal({
      ...local,
      AI_PROVIDERS: providers,
    });
    setEditingProviderId(null);
    setEditForm(null);
  };
  const handleDeleteProvider = (id) => {
    const providers = (local.AI_PROVIDERS || []).filter((p) => p.id !== id);
    let nextDefault = local.AI_REVIEW_LLM_PROVIDER;
    if (local.AI_REVIEW_LLM_PROVIDER === id) {
      nextDefault = providers.length > 0 ? providers[0].id : "gemini";
    }
    setLocal({
      ...local,
      AI_PROVIDERS: providers,
      AI_REVIEW_LLM_PROVIDER: nextDefault,
    });
  };
  const handleSetDefaultProvider = (providerId) => {
    setLocal({ ...local, AI_REVIEW_LLM_PROVIDER: providerId });
  };
  const handleToggleEnableProvider = (id) => {
    const providers = (local.AI_PROVIDERS || []).map((p) => {
      if (p.id === id) {
        return { ...p, enabled: p.enabled === false ? true : false };
      }
      return p;
    });
    setLocal({
      ...local,
      AI_PROVIDERS: providers,
    });
  };
  const handleExportConfig = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(local, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `ai-review-settings-${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };
  const handleImportConfig = (event) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result);
          if (parsed && typeof parsed === "object") {
            const updated = { ...local, ...parsed };
            setLocal(updated);
            setConfig(updated);
            setImportStatus(
              "✓ Settings successfully restored from backup file!",
            );
            setTimeout(() => setImportStatus(null), 4000);
          }
        } catch {
          setImportStatus("✗ Failed to parse JSON file.");
          setTimeout(() => setImportStatus(null), 4000);
        }
      };
    }
  };
  return _jsxs("div", {
    className: "settings-view",
    style: { maxWidth: "1100px", margin: "0 auto" },
    children: [
      _jsxs("header", {
        className: "view-header",
        style: { marginBottom: "1.5rem" },
        children: [
          _jsx("h1", {
            style: { margin: 0, fontSize: "1.5rem", color: "var(--text)" },
            children: "Configuration & AI Providers",
          }),
          _jsx("p", {
            style: {
              color: "var(--muted)",
              marginTop: "0.5rem",
              fontSize: "0.9rem",
            },
            children:
              "Manage your AI models, API keys, endpoints, and persistent settings.",
          }),
        ],
      }),
      hasUnsavedChanges &&
        _jsxs("div", {
          style: {
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.45)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            boxShadow: "0 4px 12px rgba(234, 179, 8, 0.08)",
          },
          children: [
            _jsxs("div", {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flex: 1,
                minWidth: "240px",
              },
              children: [
                _jsx("div", {
                  style: {
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(234, 179, 8, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  },
                  children: _jsx(AlertTriangle, {
                    size: 20,
                    style: { color: "#eab308" },
                  }),
                }),
                _jsxs("div", {
                  children: [
                    _jsx("div", {
                      style: {
                        fontWeight: 600,
                        color: "var(--text)",
                        fontSize: "0.95rem",
                      },
                      children:
                        "\u0647\u0634\u062F\u0627\u0631: \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u06CC\u062F (Unsaved Changes)",
                    }),
                    _jsx("div", {
                      style: {
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                        marginTop: "0.2rem",
                      },
                      children:
                        "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F\u0647\u200C\u0627\u0646\u062F. \u0644\u0637\u0641\u0627\u064B \u0631\u0648\u06CC \u062F\u06A9\u0645\u0647 \u0630\u062E\u06CC\u0631\u0647 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F \u062A\u0627 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u062F\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062B\u0628\u062A \u0634\u0648\u0646\u062F.",
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: "0.5rem" },
              children: [
                _jsxs("button", {
                  type: "button",
                  onClick: handleDiscard,
                  className: "secondary-button",
                  style: {
                    padding: "0.5rem 0.85rem",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  },
                  children: [
                    _jsx(RotateCcw, { size: 14 }),
                    " \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC (Discard)",
                  ],
                }),
                _jsxs("button", {
                  type: "button",
                  onClick: handleSave,
                  style: {
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                  },
                  children: [
                    _jsx(Save, { size: 15 }),
                    " \u0630\u062E\u06CC\u0631\u0647 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A (Save)",
                  ],
                }),
              ],
            }),
          ],
        }),
      _jsx("div", {
        className: "settings-card",
        style: {
          background: "var(--panel)",
          padding: "1.25rem 1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          marginBottom: "1.5rem",
        },
        children: _jsxs("div", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          },
          children: [
            _jsxs("div", {
              children: [
                _jsx("h3", {
                  style: {
                    margin: "0 0 0.25rem 0",
                    fontSize: "1rem",
                    color: "var(--text)",
                  },
                  children: "Test Mode (Offline Mock Agent)",
                }),
                _jsx("p", {
                  style: {
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  },
                  children:
                    "Run the full review pipeline entirely offline without API keys or costs.",
                }),
              ],
            }),
            _jsxs("label", {
              className: "switch",
              style: {
                position: "relative",
                display: "inline-block",
                width: "50px",
                height: "24px",
                flexShrink: 0,
              },
              children: [
                _jsx("input", {
                  type: "checkbox",
                  checked: local.AI_REVIEW_LLM_PROVIDER === "mock",
                  onChange: (e) => {
                    setLocal({
                      ...local,
                      AI_REVIEW_LLM_PROVIDER: e.target.checked
                        ? "mock"
                        : local.AI_PROVIDERS?.[0]?.id || "gemini",
                    });
                  },
                  style: { opacity: 0, width: 0, height: 0 },
                }),
                _jsx("span", {
                  style: {
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor:
                      local.AI_REVIEW_LLM_PROVIDER === "mock"
                        ? "var(--accent)"
                        : "var(--border)",
                    transition: ".4s",
                    borderRadius: "24px",
                  },
                  children: _jsx("span", {
                    style: {
                      position: "absolute",
                      content: '""',
                      height: "16px",
                      width: "16px",
                      left: "4px",
                      bottom: "4px",
                      backgroundColor: "white",
                      transition: ".4s",
                      borderRadius: "50%",
                      transform:
                        local.AI_REVIEW_LLM_PROVIDER === "mock"
                          ? "translateX(26px)"
                          : "none",
                    },
                  }),
                }),
              ],
            }),
          ],
        }),
      }),
      _jsxs("div", {
        className: "settings-card",
        style: {
          background: "var(--panel)",
          padding: "1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          opacity: local.AI_REVIEW_LLM_PROVIDER === "mock" ? 0.6 : 1,
          marginBottom: "1.5rem",
        },
        children: [
          _jsx("div", {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            },
            children: _jsxs("div", {
              children: [
                _jsx("h2", {
                  style: {
                    fontSize: "1.15rem",
                    margin: 0,
                    color: "var(--text)",
                  },
                  children: "AI Providers",
                }),
                _jsx("p", {
                  style: {
                    margin: "0.25rem 0 0 0",
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  },
                  children:
                    "Configure provider credentials, custom base URLs, and test connectivity.",
                }),
              ],
            }),
          }),
          _jsxs("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginBottom: "1.5rem",
            },
            children: [
              (local.AI_PROVIDERS || []).map((p) => {
                const isDefault = local.AI_REVIEW_LLM_PROVIDER === p.id;
                const isEditing = editingProviderId === p.id;
                const preset =
                  PRESET_DEFAULTS[p.provider] || PRESET_DEFAULTS.custom;
                const effectiveUrl =
                  p.baseUrl || preset.baseUrl || "(No base URL)";
                const effectiveModel = p.model || preset.defaultModel;
                const testState = testStates[p.id];
                if (isEditing && editForm) {
                  const editPreset =
                    PRESET_DEFAULTS[editForm.provider] ||
                    PRESET_DEFAULTS.custom;
                  const editTestState = testStates[`edit-${editForm.id}`];
                  return _jsxs(
                    "div",
                    {
                      style: {
                        border: "2px solid var(--accent)",
                        borderRadius: "10px",
                        padding: "1.25rem",
                        background: "rgba(0, 0, 0, 0.02)",
                      },
                      children: [
                        _jsxs("div", {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "1rem",
                          },
                          children: [
                            _jsxs("div", {
                              style: {
                                fontWeight: 600,
                                fontSize: "0.95rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              },
                              children: [
                                _jsx(Pencil, {
                                  size: 16,
                                  color: "var(--accent)",
                                }),
                                _jsxs("span", {
                                  children: [
                                    "Edit Provider: ",
                                    editPreset.label,
                                  ],
                                }),
                              ],
                            }),
                            _jsx("button", {
                              onClick: handleCancelEdit,
                              style: {
                                background: "transparent",
                                border: "none",
                                color: "var(--muted)",
                                cursor: "pointer",
                              },
                              title: "Cancel Edit",
                              children: _jsx(X, { size: 18 }),
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "form-group",
                          children: [
                            _jsx("label", { children: "Provider Platform" }),
                            _jsxs("select", {
                              value: editForm.provider,
                              onChange: (e) => {
                                const newP = e.target.value;
                                setEditForm({
                                  ...editForm,
                                  provider: newP,
                                  baseUrl:
                                    editForm.baseUrl ||
                                    PRESET_DEFAULTS[newP]?.baseUrl ||
                                    "",
                                });
                              },
                              children: [
                                _jsx("option", {
                                  value: "gemini",
                                  children: "Google Gemini",
                                }),
                                _jsx("option", {
                                  value: "openai",
                                  children: "OpenAI",
                                }),
                                _jsx("option", {
                                  value: "anthropic",
                                  children: "Anthropic (Claude)",
                                }),
                                _jsx("option", {
                                  value: "openrouter",
                                  children: "OpenRouter",
                                }),
                                _jsx("option", {
                                  value: "ollama",
                                  children: "Ollama (Local / Free)",
                                }),
                                _jsx("option", {
                                  value: "deepseek",
                                  children: "DeepSeek",
                                }),
                                _jsx("option", {
                                  value: "azure",
                                  children: "Azure OpenAI",
                                }),
                                _jsx("option", {
                                  value: "custom",
                                  children: "Custom / Third-party Proxy",
                                }),
                              ],
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "form-group",
                          children: [
                            _jsx("label", { children: "API Key / Token" }),
                            _jsxs("div", {
                              style: { position: "relative" },
                              children: [
                                _jsx("input", {
                                  type: showKeyEdit ? "text" : "password",
                                  value: editForm.apiKey,
                                  onChange: (e) =>
                                    setEditForm({
                                      ...editForm,
                                      apiKey: e.target.value,
                                    }),
                                  placeholder:
                                    editForm.provider === "ollama"
                                      ? "Not required for Ollama"
                                      : "Paste API Token (Defaults to env if empty)",
                                  disabled: editForm.provider === "ollama",
                                  style: { paddingRight: "2.5rem" },
                                }),
                                editForm.provider !== "ollama" &&
                                  _jsx("button", {
                                    type: "button",
                                    onClick: () => setShowKeyEdit(!showKeyEdit),
                                    style: {
                                      position: "absolute",
                                      right: "0.5rem",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--muted)",
                                      cursor: "pointer",
                                      padding: "0.25rem",
                                    },
                                    children: showKeyEdit
                                      ? _jsx(EyeOff, { size: 16 })
                                      : _jsx(Eye, { size: 16 }),
                                  }),
                              ],
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          style: {
                            display: "flex",
                            gap: "1rem",
                            marginTop: "0.75rem",
                          },
                          children: [
                            _jsxs("div", {
                              className: "form-group",
                              style: { flex: 1, marginBottom: 0 },
                              children: [
                                _jsxs("label", {
                                  style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  },
                                  children: [
                                    _jsx("span", { children: "Model Name" }),
                                    _jsx("button", {
                                      type: "button",
                                      onClick: () =>
                                        handleFetchModels("edit", editForm),
                                      style: {
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--accent)",
                                        cursor: "pointer",
                                        fontSize: "0.8rem",
                                        padding: 0,
                                      },
                                      children: modelLists["edit"]?.loading
                                        ? "Loading..."
                                        : modelLists["edit"]?.models?.length
                                          ? `Loaded (${modelLists["edit"].models.length})`
                                          : "Fetch List",
                                    }),
                                  ],
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editForm.model,
                                  onChange: (e) =>
                                    setEditForm({
                                      ...editForm,
                                      model: e.target.value,
                                    }),
                                  placeholder: `Default: ${editPreset.defaultModel}`,
                                  list: "edit-models-list",
                                }),
                                modelLists["edit"]?.error &&
                                  _jsx("div", {
                                    style: {
                                      color: "var(--error)",
                                      fontSize: "0.8rem",
                                      marginTop: "0.25rem",
                                    },
                                    children: modelLists["edit"].error,
                                  }),
                                _jsx("datalist", {
                                  id: "edit-models-list",
                                  children: modelLists["edit"]?.models?.map(
                                    (m) => _jsx("option", { value: m }, m),
                                  ),
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className: "form-group",
                              style: { flex: 1, marginBottom: 0 },
                              children: [
                                _jsx("label", { children: "Tier / Speed" }),
                                _jsxs("select", {
                                  value: editForm.tier || "mid",
                                  onChange: (e) =>
                                    setEditForm({
                                      ...editForm,
                                      tier: e.target.value,
                                    }),
                                  children: [
                                    _jsx("option", {
                                      value: "cheap",
                                      children: "Cheap (Fast / Low Cost)",
                                    }),
                                    _jsx("option", {
                                      value: "mid",
                                      children: "Medium (Balanced)",
                                    }),
                                    _jsx("option", {
                                      value: "premium",
                                      children: "Premium (High Quality)",
                                    }),
                                    _jsx("option", {
                                      value: "local",
                                      children: "Local (Offline / Free)",
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          style: {
                            display: "flex",
                            gap: "1rem",
                            marginTop: "0.75rem",
                          },
                          children: [
                            _jsxs("div", {
                              className: "form-group",
                              style: { flex: 1, marginBottom: 0 },
                              children: [
                                _jsx("label", {
                                  children: "Input Cost ($ / 1M tokens)",
                                }),
                                _jsx("input", {
                                  type: "number",
                                  step: "0.001",
                                  min: "0",
                                  value: editForm.inputCostPer1M ?? "",
                                  onChange: (e) =>
                                    setEditForm({
                                      ...editForm,
                                      inputCostPer1M:
                                        e.target.value === ""
                                          ? undefined
                                          : parseFloat(e.target.value),
                                    }),
                                  placeholder: `Default: $${editPreset.defaultInputCost}`,
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className: "form-group",
                              style: { flex: 1, marginBottom: 0 },
                              children: [
                                _jsx("label", {
                                  children: "Output Cost ($ / 1M tokens)",
                                }),
                                _jsx("input", {
                                  type: "number",
                                  step: "0.001",
                                  min: "0",
                                  value: editForm.outputCostPer1M ?? "",
                                  onChange: (e) =>
                                    setEditForm({
                                      ...editForm,
                                      outputCostPer1M:
                                        e.target.value === ""
                                          ? undefined
                                          : parseFloat(e.target.value),
                                    }),
                                  placeholder: `Default: $${editPreset.defaultOutputCost}`,
                                }),
                              ],
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "form-group",
                          style: { marginTop: "0.75rem", marginBottom: 0 },
                          children: [
                            _jsx("label", {
                              children: "Base URL (Gateway / Endpoint URL)",
                            }),
                            _jsx("input", {
                              type: "text",
                              value: editForm.baseUrl,
                              onChange: (e) =>
                                setEditForm({
                                  ...editForm,
                                  baseUrl: e.target.value,
                                }),
                              placeholder:
                                editPreset.baseUrl ||
                                "e.g. https://api.openai.com/v1 or api.gapgpt.app/v1",
                            }),
                            _jsxs("div", {
                              style: {
                                fontSize: "0.75rem",
                                color: "var(--muted)",
                                marginTop: "0.25rem",
                              },
                              children: [
                                "Tip: Both ",
                                _jsx("code", {
                                  children: "https://api.gapgpt.app/v1",
                                }),
                                " and ",
                                _jsx("code", { children: "api.gapgpt.app/v1" }),
                                " are supported. ",
                                _jsx("code", { children: "/chat/completions" }),
                                " is appended automatically.",
                              ],
                            }),
                          ],
                        }),
                        editTestState?.result &&
                          _jsxs("div", {
                            style: {
                              marginTop: "0.75rem",
                              padding: "0.6rem 0.8rem",
                              borderRadius: "6px",
                              fontSize: "0.85rem",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "0.5rem",
                              background: editTestState.result.ok
                                ? "rgba(46, 213, 115, 0.1)"
                                : "rgba(255, 71, 87, 0.1)",
                              color: editTestState.result.ok
                                ? "var(--low)"
                                : "var(--critical)",
                              border: `1px solid ${editTestState.result.ok ? "rgba(46, 213, 115, 0.3)" : "rgba(255, 71, 87, 0.3)"}`,
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            },
                            children: [
                              _jsx("div", {
                                style: { flexShrink: 0, marginTop: "2px" },
                                children: editTestState.result.ok
                                  ? _jsx(CheckCircle2, { size: 16 })
                                  : _jsx(AlertCircle, { size: 16 }),
                              }),
                              _jsx("span", {
                                children: editTestState.result.ok
                                  ? `✓ Connected (${editTestState.result.latencyMs}ms) — Model: ${editTestState.result.model}`
                                  : `✗ Connection Error: ${editTestState.result.error}`,
                              }),
                            ],
                          }),
                        _jsxs("div", {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: "1rem",
                          },
                          children: [
                            _jsxs("button", {
                              type: "button",
                              onClick: () =>
                                handleTest(`edit-${editForm.id}`, editForm),
                              disabled: editTestState?.loading,
                              className: "secondary-button",
                              style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontSize: "0.85rem",
                                padding: "0.5rem 0.8rem",
                              },
                              children: [
                                _jsx(Activity, { size: 15 }),
                                editTestState?.loading
                                  ? "Testing..."
                                  : "Test Connection",
                              ],
                            }),
                            _jsxs("div", {
                              style: { display: "flex", gap: "0.5rem" },
                              children: [
                                _jsx("button", {
                                  type: "button",
                                  onClick: handleCancelEdit,
                                  className: "secondary-button",
                                  style: {
                                    padding: "0.5rem 0.8rem",
                                    fontSize: "0.85rem",
                                  },
                                  children: "Cancel",
                                }),
                                _jsx("button", {
                                  type: "button",
                                  onClick: handleSaveEdit,
                                  style: {
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.85rem",
                                  },
                                  children: "Save Changes",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    },
                    p.id,
                  );
                }
                const isDisabled = p.enabled === false;
                return _jsxs(
                  "div",
                  {
                    style: {
                      border: isDefault
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border)",
                      borderRadius: "10px",
                      background: "var(--panel)",
                      padding: "1rem 1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      boxShadow: isDefault ? "0 0 0 1px var(--accent)" : "none",
                      opacity: isDisabled ? 0.6 : 1,
                      filter: isDisabled ? "grayscale(0.5)" : "none",
                      transition: "opacity 0.2s, filter 0.2s",
                    },
                    children: [
                      _jsxs("div", {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        },
                        children: [
                          _jsxs("div", {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "0.6rem",
                            },
                            children: [
                              _jsx("span", {
                                style: {
                                  fontWeight: 600,
                                  fontSize: "1rem",
                                  color: "var(--text)",
                                },
                                children: preset.label || p.provider,
                              }),
                              p.tier &&
                                _jsx("span", {
                                  style: {
                                    fontSize: "0.75rem",
                                    background: "var(--border)",
                                    color: "var(--text)",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    textTransform: "capitalize",
                                  },
                                  children: p.tier,
                                }),
                              isDefault &&
                                _jsx("span", {
                                  style: {
                                    fontSize: "0.75rem",
                                    background: "var(--accent)",
                                    color: "#fff",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    fontWeight: 500,
                                  },
                                  children: "Active Default",
                                }),
                              isDisabled &&
                                _jsx("span", {
                                  style: {
                                    fontSize: "0.75rem",
                                    background: "var(--border)",
                                    color: "var(--muted)",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    fontWeight: 500,
                                  },
                                  children: "Disabled",
                                }),
                            ],
                          }),
                          _jsxs("div", {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            },
                            children: [
                              _jsx("button", {
                                onClick: () => handleToggleEnableProvider(p.id),
                                title: isDisabled
                                  ? "Enable Provider"
                                  : "Disable Provider",
                                style: {
                                  padding: "0.4rem",
                                  background: "transparent",
                                  border: "none",
                                  color: isDisabled
                                    ? "var(--muted)"
                                    : "var(--text)",
                                  cursor: "pointer",
                                },
                                children: _jsx(Power, { size: 17 }),
                              }),
                              !isDefault &&
                                !isDisabled &&
                                _jsx("button", {
                                  onClick: () => handleSetDefaultProvider(p.id),
                                  title: "Set as Active Default Provider",
                                  style: {
                                    padding: "0.4rem",
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--muted)",
                                    cursor: "pointer",
                                  },
                                  children: _jsx(Star, { size: 18 }),
                                }),
                              _jsx("button", {
                                onClick: () => handleStartEdit(p),
                                title: "Edit Provider & Tokens",
                                style: {
                                  padding: "0.4rem",
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text)",
                                  cursor: "pointer",
                                },
                                children: _jsx(Pencil, { size: 17 }),
                              }),
                              _jsx("button", {
                                onClick: () => handleDeleteProvider(p.id),
                                title: "Delete Provider",
                                style: {
                                  padding: "0.4rem",
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--error)",
                                  cursor: "pointer",
                                },
                                children: _jsx(Trash2, { size: 17 }),
                              }),
                            ],
                          }),
                        ],
                      }),
                      _jsxs("div", {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.3rem",
                          fontSize: "0.85rem",
                          color: "var(--muted)",
                        },
                        children: [
                          _jsxs("div", {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              wordBreak: "break-all",
                            },
                            children: [
                              _jsx(Globe, {
                                size: 14,
                                style: { flexShrink: 0 },
                              }),
                              _jsx("span", {
                                style: {
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                  color: "var(--text)",
                                },
                                children: effectiveUrl,
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                              flexWrap: "wrap",
                              marginTop: "0.1rem",
                            },
                            children: [
                              _jsxs("div", {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                },
                                children: [
                                  _jsx(Cpu, { size: 14 }),
                                  _jsxs("span", {
                                    children: [
                                      "Model: ",
                                      _jsx("strong", {
                                        style: { color: "var(--text)" },
                                        children: effectiveModel,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              _jsxs("div", {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                },
                                children: [
                                  _jsx(Key, { size: 14 }),
                                  _jsx("span", {
                                    children: p.apiKey
                                      ? _jsxs("span", {
                                          style: { fontFamily: "monospace" },
                                          children: [
                                            "Key: ",
                                            p.apiKey.slice(0, 4),
                                            "\u2022\u2022\u2022\u2022",
                                            p.apiKey.slice(-4),
                                          ],
                                        })
                                      : p.provider === "ollama"
                                        ? "No Key Required"
                                        : "Using Server Env Key",
                                  }),
                                ],
                              }),
                              _jsxs("div", {
                                style: {
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                },
                                children: [
                                  _jsx(DollarSign, {
                                    size: 14,
                                    style: { color: "var(--accent)" },
                                  }),
                                  _jsxs("span", {
                                    children: [
                                      "Pricing: ",
                                      p.provider === "ollama"
                                        ? "Free (Local)"
                                        : `$${p.inputCostPer1M ?? preset.defaultInputCost} in / $${p.outputCostPer1M ?? preset.defaultOutputCost} out per 1M`,
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                      testState?.result &&
                        _jsxs("div", {
                          style: {
                            padding: "0.5rem 0.75rem",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                            background: testState.result.ok
                              ? "rgba(46, 213, 115, 0.1)"
                              : "rgba(255, 71, 87, 0.1)",
                            color: testState.result.ok
                              ? "var(--low)"
                              : "var(--critical)",
                            border: `1px solid ${testState.result.ok ? "rgba(46, 213, 115, 0.3)" : "rgba(255, 71, 87, 0.3)"}`,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          },
                          children: [
                            _jsx("div", {
                              style: { flexShrink: 0, marginTop: "2px" },
                              children: testState.result.ok
                                ? _jsx(CheckCircle2, { size: 15 })
                                : _jsx(AlertCircle, { size: 15 }),
                            }),
                            _jsx("span", {
                              children: testState.result.ok
                                ? `✓ Connected (${testState.result.latencyMs}ms) — Model: ${testState.result.model}`
                                : `✗ ${testState.result.error}`,
                            }),
                          ],
                        }),
                      _jsx("div", {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          marginTop: "0.25rem",
                        },
                        children: _jsxs("button", {
                          onClick: () => handleTest(p.id, p),
                          disabled: testState?.loading,
                          className: "secondary-button",
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            fontSize: "0.8rem",
                            padding: "0.35rem 0.75rem",
                            background: "rgba(0, 0, 0, 0.03)",
                          },
                          children: [
                            _jsx(Activity, { size: 14 }),
                            testState?.loading
                              ? "Testing..."
                              : "Test Connection",
                          ],
                        }),
                      }),
                    ],
                  },
                  p.id,
                );
              }),
              (!local.AI_PROVIDERS || local.AI_PROVIDERS.length === 0) &&
                _jsx("div", {
                  style: {
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--muted)",
                    border: "1px dashed var(--border)",
                    borderRadius: "8px",
                  },
                  children: "No AI providers configured. Add one below.",
                }),
            ],
          }),
          _jsxs("div", {
            style: {
              background: "rgba(0,0,0,0.02)",
              border: "1px solid var(--border)",
              padding: "1.25rem",
              borderRadius: "10px",
            },
            children: [
              _jsxs("h3", {
                style: {
                  fontSize: "0.95rem",
                  margin: "0 0 1rem 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  color: "var(--text)",
                },
                children: [
                  _jsx(Plus, { size: 16 }),
                  _jsx("span", { children: "Add New Provider" }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                children: [
                  _jsx("label", { children: "Provider Platform" }),
                  _jsxs("select", {
                    value: newProvider.provider,
                    onChange: (e) => {
                      const pName = e.target.value;
                      setNewProvider({
                        ...newProvider,
                        provider: pName,
                        baseUrl: PRESET_DEFAULTS[pName]?.baseUrl || "",
                      });
                    },
                    children: [
                      _jsx("option", {
                        value: "gemini",
                        children: "Google Gemini",
                      }),
                      _jsx("option", { value: "openai", children: "OpenAI" }),
                      _jsx("option", {
                        value: "anthropic",
                        children: "Anthropic (Claude)",
                      }),
                      _jsx("option", {
                        value: "openrouter",
                        children: "OpenRouter",
                      }),
                      _jsx("option", {
                        value: "ollama",
                        children: "Ollama (Local / Free)",
                      }),
                      _jsx("option", {
                        value: "deepseek",
                        children: "DeepSeek",
                      }),
                      _jsx("option", {
                        value: "azure",
                        children: "Azure OpenAI",
                      }),
                      _jsx("option", {
                        value: "custom",
                        children: "Custom / Third-party Proxy",
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                children: [
                  _jsx("label", { children: "API Key / Token" }),
                  _jsxs("div", {
                    style: { position: "relative" },
                    children: [
                      _jsx("input", {
                        type: showKeyNew ? "text" : "password",
                        value: newProvider.apiKey,
                        onChange: (e) =>
                          setNewProvider({
                            ...newProvider,
                            apiKey: e.target.value,
                          }),
                        placeholder:
                          newProvider.provider === "ollama"
                            ? "Not required for Ollama"
                            : "Paste API Token (Defaults to env if empty)",
                        disabled: newProvider.provider === "ollama",
                        style: { paddingRight: "2.5rem" },
                      }),
                      newProvider.provider !== "ollama" &&
                        _jsx("button", {
                          type: "button",
                          onClick: () => setShowKeyNew(!showKeyNew),
                          style: {
                            position: "absolute",
                            right: "0.5rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: "var(--muted)",
                            cursor: "pointer",
                            padding: "0.25rem",
                          },
                          children: showKeyNew
                            ? _jsx(EyeOff, { size: 16 })
                            : _jsx(Eye, { size: 16 }),
                        }),
                    ],
                  }),
                ],
              }),
              _jsxs("div", {
                style: { display: "flex", gap: "1rem", marginTop: "0.75rem" },
                children: [
                  _jsxs("div", {
                    className: "form-group",
                    style: { flex: 1, marginBottom: 0 },
                    children: [
                      _jsxs("label", {
                        style: {
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        },
                        children: [
                          _jsx("span", { children: "Model Name (Optional)" }),
                          _jsx("button", {
                            type: "button",
                            onClick: () =>
                              handleFetchModels("new", newProvider),
                            style: {
                              background: "transparent",
                              border: "none",
                              color: "var(--accent)",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              padding: 0,
                            },
                            children: modelLists["new"]?.loading
                              ? "Loading..."
                              : modelLists["new"]?.models?.length
                                ? `Loaded (${modelLists["new"].models.length})`
                                : "Fetch List",
                          }),
                        ],
                      }),
                      _jsx("input", {
                        type: "text",
                        value: newProvider.model,
                        onChange: (e) =>
                          setNewProvider({
                            ...newProvider,
                            model: e.target.value,
                          }),
                        placeholder: `Default: ${PRESET_DEFAULTS[newProvider.provider]?.defaultModel || "gpt-4o-mini"}`,
                        list: "new-models-list",
                      }),
                      modelLists["new"]?.error &&
                        _jsx("div", {
                          style: {
                            color: "var(--error)",
                            fontSize: "0.8rem",
                            marginTop: "0.25rem",
                          },
                          children: modelLists["new"].error,
                        }),
                      _jsx("datalist", {
                        id: "new-models-list",
                        children: modelLists["new"]?.models?.map((m) =>
                          _jsx("option", { value: m }, m),
                        ),
                      }),
                    ],
                  }),
                  _jsxs("div", {
                    className: "form-group",
                    style: { flex: 1, marginBottom: 0 },
                    children: [
                      _jsx("label", { children: "Tier / Speed" }),
                      _jsxs("select", {
                        value: newProvider.tier || "mid",
                        onChange: (e) =>
                          setNewProvider({
                            ...newProvider,
                            tier: e.target.value,
                          }),
                        children: [
                          _jsx("option", {
                            value: "cheap",
                            children: "Cheap (Fast / Low Cost)",
                          }),
                          _jsx("option", {
                            value: "mid",
                            children: "Medium (Balanced)",
                          }),
                          _jsx("option", {
                            value: "premium",
                            children: "Premium (High Quality)",
                          }),
                          _jsx("option", {
                            value: "local",
                            children: "Local (Offline / Free)",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs("div", {
                style: { display: "flex", gap: "1rem", marginTop: "0.75rem" },
                children: [
                  _jsxs("div", {
                    className: "form-group",
                    style: { flex: 1, marginBottom: 0 },
                    children: [
                      _jsx("label", { children: "Input Cost ($ / 1M tokens)" }),
                      _jsx("input", {
                        type: "number",
                        step: "0.001",
                        min: "0",
                        value: newProvider.inputCostPer1M ?? "",
                        onChange: (e) =>
                          setNewProvider({
                            ...newProvider,
                            inputCostPer1M:
                              e.target.value === ""
                                ? undefined
                                : parseFloat(e.target.value),
                          }),
                        placeholder: `Default: $${PRESET_DEFAULTS[newProvider.provider]?.defaultInputCost ?? 0.15}`,
                      }),
                    ],
                  }),
                  _jsxs("div", {
                    className: "form-group",
                    style: { flex: 1, marginBottom: 0 },
                    children: [
                      _jsx("label", {
                        children: "Output Cost ($ / 1M tokens)",
                      }),
                      _jsx("input", {
                        type: "number",
                        step: "0.001",
                        min: "0",
                        value: newProvider.outputCostPer1M ?? "",
                        onChange: (e) =>
                          setNewProvider({
                            ...newProvider,
                            outputCostPer1M:
                              e.target.value === ""
                                ? undefined
                                : parseFloat(e.target.value),
                          }),
                        placeholder: `Default: $${PRESET_DEFAULTS[newProvider.provider]?.defaultOutputCost ?? 0.6}`,
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                style: { marginTop: "0.75rem", marginBottom: 0 },
                children: [
                  _jsx("label", { children: "Base URL (Endpoint URL)" }),
                  _jsx("input", {
                    type: "text",
                    value: newProvider.baseUrl,
                    onChange: (e) =>
                      setNewProvider({
                        ...newProvider,
                        baseUrl: e.target.value,
                      }),
                    placeholder:
                      PRESET_DEFAULTS[newProvider.provider]?.baseUrl ||
                      "e.g. https://api.openai.com/v1 or api.gapgpt.app/v1",
                  }),
                  _jsxs("div", {
                    style: {
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      marginTop: "0.25rem",
                    },
                    children: [
                      "Tip: Both ",
                      _jsx("code", { children: "https://api.gapgpt.app/v1" }),
                      " and ",
                      _jsx("code", { children: "api.gapgpt.app/v1" }),
                      " are supported. ",
                      _jsx("code", { children: "/chat/completions" }),
                      " is appended automatically.",
                    ],
                  }),
                ],
              }),
              testStates["new-provider"]?.result &&
                _jsxs("div", {
                  style: {
                    marginTop: "0.75rem",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    background: testStates["new-provider"].result.ok
                      ? "rgba(46, 213, 115, 0.1)"
                      : "rgba(255, 71, 87, 0.1)",
                    color: testStates["new-provider"].result.ok
                      ? "var(--low)"
                      : "var(--critical)",
                    border: `1px solid ${testStates["new-provider"].result.ok ? "rgba(46, 213, 115, 0.3)" : "rgba(255, 71, 87, 0.3)"}`,
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  },
                  children: [
                    _jsx("div", {
                      style: { flexShrink: 0, marginTop: "2px" },
                      children: testStates["new-provider"].result.ok
                        ? _jsx(CheckCircle2, { size: 16 })
                        : _jsx(AlertCircle, { size: 16 }),
                    }),
                    _jsx("span", {
                      children: testStates["new-provider"].result.ok
                        ? `✓ Connected (${testStates["new-provider"].result.latencyMs}ms) — Model: ${testStates["new-provider"].result.model}`
                        : `✗ Connection Error: ${testStates["new-provider"].result.error}`,
                    }),
                  ],
                }),
              _jsxs("div", {
                style: {
                  display: "flex",
                  gap: "0.75rem",
                  marginTop: "1.25rem",
                },
                children: [
                  _jsxs("button", {
                    type: "button",
                    onClick: () => handleTest("new-provider", newProvider),
                    disabled: testStates["new-provider"]?.loading,
                    className: "secondary-button",
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.5rem 1rem",
                    },
                    children: [
                      _jsx(Activity, { size: 16 }),
                      testStates["new-provider"]?.loading
                        ? "Testing..."
                        : "Test Connection",
                    ],
                  }),
                  _jsxs("button", {
                    type: "button",
                    onClick: handleAddProvider,
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.5rem 1.25rem",
                    },
                    children: [_jsx(Plus, { size: 16 }), " Add to Providers"],
                  }),
                ],
              }),
            ],
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
          _jsx("h2", {
            style: {
              fontSize: "1.1rem",
              marginTop: 0,
              marginBottom: "1rem",
              color: "var(--text)",
            },
            children: "Git Provider Settings",
          }),
          _jsx("p", {
            style: {
              fontSize: "0.85rem",
              color: "var(--muted)",
              marginBottom: "1rem",
            },
            children:
              "Configure credentials for pulling Pull/Merge Requests and publishing review comments.",
          }),
          _jsxs("div", {
            className: "form-group",
            children: [
              _jsx("label", { children: "GitLab Base URL" }),
              _jsx("input", {
                type: "url",
                value: local.GITLAB_BASE_URL,
                onChange: (e) =>
                  setLocal({ ...local, GITLAB_BASE_URL: e.target.value }),
                placeholder:
                  "e.g. https://gitlab.com (Usually auto-detected from MR URL)",
              }),
            ],
          }),
          _jsxs("div", {
            className: "form-group",
            children: [
              _jsx("label", { children: "GitLab Personal Access Token" }),
              _jsx("input", {
                type: "password",
                value: local.GITLAB_TOKEN,
                onChange: (e) =>
                  setLocal({ ...local, GITLAB_TOKEN: e.target.value }),
                placeholder: "glpat-... (Defaults to server env if empty)",
              }),
            ],
          }),
          _jsxs("div", {
            className: "form-group",
            style: { marginBottom: 0 },
            children: [
              _jsx("label", {
                children: "GitHub Personal Access Token (for private repos)",
              }),
              _jsx("input", {
                type: "password",
                value: local.GITHUB_TOKEN || "",
                onChange: (e) =>
                  setLocal({ ...local, GITHUB_TOKEN: e.target.value }),
                placeholder: "ghp_... (Optional for public repositories)",
              }),
            ],
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
          _jsx("h2", {
            style: {
              fontSize: "1.1rem",
              marginTop: 0,
              marginBottom: "1rem",
              color: "var(--text)",
            },
            children: "Budget & Limits",
          }),
          _jsxs("div", {
            className: "form-group",
            style: { marginBottom: 0 },
            children: [
              _jsx("label", { children: "Max Budget per Request (USD)" }),
              _jsx("input", {
                type: "number",
                step: "0.001",
                min: "0",
                value: local.BUDGET_LIMIT,
                onChange: (e) =>
                  setLocal({ ...local, BUDGET_LIMIT: e.target.value }),
                placeholder: "e.g. 0.5 (Leave empty for no limit)",
              }),
            ],
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
            style: {
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            },
            children: [
              _jsx(ShieldCheck, { size: 20, color: "var(--accent)" }),
              _jsx("h2", {
                style: { fontSize: "1.1rem", margin: 0, color: "var(--text)" },
                children: "Data Persistence & Backup",
              }),
            ],
          }),
          _jsx("p", {
            style: {
              fontSize: "0.85rem",
              color: "var(--muted)",
              marginBottom: "1rem",
              lineHeight: "1.5",
            },
            children:
              "\u062A\u0645\u0627\u0645 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A\u060C \u062A\u0648\u06A9\u0646\u200C\u0647\u0627 \u0648 \u067E\u0631\u0648\u0627\u06CC\u062F\u0631\u0647\u0627\u06CC \u0634\u0645\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u067E\u0627\u06CC\u062F\u0627\u0631 \u062F\u0631 \u062D\u0627\u0641\u0638\u0647 \u0633\u06CC\u0633\u062A\u0645 (Local Storage) \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0628\u0627 \u0628\u06CC\u0644\u062F \u06CC\u0627 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u0628\u0639\u062F\u06CC \u0628\u0631\u0646\u0627\u0645\u0647 \u067E\u0627\u06A9 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0647\u0645\u0686\u0646\u06CC\u0646 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F \u06CC\u06A9 \u0646\u0633\u062E\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 JSON \u0627\u0632 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u062E\u0648\u062F \u062F\u0631\u06CC\u0627\u0641\u062A \u06CC\u0627 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u06A9\u0646\u06CC\u062F.",
          }),
          _jsxs("div", {
            style: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
            children: [
              _jsxs("button", {
                type: "button",
                onClick: handleExportConfig,
                className: "secondary-button",
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                },
                children: [
                  _jsx(Download, { size: 15 }),
                  " Export Backup (JSON)",
                ],
              }),
              _jsxs("button", {
                type: "button",
                onClick: () => fileInputRef.current?.click(),
                className: "secondary-button",
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                },
                children: [_jsx(Upload, { size: 15 }), " Import Backup (JSON)"],
              }),
              _jsx("input", {
                type: "file",
                ref: fileInputRef,
                onChange: handleImportConfig,
                accept: ".json",
                style: { display: "none" },
              }),
            ],
          }),
          importStatus &&
            _jsx("div", {
              style: {
                marginTop: "0.75rem",
                fontSize: "0.85rem",
                color: importStatus.startsWith("✓")
                  ? "var(--low)"
                  : "var(--critical)",
              },
              children: importStatus,
            }),
        ],
      }),
      hasUnsavedChanges &&
        _jsxs("div", {
          style: {
            position: "sticky",
            bottom: "1.25rem",
            zIndex: 50,
            background: "var(--panel)",
            border: "1px solid rgba(234, 179, 8, 0.6)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
            borderRadius: "12px",
            padding: "0.85rem 1.25rem",
            marginTop: "1.5rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            backdropFilter: "blur(12px)",
          },
          children: [
            _jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: "0.65rem" },
              children: [
                _jsx("span", {
                  style: {
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: "#eab308",
                    boxShadow: "0 0 8px #eab308",
                  },
                }),
                _jsx("span", {
                  style: {
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "var(--text)",
                  },
                  children:
                    "\u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u06CC\u062F! \u0644\u0637\u0641\u0627\u064B \u0628\u0631\u0627\u06CC \u0627\u0639\u0645\u0627\u0644 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u06A9\u0646\u06CC\u062F.",
                }),
              ],
            }),
            _jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: "0.5rem" },
              children: [
                _jsxs("button", {
                  type: "button",
                  onClick: handleDiscard,
                  className: "secondary-button",
                  style: {
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  },
                  children: [
                    _jsx(RotateCcw, { size: 14 }),
                    " \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC",
                  ],
                }),
                _jsxs("button", {
                  type: "button",
                  onClick: handleSave,
                  style: {
                    padding: "0.45rem 1.1rem",
                    fontSize: "0.85rem",
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.4)",
                  },
                  children: [
                    _jsx(Save, { size: 15 }),
                    " \u0630\u062E\u06CC\u0631\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A",
                  ],
                }),
              ],
            }),
          ],
        }),
      _jsxs("div", {
        className: "form-actions",
        style: {
          marginTop: "2rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        },
        children: [
          _jsxs("button", {
            onClick: handleSave,
            style: {
              padding: "0.75rem 1.75rem",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              position: "relative",
            },
            children: [_jsx(Save, { size: 18 }), "Save Configuration"],
          }),
          hasUnsavedChanges &&
            _jsxs("span", {
              style: {
                color: "#eab308",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "rgba(234, 179, 8, 0.1)",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid rgba(234, 179, 8, 0.3)",
              },
              children: [
                _jsx(AlertTriangle, { size: 15 }),
                " \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u06CC\u062F",
              ],
            }),
          saved &&
            _jsxs("span", {
              style: {
                color: "var(--low)",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "rgba(74, 222, 128, 0.1)",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid rgba(74, 222, 128, 0.3)",
              },
              children: [
                _jsx(CheckCircle2, { size: 16 }),
                " Saved successfully / \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F",
              ],
            }),
        ],
      }),
    ],
  });
}
