import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import {
  Plus,
  Upload,
  Download,
  Trash,
  Edit,
  Book,
  ChevronRight,
  Layers,
  FileCode,
  CheckCircle,
} from "lucide-react";
const DEFAULT_SKILLS = [
  {
    id: "agent.react-reviewer",
    name: "React Reviewer",
    focus: "react",
    description:
      "React correctness & idioms. Reviews changed lines for React-specific issues.",
    instructions:
      "You are the React Reviewer. FOCUS:react. Review the diff and return JSON matching {issues,confidence,summary}. Evaluate hooks, state management, component composition, and rendering performance.",
    type: "framework",
    targets: ["react", "next.js", "tsx", "jsx"],
  },
  {
    id: "agent.dotnet-reviewer",
    name: ".NET Core & C# Reviewer",
    focus: "dotnet, csharp",
    description:
      "Reviews C# and .NET Core code for idioms, LINQ usage, memory management, and async best practices.",
    instructions:
      "You are the .NET Core and C# Reviewer. FOCUS:dotnet,csharp. Evaluate usage of async/await, Task, dependency injection, IDisposable, LINQ performance, and C# naming conventions.",
    type: "framework",
    targets: ["cs", "csproj", "dotnet", "c#"],
  },
  {
    id: "agent.python-reviewer",
    name: "Python Reviewer",
    focus: "python",
    description:
      "Reviews Python code for PEP-8 compliance, idiomatic constructs, type hints, and performance.",
    instructions:
      "You are the Python Reviewer. FOCUS:python. Check for PEP-8 violations, idiomatic Python (list comprehensions, generators), proper use of type hints, and efficient data structures.",
    type: "language",
    targets: ["py", "python"],
  },
  {
    id: "agent.android-reviewer",
    name: "Android Reviewer (Kotlin/Java)",
    focus: "android",
    description:
      "Reviews Android code for memory leaks, UI performance, Coroutines/RxJava usage, and SDK best practices.",
    instructions:
      "You are the Android Reviewer. FOCUS:android. Review Kotlin and Java code targeting Android. Check for Context leaks, main thread blocking, inefficient View/Compose rendering, and Coroutine scope mismanagement.",
    type: "framework",
    targets: ["kt", "java", "xml", "android"],
  },
  {
    id: "agent.ios-reviewer",
    name: "iOS Reviewer (Swift/Obj-C)",
    focus: "ios",
    description:
      "Reviews iOS code for retain cycles, memory management, SwiftUI/UIKit performance, and Swift idioms.",
    instructions:
      "You are the iOS Reviewer. FOCUS:ios. Review Swift and Objective-C code. Check for retain cycles (weak self), main thread UI updates, SwiftUI view performance, and idiomatic Swift usage.",
    type: "framework",
    targets: ["swift", "m", "h", "ios"],
  },
  {
    id: "agent.nextjs-reviewer",
    name: "Next.js Reviewer",
    focus: "nextjs",
    description:
      "Reviews Next.js applications for App/Pages router patterns, SSR/SSG usage, and hydration issues.",
    instructions:
      "You are the Next.js Reviewer. FOCUS:nextjs. Check for correct usage of server vs client components, data fetching methods, routing best practices, and image optimization.",
    type: "framework",
    targets: ["next.js", "react", "tsx", "jsx"],
  },
  {
    id: "agent.angular-reviewer",
    name: "Angular Reviewer",
    focus: "angular",
    description:
      "Reviews Angular code for RxJS memory leaks, ChangeDetection, and component architecture.",
    instructions:
      "You are the Angular Reviewer. FOCUS:angular. Review Angular components and services. Check for RxJS subscription leaks (takeUntil, async pipe), ChangeDetectionStrategy.OnPush usage, and DI module boundaries.",
    type: "framework",
    targets: ["angular", "ts", "html"],
  },
  {
    id: "agent.vue-reviewer",
    name: "Vue.js Reviewer",
    focus: "vuejs",
    description:
      "Reviews Vue components for Composition/Options API usage, reactivity patterns, and lifecycle hooks.",
    instructions:
      "You are the Vue Reviewer. FOCUS:vuejs. Review Vue 2/3 code. Check for proper use of ref/reactive, unsubscription in lifecycle hooks, computed properties performance, and template semantics.",
    type: "framework",
    targets: ["vue", "js", "ts"],
  },
  {
    id: "agent.typescript-reviewer",
    name: "TypeScript Reviewer",
    focus: "typescript",
    description:
      "Reviews TypeScript code for type safety, avoiding any, and advanced generic usages.",
    instructions:
      "You are the TypeScript Reviewer. FOCUS:typescript. Check for strict type safety. Avoid 'any' types, prefer 'unknown', ensure proper use of union/intersection types, generics, and strict null checks.",
    type: "language",
    targets: ["ts", "tsx"],
  },
  {
    id: "agent.react-native-reviewer",
    name: "React Native Reviewer",
    focus: "react-native",
    description:
      "Reviews React Native code for bridge crossing performance, mobile-specific UI, and animations.",
    instructions:
      "You are the React Native Reviewer. FOCUS:react-native. Check for excessive bridge crossings, proper use of FlatList/FlashList, Reanimated worklets, and mobile gesture handling.",
    type: "framework",
    targets: ["react-native", "tsx", "jsx"],
  },
  {
    id: "agent.security-reviewer",
    name: "Security Reviewer",
    focus: "security",
    description:
      "Security vulnerabilities. Reviews changed lines for security issues.",
    instructions:
      "You are the Security Reviewer. FOCUS:security. Review the diff for security vulnerabilities like XSS, CSRF, SQL Injection, hardcoded secrets, and unsafe dependencies.",
    type: "general",
  },
  {
    id: "agent.performance-reviewer",
    name: "Performance Reviewer",
    focus: "performance",
    description:
      "Performance issues. Reviews changed lines for performance bottlenecks.",
    instructions:
      "You are the Performance Reviewer. FOCUS:performance. Review the diff for inefficient algorithms, memory leaks, unnecessary allocations, and slow database queries.",
    type: "general",
  },
  {
    id: "agent.code-reviewer",
    name: "Code Reviewer",
    focus: "code",
    description:
      "General code quality. Reviews changed lines for general code quality.",
    instructions:
      "You are the Code Reviewer. FOCUS:code. Review the diff for general code quality, readability, maintainability, naming conventions, and dead code.",
    type: "general",
  },
  {
    id: "rule.secret-detection",
    name: "Secret Detection (Rule)",
    focus: "secret_detection",
    description:
      "Deterministic rule that detects hardcoded secrets / API keys / tokens in added code.",
    instructions:
      "Scans files using regex patterns for OpenAI keys, AWS keys, private keys, and generic token variables.",
    type: "general",
  },
  {
    id: "agent.dead-code",
    name: "Dead Code Analyzer",
    focus: "dead_code",
    description:
      "Detects unused variables, functions, and unreachable code paths across files.",
    instructions:
      "You are the Dead Code Analyzer. FOCUS:dead_code. Find unused code, commented out code blocks, and unreachable logic.",
    type: "language",
    targets: ["ts", "js", "python", "java"],
  },
];
function SkillCard({ skill, onEdit, onDelete }) {
  let Icon = Book;
  if (skill.type === "framework") Icon = Layers;
  if (skill.type === "language") Icon = FileCode;
  if (skill.type === "general") Icon = CheckCircle;
  return _jsxs("div", {
    className: "skill-card",
    style: {
      background: "var(--panel)",
      borderRadius: "12px",
      border: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
    },
    children: [
      _jsxs("div", {
        style: { padding: "1.25rem", flex: 1 },
        children: [
          _jsx("div", {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "0.5rem",
            },
            children: _jsxs("h3", {
              style: {
                margin: 0,
                fontSize: "1.1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              },
              children: [
                _jsx(Icon, { size: 18, style: { color: "var(--accent)" } }),
                skill.name,
              ],
            }),
          }),
          _jsxs("div", {
            style: {
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            },
            children: [
              _jsxs("span", {
                style: {
                  display: "inline-block",
                  fontSize: "0.75rem",
                  background: "rgba(255,255,255,0.1)",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  color: "var(--muted)",
                },
                children: ["focus: ", skill.focus],
              }),
              skill.targets
                ?.slice(0, 3)
                .map((t) =>
                  _jsx(
                    "span",
                    {
                      style: {
                        display: "inline-block",
                        fontSize: "0.75rem",
                        background: "rgba(47, 129, 247, 0.1)",
                        color: "var(--accent)",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                      },
                      children: t,
                    },
                    t,
                  ),
                ),
              (skill.targets?.length || 0) > 3 &&
                _jsxs("span", {
                  style: {
                    display: "inline-block",
                    fontSize: "0.75rem",
                    background: "rgba(47, 129, 247, 0.1)",
                    color: "var(--accent)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                  },
                  children: ["+", skill.targets.length - 3, " more"],
                }),
            ],
          }),
          _jsx("p", {
            style: {
              fontSize: "0.9rem",
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.5,
            },
            children: skill.description,
          }),
        ],
      }),
      _jsxs("div", {
        style: {
          padding: "0.75rem 1.25rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          background: "rgba(0,0,0,0.1)",
        },
        children: [
          _jsx("button", {
            onClick: onDelete,
            style: {
              background: "transparent",
              border: "none",
              color: "#ff4d4d",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
            },
            title: "Delete skill",
            children: _jsx(Trash, { size: 16 }),
          }),
          _jsxs("button", {
            onClick: onEdit,
            className: "secondary-button",
            style: { display: "flex", alignItems: "center", gap: "0.5rem" },
            children: [_jsx(Edit, { size: 14 }), "Edit"],
          }),
        ],
      }),
    ],
  });
}
export function SkillsView() {
  const [skills, setSkills] = useState(() => {
    try {
      const saved = localStorage.getItem("ai-review-skills-v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge missing default skills so the user gets newly added framework skills
        const missing = DEFAULT_SKILLS.filter(
          (ds) => !parsed.find((p) => p.id === ds.id),
        );
        return [...parsed, ...missing];
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SKILLS;
  });
  const [editingSkill, setEditingSkill] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  useEffect(() => {
    localStorage.setItem("ai-review-skills-v3", JSON.stringify(skills));
  }, [skills]);
  const handleSave = (skill) => {
    if (isCreating) {
      setSkills([...skills, { ...skill, id: `skill-${Date.now()}` }]);
    } else {
      setSkills(skills.map((s) => (s.id === skill.id ? skill : s)));
    }
    setEditingSkill(null);
    setIsCreating(false);
  };
  const handleDelete = (id) => {
    setSkills(skills.filter((s) => s.id !== id));
  };
  const handleExport = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(skills, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "ai-review-skills.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result);
        if (Array.isArray(imported)) {
          const merged = [...skills];
          imported.forEach((imp) => {
            if (!merged.find((s) => s.id === imp.id)) {
              merged.push(imp);
            }
          });
          setSkills(merged);
        }
      } catch (err) {
        alert("Invalid JSON file format");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset input
  };
  if (editingSkill || isCreating) {
    return _jsx(SkillEditor, {
      initial: editingSkill,
      allSkills: skills,
      onSave: handleSave,
      onCancel: () => {
        setEditingSkill(null);
        setIsCreating(false);
      },
    });
  }
  const groupedSkills = {
    framework: skills.filter((s) => s.type === "framework"),
    language: skills.filter((s) => s.type === "language"),
    general: skills.filter((s) => !s.type || s.type === "general"),
  };
  return _jsxs("div", {
    className: "skills-view",
    style: { maxWidth: "1100px", margin: "0 auto" },
    children: [
      _jsxs("header", {
        className: "view-header",
        style: {
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        },
        children: [
          _jsxs("div", {
            children: [
              _jsx("h1", {
                style: { margin: 0, fontSize: "1.5rem" },
                children: "AI Agent Skills",
              }),
              _jsx("p", {
                style: {
                  color: "var(--muted)",
                  marginTop: "0.5rem",
                  maxWidth: "600px",
                },
                children:
                  "Extend the AI review agents by defining specific libraries, frameworks, or domain rules. The orchestrator automatically routes code to the right specialists based on file extensions and contents.",
              }),
            ],
          }),
          _jsxs("div", {
            style: { display: "flex", gap: "0.75rem" },
            children: [
              _jsxs("label", {
                className: "secondary-button",
                style: {
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                },
                children: [
                  _jsx(Upload, { size: 16 }),
                  "Import",
                  _jsx("input", {
                    type: "file",
                    accept: ".json",
                    onChange: handleImport,
                    style: { display: "none" },
                  }),
                ],
              }),
              _jsxs("button", {
                className: "secondary-button",
                onClick: handleExport,
                style: { display: "flex", alignItems: "center", gap: "0.5rem" },
                children: [_jsx(Download, { size: 16 }), "Export"],
              }),
              _jsxs("button", {
                onClick: () => {
                  setIsCreating(true);
                  setEditingSkill({
                    id: "",
                    name: "",
                    focus: "",
                    description: "",
                    instructions: "",
                    type: "framework",
                    targets: [],
                  });
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                },
                children: [_jsx(Plus, { size: 16 }), "Add Skill"],
              }),
            ],
          }),
        ],
      }),
      skills.length === 0
        ? _jsxs("div", {
            className: "empty-state",
            style: {
              textAlign: "center",
              padding: "4rem 2rem",
              background: "var(--panel)",
              borderRadius: "12px",
              border: "1px dashed var(--border)",
            },
            children: [
              _jsx(Book, {
                size: 48,
                style: {
                  margin: "0 auto",
                  color: "var(--muted)",
                  marginBottom: "1rem",
                },
              }),
              _jsx("h3", { children: "No custom skills defined" }),
              _jsx("p", {
                style: { color: "var(--muted)", marginBottom: "1.5rem" },
                children:
                  "Create a new skill to teach the AI specific patterns and rules.",
              }),
              _jsx("button", {
                onClick: () => {
                  setIsCreating(true);
                  setEditingSkill({
                    id: "",
                    name: "",
                    focus: "",
                    description: "",
                    instructions: "",
                    type: "framework",
                    targets: [],
                  });
                },
                children: "Add your first skill",
              }),
            ],
          })
        : _jsxs("div", {
            style: { display: "flex", flexDirection: "column", gap: "3rem" },
            children: [
              groupedSkills.framework.length > 0 &&
                _jsxs("section", {
                  children: [
                    _jsxs("h2", {
                      style: {
                        fontSize: "1.2rem",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "0.5rem",
                      },
                      children: [
                        _jsx(Layers, {
                          size: 20,
                          style: { color: "var(--accent)" },
                        }),
                        " Frameworks & Libraries",
                      ],
                    }),
                    _jsx("div", {
                      className: "skills-grid",
                      children: groupedSkills.framework.map((skill) =>
                        _jsx(
                          SkillCard,
                          {
                            skill: skill,
                            onEdit: () => setEditingSkill(skill),
                            onDelete: () => handleDelete(skill.id),
                          },
                          skill.id,
                        ),
                      ),
                    }),
                  ],
                }),
              groupedSkills.language.length > 0 &&
                _jsxs("section", {
                  children: [
                    _jsxs("h2", {
                      style: {
                        fontSize: "1.2rem",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "0.5rem",
                      },
                      children: [
                        _jsx(FileCode, {
                          size: 20,
                          style: { color: "var(--accent)" },
                        }),
                        " Language Specific",
                      ],
                    }),
                    _jsx("div", {
                      className: "skills-grid",
                      children: groupedSkills.language.map((skill) =>
                        _jsx(
                          SkillCard,
                          {
                            skill: skill,
                            onEdit: () => setEditingSkill(skill),
                            onDelete: () => handleDelete(skill.id),
                          },
                          skill.id,
                        ),
                      ),
                    }),
                  ],
                }),
              groupedSkills.general.length > 0 &&
                _jsxs("section", {
                  children: [
                    _jsxs("h2", {
                      style: {
                        fontSize: "1.2rem",
                        marginBottom: "1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "0.5rem",
                      },
                      children: [
                        _jsx(CheckCircle, {
                          size: 20,
                          style: { color: "var(--accent)" },
                        }),
                        " General Rules & Pipeline",
                      ],
                    }),
                    _jsx("div", {
                      className: "skills-grid",
                      children: groupedSkills.general.map((skill) =>
                        _jsx(
                          SkillCard,
                          {
                            skill: skill,
                            onEdit: () => setEditingSkill(skill),
                            onDelete: () => handleDelete(skill.id),
                          },
                          skill.id,
                        ),
                      ),
                    }),
                  ],
                }),
            ],
          }),
    ],
  });
}
function SkillEditor({ initial, allSkills, onSave, onCancel }) {
  const [skill, setSkill] = useState(
    initial || {
      id: "",
      name: "",
      focus: "",
      description: "",
      instructions: "",
      type: "framework",
      targets: [],
    },
  );
  const [targetInput, setTargetInput] = useState(
    (initial?.targets || []).join(", "),
  );
  const handleImport = (e) => {
    const importId = e.target.value;
    if (!importId || !allSkills) return;
    const source = allSkills.find((s) => s.id === importId);
    if (source) {
      setSkill({
        ...source,
        id: skill.id, // keep current id, whether it's empty or existing
      });
      setTargetInput((source.targets || []).join(", "));
    }
  };
  return _jsxs("div", {
    className: "skill-editor",
    style: { maxWidth: "800px" },
    children: [
      _jsxs("header", {
        style: {
          marginBottom: "2rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        },
        children: [
          _jsx("button", {
            onClick: onCancel,
            style: {
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              padding: "0",
            },
            children: "Skills",
          }),
          _jsx(ChevronRight, { size: 16, style: { color: "var(--muted)" } }),
          _jsx("h2", {
            style: { margin: 0, fontSize: "1.2rem" },
            children: initial?.id ? "Edit Skill" : "New Skill",
          }),
        ],
      }),
      _jsxs("div", {
        style: {
          background: "var(--panel)",
          padding: "1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        },
        children: [
          !initial?.id &&
            allSkills &&
            allSkills.length > 0 &&
            _jsxs("div", {
              className: "form-group",
              style: {
                marginBottom: "1.5rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid var(--border)",
              },
              children: [
                _jsxs("label", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  },
                  children: [
                    "Import from existing skill",
                    _jsx("span", {
                      style: {
                        fontSize: "0.75rem",
                        fontWeight: "normal",
                        color: "var(--muted)",
                      },
                      children:
                        "(Optional: Use an existing skill as a template)",
                    }),
                  ],
                }),
                _jsxs("select", {
                  onChange: handleImport,
                  defaultValue: "",
                  children: [
                    _jsx("option", {
                      value: "",
                      disabled: true,
                      children: "Select a skill to copy...",
                    }),
                    allSkills.map((s) =>
                      _jsx("option", { value: s.id, children: s.name }, s.id),
                    ),
                  ],
                }),
              ],
            }),
          _jsxs("div", {
            style: { display: "flex", gap: "1rem", marginBottom: "1rem" },
            children: [
              _jsxs("div", {
                className: "form-group",
                style: { flex: 1, marginBottom: 0 },
                children: [
                  _jsx("label", { children: "Skill Name" }),
                  _jsx("input", {
                    type: "text",
                    value: skill.name,
                    onChange: (e) =>
                      setSkill({ ...skill, name: e.target.value }),
                    placeholder: "e.g. Angular Best Practices",
                  }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                style: { width: "200px", marginBottom: 0 },
                children: [
                  _jsx("label", { children: "Category Type" }),
                  _jsxs("select", {
                    value: skill.type || "general",
                    onChange: (e) =>
                      setSkill({ ...skill, type: e.target.value }),
                    children: [
                      _jsx("option", {
                        value: "framework",
                        children: "Framework / Library",
                      }),
                      _jsx("option", {
                        value: "language",
                        children: "Language Specific",
                      }),
                      _jsx("option", {
                        value: "general",
                        children: "General / Pipeline",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          _jsxs("div", {
            style: { display: "flex", gap: "1rem", marginBottom: "1rem" },
            children: [
              _jsxs("div", {
                className: "form-group",
                style: { flex: 1, marginBottom: 0 },
                children: [
                  _jsx("label", { children: "Focus (Internal Tag)" }),
                  _jsx("input", {
                    type: "text",
                    value: skill.focus,
                    onChange: (e) =>
                      setSkill({ ...skill, focus: e.target.value }),
                    placeholder: "e.g. angular",
                  }),
                ],
              }),
              (skill.type === "framework" || skill.type === "language") &&
                _jsxs("div", {
                  className: "form-group",
                  style: { flex: 2, marginBottom: 0 },
                  children: [
                    _jsx("label", {
                      children: "Target Files (Comma separated)",
                    }),
                    _jsx("input", {
                      type: "text",
                      value: targetInput,
                      onChange: (e) => {
                        setTargetInput(e.target.value);
                        setSkill({
                          ...skill,
                          targets: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        });
                      },
                      placeholder:
                        skill.type === "language"
                          ? "e.g. ts, js, py"
                          : "e.g. angular, rx.js",
                    }),
                  ],
                }),
            ],
          }),
          _jsx("p", {
            style: {
              fontSize: "0.8rem",
              color: "var(--muted)",
              margin: "-0.5rem 0 1rem 0",
            },
            children:
              "The orchestrator uses the focus tag and targets to activate this skill when relevant files are detected.",
          }),
          _jsxs("div", {
            className: "form-group",
            children: [
              _jsx("label", { children: "Description / Goal" }),
              _jsx("input", {
                type: "text",
                value: skill.description,
                onChange: (e) =>
                  setSkill({ ...skill, description: e.target.value }),
                placeholder: "Brief description of what this agent checks for",
              }),
            ],
          }),
          _jsxs("div", {
            className: "form-group",
            children: [
              _jsx("label", {
                children: "Instructions & Rules (System Prompt)",
              }),
              _jsx("textarea", {
                value: skill.instructions,
                onChange: (e) =>
                  setSkill({ ...skill, instructions: e.target.value }),
                placeholder:
                  "- Rule 1: Always do X...\\n- Rule 2: Never do Y...",
                rows: 10,
                style: {
                  width: "100%",
                  padding: "0.75rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text)",
                  fontFamily: "monospace",
                },
              }),
            ],
          }),
          _jsxs("div", {
            style: {
              display: "flex",
              gap: "1rem",
              marginTop: "2rem",
              justifyContent: "flex-end",
            },
            children: [
              _jsx("button", {
                className: "secondary-button",
                onClick: onCancel,
                children: "Cancel",
              }),
              _jsx("button", {
                onClick: () => onSave(skill),
                disabled: !skill.name || !skill.focus,
                style: {
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                },
                children: "Save Skill",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
