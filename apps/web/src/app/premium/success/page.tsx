
// apps/web/src/app/premium/success/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function PremiumSuccessPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        auth.currentUser?.getIdToken(true).catch(() => { });

        let count = 5;
        setCountdown(count);

        const interval = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(interval);
                router.push("/");
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [router]);

    return (
        <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center px-6">
            <div className="max-w-md w-full text-center">

                {/* Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/20 border border-teal-400/30">
                    <span className="text-4xl">⚡</span>
                </div>

                <h1 className="text-4xl font-bold">You're Premium!</h1>

                <p className="mt-4 text-white/60 text-lg">
                    Your subscription is now active. Enjoy full access to all
                    premium AI models and higher usage limits.
                </p>

                <div className="mt-8 rounded-2xl border border-teal-400/20 bg-teal-500/10 p-5 text-left space-y-3">
                    {[
                        "Full access to Claude Opus, GPT-5, and more",
                        "Higher usage limits",
                        "Priority response speed",
                        "Cancel anytime",
                    ].map((feature) => (
                        <div key={feature} className="flex items-center gap-3 text-sm text-white/80">
                            <span className="text-teal-400 text-base">✓</span>
                            {feature}
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="mt-8 w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-6 py-3 font-semibold text-black"
                >
                    Start chatting
                </button>

                <p className="mt-4 text-sm text-white/30">
                    Redirecting in {countdown}s…
                </p>

            </div>
        </main>
    );
}