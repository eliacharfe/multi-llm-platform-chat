
// web/src/app/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant" | "system"; content: string };

// =========================
// Models / Providers (ported from Gradio)
// =========================

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

// =========================
// Page
// =========================

export default function Page() {
  const DEFAULT_MODEL = "openai:gpt-5-mini";

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

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

  async function send() {
    if (!canSend) return;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];

    // keep the final assistant message as the "stream target"
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    autoScrollEnabledRef.current = true;
    isStreamingRef.current = true;
    setIsStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(`${apiUrl}/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
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

            if (autoScrollEnabledRef.current) {
              requestAnimationFrame(scrollToBottom);
            }
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

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  return (
    <main className="h-screen w-screen bg-[#252525] text-gray-200 overflow-hidden">
      <div className="flex h-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-[280px] border-r border-white/10 bg-[#2b2b2b] p-4 flex flex-col gap-4">
          <button className="w-full rounded-lg bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-left">
            + New Chat
          </button>

          {/* “search / current prompt” input */}
          <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 flex items-center gap-2">
            <input
              className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400"
              placeholder="Explain quantum me..."
            />
            <button
              className="opacity-70 hover:opacity-100 transition"
              title="Clear"
            >
              🗑️
            </button>
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
              className="flex-1 overflow-y-auto px-6 pt-28 pb-10"
              onScroll={() => {
                const el = scrollRef.current;
                if (!el) return;
                if (!isStreamingRef.current) return;

                const threshold = 80;
                const distanceFromBottom =
                  el.scrollHeight - el.scrollTop - el.clientHeight;

                if (distanceFromBottom > threshold) {
                  autoScrollEnabledRef.current = false;
                }
              }}
            >
              <div className="mx-auto max-w-3xl">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    Choose a model, and ask anything…
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages
                      .filter((m) => m.role !== "system")
                      .map((m, idx) => {
                        const isUser = m.role === "user";

                        return (
                          <div
                            key={idx}
                            className={`flex ${isUser ? "justify-end" : "justify-start"
                              }`}
                          >
                            {isUser ? (
                              // ✅ USER = bubble
                              <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#3a3a3a] text-gray-100">
                                {m.content}
                              </div>
                            ) : (
                              // ✅ ASSISTANT = plain (no bubble)
                              <div className="w-full max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
                                {/* ✅ loader row while waiting for first tokens */}
                                {isStreaming &&
                                  idx === messages.length - 1 &&
                                  (m.content?.length ?? 0) === 0 && (
                                    <div className="flex items-center gap-3 text-gray-400">
                                      <Spinner />
                                      <span>{thinkingText(model)}</span>
                                    </div>
                                  )}

                                {/* normal markdown */}
                                {m.content?.length ? (
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      code({
                                        className,
                                        children,
                                        ...props
                                      }) {
                                        const isBlock =
                                          /language-\w+/.test(className || "");
                                        if (isBlock) {
                                          return (
                                            <pre className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 overflow-x-auto text-sm">
                                              <code
                                                className={className}
                                                {...props}
                                              >
                                                {children}
                                              </code>
                                            </pre>
                                          );
                                        }

                                        // inline code
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
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* COMPOSER (bottom bar) */}
            <div className="px-6 pb-6 pt-4">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl border border-white/10 bg-[#2f2f2f] shadow-xl">
                  {/* input row */}
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

                  {/* controls row (model + multimodal + send) */}
                  <div className="flex items-center justify-between gap-3 px-3 pb-3">
                    <div className="flex items-center gap-2">
                      {/* OPTIONAL: attachments (multimodal) */}
                      <label className="cursor-pointer rounded-lg px-2 py-2 hover:bg-white/5 transition border border-transparent hover:border-white/10">
                        📎
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          // TODO: hook this to your uploads state if you have one
                          onChange={(e) => {
                            // example: console.log([...e.target.files || []])
                          }}
                          disabled={isStreaming}
                        />
                      </label>

                      {/* model dropdown */}
                      <select
                        className="rounded-lg border border-white/10 bg-[#262626] px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-white/20"
                        value={model}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith("__header__:")) return;
                          setModel(v);
                        }}
                        disabled={isStreaming}
                      >
                        {modelChoices.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.disabled}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* stop button */}
                      <button
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40 transition"
                        onClick={stop}
                        disabled={!isStreaming}
                      >
                        Stop
                      </button>
                    </div>

                    {/* send button (circle) */}
                    <button
                      className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 transition disabled:opacity-40 flex items-center justify-center"
                      onClick={send}
                      disabled={!canSend}
                      title="Send"
                    >
                      ↑
                    </button>
                  </div>
                </div>

                {/* small helper text under composer (optional) */}
                <div className="mt-3 text-center text-xs text-gray-500">
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
