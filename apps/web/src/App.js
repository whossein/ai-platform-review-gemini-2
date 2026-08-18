import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import {
  Code,
  Settings,
  History,
  Wrench,
  Menu,
  X,
  Activity,
} from "lucide-react";
import { ReviewView } from "./ReviewView.js";
import { SettingsView } from "./SettingsView.js";
import { SkillsView } from "./SkillsView.js";
import { HistoryView } from "./HistoryView.js";
import { HowItWorksView } from "./HowItWorksView.js";
import { useAppConfig } from "./Settings.js";
export function App() {
  const [activeTab, setActiveTab] = useState("review");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [config] = useAppConfig();
  const tabs = [
    { id: "howitworks", label: "How It Works", icon: Activity },
    { id: "review", label: "Code Review", icon: Code },
    { id: "skills", label: "Skills & Rules", icon: Wrench },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return _jsxs("div", {
    className: "dashboard-layout",
    children: [
      _jsxs("div", {
        className: "mobile-header",
        children: [
          _jsx("h2", { children: "AI Review" }),
          _jsx("button", {
            className: "icon-btn",
            onClick: () => setIsMobileMenuOpen(!isMobileMenuOpen),
            children: isMobileMenuOpen
              ? _jsx(X, { size: 24 })
              : _jsx(Menu, { size: 24 }),
          }),
        ],
      }),
      _jsxs("aside", {
        className: `sidebar ${isMobileMenuOpen ? "open" : ""}`,
        children: [
          _jsxs("div", {
            className: "sidebar-brand",
            children: [
              _jsx("h2", { children: "AI Review" }),
              _jsx("span", { className: "version", children: "v1.0" }),
            ],
          }),
          config.BUDGET_LIMIT &&
            _jsx("div", {
              style: { padding: "0 1rem", marginBottom: "1.5rem" },
              children: _jsxs("div", {
                style: {
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                },
                children: [
                  _jsx("span", {
                    style: {
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    },
                    children: "Max Budget",
                  }),
                  _jsxs("span", {
                    style: {
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "var(--text)",
                    },
                    children: ["$", parseFloat(config.BUDGET_LIMIT).toFixed(2)],
                  }),
                ],
              }),
            }),
          _jsx("nav", {
            className: "sidebar-nav",
            children: tabs.map((tab) => {
              const Icon = tab.icon;
              return _jsxs(
                "button",
                {
                  className: `nav-item ${activeTab === tab.id ? "active" : ""}`,
                  onClick: () => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  },
                  children: [
                    _jsx(Icon, { size: 20 }),
                    _jsx("span", { children: tab.label }),
                  ],
                },
                tab.id,
              );
            }),
          }),
        ],
      }),
      _jsxs("main", {
        className: "main-content",
        children: [
          activeTab === "howitworks" && _jsx(HowItWorksView, {}),
          activeTab === "review" && _jsx(ReviewView, {}),
          activeTab === "skills" && _jsx(SkillsView, {}),
          activeTab === "history" && _jsx(HistoryView, {}),
          activeTab === "settings" && _jsx(SettingsView, {}),
        ],
      }),
      isMobileMenuOpen &&
        _jsx("div", {
          className: "sidebar-backdrop",
          onClick: () => setIsMobileMenuOpen(false),
        }),
    ],
  });
}
