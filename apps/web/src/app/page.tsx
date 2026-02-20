
"use client";

import React, { useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export default function Page() {
  const [model, setModel] = useState("openai:gpt-5-mini");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const abortRef = useRef<AbortController | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isStreaming,
    [input, isStreaming]
  );

  async function send() {
    if (!canSend) return;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
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
          // You can still send this; backend may ignore it for some models
          temperature: 0.7,
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

        // Parse SSE blocks separated by \n\n
        while (true) {
          const idx = buffer.indexOf("\n\n");
          if (idx === -1) break;

          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;

            // DO NOT trim -> preserves spaces/newlines inside JSON string
            const payload = line.slice(5);

            let obj: any;
            try {
              obj = JSON.parse(payload);
            } catch {
              continue; // ignore malformed events
            }

            if (obj.done) {
              setIsStreaming(false);
              abortRef.current = null;
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
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
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
            <button className="opacity-70 hover:opacity-100 transition" title="Clear">
              🗑️
            </button>
          </div>

          <div className="mt-auto">
            <button className="w-full rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition px-3 py-2 text-sm flex items-center gap-2">
              🤝 <span>Sign in with Hugging Face</span>
            </button>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <section className="flex-1 relative">

          {/* chat scroller */}
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 pt-28 pb-10">
              <div className="mx-auto max-w-3xl">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-400">
                    Choose a model, and ask anything…
                  </div>
                ) : (
                  <div className="space-y-4">
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
                            <div
                              className={[
                                "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                isUser
                                  ? "bg-[#3a3a3a] text-gray-100"
                                  : "bg-transparent text-gray-100",
                                isAssistant ? "border border-white/10 bg-white/5" : "",
                              ].join(" ")}
                            >
                              {m.content}
                            </div>
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
                        onChange={(e) => setModel(e.target.value)}
                        disabled={isStreaming}
                      >
                        <option value="openai:gpt-5-mini">OpenAI: GPT-5-mini</option>
                        <option value="openai:gpt-5">OpenAI: GPT-5</option>
                        <option value="openrouter:deepseek/deepseek-chat">
                          OpenRouter: DeepSeek Chat
                        </option>
                        <option value="groq:llama-3.1-8b-instant">
                          Groq: Llama 3.1 8B Instant
                        </option>
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