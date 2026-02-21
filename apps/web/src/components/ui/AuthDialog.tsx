// apps/web/src/components/ui/AuthDialog.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "@/lib/firebase";
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";

type Mode = "signin" | "signup";

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

    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");

    useEffect(() => {
        return onAuthStateChanged(auth, (u) => setUser(u));
    }, []);

    useEffect(() => {
        if (!open) return;
        setErr(null);
        setLoading(false);
        setMode("signin");
        setEmail("");
        setPassword("");
        setDisplayName("");
    }, [open]);

    const canRenderPortal = typeof window !== "undefined" && typeof document !== "undefined";
    const title = user ? "Account" : mode === "signup" ? "Create account" : "Sign in";

    const emailOk = useMemo(() => email.trim().length > 3 && email.includes("@"), [email]);
    const passOk = useMemo(() => password.length >= 6, [password]);

    if (!open || !canRenderPortal) return null;

    async function doGoogleLogin() {
        setErr(null);
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Google sign-in failed");
        } finally {
            setLoading(false);
        }
    }

    async function doEmailSignIn() {
        setErr(null);
        if (!emailOk) return setErr("Please enter a valid email.");
        if (!passOk) return setErr("Password must be at least 6 characters.");
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Email sign-in failed");
        } finally {
            setLoading(false);
        }
    }

    async function doEmailSignUp() {
        setErr(null);
        if (!emailOk) return setErr("Please enter a valid email.");
        if (!passOk) return setErr("Password must be at least 6 characters.");
        setLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            if (displayName.trim()) {
                await updateProfile(cred.user, { displayName: displayName.trim() });
            }
            onClose();
        } catch (e: any) {
            setErr(e?.message || "Sign up failed");
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

    return createPortal(
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center"
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
                    <div className="text-sm font-semibold text-gray-100">{title}</div>

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
                                <div className="text-xs text-gray-400 mt-1">{user.email || user.uid}</div>
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

                            {/* Google */}
                            <button
                                type="button"
                                onClick={doGoogleLogin}
                                disabled={loading}
                                className="mt-4 w-full rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition px-4 py-3 text-sm text-gray-100 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    "Signing in…"
                                ) : (
                                    <>
                                        {/* Google Icon */}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 48 48"
                                            className="h-5 w-5"
                                        >
                                            <path
                                                fill="#FFC107"
                                                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.8 1.1 8 3l5.7-5.7C34.6 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 19.7-8.4 19.7-20c0-1.3-.1-2.3-.1-3.5z"
                                            />
                                            <path
                                                fill="#FF3D00"
                                                d="M6.3 14.7l6.6 4.8C14.7 16 18.9 12 24 12c3 0 5.8 1.1 8 3l5.7-5.7C34.6 6.5 29.6 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"
                                            />
                                            <path
                                                fill="#4CAF50"
                                                d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
                                            />
                                            <path
                                                fill="#1976D2"
                                                d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-3 5-5.6 6.6l6.3 5.2C39.6 36.6 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
                                            />
                                        </svg>

                                        <span>Continue with Google</span>
                                    </>
                                )}
                            </button>

                            {/* Divider */}
                            <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/10" />
                                <div className="text-[11px] text-gray-400">or</div>
                                <div className="h-px flex-1 bg-white/10" />
                            </div>

                            {/* Email form */}
                            <div className="space-y-3">
                                {mode === "signup" ? (
                                    <input
                                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-100 outline-none focus:border-white/20"
                                        placeholder="Display name (optional)"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={loading}
                                    />
                                ) : null}

                                <input
                                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-100 outline-none focus:border-white/20"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    autoComplete="email"
                                />

                                <input
                                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-100 outline-none focus:border-white/20"
                                    placeholder="Password (min 6 chars)"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (mode === "signup") doEmailSignUp();
                                            else doEmailSignIn();
                                        }
                                    }}
                                />

                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={mode === "signup" ? doEmailSignUp : doEmailSignIn}
                                    className="w-full rounded-xl border border-white/10 bg-blue-600/90 hover:bg-blue-600 transition px-4 py-3 text-sm text-white disabled:opacity-50"
                                >
                                    {loading
                                        ? mode === "signup"
                                            ? "Creating account…"
                                            : "Signing in…"
                                        : mode === "signup"
                                            ? "Sign up"
                                            : "Sign in"}
                                </button>

                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                                    className="w-full text-center text-xs text-gray-300 hover:text-gray-100 transition"
                                >
                                    {mode === "signin"
                                        ? "New here? Create an account"
                                        : "Already have an account? Sign in"}
                                </button>
                            </div>
                        </>
                    )}

                    {err ? <div className="mt-3 text-xs text-red-300">{err}</div> : null}
                </div>
            </div>
        </div>,
        document.body
    );
}
