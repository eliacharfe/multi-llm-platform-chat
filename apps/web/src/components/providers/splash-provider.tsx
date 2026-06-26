
// apps/web/src/components/providers/splash-provider.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import LogoSplash from "@/components/ui/LogoSplash";

export default function SplashProvider({ children }: { children: React.ReactNode }) {
    const [showSplash, setShowSplash] = useState(true); // always start visible
    const timerFiredRef = useRef(false);

    useEffect(() => {
        // We're now on the client
        if (timerFiredRef.current) return;
        timerFiredRef.current = true;

        // Already shown this session — hide immediately, no timer
        if (sessionStorage.getItem("splash-shown") === "true") {
            setShowSplash(false);
            return;
        }

        // First visit — show for 3s then dismiss
        const t = setTimeout(() => {
            setShowSplash(false);
            sessionStorage.setItem("splash-shown", "true");
        }, 3000);

        return () => clearTimeout(t);
    }, []);

    return (
        <>
            <LogoSplash show={showSplash} text="Initializing…" />
            {children}
        </>
    );
}