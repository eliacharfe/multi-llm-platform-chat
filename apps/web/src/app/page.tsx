// web/src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";
import * as Prism from "prismjs";
import "@/lib/prism";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import CopyButton from "@/components/ui/CopyButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ModelDropdown from "@/components/ui/ModelDropdown";
import AuthDialog from "@/components/ui/AuthDialog";
import Tooltip from "@/components/ui/Tooltip";
import IconGhostButton from "@/components/ui/IconGhostButton";

type Msg = { role: "user" | "assistant" | "system"; content: string };

type ChatListItem = {
  id: string;
  title: string;
  model: string;
  updated_at: string;
};

type ChatDetail = {
  id: string;
  title: string;
  model: string;
  messages: Msg[];
  created_at?: string;
  updated_at?: string;
};

const MODEL_OPTIONS = [
  "openai:gpt-5-nano",
  "openai:gpt-5-mini",
  "openai:gpt-5",
  "openrouter:deepseek/deepseek-chat",
  "openrouter:x-ai/grok-4.1-fast",
  "openrouter:openai/gpt-4o-mini",
  "openrouter:mistralai/mistral-large-2512",
  "groq:llama-3.1-8b-instant",
  "groq:llama-3.3-70b-versatile",
  "anthropic:claude-sonnet-4-6",
  "anthropic:claude-opus-4-6",
  "anthropic:claude-haiku-4-5",
  "gemini:models/gemini-2.5-flash-lite",
  "gemini:models/gemini-2.5-flash",
] as const;

const DEFAULT_TEMPERATURE = 0.7;

const TEMPERATURE_BY_MODEL: Record<string, number> = {
  "openrouter:deepseek/deepseek-chat": 0.7,
  "openrouter:x-ai/grok-4.1-fast": 0.7,
  "openrouter:openai/gpt-4o-mini": 0.7,
  "openrouter:mistralai/mistral-large-2512": 0.6,
  "groq:llama-3.1-8b-instant": 0.7,
  "groq:llama-3.2-3b": 0.6,
  "groq:llama-3.3-70b-versatile": 0.7,
  "anthropic:claude-sonnet-4-6": 0.6,
  "anthropic:claude-opus-4-6": 0.6,
  "anthropic:claude-haiku-4-5": 0.7,
  "gemini:models/gemini-2.5-flash-lite": 0.7,
  "gemini:models/gemini-2.5-flash": 0.7,
};

const PROVIDER_TITLES: Record<string, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  groq: "Groq",
  anthropic: "Anthropic",
  gemini: "Gemini",
  nebius: "Nebius",
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🟢",
  openrouter: "⚡",
  groq: "🟠",
  anthropic: "🟣",
  gemini: "🔵",
  nebius: "🟤",
};

type SelectOpt = { value: string; label: string; disabled?: boolean };

function getTemperature(providerModel: string) {
  const t = TEMPERATURE_BY_MODEL[providerModel];
  return typeof t === "number" ? t : DEFAULT_TEMPERATURE;
}

function prettifyModelName(modelName: string) {
  const raw = (modelName || "").trim().split("/").pop() || modelName;
  const spaced = raw.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

  return spaced
    .split(" ")
    .map((w) => {
      const lw = w.toLowerCase();
      if (lw === "gpt") return "GPT";
      if (lw === "llama") return "Llama";
      if (lw === "claude") return "Claude";
      if (lw === "gemini") return "Gemini";
      return /^[0-9.]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function thinkingText(providerModel: string) {
  const [, modelName = ""] = providerModel.split(":", 2);
  const pretty = prettifyModelName(modelName);
  return `${pretty} is thinking about it...`;
}

function buildSectionedChoices(models: readonly string[]): SelectOpt[] {
  const grouped = new Map<string, string[]>();

  for (const pm of models) {
    const [provider] = pm.split(":", 1);
    if (!provider) continue;
    grouped.set(provider, [...(grouped.get(provider) || []), pm]);
  }

  const order = ["openai", "openrouter", "groq", "anthropic", "gemini", "nebius"];
  const out: SelectOpt[] = [];

  for (const provider of order) {
    const items = grouped.get(provider);
    if (!items?.length) continue;

    const icon = PROVIDER_ICONS[provider] ?? "•";
    const title = PROVIDER_TITLES[provider] ?? provider;

    out.push({
      value: `__header__:${provider}`,
      label: `--- ${icon} ${title} ${icon} ---`,
      disabled: true,
    });

    for (const pm of items) {
      const [, modelName = ""] = pm.split(":", 2);
      out.push({
        value: pm,
        label: `${icon}  ${prettifyModelName(modelName)}`
      });
    }
  }

  return out;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin"
      aria-label="Loading"
    />
  );
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  return (children as any)?.toString?.() ?? "";
}

function formatChatTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  } catch {
    return "";
  }
}


export default function Page() {
  const DEFAULT_MODEL = "gemini:models/gemini-2.5-flash";

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });
  }, []);

  const [authOpen, setAuthOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("Sign in");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) setUserLabel("Sign in");
      else setUserLabel(u.displayName || u.email || "Account");
    });
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const abortRef = useRef<AbortController | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const isStreamingRef = useRef(false);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null);

  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"default" | "danger">("default");
  const [confirmText, setConfirmText] = useState("OK");
  const [cancelText, setCancelText] = useState("Cancel");

  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setIsAuthed(!!u);
      if (!u) setUserLabel("Sign in");
      else setUserLabel(u.displayName || u.email || "Account");
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthReady(true);
      setIsAuthed(!!u);

      if (!u) {
        setUserLabel("Sign in");
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        setInput("");
        setAttachedFiles([]);
        stop();
        return;
      }
      setUserLabel(u.displayName || u.email || "Account");

      try {
        await refreshChats();
      } catch {
        // ignore
      }
    });

    return () => unsub();
  }, []);

  function openConfirm(opts: {
    title: string;
    message: string;
    variant?: "default" | "danger";
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => Promise<void> | void;
  }) {
    setConfirmTitle(opts.title);
    setConfirmMessage(opts.message);
    setConfirmVariant(opts.variant ?? "default");
    setConfirmText(opts.confirmText ?? "OK");
    setCancelText(opts.cancelText ?? "Cancel");
    confirmActionRef.current = opts.onConfirm;
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (confirmLoading) return;
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }

  const modelChoices = useMemo(() => buildSectionedChoices(MODEL_OPTIONS), []);
  const canSend = useMemo(
    () => (input.trim().length > 0 || attachedFiles.length > 0) && !isStreaming,
    [input, attachedFiles.length, isStreaming]
  );
  // const canSend = useMemo(
  //   () =>
  //     auth.currentUser &&
  //     (input.trim().length > 0 || attachedFiles.length > 0) &&
  //     !isStreaming,
  //   [input, attachedFiles.length, isStreaming, authReady]
  // );

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [chats, chatSearch]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setIsSidebarCollapsed(mq.matches);

    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await auth.currentUser?.getIdToken();

    const headers: Record<string, string> = {
      ...(init?.headers as any),
    };

    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return undefined as T;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${txt ? ` — ${txt}` : ""}`);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
  }

  async function refreshChats() {
    if (!auth.currentUser) {
      setChats([]);
      return;
    }

    setIsSidebarLoading(true);
    try {
      const data = await api<{ chats: ChatListItem[] }>("/v1/chats", { method: "GET" });
      setChats(data?.chats || []);
    } finally {
      setIsSidebarLoading(false);
    }
  }

  function newDraftChat() {
    stop();

    if (!activeChatId && messages.length === 0) return;

    setActiveChatId(null);
    setMessages([]);
    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    if (isSmallRef.current) setIsSidebarCollapsed(true);
  }

  async function openChat(chatId: string) {
    if (!chatId) return;

    stop();

    setMessages([]);
    setActiveChatId(chatId);

    const detail = await api<any>(`/v1/chats/${chatId}`, { method: "GET" });
    const chat = detail?.chat ?? detail;

    setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    if (chat?.model) setModel(chat.model);

    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    if (isSmallRef.current) setIsSidebarCollapsed(true);
  }

  async function ensureChatId(): Promise<string> {
    if (activeChatId) return activeChatId;

    const created = await api<{ chat_id: string }>("/v1/chats", {
      method: "POST",
      body: JSON.stringify({ model }),
    });

    setActiveChatId(created.chat_id);
    await refreshChats();
    return created.chat_id;
  }

  useEffect(() => {
    if (!authReady) return;
    if (!auth.currentUser) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      return;
    }
    refreshChats().catch(() => { });
  }, [authReady]);


  async function send() {

    if (!auth.currentUser) {
      setAuthOpen(true);
      return;
    }

    if (!canSend) return;

    const userText =
      input.trim() ||
      (attachedFiles.length ? "Summarize the attached file(s)." : "");

    if (!userText && attachedFiles.length === 0) return;

    const chatId = await ensureChatId();

    const DEBUG_SSE = model.startsWith("openai:gpt-5");
    console.log("[send] model:", model, "chatId:", chatId);

    const userMsg: Msg = { role: "user", content: userText };
    const nextMessages = [...messages, userMsg];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    setInput("");

    isStreamingRef.current = true;
    setIsStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("model", model);
      fd.append("temperature", String(getTemperature(model)));
      fd.append("message", userText);
      fd.append("messages", JSON.stringify(nextMessages));

      for (const f of attachedFiles) {
        fd.append("files", f);
      }

      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`${apiUrl}/v1/chat/stream_with_files`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : undefined,
        signal: ac.signal,
        body: fd,
      });

      if (res.status === 401) {
        setAuthOpen(true);
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortRef.current = null;
        return;
      }

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${txt ? ` — ${txt}` : ""}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";
      let finished = false;

      const processBuffer = () => {
        buffer = buffer.replace(/\r\n/g, "\n");

        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx === -1) break;

          const eventBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          if (DEBUG_SSE) {
            console.log("[sse] raw eventBlock:", JSON.stringify(eventBlock));
          }

          const dataLines: string[] = [];
          for (const line of eventBlock.split("\n")) {
            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^\s/, ""));
            }
          }

          if (!dataLines.length) {
            if (DEBUG_SSE) console.log("[sse] (skip) no data: lines");
            continue;
          }

          const payload = dataLines.join("\n");

          if (DEBUG_SSE) {
            console.log("[sse] payload:", payload);
          }

          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch (e) {
            if (DEBUG_SSE) console.warn("[sse] JSON.parse failed:", e);
            continue;
          }

          if (DEBUG_SSE) console.log("[sse] obj:", obj);

          if (obj.done) {
            if (DEBUG_SSE) console.log("[sse] done received");
            finished = true;
            return;
          }

          if (obj.error) {
            const short = String(obj.error_short ?? obj.error ?? "Unknown error");

            if (DEBUG_SSE) console.error("[sse] error received:", { error: obj.error, error_short: obj.error_short });

            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              const errText = `⚠️ ${short}`;

              if (last?.role === "assistant" && (last.content || "") === "") {
                copy[copy.length - 1] = { ...last, content: errText };
                return copy;
              }
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: `${last.content}\n\n${errText}` };
                return copy;
              }
              return [...copy, { role: "assistant", content: errText }];
            });

            finished = true;
            return;
          }

          const token: string = obj.t ?? "";
          if (!token) {
            if (DEBUG_SSE) console.warn("[sse] no token (obj.t empty)");
            continue;
          }

          if (DEBUG_SSE) console.log("[sse] token:", JSON.stringify(token));

          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              const next = (last.content || "") + token;
              copy[copy.length - 1] = { ...last, content: next };
              if (DEBUG_SSE) console.log("[ui] assistant len:", next.length);
            }
            return copy;
          });

          scrollToBottom(false);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
        }

        if (done) break;
      }

      buffer += decoder.decode();
      processBuffer();

      if (!finished) {
        finished = true;
      }

      setAttachedFiles([]);
      scrollToBottom(true);
      refreshChats().catch(() => { });

      if (DEBUG_SSE) {
        const last = messages[messages.length - 1];
        console.log("[send] finished=", finished, "last assistant length=", last?.content?.length);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];

          if (last?.role === "assistant" && (last.content || "") === "") {
            copy[copy.length - 1] = {
              ...last,
              content: `⚠️ ${String(e?.message || e)}`,
            };
            return copy;
          }

          return [
            ...copy,
            { role: "assistant", content: `⚠️ ${String(e?.message || e)}` },
          ];
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      isStreamingRef.current = false;
    }
  }


  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    isStreamingRef.current = false;
  }

  function isNearBottom(threshold = 120) {
    const el = scrollRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= threshold;
  }

  function scrollToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;

    if (!force && !autoScrollEnabledRef.current) return;

    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    });
  }

  const isSmallRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => {
      isSmallRef.current = mq.matches;
      setIsSidebarCollapsed(mq.matches);
    };

    apply();
    mq.addEventListener?.("change", apply) ?? mq.addListener(apply);

    return () => {
      mq.removeEventListener?.("change", apply) ?? mq.removeListener(apply);
    };
  }, []);

  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 750px)");
    const apply = () => {
      setIsSmall(mq.matches);
      setIsSidebarCollapsed(mq.matches);
    };

    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  function detectDir(text: string): "rtl" | "ltr" {
    const s = (text || "").trim();
    if (!s) return "ltr";

    const rtlChars = s.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g)?.length ?? 0;
    const ltrChars = s.match(/[A-Za-z]/g)?.length ?? 0;
    if (rtlChars > ltrChars) return "rtl";
    return "ltr";
  }

  // optional: for better punctuation/number mixing inside RTL text
  function unicodeBidiFor(dir: "rtl" | "ltr") {
    return dir === "rtl" ? "plaintext" : "normal";
  }

  return (
    <main className="h-screen w-screen bg-[#252525] text-gray-200 overflow-hidden">

      {isSmall ? (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((v) => !v)}
          className="fixed left-3 top-3 z-60 h-10 w-10 rounded-xl border border-white/10 bg-black/30 backdrop-blur flex items-center justify-center text-gray-200 hover:bg-black/40 transition"
          aria-label={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          title={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isSidebarCollapsed ? "☰" : "✕"}
        </button>
      ) : null}

      {/* ICON */}
      <a
        href="/"
        className={`fixed left-3 top-2 z-50 transition-all duration-300 hover:scale-105 active:scale-95 ${isSidebarCollapsed
          ? "opacity-0 scale-90 pointer-events-none"
          : "opacity-100 scale-100"}`}
        title="Multi LLM Chat"
      >
        <img
          src="/multi-llm-chat-logo.png"
          alt="Multi LLM Chat"
          className="h-10 w-10"
        />
      </a>

      <div className="flex h-full">

        {/* Mobile backdrop */}
        {isSmall && !isSidebarCollapsed ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        ) : null}
        {/* LEFT SIDEBAR */}
        <aside
          className={[
            "h-full min-h-0 border-r border-white/10 bg-[#2b2b2b] flex flex-col overflow-hidden",
            "transition-all duration-200 ease-out",

            isSmall
              ? [
                "fixed left-0 top-0 z-50",
                "w-[92vw] max-w-[420px]",
                "transform transition-transform duration-200 ease-out will-change-transform",
                isSidebarCollapsed ? "-translate-x-full" : "translate-x-0",
              ].join(" ")
              :
              (isSidebarCollapsed
                ? "w-[56px]"
                : "w-[250px] sm:w-[270px] lg:w-[280px] xl:w-[290px]"),
          ].join(" ")}
        >

          {/* Toggle button */}
          <div className="relative pt-20 px-2">

            <div
              className={[
                "absolute top-2 z-10",
                isSidebarCollapsed
                  ? "left-1/2 -translate-x-1/2"
                  : "right-2",
              ].join(" ")}
            >
              <IconGhostButton
                label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                withTooltip={false}
                size="md"
                onClick={() => setIsSidebarCollapsed((v) => !v)}
                disabled={isStreaming}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 transition-transform duration-200 ${isSidebarCollapsed ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <path d="M12 5v14" />
                </svg>
              </IconGhostButton>
            </div>
          </div>

          {/* Sidebar content (full height column) */}
          {!isSidebarCollapsed && (
            <div className="flex-1 min-h-0 px-4 pb-4 pt-0 flex flex-col">
              {/* Top actions */}
              <div className="flex flex-col gap-3 shrink-0">
                <button
                  className="w-full rounded-lg bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-left"
                  onClick={newDraftChat}
                >
                  + New Chat
                </button>

                <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 flex items-center gap-2">
                  <input
                    className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400"
                    placeholder="Search chats..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                  />
                  <button
                    className="opacity-70 hover:opacity-100 transition cursor-pointer"
                    title="Search"
                    type="button"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chats list (SCROLLS) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 mt-4">
                {isSidebarLoading && chats.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-2">Loading chats…</div>
                ) : filteredChats.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-2">No saved chats yet.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredChats.map((c) => {
                      const active = c.id === activeChatId;

                      return (
                        <div
                          key={c.id}
                          className={[
                            "group w-full text-left rounded-lg px-3 py-2 border transition relative",
                            active
                              ? "bg-white/10 border-white/15"
                              : "bg-black/10 border-white/10 hover:bg-white/10 hover:border-white/15",
                          ].join(" ")}
                        >
                          <button onClick={() => openChat(c.id)} className="w-full text-left">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm text-gray-100 truncate">
                                {c.title || "New chat"}
                              </div>
                              <div className="text-[11px] text-gray-400 shrink-0">
                                {formatChatTime(c.updated_at)}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-400 truncate">
                              {c.model}
                            </div>
                          </button>

                          <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();

                                const id = c.id;

                                openConfirm({
                                  title: "Delete chat?",
                                  message: "This will permanently delete the chat and its messages.",
                                  variant: "danger",
                                  confirmText: "Delete",
                                  cancelText: "Cancel",
                                  onConfirm: async () => {
                                    await api(`/v1/chats/${id}`, { method: "DELETE" });

                                    if (activeChatId === id) {
                                      setActiveChatId(null);
                                      setMessages([]);
                                    }

                                    await refreshChats();
                                    closeConfirm();
                                  },
                                });
                              }}
                              className="relative group/delete text-gray-400 hover:text-red-400"
                              aria-label="Delete chat"
                            >
                              🗑️

                              {/* Tooltip (bottom, compact) */}
                              <span
                                className={[
                                  "pointer-events-none absolute right-0 translate-x-0 top-full mb-2 z-9999",
                                  "opacity-0 translate-y-0.5 group-hover/delete:opacity-100 group-hover/delete:translate-y-0",
                                  "transition duration-150",
                                ].join(" ")}
                              >
                                <span className="absolute right-2 -top-[3px] h-1.5 w-1.5 rotate-45 bg-white/95 rounded-[2px] shadow-sm z-9999" />
                                <span className="block whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-[11px] leading-none text-black shadow-lg z-9999">
                                  Delete Chat
                                </span>
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer (ALWAYS VISIBLE) */}
              <div className="shrink-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="w-full rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition px-3 py-2 text-sm flex items-center justify-between gap-2"
                >
                  <span className="truncate">{userLabel}</span>
                  <span className="text-xs text-gray-400">{isAuthed ? "🟢" : "○"}</span>
                </button>
              </div>
            </div>
          )}
        </aside>


        {/* MAIN CHAT AREA */}
        <section className="flex-1 relative min-w-0">
          <div className="h-full flex flex-col">
            {/* chat scroller */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-[calc(220px+env(safe-area-inset-bottom))]"
              onScroll={() => {
                autoScrollEnabledRef.current = isNearBottom(140);
              }}
            >
              <div className="mx-auto max-w-3xl min-w-0">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-full max-w-3xl px-2">
                      <div className="relative text-center">
                        {/* Glow background */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="h-40 w-md bg-linear-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 blur-3xl rounded-full opacity-60" />
                        </div>

                        <div className="relative">
                          <div className="text-3xl sm:text-4xl font-semibold text-gray-100 tracking-tight lg:pt-20 sm:pt-1 md:pt-10">
                            Welcome back!
                          </div>

                          <div className="mt-2 text-base sm:text-lg text-gray-400">
                            Choose a model, and ask anything…
                          </div>

                          {/* suggestions */}
                          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              {
                                t: "Generate a useful Python script",
                                s: "Convert it to JavaScript, then explain the differences",
                              },
                              {
                                t: "Evaluate two AI models of your choice",
                                s: "Analyze speed, cost, and output quality",
                              },
                              {
                                t: "Explain a well-known physics problem",
                                s: "Break down its core principles clearly",
                              },
                              {
                                t: "Next.js vs Angular",
                                s: "When to choose each in real projects",
                              },
                            ]
                              // .slice(0, isExtraSmall ? 3 : 4)
                              .map((x) => (
                                <button
                                  key={x.t}
                                  type="button"
                                  onClick={() => setInput(`${x.t}\n${x.s}`)}
                                  className={[
                                    "group cursor-pointer text-left rounded-2xl border border-white/10",
                                    "bg-white/3 hover:bg-white/6 transition",
                                    "px-5 py-4",
                                    "transform-gpu will-change-transform",
                                    "hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.99]",
                                    "duration-200 ease-out",
                                    "hover:shadow-[0_12px_35px_rgba(0,0,0,0.35)]",
                                    "hover:ring-1 hover:ring-white/15",
                                  ].join(" ")}
                                >
                                  <div className="text-sm font-medium text-gray-100">{x.t}</div>
                                  <div className="mt-1 text-sm text-gray-400">{x.s}</div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages
                      .filter((m) => m.role !== "system")
                      .map((m, idx) => {
                        const isUser = m.role === "user";
                        const isAssistant = m.role === "assistant";

                        const dir = detectDir(m.content);
                        const isRTL = dir === "rtl";

                        return (
                          <div
                            key={idx}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            {isUser ? (
                              <div className="max-w-[75%]" dir={dir} style={{ unicodeBidi: isRTL ? "plaintext" : "normal" }}>
                                {/* Bubble */}
                                <div
                                  className={[
                                    "rounded-2xl border border-white/10 bg-blue-600/20 px-4 py-3 shadow-sm",
                                    isRTL ? "text-right" : "text-left",
                                  ].join(" ")}
                                >
                                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
                                    {m.content}
                                  </div>
                                </div>

                                <div className={["mt-1 flex", isRTL ? "justify-start" : "justify-end"].join(" ")}>
                                  <CopyButton text={m.content} />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full max-w-3xl">
                                <div
                                  dir={dir}
                                  style={{ unicodeBidi: isRTL ? "plaintext" : "normal" }}
                                  className={[
                                    "text-sm leading-relaxed text-gray-100 min-w-0",
                                    "wrap-anywhere",
                                    isRTL ? "text-right" : "text-left",
                                    "[&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1",
                                    "[&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-2",
                                    "[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-x-auto",
                                    "[&_code]:max-w-full",
                                    "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
                                    "[&_img]:max-w-full",
                                  ].join(" ")}
                                >
                                  {isStreaming &&
                                    idx === messages.length - 1 &&
                                    (m.content?.length ?? 0) === 0 && (
                                      <div className="flex items-center gap-3 text-gray-400">
                                        <Spinner />
                                        <span>{thinkingText(model)}</span>
                                      </div>
                                    )}

                                  {m.content?.length ? (
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        code({ className, children, ...props }) {
                                          const lang =
                                            (className || "").match(/language-(\w+)/)?.[1] || "";
                                          const isBlock = /language-\w+/.test(className || "");

                                          if (isBlock) {
                                            const raw = childrenToText(children).replace(/\n$/, "");
                                            const grammar = (Prism.languages as any)[lang];
                                            const highlighted = grammar
                                              ? Prism.highlight(raw, grammar, lang)
                                              : raw;

                                            return (
                                              // <div className="relative my-3" dir="ltr">
                                              <div className="relative my-3 max-w-full min-w-0" dir="ltr">
                                                <div className="absolute right-2 top-2 flex items-center gap-2">
                                                  {lang && (
                                                    <span className="text-[11px] text-gray-400 rounded-md border border-white/10 bg-black/30 px-2 py-1">
                                                      {lang}
                                                    </span>
                                                  )}
                                                  <CopyButton
                                                    text={raw}
                                                    className="bg-black/30"
                                                    title="Copy code"
                                                  />
                                                </div>

                                                <pre
                                                  dir="ltr"
                                                  className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 pt-10 overflow-x-auto max-w-full text-sm"
                                                >
                                                  <code
                                                    className={className}
                                                    dangerouslySetInnerHTML={{ __html: highlighted }}
                                                  />
                                                </pre>
                                              </div>
                                            );
                                          }

                                          // inline code should also stay LTR
                                          return (
                                            <code
                                              dir="ltr"
                                              className="bg-[#1e1e1e] border border-white/10 px-1.5 py-0.5 rounded text-xs"
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          );
                                        },
                                      }}
                                    >
                                      {m.content}
                                    </ReactMarkdown>
                                  ) : null}
                                </div>

                                {
                                  isAssistant && (m.content?.length ?? 0) > 0 ? (
                                    <div className={["mt-2 flex", isRTL ? "justify-end" : "justify-start"].join(" ")}>
                                      <CopyButton text={m.content} />
                                    </div>
                                  ) : null
                                }
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* COMPOSER (bottom bar) — FIXED OUTSIDE SCROLL */}
            <div
              className={[
                "fixed bottom-0 bg-[#252525] transition-opacity",
                "z-30",
                isSmall && !isSidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100",
              ].join(" ")}
              style={{
                left: isSmall ? 0 : isSidebarCollapsed ? 56 : 290,
                right: 0,
              }}
            >
              <div className="px-6 pt-4 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <div className="mx-auto max-w-3xl">
                  <div className="relative p-[3px] rounded-2xl focus-within:bg-linear-to-r focus-within:from-blue-500 focus-within:via-indigo-500 focus-within:to-blue-500 transition-all">
                    <div className="rounded-2xl bg-[#2f2f2f]">
                      <div className="px-4 pt-4">
                        {attachedFiles.length > 0 ? (
                          <div className="px-4 pt-3 flex flex-wrap gap-2">
                            {attachedFiles.map((f, idx) => (
                              <div
                                key={`${f.name}-${idx}`}
                                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-200"
                                title={f.name}
                              >
                                <span className="max-w-[220px] truncate">{f.name}</span>
                                <button
                                  type="button"
                                  className="opacity-80 hover:opacity-100"
                                  onClick={() =>
                                    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  disabled={isStreaming}
                                  aria-label={`Remove ${f.name}`}
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              className="ml-1 text-xs text-gray-300/80 hover:text-gray-200 underline underline-offset-2"
                              onClick={() => setAttachedFiles([])}
                              disabled={isStreaming}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}

                        <textarea
                          className="w-full resize-none bg-transparent outline-none text-gray-100 placeholder:text-gray-400 text-sm leading-relaxed"
                          placeholder="Send a message…"
                          rows={2}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              send();
                            }
                          }}
                          disabled={isStreaming}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 px-3 pb-3">
                        <div className="flex items-center gap-1">
                          <IconGhostButton
                            label="Toggle Sidebar"
                            onClick={() => setIsSidebarCollapsed((v) => !v)}
                            disabled={isStreaming}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect x="4" y="5" width="16" height="14" rx="2" />
                              <path d="M12 5v14" />
                            </svg>
                          </IconGhostButton>

                          <Tooltip text="Attach files" side="bottom">
                            <label
                              className={[
                                "h-7 w-7 rounded-lg",
                                "flex items-center justify-center",
                                "text-white/70 hover:text-white",
                                "hover:bg-white/6",
                                "transition cursor-pointer",
                              ].join(" ")}
                              aria-label="Attach files"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.84 8.84a2 2 0 0 1-2.83-2.83l8.49-8.49" />
                              </svg>

                              <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (!files.length) return;
                                  setAttachedFiles((prev) => [...prev, ...files]);
                                  e.currentTarget.value = "";
                                }}
                                disabled={isStreaming}
                              />
                            </label>
                          </Tooltip>

                          <ModelDropdown
                            value={model}
                            options={modelChoices}
                            onChange={(v) => {
                              if (v.startsWith("__header__:")) return;
                              setModel(v);
                            }}
                            disabled={isStreaming}
                          />
                        </div>

                        <button
                          className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 transition disabled:opacity-40 flex items-center justify-center"
                          onClick={isStreaming ? stop : send}
                          disabled={isStreaming ? false : !canSend}
                          title={isStreaming ? "Stop" : "Send"}
                        >
                          {isStreaming ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="white"
                              className="w-5 h-5"
                              aria-hidden="true"
                            >
                              <rect x="7" y="7" width="10" height="10" rx="2" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-5 h-5"
                              aria-hidden="true"
                            >
                              <path d="M2 2L13 13" />
                              <path d="M2 2L9 22L13 13L22 9L2 2Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 text-center text-xs text-gray-500">
                    Multi-LLM Platform • Streaming enabled
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section >
      </div >


      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        variant={confirmVariant}
        confirmText={confirmText}
        cancelText={cancelText}
        loading={confirmLoading}
        onClose={closeConfirm}
        onConfirm={async () => {
          const fn = confirmActionRef.current;
          if (!fn) return;
          await fn();
        }}
      />
    </main >
  );
}
