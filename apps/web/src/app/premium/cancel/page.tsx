
// apps/web/src/app/premium/cancel/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

type SubscriptionInfo = {
    is_premium: boolean;
    message_count_today: number;
    daily_limit: number | null;
};

const BENEFITS = [
    {
        icon: "🤖",
        title: "All AI models",
        desc: "GPT-5, Claude Opus, Gemini Flash & more",
    },
    {
        icon: "∞",
        title: "Unlimited messages",
        desc: "No daily caps, ever",
    },
    {
        icon: "📎",
        title: "File & image uploads",
        desc: "Attach PDFs, code, images to any chat",
    },
    {
        icon: "🧠",
        title: "Extended context window",
        desc: "8,192 tokens — 4× more than free",
    },
    {
        icon: "⚡",
        title: "Priority speed",
        desc: "Faster responses during peak hours",
    },
];

export default function CancelSubscriptionPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [info, setInfo] = useState<SubscriptionInfo | null>(null);
    const [infoLoading, setInfoLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const token = await auth.currentUser?.getIdToken();
                const res = await fetch(`${apiUrl}/v1/me`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) setInfo(await res.json());
            } catch {
                // ignore
            } finally {
                setInfoLoading(false);
            }
        }
        load();
    }, []);

    async function handleCancel() {
        setLoading(true);
        setError(null);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${apiUrl}/v1/subscriptions/cancel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || `HTTP ${res.status}`);
            }
            setDone(true);
        } catch (e: any) {
            setError(e?.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    // ── Post-cancel success state ──────────────────────────────────────────
    if (done) {
        return (
            <main className="min-h-screen bg-[#1a1a1a] text-gray-100 flex items-center justify-center px-4 py-16">
                <div className="w-full max-w-lg">
                    {/* Success card */}
                    <div className="rounded-2xl border border-white/10 bg-[#242424] overflow-hidden">
                        {/* Top accent bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-teal-500/60 via-teal-400/40 to-transparent" />

                        <div className="px-8 py-10 text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-500/15 border border-teal-400/20 mb-6">
                                <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            <h1 className="text-xl font-semibold text-gray-100 mb-2">
                                Cancellation scheduled
                            </h1>
                            <p className="text-sm text-gray-400 leading-relaxed mb-8">
                                Your Premium access stays active until the end of your current billing period.
                                You won't be charged again.
                            </p>

                            {/* What happens next */}
                            <div className="text-left rounded-xl border border-white/8 bg-white/4 divide-y divide-white/8 mb-8">
                                {[
                                    { step: "Now", text: "Premium features remain fully active" },
                                    { step: "Billing ends", text: "Access reverts to the free plan automatically" },
                                    { step: "Anytime", text: "You can resubscribe from the chat screen" },
                                ].map(({ step, text }) => (
                                    <div key={step} className="flex items-start gap-4 px-4 py-3">
                                        <span className="text-[11px] font-medium text-teal-400 uppercase tracking-wide mt-0.5 w-20 shrink-0">
                                            {step}
                                        </span>
                                        <span className="text-sm text-gray-300">{text}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => router.push("/")}
                                className="w-full rounded-xl bg-white/10 hover:bg-white/15 transition-colors px-5 py-2.5 text-sm font-medium"
                            >
                                Back to chat
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-xs text-gray-600 mt-6">
                        Changed your mind?{" "}
                        <button
                            onClick={() => router.push("/premium?reactivate=true")}
                            className="text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
                        >
                            Reactivate Premium
                        </button>
                    </p>
                </div>
            </main>
        );
    }

    // ── Main cancel page ───────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-[#1a1a1a] text-gray-100 px-4 py-16">
            <div className="w-full max-w-2xl mx-auto">

                {/* Back link */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="grid gap-6 md:grid-cols-[1fr_320px] md:items-start">

                    {/* LEFT — what you'll lose */}
                    <div>
                        <div className="mb-1 text-xs font-semibold tracking-widest text-teal-400 uppercase">
                            Premium membership
                        </div>
                        <h1 className="text-2xl font-semibold text-gray-100 mb-2">
                            Before you go
                        </h1>
                        <p className="text-sm text-gray-400 leading-relaxed mb-8">
                            Cancelling ends your Premium plan at the close of your current billing period.
                            Here's what you'll lose access to:
                        </p>

                        <div className="space-y-3 mb-8">
                            {BENEFITS.map((b) => (
                                <div
                                    key={b.title}
                                    className="flex items-start gap-4 rounded-xl border border-white/8 bg-[#242424] px-4 py-3.5"
                                >
                                    <span className="text-xl mt-0.5 w-7 shrink-0 text-center">{b.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium text-gray-200">{b.title}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{b.desc}</div>
                                    </div>
                                    {/* "Active" pill */}
                                    <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-400 bg-teal-400/10 border border-teal-400/20 rounded-full px-2 py-0.5 mt-0.5">
                                        Active
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Free plan comparison */}
                        <div className="rounded-xl border border-white/8 bg-[#1e1e1e] px-5 py-4">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                After cancellation — Free plan
                            </div>
                            <div className="space-y-2">
                                {[
                                    "20 messages per day",
                                    "Less powerful models",
                                    "No file or image uploads",
                                    "2,048 token context window only",
                                ].map((line) => (
                                    <div key={line} className="flex items-center gap-2.5 text-sm text-gray-400">
                                        <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — confirm card */}
                    <div className="md:sticky md:top-8">
                        <div className="rounded-2xl border border-white/10 bg-[#242424] overflow-hidden">
                            <div className="h-0.5 w-full bg-gradient-to-r from-red-500/40 via-red-400/20 to-transparent" />

                            <div className="px-6 py-6">
                                <h2 className="text-base font-semibold text-gray-100 mb-1">
                                    Cancel subscription
                                </h2>
                                <p className="text-xs text-gray-500 leading-relaxed mb-5">
                                    You'll keep Premium until the end of your billing period. No refund is issued for unused time.
                                </p>

                                {/* Current plan info */}
                                {!infoLoading && info && (
                                    <div className="rounded-lg border border-white/8 bg-white/4 px-4 py-3 mb-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500">Current plan</span>
                                            <span className="text-xs font-semibold text-teal-400">⚡ Premium</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Messages today</span>
                                            <span className="text-xs text-gray-300">{info.message_count_today} sent</span>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400 leading-relaxed">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2.5">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={loading}
                                        className="w-full rounded-xl bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 transition-colors px-4 py-2.5 text-sm text-red-400 font-medium disabled:opacity-40"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                                Cancelling…
                                            </span>
                                        ) : "Yes, cancel my subscription"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => router.back()}
                                        disabled={loading}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-4 py-2.5 text-sm text-gray-300 font-medium"
                                    >
                                        Keep Premium
                                    </button>
                                </div>

                                <p className="text-center text-[11px] text-gray-600 mt-4 leading-relaxed">
                                    Need help?{" "}
                                    <a href="mailto:multillm.support@gmail.com" className="text-gray-500 hover:text-gray-400 underline underline-offset-2 transition-colors">
                                        Contact support
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}