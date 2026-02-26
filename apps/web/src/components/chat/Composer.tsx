
// apps/web/src/components/chat/Composer.tsx

"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import ModelDropdown from "@/components/ui/ModelDropdown";
import Tooltip from "@/components/ui/Tooltip";
import IconGhostButton from "@/components/ui/IconGhostButton";

export type SelectOpt = { value: string; label: string; disabled?: boolean };

export type ComposerHandle = {
    focus: () => void;
};

const Composer = forwardRef<ComposerHandle, {
    input: string;
    setInput: (s: string) => void;

    attachedFiles: File[];
    onAddFiles: (files: File[]) => void;
    onClearFiles: () => void;

    model: string;
    modelChoices: SelectOpt[];
    onChangeModel: (m: string) => void;

    canSend: boolean;
    isStreaming: boolean;
    onSend: () => void;
    onStop: () => void;

    isSmall: boolean;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
}>(function Composer(
    {
        input,
        setInput,
        attachedFiles,
        onAddFiles,
        onClearFiles,

        model,
        modelChoices,
        onChangeModel,

        canSend,
        isStreaming,
        onSend,
        onStop,

        isSmall,
        isSidebarCollapsed,
        onToggleSidebar,
    },
    ref
) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
        focus() {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            // optional: put cursor at end
            const len = el.value.length;
            el.setSelectionRange(len, len);
        },
    }));

    return (
        <div className="px-6 pb-4 md:pb-[calc(12px+env(safe-area-inset-bottom))] bg-transparent">
            <div className="mx-auto max-w-3xl bg-transparent">
                <div className="relative p-[3px] rounded-2xl focus-within:bg-linear-to-r focus-within:from-blue-500 focus-within:via-indigo-500 focus-within:to-blue-500 transition-all">
                    <div className="rounded-2xl bg-[#2f2f2f]/70 backdrop-blur-xl border border-white/10 shadow-2xl">
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
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        className="ml-1 text-xs text-gray-300/80 hover:text-gray-200 underline underline-offset-2"
                                        onClick={onClearFiles}
                                        disabled={isStreaming}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : null}

                            <textarea
                                ref={textareaRef}
                                className="w-full resize-none bg-transparent outline-none text-gray-100 placeholder:text-gray-400 text-sm leading-relaxed"
                                placeholder="Send a message…"
                                rows={2}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        const text = (e.currentTarget.value || "").trim();
                                        if (!text && attachedFiles.length === 0) return;
                                        onSend();
                                    }
                                }}
                                disabled={isStreaming}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 px-3 pb-3">
                            <div className="flex items-center gap-1">
                                <IconGhostButton
                                    label="Toggle Sidebar"
                                    onClick={onToggleSidebar}
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
                                            accept={[
                                                "application/pdf",
                                                "text/plain",
                                                "text/markdown",
                                                "application/json",
                                                "text/csv",
                                                "application/xml",
                                                "text/xml",
                                                "application/msword",
                                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                "application/vnd.ms-excel",
                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",


                                                // "application/pdf",
                                                // "text/plain",
                                                // "text/markdown",
                                                // "application/json",
                                                // "text/csv",
                                                // "application/xml",
                                                // "text/xml",
                                                // "application/msword",
                                                // "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                // "application/vnd.ms-excel",
                                                // "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                                // // "image/*",
                                                // ".txt",
                                                // ".md",
                                                // ".json",
                                                // ".csv",
                                                // ".log",
                                                // ".yaml",
                                                // ".yml",
                                                // ".dart",
                                                // ".py",
                                                // ".js",
                                                // ".ts",
                                                // ".tsx",
                                                // ".html",
                                                // ".css",
                                                // ".xml",
                                                // ".swift",
                                                // ".pdf",
                                            ].join(",")}
                                            className="hidden"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length) onAddFiles(files);
                                                e.currentTarget.value = "";
                                            }}
                                            disabled={isStreaming}
                                        />
                                    </label>
                                </Tooltip>

                                <ModelDropdown
                                    value={model}
                                    options={modelChoices}
                                    onChange={(v) => onChangeModel(v)}
                                    disabled={isStreaming}
                                />
                            </div>

                            <button
                                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 transition disabled:opacity-40 flex items-center justify-center"
                                onClick={isStreaming ? onStop : onSend}
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
                    Multi-LLM Platform •{" "}
                    <a
                        href="https://www.eliacharfeig.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-gray-200 underline underline-offset-2"
                    >
                        Built by Eliachar Feig
                    </a>{" "}
                    •{" "}
                    <a
                        href="https://github.com/eliacharfe/multi-llm-platform-chat"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-gray-200 underline underline-offset-2"
                    >
                        GitHub
                    </a>{" "}
                    •{" "}
                    <a
                        href="https://www.linkedin.com/in/eliachar-feig/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-gray-200 underline underline-offset-2"
                    >
                        LinkedIn
                    </a>
                </div>

            </div>
        </div>
    );
});

export default Composer;
