
// apps/web/src/components/ui/Tooltip.tsx

"use client";

import React from "react";

export default function Tooltip({
    text,
    side = "bottom",
    className = "",
    wrap = true,
    children,
}: {
    text: string;
    side?: "top" | "bottom";
    className?: string;
    wrap?: boolean;
    children: React.ReactNode;
}) {
    const isTop = side === "top";

    const Wrapper: any = wrap ? "div" : "span";
    const wrapperClass = wrap
        ? `relative inline-flex group ${className}`
        : `group ${className}`;

    return (
        <Wrapper
            className={wrapperClass}
            style={!wrap ? ({ display: "contents" } as React.CSSProperties) : undefined}
        >
            {children}

            <div
                className={[
                    "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50",
                    isTop ? "bottom-full mb-2" : "top-full mt-2",
                    "opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0",
                    "transition duration-150",
                ].join(" ")}
            >
                <div
                    className={[
                        "mx-auto h-1.5 w-1.5 rotate-45 bg-white/95 rounded-[2px] shadow-sm -mb-[2px]",
                        isTop ? "mb-[-2px]" : "mt-[-2px]",
                    ].join(" ")}
                />

                <div className="whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-[11px] leading-none text-black shadow-lg">
                    {text}
                </div>
            </div>
        </Wrapper>
    );
}