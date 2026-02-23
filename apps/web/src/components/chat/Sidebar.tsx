
// apps/web/src/components/chat/Sidebar.tsx

"use client";

import React from "react";
import IconGhostButton from "@/components/ui/IconGhostButton";

export type ChatListItem = {
    id: string;
    title: string;
    model: string;
    updated_at: string;
};

function formatChatTime(iso: string) {
    try {
        const d = new Date(iso);
        const now = new Date();
        const sameDay =
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();

        if (sameDay) {
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            return `${hh}:${mm}`;
        }

        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
        ).padStart(2, "0")}`;
    } catch {
        return "";
    }
}



export default function Sidebar({
    isSmall,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isStreaming,

    chats,
    filteredChats,
    activeChatId,

    isSidebarLoading,
    chatSearch,
    setChatSearch,

    onNewChat,
    onOpenChat,
    onRequestDeleteChat,

    sidebarLoadingSince,
    onRetryChats,

    userLabel,
    isAuthed,
    onOpenAuth,
}: {
    isSmall: boolean;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    isStreaming: boolean;

    chats: ChatListItem[];
    filteredChats: ChatListItem[];
    activeChatId: string | null;

    isSidebarLoading: boolean;
    chatSearch: string;
    setChatSearch: (s: string) => void;

    onNewChat: () => void;
    onOpenChat: (id: string) => void;
    onRequestDeleteChat: (id: string) => void;

    sidebarLoadingSince: number | null;
    onRetryChats: () => void;

    userLabel: string;
    isAuthed: boolean;
    onOpenAuth: () => void;
}) {

    const [loadingTick, setLoadingTick] = React.useState(0);
    const [nowMs, setNowMs] = React.useState(() => Date.now());

    const showWarmupUI = isSidebarLoading && chats.length === 0;

    React.useEffect(() => {
        if (!showWarmupUI) return;

        const t1 = window.setInterval(() => setLoadingTick((v) => v + 1), 2000);
        const t2 = window.setInterval(() => setNowMs(Date.now()), 250);

        return () => {
            window.clearInterval(t1);
            window.clearInterval(t2);
        };
    }, [showWarmupUI]);

    const elapsedMs =
        showWarmupUI && sidebarLoadingSince ? Math.max(0, nowMs - sidebarLoadingSince) : 0;

    const loadingLabel = loadingTick % 2 === 0 ? "Loading chats…" : "Waking up server…";
    const showRetry = showWarmupUI && elapsedMs >= 15000;

    return (
        <aside
            className={[
                "h-full min-h-0 border-r border-white/10 bg-[#2b2b2b] flex flex-col overflow-hidden",
                "transition-all duration-200 ease-out",

                isSmall
                    ? [
                        "fixed left-0 top-0 z-50",
                        "w-[92vw] max-w-[420px]",
                        "transform transition-transform duration-200 ease-out will-change-transform",
                        isSidebarCollapsed ? "-translate-x-full" : "translate-x-0",
                    ].join(" ")
                    : isSidebarCollapsed
                        ? "w-[56px]"
                        : "w-[250px] sm:w-[270px] lg:w-[280px] xl:w-[290px]",
            ].join(" ")}
        >
            {/* Toggle button */}
            <div className="relative pt-20 px-2">
                <div
                    className={[
                        "absolute top-2 z-10",
                        isSidebarCollapsed ? "left-1/2 -translate-x-1/2" : "right-2",
                    ].join(" ")}
                >
                    <IconGhostButton
                        label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        withTooltip={false}
                        size="md"
                        onClick={() => setIsSidebarCollapsed((v) => !v)}
                        disabled={isStreaming}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-5 w-5 transition-transform duration-200 ${isSidebarCollapsed ? "rotate-180" : ""
                                }`}
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
                </div>
            </div>

            {/* Sidebar content */}
            {!isSidebarCollapsed && (
                <div className="flex-1 min-h-0 px-4 pb-4 pt-0 flex flex-col">
                    {/* Top actions */}
                    <div className="flex flex-col gap-3 shrink-0">
                        <button
                            className="w-full rounded-lg bg-white/10 hover:bg-white/15 transition px-3 py-2 text-sm text-left"
                            onClick={onNewChat}
                            disabled={isStreaming}
                        >
                            + New Chat
                        </button>

                        <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 flex items-center gap-2">
                            <input
                                className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400"
                                placeholder="Search chats..."
                                value={chatSearch}
                                onChange={(e) => setChatSearch(e.target.value)}
                            />
                            <button
                                className="opacity-70 hover:opacity-100 transition cursor-pointer"
                                title="Search"
                                type="button"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 text-gray-300"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Chats list */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 mt-4">
                        {/* {isSidebarLoading && chats.length === 0 ? (
                            <div className="text-xs text-gray-400 px-2 py-2">Loading chats…</div>
                        ) : filteredChats.length === 0 ? (
                            <div className="text-xs text-gray-400 px-2 py-2">No saved chats yet.</div>
                        ) : ( */}
                        {showWarmupUI ? (
                            <div className="px-2 py-2">
                                <div className="text-xs text-gray-400">{loadingLabel}</div>

                                {showRetry ? (
                                    <button
                                        type="button"
                                        onClick={onRetryChats}
                                        className="mt-2 rounded-lg border border-white/10 bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs text-gray-100"
                                    >
                                        Retry
                                    </button>
                                ) : null}
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="text-xs text-gray-400 px-2 py-2">No saved chats yet.</div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {filteredChats.map((c) => {
                                    const active = c.id === activeChatId;

                                    return (
                                        <div
                                            key={c.id}
                                            className={[
                                                "group w-full text-left rounded-lg px-3 py-2 border transition relative",
                                                active
                                                    ? "bg-white/10 border-white/15"
                                                    : "bg-black/10 border-white/10 hover:bg-white/10 hover:border-white/15",
                                            ].join(" ")}
                                        >
                                            <button onClick={() => onOpenChat(c.id)} className="w-full text-left">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm text-gray-100 truncate">
                                                        {c.title || "New chat"}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400 shrink-0">
                                                        {formatChatTime(c.updated_at)}
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-[11px] text-gray-400 truncate">{c.model}</div>
                                            </button>

                                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRequestDeleteChat(c.id);
                                                    }}
                                                    className="relative group/delete text-gray-400 hover:text-red-400"
                                                    aria-label="Delete chat"
                                                >
                                                    🗑️

                                                    <span
                                                        className={[
                                                            "pointer-events-none absolute right-0 translate-x-0 top-full mb-2 z-9999",
                                                            "opacity-0 translate-y-0.5 group-hover/delete:opacity-100 group-hover/delete:translate-y-0",
                                                            "transition duration-150",
                                                        ].join(" ")}
                                                    >
                                                        <span className="absolute right-2 -top-[3px] h-1.5 w-1.5 rotate-45 bg-white/95 rounded-[2px] shadow-sm z-9999" />
                                                        <span className="block whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-[11px] leading-none text-black shadow-lg z-9999">
                                                            Delete Chat
                                                        </span>
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 pt-4">
                        <button
                            type="button"
                            onClick={onOpenAuth}
                            className="w-full rounded-lg bg-black/20 border border-white/10 hover:bg-black/30 transition px-3 py-2 text-sm flex items-center justify-between gap-2"
                        >
                            <span className="truncate">{userLabel}</span>
                            <span className="text-xs text-gray-400">{isAuthed ? "🟢" : "○"}</span>
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
}