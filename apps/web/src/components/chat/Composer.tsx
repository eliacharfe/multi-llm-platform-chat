

// apps/web/src/components/chat/Composer.tsx

"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import ModelDropdown from "@/components/ui/ModelDropdown";
import Tooltip from "@/components/ui/Tooltip";
import IconGhostButton from "@/components/ui/IconGhostButton";

export type SelectOpt = { value: string; label: string; disabled?: boolean };

export type ComposerHandle = {
    focus: () => void;
};

const VOICE_LANGS = [
    { code: "auto", label: "Auto-detect", flag: "🌐" },
    // ── alphabetical below ──
    { code: "af", label: "Afrikaans", flag: "🇿🇦" },
    { code: "sq", label: "Albanian", flag: "🇦🇱" },
    { code: "ar", label: "Arabic", flag: "🇸🇦" },
    { code: "hy", label: "Armenian", flag: "🇦🇲" },
    { code: "az", label: "Azerbaijani", flag: "🇦🇿" },
    { code: "eu", label: "Basque", flag: "🇪🇸" },
    { code: "be", label: "Belarusian", flag: "🇧🇾" },
    { code: "bn", label: "Bengali", flag: "🇧🇩" },
    { code: "bs", label: "Bosnian", flag: "🇧🇦" },
    { code: "bg", label: "Bulgarian", flag: "🇧🇬" },
    { code: "ca", label: "Catalan", flag: "🇪🇸" },
    { code: "zh", label: "Chinese", flag: "🇨🇳" },
    { code: "hr", label: "Croatian", flag: "🇭🇷" },
    { code: "cs", label: "Czech", flag: "🇨🇿" },
    { code: "da", label: "Danish", flag: "🇩🇰" },
    { code: "nl", label: "Dutch", flag: "🇳🇱" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "et", label: "Estonian", flag: "🇪🇪" },
    { code: "fi", label: "Finnish", flag: "🇫🇮" },
    { code: "fr", label: "French", flag: "🇫🇷" },
    { code: "gl", label: "Galician", flag: "🇪🇸" },
    { code: "ka", label: "Georgian", flag: "🇬🇪" },
    { code: "de", label: "German", flag: "🇩🇪" },
    { code: "el", label: "Greek", flag: "🇬🇷" },
    { code: "gu", label: "Gujarati", flag: "🇮🇳" },
    { code: "ht", label: "Haitian Creole", flag: "🇭🇹" },
    { code: "ha", label: "Hausa", flag: "🇳🇬" },
    { code: "he", label: "Hebrew", flag: "🇮🇱" },
    { code: "hi", label: "Hindi", flag: "🇮🇳" },
    { code: "hu", label: "Hungarian", flag: "🇭🇺" },
    { code: "is", label: "Icelandic", flag: "🇮🇸" },
    { code: "id", label: "Indonesian", flag: "🇮🇩" },
    { code: "it", label: "Italian", flag: "🇮🇹" },
    { code: "ja", label: "Japanese", flag: "🇯🇵" },
    { code: "kn", label: "Kannada", flag: "🇮🇳" },
    { code: "kk", label: "Kazakh", flag: "🇰🇿" },
    { code: "km", label: "Khmer", flag: "🇰🇭" },
    { code: "ko", label: "Korean", flag: "🇰🇷" },
    { code: "lo", label: "Lao", flag: "🇱🇦" },
    { code: "lv", label: "Latvian", flag: "🇱🇻" },
    { code: "lt", label: "Lithuanian", flag: "🇱🇹" },
    { code: "mk", label: "Macedonian", flag: "🇲🇰" },
    { code: "ms", label: "Malay", flag: "🇲🇾" },
    { code: "ml", label: "Malayalam", flag: "🇮🇳" },
    { code: "mt", label: "Maltese", flag: "🇲🇹" },
    { code: "mr", label: "Marathi", flag: "🇮🇳" },
    { code: "mn", label: "Mongolian", flag: "🇲🇳" },
    { code: "my", label: "Myanmar", flag: "🇲🇲" },
    { code: "ne", label: "Nepali", flag: "🇳🇵" },
    { code: "no", label: "Norwegian", flag: "🇳🇴" },
    { code: "ps", label: "Pashto", flag: "🇦🇫" },
    { code: "fa", label: "Persian", flag: "🇮🇷" },
    { code: "pl", label: "Polish", flag: "🇵🇱" },
    { code: "pt", label: "Portuguese", flag: "🇵🇹" },
    { code: "pa", label: "Punjabi", flag: "🇮🇳" },
    { code: "ro", label: "Romanian", flag: "🇷🇴" },
    { code: "ru", label: "Russian", flag: "🇷🇺" },
    { code: "sr", label: "Serbian", flag: "🇷🇸" },
    { code: "si", label: "Sinhala", flag: "🇱🇰" },
    { code: "sk", label: "Slovak", flag: "🇸🇰" },
    { code: "sl", label: "Slovenian", flag: "🇸🇮" },
    { code: "so", label: "Somali", flag: "🇸🇴" },
    { code: "es", label: "Spanish", flag: "🇪🇸" },
    { code: "sw", label: "Swahili", flag: "🇰🇪" },
    { code: "sv", label: "Swedish", flag: "🇸🇪" },
    { code: "tl", label: "Tagalog", flag: "🇵🇭" },
    { code: "tg", label: "Tajik", flag: "🇹🇯" },
    { code: "ta", label: "Tamil", flag: "🇮🇳" },
    { code: "tt", label: "Tatar", flag: "🇷🇺" },
    { code: "te", label: "Telugu", flag: "🇮🇳" },
    { code: "th", label: "Thai", flag: "🇹🇭" },
    { code: "tr", label: "Turkish", flag: "🇹🇷" },
    { code: "tk", label: "Turkmen", flag: "🇹🇲" },
    { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
    { code: "ur", label: "Urdu", flag: "🇵🇰" },
    { code: "uz", label: "Uzbek", flag: "🇺🇿" },
    { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
    { code: "cy", label: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
    { code: "yi", label: "Yiddish", flag: "🕍" },
    { code: "yo", label: "Yoruba", flag: "🇳🇬" },
] as const;

type VoiceLangCode = typeof VOICE_LANGS[number]["code"];

function useVoiceRecorder(onTranscript: (text: string) => void, lang: string) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Pick the best supported format
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : "audio/mp4"; // Safari fallback

            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                streamRef.current?.getTracks().forEach((t) => t.stop());

                const blob = new Blob(chunksRef.current, { type: mimeType });
                if (blob.size < 1000) return;

                setIsTranscribing(true);
                try {
                    // ── Get Firebase token (same way your other API calls do) ──
                    const { getAuth } = await import("firebase/auth");
                    const auth = getAuth();
                    const token = await auth.currentUser?.getIdToken();

                    if (!token) throw new Error("Not authenticated");

                    const formData = new FormData();
                    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
                    formData.append("file", blob, `audio.${ext}`);
                    formData.append("lang", lang === "auto" ? navigator.language || "" : lang);

                    const res = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/v1/voice/transcribe`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                        }
                    );

                    if (!res.ok) throw new Error(`Transcription error: ${res.status}`);
                    const data = await res.json();
                    console.log("Whisper response:", data);
                    if (data.transcript?.trim()) onTranscript(data.transcript.trim());
                } catch (err) {
                    console.error("Whisper transcription failed:", err);
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Microphone access was denied. Please allow it in your browser settings.");
        }
    }, [onTranscript, lang]);

    const stop = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        // Request any buffered data before stopping
        recorder.requestData();

        // Small delay to let ondataavailable fire with the final chunk
        setTimeout(() => {
            recorder.stop();
            mediaRecorderRef.current = null;
        }, 100);

        setIsRecording(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mediaRecorderRef.current?.stop();
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    return { isRecording, isTranscribing, start, stop };
}
// ─────────────────────────────────────────────────────────────────────────────

const Composer = forwardRef<ComposerHandle, {
    input: string;
    setInput: (s: string) => void;

    attachedFiles: File[];
    onAddFiles: (files: File[]) => void;
    onClearFiles: () => void;

    model: string;
    modelChoices: SelectOpt[];
    onChangeModel: (m: string) => void;

    canSend: boolean;
    isStreaming: boolean;
    onSend: () => void;
    onStop: () => void;

    isSmall: boolean;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    isPremium?: boolean;

    deepSearch: boolean;
    onToggleDeepSearch: () => void;
}>(function Composer(
    {
        input,
        setInput,
        attachedFiles,
        onAddFiles,
        onClearFiles,

        model,
        modelChoices,
        onChangeModel,

        canSend,
        isStreaming,
        onSend,
        onStop,

        isSmall,
        isSidebarCollapsed,
        onToggleSidebar,
        isPremium,

        deepSearch,
        onToggleDeepSearch,
    },
    ref
) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Accumulated final transcript across the session
    const finalTranscriptRef = useRef<string>("");

    const [voiceLang, setVoiceLang] = useState<VoiceLangCode>("auto");

    useEffect(() => {
        const saved = localStorage.getItem("voiceLang") as VoiceLangCode | null;
        if (saved) setVoiceLang(saved);
    }, []);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const langMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!showLangMenu) return;
        const handler = (e: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
                setShowLangMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showLangMenu]);

    const selectVoiceLang = useCallback((code: VoiceLangCode) => {
        setVoiceLang(code);
        localStorage.setItem("voiceLang", code);
        setShowLangMenu(false);
    }, []);

    const currentLang = VOICE_LANGS.find((l) => l.code === voiceLang) ?? VOICE_LANGS[0];

    const handleTranscript = useCallback((finalChunk: string) => {
        // Append new final chunk (with a space separator if needed)
        finalTranscriptRef.current =
            finalTranscriptRef.current
                ? finalTranscriptRef.current + " " + finalChunk.trim()
                : finalChunk.trim();
        setInput(finalTranscriptRef.current);
    }, [setInput]);

    const { isRecording, isTranscribing, start, stop } = useVoiceRecorder(handleTranscript, voiceLang);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stop();
        } else {
            // Reset accumulated transcript so voice starts fresh relative to current input
            finalTranscriptRef.current = input.trim();
            start();
        }
    }, [isRecording, start, stop, input]);

    useImperativeHandle(ref, () => ({
        focus() {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
        },
    }));

    return (
        <div className="px-3 sm:px-6 pb-2 bg-transparent">
            <div className="mx-auto max-w-3xl bg-transparent">
                <div className="relative p-[3px] rounded-2xl focus-within:bg-linear-to-r focus-within:from-teal-500 focus-within:via-cyan-500 focus-within:to-teal-500 transition-all">
                    <div className="rounded-2xl bg-[#2f2f2f]/70 backdrop-blur-xl border border-white/10 shadow-2xl">
                        <div className="px-4 pt-4">
                            {attachedFiles.length > 0 ? (
                                <div className="px-4 pt-3 flex flex-wrap gap-2">
                                    {attachedFiles.map((f, idx) => (
                                        <div
                                            key={`${f.name}-${idx}`}
                                            className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-200"
                                            title={f.name}
                                        >
                                            <span className="max-w-[220px] truncate">{f.name}</span>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="ml-1 text-xs text-gray-300/80 hover:text-gray-200 underline underline-offset-2"
                                        onClick={onClearFiles}
                                        disabled={isStreaming}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : null}

                            <textarea
                                ref={textareaRef}
                                className="w-full resize-none bg-transparent outline-none text-gray-100 placeholder:text-gray-400 text-sm leading-relaxed"
                                placeholder="Send a message…"
                                rows={2}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    // Keep ref in sync if user edits manually
                                    finalTranscriptRef.current = e.target.value;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        const text = (e.currentTarget.value || "").trim();
                                        if (!text && attachedFiles.length === 0) return;
                                        onSend();
                                    }
                                }}
                                disabled={isStreaming}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 px-3 pb-3">
                            <div className="flex items-center gap-1">
                                <IconGhostButton
                                    label="Toggle Sidebar"
                                    onClick={onToggleSidebar}
                                    disabled={isStreaming}
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <rect x="4" y="5" width="16" height="14" rx="2" />
                                        <path d="M12 5v14" />
                                    </svg>
                                </IconGhostButton>

                                <Tooltip text="Attach files" side="bottom">
                                    <label
                                        className={[
                                            "h-7 w-7 rounded-lg",
                                            "flex items-center justify-center",
                                            "text-white/70 hover:text-white",
                                            "hover:bg-white/6",
                                            "transition cursor-pointer",
                                        ].join(" ")}
                                        aria-label="Attach files"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            className="h-5 w-5"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.84 8.84a2 2 0 0 1-2.83-2.83l8.49-8.49" />
                                        </svg>
                                        <input
                                            type="file"
                                            multiple
                                            accept={[
                                                "application/pdf",
                                                "text/plain",
                                                "text/markdown",
                                                "application/json",
                                                "text/csv",
                                                "application/xml",
                                                "text/xml",
                                                "application/msword",
                                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                "application/vnd.ms-excel",
                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",


                                                // "application/pdf",
                                                // "text/plain",
                                                // "text/markdown",
                                                // "application/json",
                                                // "text/csv",
                                                // "application/xml",
                                                // "text/xml",
                                                // "application/msword",
                                                // "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                // "application/vnd.ms-excel",
                                                // "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                                // // "image/*",
                                                // ".txt",
                                                // ".md",
                                                // ".json",
                                                // ".csv",
                                                // ".log",
                                                // ".yaml",
                                                // ".yml",
                                                // ".dart",
                                                // ".py",
                                                // ".js",
                                                // ".ts",
                                                // ".tsx",
                                                // ".html",
                                                // ".css",
                                                // ".xml",
                                                // ".swift",
                                                // ".pdf",
                                            ].join(",")}
                                            className="hidden"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length) onAddFiles(files);
                                                e.currentTarget.value = "";
                                            }}
                                            disabled={isStreaming}
                                        />
                                    </label>
                                </Tooltip>

                                {/* Deep Search toggle */}
                                <Tooltip
                                    text={isPremium ? (deepSearch ? "Deep Search on" : "Deep Search off") : "Deep Search — Premium only"}
                                    side="bottom"
                                >
                                    <button
                                        type="button"
                                        onClick={isPremium ? onToggleDeepSearch : undefined}
                                        disabled={isStreaming}
                                        className={[
                                            "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition select-none",
                                            !isPremium
                                                ? "cursor-not-allowed opacity-40 text-white/50"
                                                : deepSearch
                                                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                                                    : "text-white/60 hover:text-white hover:bg-white/6",
                                        ].join(" ")}
                                        aria-label="Toggle Deep Search"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                        </svg>
                                        <span className="hidden sm:inline">Search</span>
                                    </button>
                                </Tooltip>

                                <ModelDropdown
                                    value={model}
                                    options={modelChoices}
                                    onChange={(v) => onChangeModel(v)}
                                    disabled={isStreaming}
                                    isPremium={isPremium}
                                />
                            </div>

                            {/* ── Right side: lang dropdown + mic + send ── */}
                            <div className="flex items-center gap-1">

                                {/* Voice language dropdown */}
                                <div className="relative" ref={langMenuRef}>
                                    <Tooltip
                                        text={`Voice language: ${currentLang.label}`}
                                        side="bottom"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setShowLangMenu((v) => !v)}
                                            disabled={isRecording || isTranscribing || isStreaming}
                                            className="text-base h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition disabled:opacity-40 select-none"
                                            aria-label="Select voice language"
                                        >
                                            {currentLang.flag}
                                        </button>
                                    </Tooltip>

                                    {showLangMenu && (
                                        <div className="absolute bottom-10 right-0 z-50 w-48 rounded-xl border border-white/10 bg-[#2a2a2a] shadow-2xl overflow-hidden">
                                            <div className="max-h-72 overflow-y-auto py-1">
                                                {VOICE_LANGS.map((l) => (
                                                    <button
                                                        key={l.code}
                                                        type="button"
                                                        onClick={() => selectVoiceLang(l.code)}
                                                        className={[
                                                            "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition",
                                                            voiceLang === l.code
                                                                ? "bg-teal-600/30 text-teal-300"
                                                                : "text-gray-200 hover:bg-white/8",
                                                        ].join(" ")}
                                                    >
                                                        <span className="text-base">{l.flag}</span>
                                                        <span>{l.label}</span>
                                                        {voiceLang === l.code && (
                                                            <svg className="ml-auto h-3.5 w-3.5 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Voice record button — hold on mobile, click-toggle on desktop */}
                                <Tooltip
                                    text={isTranscribing ? "Transcribing…" : isRecording ? "Stop recording" : "Voice input"}
                                    side="bottom"
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            if (window.matchMedia("(hover: hover)").matches) {
                                                toggleRecording();
                                            }
                                        }}

                                        onPointerDown={(e) => {
                                            if (!window.matchMedia("(hover: hover)").matches) {
                                                e.preventDefault();
                                                if (!isRecording && !isTranscribing && !isStreaming) {
                                                    finalTranscriptRef.current = input.trim();
                                                    start();
                                                }
                                            }
                                        }}
                                        onPointerUp={(e) => {
                                            if (!window.matchMedia("(hover: hover)").matches) {
                                                if (isRecording) stop();
                                            }
                                        }}
                                        onPointerLeave={(e) => {
                                            // If finger slides off button, still stop recording
                                            if (!window.matchMedia("(hover: hover)").matches) {
                                                if (isRecording) stop();
                                            }
                                        }}
                                        disabled={isStreaming || isTranscribing}
                                        aria-label={isRecording ? "Stop recording" : "Hold to record"}
                                        className={[
                                            "relative h-10 w-10 rounded-full flex items-center justify-center transition disabled:opacity-40",
                                            isTranscribing
                                                ? "bg-teal-500/20 text-teal-400"
                                                : isRecording
                                                    ? "bg-red-500/20 text-red-400"
                                                    : "text-white/60 hover:text-white hover:bg-white/8",
                                        ].join(" ")}
                                    >
                                        {(isRecording || isTranscribing) && (
                                            <span className={[
                                                "absolute inset-0 rounded-full animate-ping pointer-events-none",
                                                isTranscribing ? "bg-teal-500/30" : "bg-red-500/30",
                                            ].join(" ")} />
                                        )}
                                        {isTranscribing ? (
                                            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                            </svg>
                                        ) : isRecording ? (
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                                                <rect x="7" y="7" width="10" height="10" rx="2" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <rect x="9" y="2" width="6" height="12" rx="3" />
                                                <path d="M5 10a7 7 0 0 0 14 0" />
                                                <line x1="12" y1="19" x2="12" y2="22" />
                                                <line x1="9" y1="22" x2="15" y2="22" />
                                            </svg>
                                        )}
                                    </button>
                                </Tooltip>
                                {/* <Tooltip
                                    text={isTranscribing ? "Transcribing…" : isRecording ? "Stop recording" : "Voice input"}
                                    side="bottom"
                                >
                                    <button
                                        type="button"
                                        onClick={toggleRecording}
                                        disabled={isStreaming || isTranscribing}
                                        aria-label={isRecording ? "Stop recording" : "Start voice input"}
                                        className={[
                                            "relative h-10 w-10 rounded-full flex items-center justify-center transition disabled:opacity-40",
                                            isTranscribing
                                                ? "bg-teal-500/20 text-teal-400"
                                                : isRecording
                                                    ? "bg-red-500/20 text-red-400"
                                                    : "text-white/60 hover:text-white hover:bg-white/8",
                                        ].join(" ")}
                                    >
                                        {(isRecording || isTranscribing) && (
                                            <span className={[
                                                "absolute inset-0 rounded-full animate-ping pointer-events-none",
                                                isTranscribing ? "bg-teal-500/30" : "bg-red-500/30",
                                            ].join(" ")} />
                                        )}
                                        {isTranscribing ? (
                                            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                            </svg>
                                        ) : isRecording ? (
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                                                <rect x="7" y="7" width="10" height="10" rx="2" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <rect x="9" y="2" width="6" height="12" rx="3" />
                                                <path d="M5 10a7 7 0 0 0 14 0" />
                                                <line x1="12" y1="19" x2="12" y2="22" />
                                                <line x1="9" y1="22" x2="15" y2="22" />
                                            </svg>
                                        )}
                                    </button>
                                </Tooltip> */}

                                {/* Send / Stop button */}
                                <button
                                    className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-500 transition disabled:opacity-40 flex items-center justify-center"
                                    onClick={isStreaming ? onStop : onSend}
                                    disabled={isStreaming ? false : !canSend}
                                    title={isStreaming ? "Stop" : "Send"}
                                >
                                    {isStreaming ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5" aria-hidden="true">
                                            <rect x="7" y="7" width="10" height="10" rx="2" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                                            <path d="M2 2L13 13" />
                                            <path d="M2 2L9 22L13 13L22 9L2 2Z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Composer;
