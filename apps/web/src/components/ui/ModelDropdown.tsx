
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type SelectOpt = { value: string; label: string; disabled?: boolean };

export default function ModelDropdown({
    value,
    options,
    onChange,
    disabled,
}: {
    value: string;
    options: SelectOpt[];
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const selectedLabel = useMemo(() => {
        return options.find((o) => o.value === value)?.label ?? value;
    }, [options, value]);

    // close on outside click
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, []);

    // Esc closes
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function useMediaQuery(query: string) {
        const [matches, setMatches] = useState(false);

        useEffect(() => {
            const mq = window.matchMedia(query);
            const apply = () => setMatches(mq.matches);
            apply();

            if (mq.addEventListener) mq.addEventListener("change", apply);
            else mq.addListener(apply);

            return () => {
                if (mq.removeEventListener) mq.removeEventListener("change", apply);
                else mq.removeListener(apply);
            };
        }, [query]);

        return matches;
    }

    const isSmall = useMediaQuery("(max-width: 520px)");

    return (
        <div className="relative" ref={wrapRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-white/10 bg-[#262626] px-3 py-2 text-xs text-gray-200 hover:bg-white/[0.06] transition focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                title={selectedLabel}
            >
                <span className="truncate max-w-[300px]">{selectedLabel}</span>
                <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 opacity-80 transition ${open ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && !disabled ? (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                        onClick={() => setOpen(false)}
                    />

                    {/* Dropdown panel */}
                    <div
                        className={[
                            "absolute bottom-full mb-2 w-[320px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#1f1f1f] shadow-2xl overflow-hidden z-50",
                            isSmall ? "left-1/2 -translate-x-1/2" : "left-0",
                        ].join(" ")}
                    >
                        <div className="max-h-[70vh] overflow-y-auto p-2">
                            {options.map((opt) => {
                                const isHeader = !!opt.disabled;

                                if (isHeader) {
                                    return (
                                        <div
                                            key={opt.value}
                                            className="px-3 py-2 text-[11px] tracking-wide text-gray-400 select-none"
                                        >
                                            {opt.label}
                                        </div>
                                    );
                                }

                                const isActive = opt.value === value;

                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setOpen(false);
                                        }}
                                        className={[
                                            "w-full text-left px-3 py-2 rounded-xl text-sm transition-colors duration-150",
                                            "hover:bg-white/[0.08]",
                                            isActive
                                                ? "bg-white/10 text-gray-100"
                                                : "text-gray-200",
                                        ].join(" ")}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}