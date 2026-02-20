
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
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Multi-LLM Platform</h1>

          <select
            className="rounded-md border px-3 py-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isStreaming}
          >
            <option value="openai:gpt-5-mini">openai:gpt-5-mini</option>
            <option value="openai:gpt-5">openai:gpt-5</option>
            <option value="openrouter:deepseek/deepseek-chat">
              openrouter:deepseek/deepseek-chat
            </option>
            <option value="groq:llama-3.1-8b-instant">
              groq:llama-3.1-8b-instant
            </option>
          </select>
        </header>

        <section className="rounded-xl border p-4 min-h-[420px] space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm text-gray-500">
              Choose a model, and ask anything…
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-xs text-gray-500">{m.role}</div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
        </section>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border px-3 py-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={isStreaming}
          />
          <button
            className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
            onClick={send}
            disabled={!canSend}
          >
            Send
          </button>
          <button
            className="rounded-md border px-4 py-2 disabled:opacity-50"
            onClick={stop}
            disabled={!isStreaming}
          >
            Stop
          </button>
        </div>
      </div>
    </main>
  );
}