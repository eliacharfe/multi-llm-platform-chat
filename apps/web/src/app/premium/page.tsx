
// apps/web/src/app/premium/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { initializePaddle } from "@paddle/paddle-js";

function PremiumPageInner() {
    const router = useRouter();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
    const [isPremium, setIsPremium] = useState(false);
    const [checking, setChecking] = useState(true);

    const searchParams = useSearchParams();
    const isReactivate = searchParams.get("reactivate") === "true";
    const [reactivating, setReactivating] = useState(false);
    const [reactivated, setReactivated] = useState(false);
    const [reactivateError, setReactivateError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdTokenResult(true);
                setIsPremium(!!token.claims?.premium);
            }
            setChecking(false);
        });
        return () => unsub();
    }, []);


    useEffect(() => {
        if (!isReactivate || checking) return;

        async function doReactivate() {
            setReactivating(true);
            try {
                const token = await auth.currentUser?.getIdToken();
                const res = await fetch(`${apiUrl}/v1/subscriptions/reactivate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(await res.text());
                setReactivated(true);
            } catch (e: any) {
                setReactivateError(e?.message || "Failed to reactivate.");
            } finally {
                setReactivating(false);
            }
        }
        doReactivate();
    }, [isReactivate, checking]);


    const handleCheckout = async (plan: "monthly" | "yearly") => {
        try {
            const user = auth.currentUser;
            if (!user) { alert("Please sign in first."); router.push("/"); return; }

            const token = await user.getIdToken();
            const res = await fetch(`${apiUrl}/billing/create-checkout-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan }),
            });

            if (!res.ok) throw new Error("Failed to create checkout session");
            const data = await res.json();

            // Open Paddle.js overlay
            const paddle = await initializePaddle({
                environment: "sandbox",
                token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
            });

            paddle?.Checkout.open({
                transactionId: data.transaction_id,
                settings: {
                    successUrl: `${window.location.origin}/premium/success`,
                },
            });

        } catch (err) {
            console.error(err);
            alert("Unable to start checkout.");
        }
    };

    if (checking) {
        return (
            <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
                <p className="text-white/40 text-sm">Checking subscription…</p>
            </main>
        );
    }
    if (isPremium) {
        // Reactivating state
        if (reactivating) {
            return (
                <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-white/50 text-sm">Reactivating your subscription…</p>
                    </div>
                </main>
            );
        }

        // Reactivated success state
        if (reactivated) {
            return (
                <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center px-6">
                    <div className="max-w-md w-full text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/20 border border-teal-400/30">
                            <span className="text-4xl">⚡</span>
                        </div>
                        <h1 className="text-3xl font-bold">You're back!</h1>
                        <p className="mt-3 text-white/60">
                            Your Premium subscription is active again. You won't be charged anything extra.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="mt-8 w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-6 py-3 font-semibold text-black"
                        >
                            Back to chat
                        </button>
                    </div>
                </main>
            );
        }

        // Reactivate error
        if (reactivateError) {
            return (
                <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center px-6">
                    <div className="max-w-md w-full text-center">
                        <p className="text-red-400 text-sm mb-4">{reactivateError}</p>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white"
                        >
                            Back to chat
                        </button>
                    </div>
                </main>
            );
        }

        // Already premium (no reactivate param)
        return (
            <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-500/20 border border-teal-400/30">
                        <span className="text-4xl">⚡</span>
                    </div>
                    <h1 className="text-3xl font-bold">You're already Premium</h1>
                    <p className="mt-3 text-white/60">You have full access to all premium models and features.</p>
                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="mt-8 w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-6 py-3 font-semibold text-black"
                    >
                        Back to chat
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#1f1f1f] text-white px-6 py-10">
            <div className="mx-auto max-w-3xl">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mb-6 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white"
                >
                    ← Back
                </button>

                <h1 className="text-4xl font-bold">Premium</h1>
                <p className="mt-4 text-white/70">
                    Upgrade to Premium to unlock better models, more usage, and advanced features.
                </p>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {/* Monthly Plan */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                        <h2 className="text-2xl font-semibold">Monthly Plan</h2>
                        <p className="mt-4 text-4xl font-bold">
                            $5<span className="text-lg font-medium text-white/60">/month</span>
                        </p>
                        <p className="mt-3 text-white/70">Perfect for flexible month-to-month access.</p>
                        <ul className="mt-6 space-y-2 text-sm text-white/70">
                            <li>• Full premium AI model access</li>
                            <li>• Higher usage limits</li>
                            <li>• Cancel anytime</li>
                            <li>• No hidden fees</li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => handleCheckout("monthly")}
                            className="mt-6 w-full rounded-full bg-linear-to-r from-yellow-300 to-amber-500 px-6 py-3 font-semibold text-black"
                        >
                            Choose Monthly
                        </button>
                    </div>

                    {/* Yearly Plan */}
                    <div className="rounded-2xl border border-teal-400/30 bg-teal-500/10 p-6 relative">
                        <span className="absolute right-4 top-4 rounded-full bg-teal-400 px-3 py-1 text-xs font-bold text-black">
                            Best Value
                        </span>
                        <h2 className="text-2xl font-semibold">Yearly Plan</h2>
                        <p className="mt-4 text-4xl font-bold">
                            $3.5<span className="text-lg font-medium text-white/60">/month</span>
                        </p>
                        <p className="mt-1 text-sm text-teal-300">Billed annually at $42/year</p>
                        <p className="mt-3 text-white/70">Save 30% with long-term access.</p>
                        <ul className="mt-6 space-y-2 text-sm text-white/70">
                            <li>• Full premium AI model access</li>
                            <li>• Higher usage limits</li>
                            <li>• Cancel anytime</li>
                            <li>• No hidden fees</li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => handleCheckout("yearly")}
                            className="mt-6 w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-6 py-3 font-semibold text-black"
                        >
                            Choose Yearly
                        </button>
                    </div>
                </div>

                <p className="mt-8 text-center text-sm text-white/50">
                    Transparent pricing. Cancel whenever you want. No hidden charges or surprise commitments.
                </p>
            </div>
        </main>
    );
}

import { Suspense } from "react";

export default function PremiumPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
                <p className="text-white/40 text-sm">Loading…</p>
            </main>
        }>
            <PremiumPageInner />
        </Suspense>
    );
}
