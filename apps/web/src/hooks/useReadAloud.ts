// apps/web/src/hooks/useReadAloud.ts

import { useState, useCallback, useRef } from "react";

function stripMarkdown(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]*`/g, "")
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, " ")
        .trim();
}

export function useReadAloud(apiUrl: string) {
    const [speakingIdx, setSpeakingIdx] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        setSpeakingIdx(null);
        setIsLoading(false);
        setIsPaused(false);
    }, []);

    const togglePause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPaused) {
            audio.play();
            setIsPaused(false);
        } else {
            audio.pause();
            setIsPaused(true);
        }
    }, [isPaused]);

    const speak = useCallback(async (text: string, idx: string) => {
        // If same message is paused, resume it
        if (speakingIdx === idx && isPaused) {
            togglePause();
            return;
        }

        // If same message is playing, stop it
        if (speakingIdx === idx) {
            stop();
            return;
        }

        stop();
        setIsLoading(true);
        setSpeakingIdx(idx);

        try {
            const token = await import("@/lib/firebase").then(async (mod) => {
                const user = mod.auth.currentUser;
                return user ? user.getIdToken() : null;
            });

            const clean = stripMarkdown(text);

            const res = await fetch(`${apiUrl}/v1/audio/speak`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text: clean, voice: "nova" }),
            });

            if (!res.ok) throw new Error("TTS request failed");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onpause = () => {
                if (!audio.ended) setIsPaused(true);
            };

            audio.onplay = () => {
                setIsPaused(false);
            };

            audio.onended = () => {
                URL.revokeObjectURL(url);
                setSpeakingIdx(null);
                setIsLoading(false);
                setIsPaused(false);
                audioRef.current = null;
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                setSpeakingIdx(null);
                setIsLoading(false);
                setIsPaused(false);
                audioRef.current = null;
            };

            setIsLoading(false);
            await audio.play();

        } catch (e) {
            console.error("[TTS]", e);
            setSpeakingIdx(null);
            setIsLoading(false);
            setIsPaused(false);
        }
    }, [speakingIdx, isPaused, stop, togglePause, apiUrl]);

    return { speak, stop, togglePause, speakingIdx, isLoading, isPaused };
}