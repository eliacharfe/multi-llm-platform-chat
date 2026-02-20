// web/src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CopyButton from "@/components/ui/CopyButton";

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
        label: `${icon} ${modelName}`,
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

function getUserId(): string {
  if (typeof window === "undefined") return "dev-user";
  const key = "mlc_x_user_id";
  let v = window.localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    window.localStorage.setItem(key, v);
  }
  return v;
}

export default function Page() {
  const DEFAULT_MODEL = "openai:gpt-5-mini";

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

  const modelChoices = useMemo(() => buildSectionedChoices(MODEL_OPTIONS), []);
  const canSend = useMemo(
    () => input.trim().length > 0 && !isStreaming,
    [input, isStreaming]
  );

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [chats, chatSearch]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": getUserId(),
        ...(init?.headers ?? {}),
      },
    });

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
    setIsSidebarLoading(true);
    try {
      const data = await api<{ chats: ChatListItem[] }>("/v1/chats", { method: "GET" });
      setChats(data.chats || []);
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
  }

  async function openChat(chatId: string) {
    if (!chatId) return;

    stop();

    setMessages([]);
    setActiveChatId(chatId);

    const detail = await api<any>(`/v1/chats/${chatId}`, { method: "GET" });

    const chat = detail?.chat ?? detail;

    console.log("openChat detail:", detail);

    setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    if (chat?.model) setModel(chat.model);

    autoScrollEnabledRef.current = true;
    scrollToBottom(true);
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
    refreshChats().catch(() => { });
  }, []);

  async function send() {
    if (!canSend) return;

    const chatId = await ensureChatId();

    const userMsg: Msg = { role: "user", content: input.trim() };
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
      const res = await fetch(`${apiUrl}/v1/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getUserId(),
        },
        signal: ac.signal,
        body: JSON.stringify({
          chat_id: chatId,
          model,
          messages: nextMessages,
          temperature: getTemperature(model),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx === -1) break;

          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5);

            let obj: any;
            try {
              obj = JSON.parse(payload);
            } catch {
              continue;
            }

            if (obj.done) {
              setIsStreaming(false);
              abortRef.current = null;
              isStreamingRef.current = false;
              scrollToBottom(true);

              refreshChats().catch(() => { });
              return;
            }

            if (obj.error) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + `\n⚠️ ${obj.error}`,
                  };
                }
                return copy;
              });
              continue;
            }

            const token: string = obj.t ?? "";
            if (!token) continue;

            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + token,
                };
              }
              return copy;
            });

            scrollToBottom(false);
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${String(e)}` },
        ]);
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

  return (
    <main className="h-screen w-screen bg-[#252525] text-gray-200 overflow-hidden">

      <a
        href="/"
        className="fixed left-4 top-4 z-50 transition hover:scale-105 active:scale-95"
        title="Multi LLM Chat"
      >
        <img
          src="/multi-llm-chat-logo.png"
          alt="Multi LLM Chat"
          className="h-10 w-10"
        />
      </a>


      <div className="flex h-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-[280px] border-r border-white/10 bg-[#2b2b2b] p-4 flex flex-col gap-4 pt-20">
          <button
            className="w-full rounded-lg bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-left "
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
              className="opacity-70 hover:opacity-100 transition"
              title="Search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          {/* Chats list (saved only) */}
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            {isSidebarLoading && chats.length === 0 ? (
              <div className="text-xs text-gray-400 px-2 py-2">Loading chats…</div>
            ) : filteredChats.length === 0 ? (
              <div className="text-xs text-gray-400 px-2 py-2">
                No saved chats yet.
              </div>
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
                      {/* Clickable area */}
                      <button
                        onClick={() => openChat(c.id)}
                        className="w-full text-left"
                      >
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

                      {/* Delete button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Delete this chat?")) return;

                          await api(`/v1/chats/${c.id}`, {
                            method: "DELETE",
                          });

                          if (activeChatId === c.id) {
                            setActiveChatId(null);
                            setMessages([]);
                          }

                          await refreshChats();
                        }}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-400"
                        title="Delete chat"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto">
            <button className="w-full rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition px-3 py-2 text-sm flex items-center gap-2">
              <span>Eliachar Feig</span>
            </button>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <section className="flex-1 relative">
          <div className="h-full flex flex-col">
            {/* chat scroller */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 pt-28 pb-1"
              onScroll={() => {
                autoScrollEnabledRef.current = isNearBottom(140);
              }}
            >
              <div className="mx-auto max-w-3xl">
                {messages.length === 0 ? (
                  <div className="min-h-[55vh] flex items-center justify-center">
                    <div className="w-full max-w-3xl px-2">
                      <div className="relative text-center">

                        {/* Glow background */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="h-40 w-[28rem] bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 blur-3xl rounded-full opacity-60" />
                        </div>

                        <div className="relative">
                          <div className="text-3xl sm:text-4xl font-semibold text-gray-100 tracking-tight">
                            Welcome back!
                          </div>

                          <div className="mt-2 text-base sm:text-lg text-gray-400">
                            Choose a model, and ask anything…
                          </div>

                          {/* suggestions */}
                          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              { t: "What is the capital of Indonesia?", s: "Jakarta or Nusantara?" },
                              { t: "Generate Python code for", s: "web scraping with BeautifulSoup" },
                              { t: "Explain a well-known physics problem", s: "and its fundamental principles" },
                              { t: "Compare Next.js vs Angular", s: "project use cases" },
                            ].map((x) => (
                              <button
                                key={x.t}
                                type="button"
                                onClick={() => setInput(`${x.t}\n${x.s}`)}
                                className="cursor-pointer text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition px-5 py-4"
                              >
                                <div className="text-sm font-medium text-gray-100">
                                  {x.t}
                                </div>
                                <div className="mt-1 text-sm text-gray-400">
                                  {x.s}
                                </div>
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

                        return (
                          <div
                            key={idx}
                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          >
                            {isUser ? (
                              <div className="max-w-[75%]">
                                <div className="relative whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#3a3a3a] text-gray-100">
                                  {m.content}
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <CopyButton text={m.content} />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full max-w-3xl">
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
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
                                          const raw = childrenToText(children).replace(/\n$/, "");

                                          if (isBlock) {
                                            return (
                                              <div className="relative my-3">
                                                <div className="absolute right-2 top-2 flex items-center gap-2">
                                                  {lang ? (
                                                    <span className="text-[11px] text-gray-400 rounded-md border border-white/10 bg-black/30 px-2 py-1">
                                                      {lang}
                                                    </span>
                                                  ) : null}
                                                  <CopyButton
                                                    text={raw}
                                                    className="bg-black/30"
                                                    title="Copy code"
                                                  />
                                                </div>

                                                <pre className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 pt-10 overflow-x-auto text-sm">
                                                  <code className={className} {...props}>
                                                    {children}
                                                  </code>
                                                </pre>
                                              </div>
                                            );
                                          }

                                          return (
                                            <code
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

                                {isAssistant && (m.content?.length ?? 0) > 0 ? (
                                  <div className="mt-2 flex justify-start">
                                    <CopyButton text={m.content} />
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* COMPOSER (bottom bar) */}
            <div className="px-6 pb-3 pt-4">
              <div className="mx-auto max-w-3xl">
                <div className="relative p-[3px] rounded-2xl focus-within:bg-gradient-to-r focus-within:from-blue-500 focus-within:via-indigo-500 focus-within:to-blue-500 transition-all">
                  <div className="rounded-2xl bg-[#2f2f2f]">
                    {/* <div className="rounded-2xl border border-white/10 bg-[#2f2f2f] shadow-xl transition-all focus-within:border-blue-600 focus-within:border-[4px]"> */}
                    <div className="px-4 pt-4">
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
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-lg px-2 py-2 hover:bg-white/5 transition border border-transparent hover:border-white/10">
                          📎
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={() => { }}
                            disabled={isStreaming}
                          />
                        </label>

                        <select
                          className="rounded-lg border border-white/10 bg-[#262626] px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-white/20"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}   // ✅ add this
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (isStreaming) stop();
                              else send();
                            }
                          }}
                          disabled={isStreaming}
                        >
                          {modelChoices.map((opt) => (
                            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                      </div>

                      <button
                        className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 transition disabled:opacity-40 flex items-center justify-center"
                        onClick={isStreaming ? stop : send}
                        disabled={isStreaming ? false : !canSend}
                        title={isStreaming ? "Stop" : "Send"}
                      >
                        {isStreaming ? (
                          // STOP icon (square)
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
                          // SEND icon (paper plane)
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
        </section>
      </div>
    </main>
  );
}
