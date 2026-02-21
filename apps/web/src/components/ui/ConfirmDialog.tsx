

"use client";

import React, { useEffect, useRef } from "react";

export type ConfirmDialogProps = {
    open: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "danger";
    loading?: boolean;

    // Actions
    onConfirm: () => void | Promise<void>;
    onClose: () => void;

    // Behavior
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
};

export default function ConfirmDialog({
    open,
    title = "Confirm",
    message = "Are you sure?",
    confirmText = "OK",
    cancelText = "Cancel",
    variant = "default",
    loading = false,
    onConfirm,
    onClose,
    closeOnBackdrop = true,
    closeOnEsc = true,
}: ConfirmDialogProps) {
    const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

    // Focus the confirm button when opened
    useEffect(() => {
        if (!open) return;
        const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [open]);

    // Esc to close
    useEffect(() => {
        if (!open || !closeOnEsc) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, closeOnEsc, onClose]);

    if (!open) return null;

    const confirmClasses =
        variant === "danger"
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-blue-600 hover:bg-blue-500 text-white";

    return (
        <div
            className="fixed inset-0 z-200 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            onMouseDown={() => {
                if (closeOnBackdrop) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card */}
            <div
                className="relative w-[92%] max-w-md rounded-2xl border border-white/10 bg-[#1f1f1f] shadow-2xl p-5 animate-[fadeIn_.15s_ease-out]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="text-lg font-semibold text-gray-100">{title}</div>

                {message ? (
                    <div className="mt-2 text-sm text-gray-400 leading-relaxed">
                        {message}
                    </div>
                ) : null}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl border border-white/10 bg-white/3 hover:bg-white/6 transition px-4 py-2 text-sm text-gray-200 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>

                    <button
                        ref={confirmBtnRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={[
                            "rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed",
                            confirmClasses,
                        ].join(" ")}
                    >
                        {loading ? "Working…" : confirmText}
                    </button>
                </div>
            </div>

            {/* tiny keyframes for the card */}
            <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
        </div>
    );
}