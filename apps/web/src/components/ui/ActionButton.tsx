
// apps/web/src/components/ui/ActionButton.tsx

"use client";

import React from "react";
import Tooltip from "@/components/ui/Tooltip";

type Variant = "default" | "success";

export default function ActionButton({
    label,
    title,
    icon,
    onClick,
    className = "",
    variant = "default",
    disabled = false,
}: {
    label: string;
    title?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: Variant;
    disabled?: boolean;
}) {
    const base =
        "relative flex items-center gap-1.5 " +
        "px-2 py-1 text-[10px] " +
        "rounded-md border " +
        "transition-all duration-200 ease-out " +
        "active:scale-95";

    const normal =
        "bg-black/20 border-white/10 text-gray-300 " +
        "hover:bg-black/30 hover:border-white/20";

    const success = "bg-green-500/15 border-green-400/40 text-green-300";

    const disabledCls = "opacity-50 pointer-events-none";

    const cls = [
        base,
        variant === "success" ? success : normal,
        disabled ? disabledCls : "",
        className,
    ].join(" ");

    return (
        <Tooltip text={title ?? label} side="bottom" className={className}>
            <button type="button" onClick={onClick} className={cls} disabled={disabled}>
                {icon ? <span className="leading-none">{icon}</span> : null}
                <span>{label}</span>
            </button>
        </Tooltip>
    );
}

