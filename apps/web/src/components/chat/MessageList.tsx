
// apps/web/src/components/chat/MessageList.tsx

"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Prism from "prismjs";
import "@/lib/prism";

import CopyButton from "@/components/ui/CopyButton";
import ActionButton from "@/components/ui/ActionButton";
import { useReadAloud } from "@/hooks/useReadAloud";
import { estimateCost, formatCost } from "@/lib/models";

export type Msg = {
    role: "user" | "assistant" | "system";
    content: string;
    isError?: boolean;
    modelSwitch?: string;
    inputTokens?: number;
    outputTokens?: number;
};

function Spinner() {
    return (
        <span
            className="inline-block h-4 w-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin"
            aria-label="Loading"
        />
    );
}

function RetryButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="Try again"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 transition"
        >
            <span aria-hidden="true">↻</span>
            <span>Retry</span>
        </button>
    );
}

function TokenBadge({ inputTokens, outputTokens, model }: {
    inputTokens: number;
    outputTokens: number;
    model: string;
}) {
    const total = inputTokens + outputTokens;
    if (!total) return null;

    const cost = estimateCost(model, inputTokens, outputTokens);
    const costStr = cost > 0 ? formatCost(cost) : null;

    return (
        <span
            title={`Input: ${inputTokens.toLocaleString()} · Output: ${outputTokens.toLocaleString()} · Total: ${total.toLocaleString()} tokens`}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-300 hover:border-white/20 transition cursor-default select-none"
        >
            <span>{total.toLocaleString()} tok</span>
            {costStr && (
                <>
                    <span className="opacity-30">·</span>
                    <span className="text-emerald-600/70">{costStr}</span>
                </>
            )}
        </span>
    );
}

function childrenToText(children: React.ReactNode): string {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(childrenToText).join("");
    return (children as any)?.toString?.() ?? "";
}

function detectDir(text: string): "rtl" | "ltr" {
    const s = (text || "").trim();
    if (!s) return "ltr";
    const rtlChars =
        s.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g)?.length ?? 0;
    const ltrChars = s.match(/[A-Za-z]/g)?.length ?? 0;
    return rtlChars > ltrChars ? "rtl" : "ltr";
}

export default function MessageList({
    messages,
    isStreaming,
    thinkingLabel,
    model,
    onSuggestion,
    conversationText,
    onRetry,
    onEditMessage,
    onShare,
    isShareLoading,
    apiUrl,
}: {
    messages: Msg[];
    isStreaming: boolean;
    thinkingLabel: string;
    model: string;
    onSuggestion: (text: string) => void;
    conversationText: string;
    onRetry: () => void;
    onEditMessage: (idx: number, newContent: string) => void;
    onShare?: () => void;
    isShareLoading?: boolean;
    apiUrl: string;
}) {
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState("");

    const { speak, stop, togglePause, speakingIdx, isLoading, isPaused } = useReadAloud(apiUrl);

    const suggestions = [
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
    ];

    if (messages.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-full max-w-3xl px-2">
                    <div className="relative text-center">
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="h-40 w-md bg-linear-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 blur-3xl rounded-full opacity-60" />
                        </div>
                        <div className="relative">
                            <div className="text-3xl sm:text-4xl font-semibold text-gray-100 tracking-tight 2xl:pt-30">
                                Welcome back!
                            </div>
                            <div className="mt-2 text-base sm:text-lg text-gray-400">
                                Choose a model, and ask anything…
                            </div>
                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {suggestions.map((x) => (
                                    <button
                                        key={x.t}
                                        type="button"
                                        onClick={() => onSuggestion(`${x.t}\n${x.s}`)}
                                        className={[
                                            "group cursor-pointer text-left rounded-2xl border border-white/10",
                                            "bg-white/3 hover:bg-teal-500/8 transition",
                                            "px-5 py-4",
                                            "transform-gpu will-change-transform",
                                            "hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.99]",
                                            "duration-200 ease-out",
                                            "hover:shadow-[0_12px_35px_rgba(20,184,166,0.15)]",
                                            "hover:ring-1 hover:ring-teal-500/25",
                                            "hover:border-teal-500/30",
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
        );
    }

    return (
        <div className="space-y-5">
            {messages
                .filter((m) => m.role !== "system" || m.modelSwitch)
                .map((m, idx) => {
                    if (m.modelSwitch) {
                        return (
                            <div key={idx} className="flex items-center gap-3 py-1">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    🔄 Switched to {m.modelSwitch}
                                </span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>
                        );
                    }

                    const isUser = m.role === "user";
                    const isAssistant = m.role === "assistant";
                    const isLastMessage = idx === messages.length - 1;
                    const isThisStreaming = isStreaming && isLastMessage;

                    const dir = detectDir(m.content);
                    const isRTL = dir === "rtl";

                    return (
                        <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                            {isUser ? (
                                <div
                                    className="max-w-[75%]"
                                    dir={dir}
                                    style={{ unicodeBidi: isRTL ? "plaintext" : "normal" }}
                                >
                                    {editingIdx === idx ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                className="w-full rounded-2xl border border-blue-500/50 bg-[#1e1e1e] px-4 py-3 text-sm text-gray-100 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                                rows={Math.max(2, editDraft.split("\n").length)}
                                                value={editDraft}
                                                onChange={e => setEditDraft(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                        onEditMessage(idx, editDraft);
                                                        setEditingIdx(null);
                                                    }
                                                    if (e.key === "Escape") setEditingIdx(null);
                                                }}
                                                autoFocus
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingIdx(null)}
                                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 transition"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onEditMessage(idx, editDraft);
                                                        setEditingIdx(null);
                                                    }}
                                                    className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/30 transition"
                                                >
                                                    Send ↵
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={[
                                                // "rounded-2xl border border-white/10 bg-blue-600/20 px-4 py-3 shadow-sm",
                                                "rounded-2xl border border-teal-500/20 bg-teal-500/10 px-4 py-3 shadow-sm",
                                                isRTL ? "text-right" : "text-left",
                                            ].join(" ")}>
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
                                                    {m.content}
                                                </div>
                                            </div>
                                            <div className={["mt-1 flex gap-1", isRTL ? "justify-start" : "justify-end"].join(" ")}>
                                                <CopyButton text={m.content} />
                                                <ActionButton
                                                    label="Edit"
                                                    title="Edit message"
                                                    onClick={() => {
                                                        setEditDraft(m.content);
                                                        setEditingIdx(idx);
                                                    }}
                                                    disabled={isStreaming}
                                                />
                                            </div>
                                        </>
                                    )}
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
                                        {isThisStreaming && (m.content?.length ?? 0) === 0 && (
                                            <div className="flex items-center gap-3 pb-5 text-gray-400">
                                                <Spinner />
                                                <span>{thinkingLabel}</span>
                                            </div>
                                        )}

                                        {isAssistant && speakingIdx === String(idx) && (
                                            <div className={["flex items-center gap-2 mb-2 text-xs", isPaused ? "text-yellow-400" : "text-blue-400"].join(" ")}>
                                                {isPaused ? <span>⏸</span> : <span className="animate-pulse">●</span>}
                                                <span>{isPaused ? "Paused" : "Reading aloud…"}</span>
                                            </div>
                                        )}

                                        {m.content?.length ? (
                                            isAssistant && m.isError ? (
                                                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                                    <div className="flex items-start gap-2">
                                                        <span className="mt-0.5" aria-hidden="true">⚠️</span>
                                                        <span>{m.content}</span>
                                                    </div>
                                                    {isLastMessage && !isStreaming && (
                                                        <div className="mt-3">
                                                            <RetryButton onClick={onRetry} />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ className, children, ...props }) {
                                                            const lang = (className || "").match(/language-(\w+)/)?.[1] || "";
                                                            const isBlock = /language-\w+/.test(className || "");

                                                            if (isBlock) {
                                                                const raw = childrenToText(children).replace(/\n$/, "");
                                                                const grammar = (Prism.languages as any)[lang];
                                                                const highlighted = grammar ? Prism.highlight(raw, grammar, lang) : raw;

                                                                return (
                                                                    <div className="relative my-3 max-w-full min-w-0" dir="ltr">
                                                                        <div className="absolute right-2 top-2 flex items-center gap-2">
                                                                            {lang && (
                                                                                <span className="text-[11px] text-gray-400 rounded-md border border-white/10 bg-black/30 px-2 py-1">
                                                                                    {lang}
                                                                                </span>
                                                                            )}
                                                                            <CopyButton text={raw} className="bg-black/30" title="Copy code" />
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
                                            )
                                        ) : null}
                                    </div>

                                    {isAssistant && (m.content?.length ?? 0) > 0 && !m.isError ? (
                                        <div className={["mt-2 flex items-center gap-2 flex-wrap", isRTL ? "justify-end" : "justify-start"].join(" ")}>
                                            {isLastMessage && !isStreaming && (
                                                <>
                                                    <CopyButton text={conversationText} title="Copy conversation" />
                                                    <ActionButton label="Retry" title="Try again" onClick={onRetry} />
                                                    {onShare && (
                                                        <ActionButton
                                                            label={isShareLoading ? "…" : "Share"}
                                                            title="Share conversation"
                                                            onClick={onShare}
                                                            disabled={isShareLoading}
                                                        />
                                                    )}
                                                </>
                                            )}

                                            <button
                                                type="button"
                                                title={
                                                    isLoading && speakingIdx === String(idx) ? "Loading…"
                                                        : speakingIdx === String(idx) && isPaused ? "Resume"
                                                            : speakingIdx === String(idx) ? "Pause"
                                                                : "Read aloud"
                                                }
                                                onClick={() => {
                                                    if (speakingIdx === String(idx) && !isPaused) {
                                                        togglePause();
                                                    } else {
                                                        speak(m.content, String(idx));
                                                    }
                                                }}
                                                disabled={isLoading && speakingIdx !== String(idx)}
                                                className={[
                                                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition",
                                                    speakingIdx === String(idx) && !isPaused
                                                        ? "border-blue-500/40 bg-blue-500/20 text-blue-400"
                                                        : speakingIdx === String(idx) && isPaused
                                                            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                                                            : isLoading
                                                                ? "border-white/10 bg-white/5 text-gray-600 cursor-wait"
                                                                : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200",
                                                ].join(" ")}
                                            >
                                                {isLoading && speakingIdx === String(idx) ? (
                                                    <>
                                                        <span className="animate-spin inline-block">⏳</span>
                                                        <span>Loading…</span>
                                                    </>
                                                ) : speakingIdx === String(idx) && isPaused ? (
                                                    <>
                                                        <span>▶</span>
                                                        <span>Resume</span>
                                                    </>
                                                ) : speakingIdx === String(idx) ? (
                                                    <>
                                                        <span className="animate-pulse">●</span>
                                                        <span>Pause</span>
                                                    </>
                                                ) : (
                                                    <span>🔊</span>
                                                )}
                                            </button>

                                            {speakingIdx === String(idx) && (
                                                <button
                                                    type="button"
                                                    title="Stop"
                                                    onClick={stop}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-400 hover:bg-white/10 transition"
                                                >
                                                    ■ Stop
                                                </button>
                                            )}

                                            {/* Token badge — shows after streaming completes */}
                                            {!isThisStreaming && (m.inputTokens || m.outputTokens) ? (
                                                <TokenBadge
                                                    inputTokens={m.inputTokens ?? 0}
                                                    outputTokens={m.outputTokens ?? 0}
                                                    model={model}   // ADD
                                                />
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
}

