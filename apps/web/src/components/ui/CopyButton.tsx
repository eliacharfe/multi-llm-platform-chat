"use client";

import { useCallback, useRef, useState } from "react";
import Tooltip from "@/components/ui/Tooltip";

async function copyToClipboard(text: string) {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
}

export default function CopyButton({
    text,
    className = "",
    title = "Copy",
}: {
    text: string;
    className?: string;
    title?: string;
}) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    const onCopy = useCallback(async () => {
        try {
            await copyToClipboard(text);
            setCopied(true);

            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

            timeoutRef.current = window.setTimeout(() => {
                setCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } catch { }
    }, [text]);

    return (
        <Tooltip text={copied ? "Copied!" : title} side="bottom" className={className}>
            <button
                type="button"
                onClick={onCopy}
                aria-label="Copy to clipboard"
                className={`
          relative flex items-center gap-1.5
          px-2 py-1 text-[10px]
          rounded-md border
          transition-all duration-200 ease-out
          active:scale-95
          ${copied
                        ? "bg-green-500/15 border-green-400/40 text-green-300"
                        : "bg-black/20 border-white/10 text-gray-300 hover:bg-black/30 hover:border-white/20"
                    }
        `}
            >
                <span
                    className={`transition-all duration-200 ${copied ? "opacity-0 scale-75" : "opacity-100 scale-100"
                        }`}
                >
                    ⧉
                </span>

                <span
                    className={`absolute left-2 transition-all duration-200 ${copied ? "opacity-100 scale-100" : "opacity-0 scale-75"
                        }`}
                >
                    ✓
                </span>

                <span>{copied ? "Copied" : "Copy"}</span>
            </button>
        </Tooltip>
    );
}
