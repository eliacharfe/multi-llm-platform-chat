
//apps/web/src/components/ui/AuthDialog.ts
"use client";

import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    User,
} from "firebase/auth";

export default function AuthDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const [user, setUser] = useState<User | null>(auth.currentUser);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        return onAuthStateChanged(auth, (u) => setUser(u));
    }, []);

    if (!open) return null;

    async function doGoogleLogin() {
        setErr(null);
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    async function doLogout() {
        setErr(null);
        setLoading(true);
        try {
            await signOut(auth);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Logout failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                // click outside closes
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

            <div className="relative w-[92vw] max-w-md rounded-2xl border border-white/10 bg-[#2b2b2b] shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div className="text-sm font-semibold text-gray-100">
                        {user ? "Account" : "Sign in"}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 w-9 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30 transition text-gray-200"
                        aria-label="Close"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-5 py-5">
                    {user ? (
                        <>
                            <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                                <div className="text-sm text-gray-100 font-medium">
                                    {user.displayName || "Signed in"}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {user.email || user.uid}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={doLogout}
                                disabled={loading}
                                className="mt-4 w-full rounded-xl border border-red-400/20 bg-red-500/10 hover:bg-red-500/15 transition px-4 py-3 text-sm text-red-200 disabled:opacity-50"
                            >
                                {loading ? "Signing out…" : "Sign out"}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-sm text-gray-300">
                                Sign in to sync your chats across devices.
                            </div>

                            <button
                                type="button"
                                onClick={doGoogleLogin}
                                disabled={loading}
                                className="mt-4 w-full rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition px-4 py-3 text-sm text-gray-100 disabled:opacity-50"
                            >
                                {loading ? "Signing in…" : "Continue with Google"}
                            </button>
                        </>
                    )}

                    {err ? (
                        <div className="mt-3 text-xs text-red-300">{err}</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}