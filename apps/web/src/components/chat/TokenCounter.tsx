
// apps/web/src/components/chat/TokenCounter.tsx:

"use client";

import React, { useEffect, useState } from "react";
import { estimateCost, formatCost } from "@/lib/models";

export default function TokenCounter({
    model,
    inputTokens,
    outputTokens,
    isStreaming,
}: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    isStreaming: boolean;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isStreaming) {
            setVisible(true);
        } else {
            // fade out 2s after streaming ends
            const t = setTimeout(() => setVisible(false), 2000);
            return () => clearTimeout(t);
        }
    }, [isStreaming]);

    if (!visible || (inputTokens === 0 && outputTokens === 0)) return null;

    const cost = estimateCost(model, inputTokens, outputTokens);
    const total = inputTokens + outputTokens;

    return (
        <div
            className={[
                "flex items-center justify-center gap-3 py-1 text-xs text-gray-500",
                "transition-opacity duration-700",
                isStreaming ? "opacity-100" : "opacity-0",
            ].join(" ")}
        >
            <span>↑ {inputTokens.toLocaleString()} in</span>
            <span className="text-gray-700">·</span>
            <span>↓ {outputTokens.toLocaleString()} out</span>
            <span className="text-gray-700">·</span>
            <span>{total.toLocaleString()} total</span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-400">{formatCost(cost)}</span>
        </div>
    );
}