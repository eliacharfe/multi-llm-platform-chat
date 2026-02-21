
// apps/web/src/components/ui/IconGhostButton.tsx

"use client";

import React from "react";
import Tooltip from "@/components/ui/Tooltip";

export default function IconGhostButton({
    label,
    onClick,
    disabled,
    className,
    withTooltip = true,
    size = "sm",
    tooltipSide = "bottom",
    children,
}: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    withTooltip?: boolean;
    size?: "sm" | "md" | "lg";
    tooltipSide?: "top" | "bottom";
    children: React.ReactNode;
}) {
    const sizeClasses =
        size === "lg"
            ? "h-11 w-11"
            : size === "md"
                ? "h-9 w-9"
                : "h-7 w-7";

    const button = (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={[
                sizeClasses,
                "rounded-lg",
                "flex items-center justify-center",
                "text-white/70 hover:text-white",
                "hover:bg-white/6",
                "transition",
                "focus:outline-none focus:ring-2 focus:ring-white/10",
                "disabled:opacity-40 disabled:hover:bg-transparent",
            ].join(" ")}
        >
            {children}
        </button>
    );

    if (!withTooltip) {
        return <div className={className}>{button}</div>;
    }

    return (
        <Tooltip text={label} side={tooltipSide} className={className}>
            {button}
        </Tooltip>
    );
}