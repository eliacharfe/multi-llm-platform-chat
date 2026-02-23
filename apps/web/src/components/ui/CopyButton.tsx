
"use client";

import { useCallback, useRef, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";

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
        <ActionButton
            onClick={onCopy}
            className={className}
            title={copied ? "Copied!" : title}
            variant={copied ? "success" : "default"}
            label={copied ? "Copied" : "Copy"}
        />
    );
}