
// apps/web/src/components/ui/LogoSplash.tsx

"use client";

import React from "react";

export default function LogoSplash({
    show,
    text = "Loading…",
}: {
    show: boolean;
    text?: string;
}) {
    return (
        <div
            className={[
                "fixed inset-0 z-9999 flex items-center justify-center",
                "bg-black/45 backdrop-blur-xl",
                "transition-opacity duration-500",
                show ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
            ].join(" ")}
            aria-hidden={!show}
        >
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    {/* glow */}
                    <div className="absolute inset-0 blur-3xl opacity-70 bg-linear-to-r from-blue-500/30 via-indigo-500/30 to-emerald-500/30 rounded-full" />

                    <img
                        src="/multi-llm-logo.png"
                        alt="Multi-LLM Platform"
                        className="relative h-24 w-24 drop-shadow-[0_12px_35px_rgba(0,0,0,0.55)]"
                        style={{
                            animation: "splashPulse 1.15s ease-in-out infinite",
                            willChange: "transform, opacity, filter",
                        }}
                    />
                </div>

                <div
                    className="text-md text-gray-300/80"
                    style={{
                        animation: "textFade 2.4s ease-in-out infinite",
                    }}
                >
                    {text}
                </div>
            </div>

            <style jsx global>{`
        @keyframes splashPulse {
          0% {
            transform: scale(0.92) rotate(-6deg);
            opacity: 0.85;
            filter: saturate(1) brightness(1);
          }
          50% {
            transform: scale(1.08) rotate(6deg);
            opacity: 1;
            filter: saturate(1.35) brightness(1.15);
          }
          100% {
            transform: scale(0.92) rotate(-6deg);
            opacity: 0.85;
            filter: saturate(1) brightness(1);
          }
        }

        @keyframes textFade {
        0% {
            opacity: 0.15;
            transform: translateY(4px);
            filter: blur(1px);
        }
        50% {
            opacity: 1;
            transform: translateY(0px);
            filter: blur(0px);
        }
        100% {
            opacity: 0.15;
            transform: translateY(4px);
            filter: blur(1px);
        }
        }
      `}</style>
        </div>
    );
}
