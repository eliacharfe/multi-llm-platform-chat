// apps/web/src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "@/lib/prism";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AuthDialog from "@/components/ui/AuthDialog";
import LogoSplash from "@/components/ui/LogoSplash";

import Sidebar from "@/components/chat/Sidebar";
import type { ChatListItem } from "@/components/chat/Sidebar";

import MessageList from "@/components/chat/MessageList";
import type { Msg } from "@/components/chat/MessageList";

import Composer from "@/components/chat/Composer";
import type { SelectOpt } from "@/components/chat/Composer";

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



export default function Page() {
  const DEFAULT_MODEL = "gemini:models/gemini-2.5-flash";

  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;

    const minMs = 3000;
    const t = window.setTimeout(() => setShowSplash(false), minMs);
    return () => window.clearTimeout(t);
  }, [authReady]);

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

  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);

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

    console.log("[ensureChatId] creating chat", {
      model,
      input: input.trim(),
      files: attachedFiles.length,
      stack: new Error().stack,
    });

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

  function addFiles(files: File[]) {
    if (!files.length) return;

    const dedupKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

    setAttachedFiles((prev) => {
      const prevKeys = new Set(prev.map(dedupKey));
      const next = [...prev];

      for (const f of files) {
        if (!prevKeys.has(dedupKey(f))) {
          next.push(f);
          prevKeys.add(dedupKey(f));
        }
      }
      return next;
    });
  }

  useEffect(() => {
    const hasFiles = (dt: DataTransfer | null) => {
      if (!dt) return false;
      return Array.from(dt.types || []).includes("Files");
    };

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      e.preventDefault(); // allow drop
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    };

    const onDrop = (e: DragEvent) => {
      if (isStreaming) return;
      if (!hasFiles(e.dataTransfer)) return;

      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);

      const files = Array.from(e.dataTransfer?.files || []);
      addFiles(files);
    };

    const preventWindowDrop = (e: DragEvent) => {
      if (hasFiles(e.dataTransfer)) e.preventDefault();
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    // extra safety
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);

      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, [isStreaming]);

  return (
    <main className="h-screen w-screen bg-[#252525] text-gray-200 overflow-hidden">
      <LogoSplash
        show={showSplash}
        text={authReady ? "Preparing your workspace…" : "Initializing…"}
      />

      {isDraggingFiles ? (
        <div
          className="fixed inset-0 z-999 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-white/15 bg-black/40 px-6 py-4 text-sm text-gray-100 shadow-xl">
            Drop files to attach
          </div>
        </div>
      ) : null}

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
          src="/multi-llm-logo.png"
          alt="Multi LLM Chat"
          className="h-7 w-7"
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
        <Sidebar
          isSmall={isSmall}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          isStreaming={isStreaming}
          chats={chats}
          filteredChats={filteredChats}
          activeChatId={activeChatId}
          isSidebarLoading={isSidebarLoading}
          chatSearch={chatSearch}
          setChatSearch={setChatSearch}
          onNewChat={newDraftChat}
          onOpenChat={openChat}
          onRequestDeleteChat={(id) => {
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
          userLabel={userLabel}
          isAuthed={isAuthed}
          onOpenAuth={() => setAuthOpen(true)}
        />


        {/* MAIN CHAT AREA */}
        <section className="flex-1 relative min-w-0">
          <div className="h-full flex flex-col">
            {/* chat scroller */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-[calc(env(safe-area-inset-bottom)-15px)]"
              onScroll={() => {
                autoScrollEnabledRef.current = isNearBottom(140);
              }}
            >
              <div className="mx-auto max-w-3xl min-w-0">
                <MessageList
                  messages={messages}
                  isStreaming={isStreaming}
                  model={model}
                  thinkingLabel={thinkingText(model)}
                  onSuggestion={(text) => setInput(text)}
                />
              </div>
            </div>

            {/* COMPOSER (bottom bar) — FIXED OUTSIDE SCROLL */}
            <Composer
              input={input}
              setInput={setInput}
              attachedFiles={attachedFiles}
              onAddFiles={addFiles}
              onClearFiles={() => setAttachedFiles([])}
              model={model}
              modelChoices={modelChoices}
              onChangeModel={(v) => {
                if (v.startsWith("__header__:")) return;
                setModel(v);
              }}
              canSend={canSend}
              isStreaming={isStreaming}
              onSend={send}
              onStop={stop}
              isSmall={isSmall}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
            />

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
