
// apps/web/src/app/share/[token]/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MessageList from "@/components/chat/MessageList";
import type { Msg } from "@/components/chat/MessageList";

export default function SharedChatPage() {
    const { token } = useParams<{ token: string }>();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

    const [messages, setMessages] = useState<Msg[]>([]);
    const [title, setTitle] = useState("");
    const [model, setModel] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        fetch(`${apiUrl}/v1/shared/${token}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => {
                setTitle(data.title);
                setModel(data.model);
                setMessages(data.messages || []);
            })
            .catch(() => setError("This shared conversation could not be found."))
            .finally(() => setLoading(false));
    }, [token, apiUrl]);

    if (loading) return (
        <div className="min-h-screen bg-[#252525] flex items-center justify-center text-gray-400 text-sm">
            Loading…
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#252525] flex items-center justify-center text-gray-400 text-sm">
            {error}
        </div>
    );

    return (
        <main className="min-h-screen bg-[#252525] text-gray-200">
            <div className="mx-auto max-w-3xl px-4 py-10">
                <div className="mb-8 border-b border-white/10 pb-4">
                    <h1 className="text-xl font-semibold text-gray-100">{title}</h1>
                    <p className="mt-1 text-xs text-gray-500">{model}</p>
                </div>

                <MessageList
                    messages={messages}
                    isStreaming={false}
                    thinkingLabel=""
                    model={model}
                    onSuggestion={() => { }}
                    conversationText=""
                    onRetry={() => { }}
                    onEditMessage={() => { }}
                    apiUrl={apiUrl}
                />
            </div>
        </main>
    );
}