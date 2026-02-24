// apps/web/src/components/chat/ModelTierPicker.tsx

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { prettifyModelName, getProvider, type ModeTier } from "@/lib/models";

const TIERS: Array<{
    value: ModeTier;
    title: string;
    desc: string;
}> = [
        { value: "auto", title: "Auto", desc: "Decides how long to think" },
        { value: "instant", title: "Instant", desc: "Answers right away" },
        { value: "thinking", title: "Thinking", desc: "Thinks longer for better answers" },
    ];

export default function ModelTierPicker({
    model,
    tier,
    onChangeTier,
}: {
    model: string;
    tier: ModeTier;
    onChangeTier: (t: ModeTier) => void;
}) {
    const [, modelName = ""] = model.split(":", 2);
    const prettyModel = useMemo(() => prettifyModelName(modelName), [modelName]);

    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const popRef = useRef<HTMLDivElement | null>(null);

    const provider = getProvider(model);

    const providerLabel = useMemo(() => {
        switch (provider) {
            case "openai":
                return "GPT mode";
            case "gemini":
                return "Gemini mode";
            case "openrouter":
                return "OpenRouter mode";
            case "groq":
                return "Grok mode";
            case "anthropic":
                return "Claude mode";
            default:
                return "Model mode";
        }
    }, [provider]);

    useEffect(() => {
        if (!open) return;

        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t)) return;
            if (popRef.current?.contains(t)) return;
            setOpen(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const selected = TIERS.find((x) => x.value === tier) ?? TIERS[0];

    return (
        <div className="relative flex items-center gap-3">
            {/* Trigger pill */}
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={[
                    "inline-flex items-center gap-2",
                    "rounded-xl border border-white/10",
                    "bg-white/0.04 hover:bg-white/[0.07] transition",
                    "backdrop-blur-md",
                    "px-3 py-2",
                    "text-sm text-gray-200",
                    "shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Switch mode"
            >
                <span className="hidden sm:inline text-gray-400">Mode</span>
                <span className="font-medium">{selected.title}</span>
                <span className={["ml-1 opacity-70 transition", open ? "rotate-180" : ""].join(" ")}>
                    ▾
                </span>
            </button>

            {/* Model label (right side) */}
            <div className="text-base sm:text-xl text-gray-400 whitespace-nowrap">
                {prettyModel}
            </div>

            {/* Popover */}
            {open ? (
                <div
                    ref={popRef}
                    role="menu"
                    className={[
                        "absolute left-0 top-[calc(100%+10px)] z-50",
                        "w-[280px]",
                        "rounded-2xl border border-white/10",
                        "bg-[#2b2b2b]/80 backdrop-blur-xl",
                        "shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
                        "p-2",
                    ].join(" ")}
                >
                    {/* Header (optional) */}
                    <div className="px-3 py-2 text-xs text-gray-400">
                        {providerLabel}
                    </div>

                    <div className="h-px bg-white/10 my-1" />

                    {TIERS.map((x) => {
                        const active = x.value === tier;
                        return (
                            <button
                                key={x.value}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                    onChangeTier(x.value);
                                    setOpen(false);
                                }}
                                className={[
                                    "w-full text-left",
                                    "rounded-xl",
                                    "px-3 py-2",
                                    "hover:bg-white/0.06 transition",
                                    active ? "bg-white/0.06" : "",
                                ].join(" ")}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm text-gray-100">{x.title}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{x.desc}</div>
                                    </div>

                                    <div className="pt-0.5">
                                        {active ? (
                                            <span className="text-gray-200">✓</span>
                                        ) : (
                                            <span className="opacity-0">✓</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {/* <div className="h-px bg-white/10 my-2" /> */}

                    {/* Footer row like “Legacy models” in the screenshot (optional) */}
                    {/* <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/0.06 transition flex items-center justify-between"
                        onClick={() => {
                            // You can hook this later (or remove this row)
                            setOpen(false);
                        }}
                    > */}
                    {/* <span className="text-gray-300">More modes</span> */}
                    {/* <span className="opacity-70">›</span> */}
                    {/* </button> */}
                </div>
            ) : null}
        </div>
    );
}
