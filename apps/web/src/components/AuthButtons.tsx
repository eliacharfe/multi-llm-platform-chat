// apps/web/src/components/AuthButtons.tsx

"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";

export default function AuthButtons() {
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        return onAuthStateChanged(auth, (u) => setUserEmail(u?.email ?? null));
    }, []);

    async function loginGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider());
    }

    async function signupEmail() {
        await createUserWithEmailAndPassword(auth, email, pwd);
    }

    async function loginEmail() {
        await signInWithEmailAndPassword(auth, email, pwd);
    }

    async function logout() {
        await signOut(auth);
    }

    return (
        <div className="flex items-center gap-2">
            {userEmail ? (
                <>
                    <div className="text-xs text-gray-300/90">{userEmail}</div>
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30" onClick={logout}>
                        Logout
                    </button>
                </>
            ) : (
                <>
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30" onClick={loginGoogle}>
                        Continue with Google
                    </button>

                    <input
                        className="px-2 py-2 rounded-lg border border-white/10 bg-black/20 text-sm text-gray-100 w-44"
                        placeholder="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        className="px-2 py-2 rounded-lg border border-white/10 bg-black/20 text-sm text-gray-100 w-36"
                        placeholder="password"
                        type="password"
                        value={pwd}
                        onChange={(e) => setPwd(e.target.value)}
                    />

                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30" onClick={loginEmail}>
                        Login
                    </button>
                    <button className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30" onClick={signupEmail}>
                        Sign up
                    </button>
                </>
            )}
        </div>
    );
}