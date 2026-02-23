
// apps/web/src/components/chat/MessageList.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Prism from "prismjs";
import "@/lib/prism";

import CopyButton from "@/components/ui/CopyButton";
import ActionButton from "@/components/ui/ActionButton";

export type Msg = { role: "user" | "assistant" | "system"; content: string };

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
}: {
    messages: Msg[];
    isStreaming: boolean;
    thinkingLabel: string;
    model: string;
    onSuggestion: (text: string) => void;
    conversationText: string;
    onRetry: () => void;
}) {
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
                            <div className="text-3xl sm:text-4xl font-semibold text-gray-100 tracking-tight lg:pt-20 sm:pt-1 md:pt-10">
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
        );
    }

    return (
        <div className="space-y-5">
            {messages
                .filter((m) => m.role !== "system")
                .map((m, idx) => {
                    const isUser = m.role === "user";
                    const isAssistant = m.role === "assistant";

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
                                                    <span>{thinkingLabel}</span>
                                                </div>
                                            )}

                                        {m.content?.length ? (
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
                                        ) : null}
                                    </div>

                                    {isAssistant &&
                                        (m.content?.length ?? 0) > 0 &&
                                        idx === messages.length - 1 &&
                                        !isStreaming ? (
                                        <div className={["mt-2 flex items-center gap-2", isRTL ? "justify-end" : "justify-start"].join(" ")}>
                                            <CopyButton
                                                text={conversationText}
                                                title="Copy conversation"
                                            />
                                            <ActionButton
                                                label="Retry"
                                                title="Try again"
                                                icon="↻"
                                                onClick={onRetry}
                                            />
                                        </div>
                                    ) : null}

                                    {/* {isAssistant && (m.content?.length ?? 0) > 0 ? (
                                        <div className={["mt-2 flex", isRTL ? "justify-end" : "justify-start"].join(" ")}>
                                            <CopyButton text={m.content} />
                                        </div>
                                    ) : null} */}
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
}

