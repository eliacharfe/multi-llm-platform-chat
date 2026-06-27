
"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
};

const INSTALL_DISMISSED_AT_KEY = "multillm-install-dismissed-at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function InstallAppPopup() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

        if (isStandalone) {
            setInstalled(true);
            return;
        }

        const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_AT_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < ONE_DAY_MS) return;

        let showTimer: ReturnType<typeof setTimeout> | null = null;

        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            showTimer = setTimeout(() => setVisible(true), 5000);
        };

        const handleAppInstalled = () => {
            setInstalled(true);
            setVisible(false);
            setDeferredPrompt(null);
            localStorage.removeItem(INSTALL_DISMISSED_AT_KEY);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            if (showTimer) clearTimeout(showTimer);
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
            setVisible(false);
            localStorage.removeItem(INSTALL_DISMISSED_AT_KEY);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        localStorage.setItem(INSTALL_DISMISSED_AT_KEY, String(Date.now()));
        setVisible(false);
    };

    if (!visible || installed) return null;

    return (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-white/10 bg-[#2a2a2e] p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-lg">
                    💬
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">
                        Get the MultiLLM app
                    </h3>

                    <p className="mt-1 text-sm leading-5 text-white/60">
                        Install for faster access to all your AI models, right from your desktop/home screen.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            onClick={handleInstall}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                        >
                            Install App
                        </button>

                        <button
                            onClick={handleDismiss}
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}