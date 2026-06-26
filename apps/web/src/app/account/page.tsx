

// apps/web/src/app/account/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AuthDialog from "@/components/ui/AuthDialog";

type AccountData = {
    is_premium: boolean;
    plan: "monthly" | "yearly" | null;
    status: "active" | "canceled" | null;
    current_period_end: string | null;
};

type MeData = {
    is_premium: boolean;
    message_count_today: number;
    daily_limit: number | null;
};

function formatDate(iso: string | null): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return "";
    }
}

function getInitials(name: string | null, email: string | null): string {
    if (name?.trim()) return name.trim()[0].toUpperCase();
    if (email?.trim()) return email.trim()[0].toUpperCase();
    return "?";
}

const FREE_FEATURES = [
    "Access to standard AI models",
    "20 messages per day",
    "2,048 token context window",
    "Chat history sync",
];

const PREMIUM_FEATURES = [
    "All premium AI models (GPT-5, Claude Opus, Gemini 2.5 Pro…)",
    "Unlimited messages",
    "8,192 token context (4× more)",
    "Deep Search — real-time web results in any chat",
    "Priority response speed",
];

const PREMIUM_UPSELL_FEATURES = [
    "GPT-5, Claude Opus 4, Gemini 2.5 Pro",
    "Unlimited messages — no daily cap",
    "8,192 token context (4× more)",
    "Deep Search with real-time web results",
];

function CheckIcon({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

export default function AccountPage() {
    const router = useRouter();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [account, setAccount] = useState<AccountData | null>(null);
    const [me, setMe] = useState<MeData | null>(null);
    const [actionLoading, setActionLoading] = useState<"cancel" | "reactivate" | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [authOpen, setAuthOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.replace("/"); return; }
            setUserEmail(user.email);
            setDisplayName(user.displayName);
            try {
                const token = await user.getIdToken();
                const [accountRes, meRes] = await Promise.all([
                    fetch(`${apiUrl}/v1/account`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${apiUrl}/v1/me`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (accountRes.ok) setAccount(await accountRes.json());
                if (meRes.ok) setMe(await meRes.json());
            } catch (e) {
                console.error("[AccountPage]", e);
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    async function handleCancel() {
        setActionError(null);
        setActionSuccess(null);
        setActionLoading("cancel");
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${apiUrl}/v1/subscriptions/cancel`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(await res.text());
            setActionSuccess("Subscription set to cancel. You keep Premium access until the end of the billing period.");
            setAccount((prev) => prev ? { ...prev, status: "canceled" } : prev);
        } catch (e: any) {
            setActionError(e?.message || "Failed to cancel. Please try again.");
        } finally {
            setActionLoading(null);
        }
    }

    async function handleReactivate() {
        setActionError(null);
        setActionSuccess(null);
        setActionLoading("reactivate");
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${apiUrl}/v1/subscriptions/reactivate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(await res.text());
            setActionSuccess("Subscription reactivated successfully.");
            setAccount((prev) => prev ? { ...prev, status: "active" } : prev);
        } catch (e: any) {
            setActionError(e?.message || "Failed to reactivate. Please try again.");
        } finally {
            setActionLoading(null);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full" />
            </main>
        );
    }

    const planLabel =
        account?.plan === "monthly" ? "Premium Monthly" :
            account?.plan === "yearly" ? "Premium Yearly" : null;

    const renewalDate = formatDate(account?.current_period_end ?? null);
    const isCanceled = account?.status === "canceled";
    const isPremium = account?.is_premium ?? false;

    const usedToday = me?.message_count_today ?? 0;
    const dailyLimit = me?.daily_limit ?? 20;
    const usagePercent = isPremium ? 100 : Math.min(100, (usedToday / dailyLimit) * 100);

    // Show email as name if displayName looks like an app/service name or is absent
    const nameLabel = displayName || userEmail?.split("@")[0] || "—";
    const showEmail = displayName && userEmail;

    return (
        <main className="min-h-screen bg-[#1f1f1f] text-white px-5 py-10">
            <div className="mx-auto max-w-4xl">

                {/* Back */}
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mb-8 flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition"
                >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                    Back
                </button>

                <h1 className="text-2xl font-bold mb-6">Account</h1>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

                    {/* ── LEFT COLUMN ── */}
                    <div className="flex flex-col gap-4">

                        {/* Identity — compact */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex items-center gap-3">
                            <div className={[
                                "flex items-center justify-center w-11 h-11 rounded-full text-lg font-bold shrink-0",
                                isPremium
                                    ? "bg-teal-500/20 border border-teal-400/30 text-teal-300"
                                    : "bg-white/10 border border-white/10 text-white/70",
                            ].join(" ")}>
                                {getInitials(displayName, userEmail)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-medium text-white text-sm truncate">{nameLabel}</div>
                                {showEmail && (
                                    <div className="text-xs text-white/40 truncate">{userEmail}</div>
                                )}
                            </div>
                            {isPremium && (
                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-500/15 border border-teal-400/20 px-2.5 py-1 text-xs font-semibold text-teal-300">
                                    ⚡ {planLabel}
                                </span>
                            )}
                        </div>

                        {/* Plan + usage — single card */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
                                <span className="text-sm text-white/50">Current plan</span>
                                {isPremium && planLabel ? (
                                    <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-300">
                                        ⚡ {planLabel}
                                    </span>
                                ) : (
                                    <span className="text-sm text-white/70">Free</span>
                                )}
                            </div>

                            {isPremium && renewalDate && (
                                <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
                                    <span className="text-sm text-white/50">{isCanceled ? "Access until" : "Next renewal"}</span>
                                    <span className={`text-sm ${isCanceled ? "text-amber-400" : "text-white/70"}`}>{renewalDate}</span>
                                </div>
                            )}

                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-white/50">Messages today</span>
                                    <span className="text-sm">
                                        {isPremium ? (
                                            <span className="text-teal-300">{usedToday} <span className="text-white/30">/ unlimited</span></span>
                                        ) : (
                                            <span className={usedToday >= dailyLimit ? "text-red-400" : "text-white/70"}>
                                                {usedToday} / {dailyLimit}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                {!isPremium && (
                                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className={[
                                                "h-full rounded-full transition-all duration-500",
                                                usagePercent >= 100 ? "bg-red-400" :
                                                    usagePercent >= 75 ? "bg-amber-400" : "bg-teal-400",
                                            ].join(" ")}
                                            style={{ width: `${usagePercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {isCanceled && (
                                <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/15">
                                    <p className="text-xs text-amber-400">
                                        Subscription set to cancel. Premium access continues until {renewalDate}.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* What's included */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <p className="text-xs font-medium text-white/35 mb-3">
                                {isPremium ? "Your plan includes" : "Free plan includes"}
                            </p>
                            <ul className="space-y-2">
                                {(isPremium ? PREMIUM_FEATURES : FREE_FEATURES).map((f) => (
                                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                                        <CheckIcon className={isPremium ? "text-teal-400" : "text-white/25"} />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Feedback */}
                        {actionError && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                                {actionError}
                            </div>
                        )}
                        {actionSuccess && (
                            <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
                                {actionSuccess}
                            </div>
                        )}

                        {/* Subscription action */}
                        {isPremium && (
                            isCanceled ? (
                                <button
                                    type="button"
                                    onClick={handleReactivate}
                                    disabled={!!actionLoading}
                                    className="w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-60 transition hover:opacity-90"
                                >
                                    {actionLoading === "reactivate" ? "Reactivating…" : "Reactivate subscription"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={!!actionLoading}
                                    className="w-full rounded-full border border-red-500/25 bg-red-500/8 px-5 py-3 text-sm font-medium text-red-400/80 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-60 transition"
                                >
                                    {actionLoading === "cancel" ? "Canceling…" : "Cancel subscription"}
                                </button>
                            )
                        )}

                        {/* Sign out — anchored at the bottom of left col with a divider */}
                        <div className="pt-1 border-t border-white/8">
                            <button
                                type="button"
                                onClick={() => setAuthOpen(true)}
                                className="flex items-center gap-2 text-sm text-white/35 hover:text-white/60 transition"
                            >
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Sign out
                            </button>
                        </div>

                    </div>

                    {/* ── RIGHT COLUMN ── */}
                    <div className="flex flex-col gap-4">

                        {/* Upsell / plan summary */}
                        {!isPremium ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                                <p className="text-sm font-semibold text-white mb-0.5">⚡ Upgrade to Premium</p>
                                <p className="text-xs text-white/45 mb-4 leading-relaxed">
                                    Unlock the most powerful AI models and remove all limits.
                                </p>
                                <ul className="space-y-2 mb-4">
                                    {PREMIUM_UPSELL_FEATURES.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                                            <CheckIcon className="text-teal-400" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => router.push("/premium?upgrade=monthly")}
                                        className="w-full rounded-full bg-linear-to-r from-yellow-300 to-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
                                    >
                                        Monthly — $5/mo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/premium?upgrade=yearly")}
                                        className="w-full rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white/90 transition"
                                    >
                                        Yearly — $3.50/mo
                                        <span className="ml-1.5 text-xs text-teal-400">Save 30%</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-teal-400/20 bg-teal-500/8 px-4 py-4">
                                <p className="text-sm font-semibold text-white mb-0.5">⚡ You're on Premium</p>
                                <p className="text-xs text-white/45 mb-4 leading-relaxed">
                                    Full access to all models and features. Thanks for supporting MultiLLM!
                                </p>
                                <ul className="space-y-2">
                                    {PREMIUM_UPSELL_FEATURES.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                                            <CheckIcon className="text-teal-400" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* About */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                            <p className="text-xs font-medium text-white/35 mb-2">About MultiLLM</p>
                            <p className="text-xs text-white/45 leading-relaxed mb-3">
                                One place for the world's best AI models — OpenAI, Anthropic, Google, and more. No tab-switching, no juggling accounts.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: "Pricing", href: "/pricing" },
                                    { label: "Terms", href: "/terms" },
                                    { label: "Privacy", href: "/privacy" },
                                    { label: "Support", href: "mailto:support@multillm.net" },
                                ].map(({ label, href }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45 hover:text-white/75 hover:border-white/20 transition"
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Danger zone */}
                        <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                            <p className="text-xs font-medium text-white/35 mb-1">Danger zone</p>
                            <p className="text-xs text-white/35 leading-relaxed mb-3">
                                Permanently delete your account and all chat history. This cannot be undone.
                            </p>
                            {!showDeleteConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="text-xs text-red-400/55 hover:text-red-400 transition underline underline-offset-2"
                                >
                                    Delete account
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 rounded-full border border-white/10 py-1.5 text-xs text-white/45 hover:text-white/65 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // TODO: wire up delete account endpoint
                                            alert("Delete account not yet implemented.");
                                            setShowDeleteConfirm(false);
                                        }}
                                        className="flex-1 rounded-full border border-red-500/25 bg-red-500/10 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                                    >
                                        Yes, delete
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
            </div>
        </main>
    );
}

// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { auth } from "@/lib/firebase";
// import { onAuthStateChanged } from "firebase/auth";
// import AuthDialog from "@/components/ui/AuthDialog";

// type AccountData = {
//     is_premium: boolean;
//     plan: "monthly" | "yearly" | null;
//     status: "active" | "canceled" | null;
//     current_period_end: string | null;
// };

// type MeData = {
//     is_premium: boolean;
//     message_count_today: number;
//     daily_limit: number | null;
// };

// function formatDate(iso: string | null): string {
//     if (!iso) return "";
//     try {
//         return new Date(iso).toLocaleDateString("en-US", {
//             month: "long",
//             day: "numeric",
//             year: "numeric",
//         });
//     } catch {
//         return "";
//     }
// }

// function getInitials(name: string | null, email: string | null): string {
//     if (name?.trim()) return name.trim()[0].toUpperCase();
//     if (email?.trim()) return email.trim()[0].toUpperCase();
//     return "?";
// }

// const FREE_FEATURES = [
//     "Access to standard AI models",
//     "20 messages per day",
//     "Chat history sync",
// ];

// const PREMIUM_FEATURES = [
//     "All premium AI models (GPT-5, Claude Opus, Gemini 2.5 Pro…)",
//     "Unlimited messages",
//     "8,192 token context (4× more)",
//     "Deep Search — real-time web results",
// ];

// export default function AccountPage() {
//     const router = useRouter();
//     const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

//     const [loading, setLoading] = useState(true);
//     const [userEmail, setUserEmail] = useState<string | null>(null);
//     const [displayName, setDisplayName] = useState<string | null>(null);
//     const [account, setAccount] = useState<AccountData | null>(null);
//     const [me, setMe] = useState<MeData | null>(null);
//     const [actionLoading, setActionLoading] = useState<"cancel" | "reactivate" | null>(null);
//     const [actionError, setActionError] = useState<string | null>(null);
//     const [actionSuccess, setActionSuccess] = useState<string | null>(null);
//     const [authOpen, setAuthOpen] = useState(false);

//     useEffect(() => {
//         const unsub = onAuthStateChanged(auth, async (user) => {
//             if (!user) {
//                 router.replace("/");
//                 return;
//             }
//             setUserEmail(user.email);
//             setDisplayName(user.displayName);

//             try {
//                 const token = await user.getIdToken();
//                 const [accountRes, meRes] = await Promise.all([
//                     fetch(`${apiUrl}/v1/account`, { headers: { Authorization: `Bearer ${token}` } }),
//                     fetch(`${apiUrl}/v1/me`, { headers: { Authorization: `Bearer ${token}` } }),
//                 ]);
//                 if (accountRes.ok) setAccount(await accountRes.json());
//                 if (meRes.ok) setMe(await meRes.json());
//             } catch (e) {
//                 console.error("[AccountPage] failed to fetch account", e);
//             } finally {
//                 setLoading(false);
//             }
//         });
//         return () => unsub();
//     }, []);

//     async function handleCancel() {
//         setActionError(null);
//         setActionSuccess(null);
//         setActionLoading("cancel");
//         try {
//             const token = await auth.currentUser?.getIdToken();
//             const res = await fetch(`${apiUrl}/v1/subscriptions/cancel`, {
//                 method: "POST",
//                 headers: { Authorization: `Bearer ${token}` },
//             });
//             if (!res.ok) throw new Error(await res.text());
//             setActionSuccess("Your subscription will cancel at the end of the billing period. You keep Premium access until then.");
//             setAccount((prev) => prev ? { ...prev, status: "canceled" } : prev);
//         } catch (e: any) {
//             setActionError(e?.message || "Failed to cancel. Please try again.");
//         } finally {
//             setActionLoading(null);
//         }
//     }

//     async function handleReactivate() {
//         setActionError(null);
//         setActionSuccess(null);
//         setActionLoading("reactivate");
//         try {
//             const token = await auth.currentUser?.getIdToken();
//             const res = await fetch(`${apiUrl}/v1/subscriptions/reactivate`, {
//                 method: "POST",
//                 headers: { Authorization: `Bearer ${token}` },
//             });
//             if (!res.ok) throw new Error(await res.text());
//             setActionSuccess("Your subscription has been reactivated.");
//             setAccount((prev) => prev ? { ...prev, status: "active" } : prev);
//         } catch (e: any) {
//             setActionError(e?.message || "Failed to reactivate. Please try again.");
//         } finally {
//             setActionLoading(null);
//         }
//     }

//     if (loading) {
//         return (
//             <main className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
//                 <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full" />
//             </main>
//         );
//     }

//     const planLabel =
//         account?.plan === "monthly" ? "Premium Monthly" :
//             account?.plan === "yearly" ? "Premium Yearly" : null;

//     const renewalDate = formatDate(account?.current_period_end ?? null);
//     const isCanceled = account?.status === "canceled";
//     const isPremium = account?.is_premium ?? false;

//     const usedToday = me?.message_count_today ?? 0;
//     const dailyLimit = me?.daily_limit ?? 20;
//     const usagePercent = isPremium ? 100 : Math.min(100, (usedToday / dailyLimit) * 100);

//     return (
//         <main className="min-h-screen bg-[#1f1f1f] text-white px-5 py-10">
//             <div className="mx-auto max-w-lg">

//                 {/* Back */}
//                 <button
//                     type="button"
//                     onClick={() => router.back()}
//                     className="mb-8 flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition"
//                 >
//                     <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                         <path d="M19 12H5M12 5l-7 7 7 7" />
//                     </svg>
//                     Back
//                 </button>

//                 {/* Avatar + name hero */}
//                 <div className="flex flex-col items-center mb-8">
//                     <div className={[
//                         "flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold mb-3",
//                         isPremium
//                             ? "bg-teal-500/20 border border-teal-400/30 text-teal-300"
//                             : "bg-white/10 border border-white/10 text-white/70",
//                     ].join(" ")}>
//                         {getInitials(displayName, userEmail)}
//                     </div>
//                     <div className="text-base font-semibold text-white">
//                         {displayName || userEmail || "—"}
//                     </div>
//                     {displayName && (
//                         <div className="text-xs text-white/40 mt-0.5">{userEmail}</div>
//                     )}
//                     {isPremium && (
//                         <span className="mt-2 flex items-center gap-1 rounded-full bg-teal-500/15 border border-teal-400/25 px-3 py-1 text-xs font-semibold text-teal-300">
//                             ⚡ {planLabel}
//                         </span>
//                     )}
//                 </div>

//                 {/* Account info card */}
//                 <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10 overflow-hidden mb-5">

//                     {/* Plan row */}
//                     <div className="px-5 py-4 flex items-center justify-between gap-4">
//                         <span className="text-sm text-white/50">Current plan</span>
//                         {isPremium && planLabel ? (
//                             <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-300">
//                                 <span>⚡</span>{planLabel}
//                             </span>
//                         ) : (
//                             <span className="text-sm text-white/70">Free</span>
//                         )}
//                     </div>

//                     {/* Renewal / expiry */}
//                     {isPremium && renewalDate && (
//                         <div className="px-5 py-4 flex items-center justify-between gap-4">
//                             <span className="text-sm text-white/50">
//                                 {isCanceled ? "Access until" : "Next renewal"}
//                             </span>
//                             <span className={`text-sm ${isCanceled ? "text-amber-400" : "text-white/70"}`}>
//                                 {renewalDate}
//                             </span>
//                         </div>
//                     )}

//                     {/* Usage */}
//                     <div className="px-5 py-4">
//                         <div className="flex items-center justify-between mb-2">
//                             <span className="text-sm text-white/50">Messages today</span>
//                             <span className="text-sm text-white/70">
//                                 {isPremium ? (
//                                     <span className="text-teal-300">{usedToday} <span className="text-white/30 font-normal">/ unlimited</span></span>
//                                 ) : (
//                                     <span className={usedToday >= dailyLimit ? "text-red-400" : ""}>
//                                         {usedToday} / {dailyLimit}
//                                     </span>
//                                 )}
//                             </span>
//                         </div>
//                         {!isPremium && (
//                             <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
//                                 <div
//                                     className={[
//                                         "h-full rounded-full transition-all",
//                                         usagePercent >= 100 ? "bg-red-400" :
//                                             usagePercent >= 75 ? "bg-amber-400" : "bg-teal-400",
//                                     ].join(" ")}
//                                     style={{ width: `${usagePercent}%` }}
//                                 />
//                             </div>
//                         )}
//                     </div>

//                     {/* Cancellation notice */}
//                     {isCanceled && (
//                         <div className="px-5 py-3 bg-amber-500/10">
//                             <p className="text-xs text-amber-400">
//                                 Subscription set to cancel. Premium access continues until {renewalDate}.
//                             </p>
//                         </div>
//                     )}
//                 </div>

//                 {/* What's included */}
//                 <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 mb-5">
//                     <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
//                         {isPremium ? "Your plan includes" : "Free plan includes"}
//                     </div>
//                     <ul className="space-y-2">
//                         {(isPremium ? PREMIUM_FEATURES : FREE_FEATURES).map((f) => (
//                             <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
//                                 <svg viewBox="0 0 24 24" className={`w-4 h-4 mt-0.5 shrink-0 ${isPremium ? "text-teal-400" : "text-white/30"}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                                     <path d="M20 6L9 17l-5-5" />
//                                 </svg>
//                                 {f}
//                             </li>
//                         ))}
//                     </ul>
//                 </div>

//                 {/* Feedback */}
//                 {actionError && (
//                     <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
//                         {actionError}
//                     </div>
//                 )}
//                 {actionSuccess && (
//                     <div className="mb-4 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
//                         {actionSuccess}
//                     </div>
//                 )}

//                 {/* Actions */}
//                 {isPremium ? (
//                     <div className="flex flex-col gap-3">
//                         {isCanceled ? (
//                             <button
//                                 type="button"
//                                 onClick={handleReactivate}
//                                 disabled={!!actionLoading}
//                                 className="w-full rounded-full bg-linear-to-r from-teal-300 to-cyan-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-60 transition hover:opacity-90"
//                             >
//                                 {actionLoading === "reactivate" ? "Reactivating…" : "Reactivate Subscription"}
//                             </button>
//                         ) : (
//                             <button
//                                 type="button"
//                                 onClick={handleCancel}
//                                 disabled={!!actionLoading}
//                                 className="w-full rounded-full border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60 transition"
//                             >
//                                 {actionLoading === "cancel" ? "Canceling…" : "Cancel Subscription"}
//                             </button>
//                         )}
//                     </div>
//                 ) : (
//                     <button
//                         type="button"
//                         onClick={() => router.push("/premium")}
//                         className="w-full rounded-full bg-linear-to-r from-yellow-300 to-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
//                     >
//                         ⚡ Upgrade to Premium
//                     </button>
//                 )}

//                 {/* Sign out */}
//                 <button
//                     type="button"
//                     onClick={() => setAuthOpen(true)}
//                     className="mt-4 w-full rounded-full border border-white/10 px-5 py-3 text-sm text-white/40 hover:text-white/70 transition"
//                 >
//                     Sign out
//                 </button>

//                 <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

//             </div>
//         </main>
//     );
// }