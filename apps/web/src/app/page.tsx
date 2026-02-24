
// apps/web/src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AuthDialog from "@/components/ui/AuthDialog";
import LogoSplash from "@/components/ui/LogoSplash";

import Sidebar from "@/components/chat/Sidebar";
import type { ChatListItem } from "@/components/chat/Sidebar";

import MessageList from "@/components/chat/MessageList";
import type { Msg } from "@/components/chat/MessageList";

import Composer, { type ComposerHandle } from "@/components/chat/Composer";

import {
  MODEL_OPTIONS,
  getTemperature,
  thinkingText,
  buildSectionedChoices,
} from "@/lib/models";




export default function Page() {
  const DEFAULT_MODEL = "gemini:models/gemini-2.5-flash";

  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("Sign in");

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarLoadingSince, setSidebarLoadingSince] = useState<number | null>(null);

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const abortRef = useRef<AbortController | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const isStreamingRef = useRef(false);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const isSmallRef = useRef(false);
  const [isSmall, setIsSmall] = useState(false);

  const modelChoices = useMemo(() => buildSectionedChoices(MODEL_OPTIONS), []);
  const canSend = useMemo(
    () => (input.trim().length > 0 || attachedFiles.length > 0) && !isStreaming,
    [input, attachedFiles.length, isStreaming]
  );

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<null | (() => Promise<void> | void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("Confirm");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"default" | "danger">(
    "default"
  );
  const [confirmText, setConfirmText] = useState("OK");
  const [cancelText, setCancelText] = useState("Cancel");

  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);

  const composerRef = useRef<ComposerHandle | null>(null);
  const prevStreamingRef = useRef(false);

  useEffect(() => {
    const was = prevStreamingRef.current;
    const now = isStreaming;

    // streaming just ended
    if (was && !now) {
      // wait a tick so textarea is enabled again
      requestAnimationFrame(() => composerRef.current?.focus());
    }

    prevStreamingRef.current = now;
  }, [isStreaming]);


  useEffect(() => {
    if (!authReady) return;
    fetch(`${apiUrl}/health`, { cache: "no-store" }).catch(() => { });
  }, [authReady, apiUrl]);

  useEffect(() => {
    if (!authReady) return;

    const minMs = 3000;
    const t = window.setTimeout(() => setShowSplash(false), minMs);
    return () => window.clearTimeout(t);
  }, [authReady]);

  function openConfirm(opts: {
    title: string;
    message: string;
    variant?: "default" | "danger";
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => Promise<void> | void;
  }) {
    setConfirmTitle(opts.title);
    setConfirmMessage(opts.message);
    setConfirmVariant(opts.variant ?? "default");
    setConfirmText(opts.confirmText ?? "OK");
    setCancelText(opts.cancelText ?? "Cancel");
    confirmActionRef.current = opts.onConfirm;
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }

  async function refreshChats(user?: User | null) {
    const u = user ?? auth.currentUser;

    if (!u) {
      setChats([]);
      return;
    }

    setIsSidebarLoading(true);
    setSidebarLoadingSince((prev) => prev ?? Date.now());

    try {
      const token = await u.getIdToken();

      const res = await fetch(`${apiUrl}/v1/chats`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.status === 401) {
        setAuthOpen(true);
        setChats([]);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${txt ? ` — ${txt}` : ""}`);
      }

      const data = (await res.json()) as { chats: ChatListItem[] };
      setChats(data?.chats || []);
    } finally {
      setIsSidebarLoading(false);
      setSidebarLoadingSince(null);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthReady(true);
      setIsAuthed(!!u);

      if (!u) {
        setUserLabel("Sign in");
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        setInput("");
        setAttachedFiles([]);
        stop();
        return;
      }

      setUserLabel(u.displayName || u.email || "Account");

      try {
        await refreshChats(u);
      } catch {
        // ignore
      }
    });

    return () => unsub();
  }, []);

  function newDraftChat() {
    stop();

    if (!activeChatId && messages.length === 0) return;

    setActiveChatId(null);
    setMessages([]);
    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    if (isSmallRef.current) setIsSidebarCollapsed(true);
  }

  async function openChat(chatId: string) {
    if (!chatId) return;

    stop();

    setMessages([]);
    setActiveChatId(chatId);

    const detail = await api<any>(`/v1/chats/${chatId}`, { method: "GET" });
    const chat = detail?.chat ?? detail;

    setMessages(Array.isArray(chat?.messages) ? chat.messages : []);
    if (chat?.model) setModel(chat.model);

    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    if (isSmallRef.current) setIsSidebarCollapsed(true);
  }

  async function ensureChatId(): Promise<string> {
    if (activeChatId) return activeChatId;

    console.log("[ensureChatId] creating chat", {
      model,
      input: input.trim(),
      files: attachedFiles.length,
      stack: new Error().stack,
    });

    const created = await api<{ chat_id: string }>("/v1/chats", {
      method: "POST",
      body: JSON.stringify({ model }),
    });

    setActiveChatId(created.chat_id);
    await refreshChats();
    return created.chat_id;
  }

  async function streamSSE(
    res: Response,
    signal: AbortSignal,
    onToken: (t: string) => void,
    onError: (msg: string) => void,
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const process = () => {
      buffer = buffer.replace(/\r\n/g, "\n");
      while (true) {
        const idx = buffer.indexOf("\n\n");
        if (idx === -1) break;
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = block.split("\n").filter(l => l.startsWith("data:"));
        if (!lines.length) continue;
        let obj: any;
        try { obj = JSON.parse(lines.map(l => l.slice(5).replace(/^\s/, "")).join("\n")); }
        catch { continue; }
        if (obj.done) return true;
        if (obj.error) { onError(String(obj.error_short ?? obj.error ?? "Unknown error")); return true; }
        if (obj.t) onToken(obj.t);
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (value) { buffer += decoder.decode(value, { stream: true }); if (process()) break; }
      if (done) break;
    }
    buffer += decoder.decode();
    process();
  }

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await auth.currentUser?.getIdToken();

    const headers: Record<string, string> = {
      ...(init?.headers as any),
    };

    const isFormData =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!isFormData) headers["Content-Type"] = "application/json";

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });

    if (res.status === 401) {
      setAuthOpen(true);
      return undefined as T;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${txt ? ` — ${txt}` : ""}`);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    isStreamingRef.current = false;
  }

  function isNearBottom(threshold = 120) {
    const el = scrollRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= threshold;
  }

  function scrollToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;

    if (!force && !autoScrollEnabledRef.current) return;

    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    });
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 750px)");
    const apply = () => {
      const small = mq.matches;
      isSmallRef.current = small;
      setIsSmall(small);
      setIsSidebarCollapsed(small);
    };

    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  function addFiles(files: File[]) {
    if (!files.length) return;

    const dedupKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

    setAttachedFiles((prev) => {
      const prevKeys = new Set(prev.map(dedupKey));
      const next = [...prev];

      for (const f of files) {
        if (!prevKeys.has(dedupKey(f))) {
          next.push(f);
          prevKeys.add(dedupKey(f));
        }
      }
      return next;
    });
  }

  useEffect(() => {
    const hasFiles = (dt: DataTransfer | null) => {
      if (!dt) return false;
      return Array.from(dt.types || []).includes("Files");
    };

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer) || isStreaming) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    };

    const onDrop = (e: DragEvent) => {
      if (isStreaming) return;
      if (!hasFiles(e.dataTransfer)) return;

      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);

      const files = Array.from(e.dataTransfer?.files || []);
      addFiles(files);
    };

    const preventWindowDrop = (e: DragEvent) => {
      if (hasFiles(e.dataTransfer)) e.preventDefault();
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);

      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, [isStreaming]);

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [chats, chatSearch]);

  const conversationText = useMemo(() => {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
      .join("\n\n---\n\n");
  }, [messages]);

  async function submit(isRetry = false) {
    if (!auth.currentUser) { setAuthOpen(true); return; }
    if (!isRetry && !canSend) return;
    if (isRetry && (!activeChatId || isStreamingRef.current)) return;

    const chatId = await ensureChatId();
    const userText = isRetry
      ? (messages.findLast(m => m.role === "user")?.content ?? "")
      : input.trim() || (attachedFiles.length ? "Summarize the attached file(s)." : "");

    if (!userText && !attachedFiles.length && !isRetry) return;

    const base = isRetry
      ? messages.slice(0, messages.map((m, i) => ({ m, i })).reverse().find(x => x.m.role === "user")!.i + 1)
      : [...messages, { role: "user" as const, content: userText }];

    setMessages([...base, { role: "assistant", content: "" }]);
    if (!isRetry) setInput("");
    setAttachedFiles([]);
    autoScrollEnabledRef.current = true;
    scrollToBottom(true);

    isStreamingRef.current = true;
    setIsStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("model", model);
      fd.append("temperature", String(getTemperature(model)));
      if (isRetry) {
        fd.append("retry", "true");
      } else {
        fd.append("message", userText);
        fd.append("messages", JSON.stringify(base));
        for (const f of attachedFiles) fd.append("files", f);
      }

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${apiUrl}/v1/chat/stream_with_files`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: ac.signal,
        body: fd,
      });

      if (res.status === 401) { setAuthOpen(true); return; }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      await streamSSE(
        res,
        ac.signal,
        (t) => {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant")
              copy[copy.length - 1] = { ...last, content: (last.content || "") + t };
            return copy;
          });
          scrollToBottom(false);
        },
        (errMsg) => {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            const text = `⚠️ ${errMsg}`;
            if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: text };
            else copy.push({ role: "assistant", content: text });
            return copy;
          });
        },
      );

      scrollToBottom(true);
      refreshChats().catch(() => { });
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          const text = `⚠️ ${String(e?.message || e)}`;
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: text };
          else copy.push({ role: "assistant", content: text });
          return copy;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      isStreamingRef.current = false;
    }
  }

  return (
    <main className="fixed inset-0 h-dvh w-screen bg-[#252525] text-gray-200 overflow-hidden flex flex-col">
      <LogoSplash
        show={showSplash}
        text={authReady ? "Preparing your workspace…" : "Initializing…"}
      />

      {isDraggingFiles ? (
        <div
          className="fixed inset-0 z-999 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-white/15 bg-black/40 px-6 py-4 text-sm text-gray-100 shadow-xl">
            Drop files to attach
          </div>
        </div>
      ) : null}

      {isSmall ? (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((v) => !v)}
          className="fixed left-3 top-3 z-60 h-10 w-10 rounded-xl border border-white/10 bg-black/30 backdrop-blur flex items-center justify-center text-gray-200 hover:bg-black/40 transition"
          aria-label={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          title={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isSidebarCollapsed ? "☰" : "✕"}
        </button>
      ) : null}

      {/* ICON */}
      <a
        href="/"
        className={`fixed left-3 top-2 z-50 transition-all duration-300 hover:scale-105 active:scale-95 ${isSidebarCollapsed
          ? "opacity-0 scale-90 pointer-events-none"
          : "opacity-100 scale-100"
          }`}
        title="Multi LLM Chat"
      >
        <img src="/multi-llm-logo.png" alt="Multi LLM Chat" className="h-7 w-7" />
      </a>

      <div className="flex h-full">
        {/* Mobile backdrop */}
        {isSmall && !isSidebarCollapsed ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        ) : null}

        {/* LEFT SIDEBAR */}
        <Sidebar
          isSmall={isSmall}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          isStreaming={isStreaming}
          chats={chats}
          filteredChats={filteredChats}
          activeChatId={activeChatId}
          isSidebarLoading={isSidebarLoading}
          sidebarLoadingSince={sidebarLoadingSince}
          onRetryChats={() => refreshChats().catch(() => { })}
          chatSearch={chatSearch}
          setChatSearch={setChatSearch}
          onNewChat={newDraftChat}
          onOpenChat={openChat}
          onRequestDeleteChat={(id) => {
            openConfirm({
              title: "Delete chat?",
              message: "This will permanently delete the chat and its messages.",
              variant: "danger",
              confirmText: "Delete",
              cancelText: "Cancel",
              onConfirm: async () => {
                await api(`/v1/chats/${id}`, { method: "DELETE" });

                if (activeChatId === id) {
                  setActiveChatId(null);
                  setMessages([]);
                }

                await refreshChats();
                closeConfirm();
              },
            });
          }}
          userLabel={userLabel}
          isAuthed={isAuthed}
          onOpenAuth={() => setAuthOpen(true)}
        />

        {/* MAIN CHAT AREA */}
        <section className="flex-1 relative min-w-0">
          <div className="h-full flex flex-col">
            {/* chat scroller */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 sm:px-6 pt-6 sm:pt-8 pb-[calc(env(safe-area-inset-bottom)-15px)]"
              onScroll={() => {
                autoScrollEnabledRef.current = isNearBottom(140);
              }}
            >
              <div className="mx-auto max-w-3xl min-w-0">
                <MessageList
                  messages={messages}
                  isStreaming={isStreaming}
                  model={model}
                  thinkingLabel={thinkingText(model)}
                  onSuggestion={(text) => setInput(text)}
                  conversationText={conversationText}
                  onRetry={() => submit(true)}
                />
              </div>
            </div>

            {/* COMPOSER */}
            <Composer
              ref={composerRef}
              input={input}
              setInput={setInput}
              attachedFiles={attachedFiles}
              onAddFiles={addFiles}
              onClearFiles={() => setAttachedFiles([])}
              model={model}
              modelChoices={modelChoices}
              onChangeModel={(v) => {
                if (v.startsWith("__header__:")) return;
                setModel(v);
              }}
              canSend={canSend}
              isStreaming={isStreaming}
              onSend={() => submit(false)}
              onStop={stop}
              isSmall={isSmall}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
            />
          </div>
        </section>
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        variant={confirmVariant}
        confirmText={confirmText}
        cancelText={cancelText}
        onClose={closeConfirm}
        onConfirm={async () => {
          const fn = confirmActionRef.current;
          if (!fn) return;
          await fn();
        }}
      />
    </main>
  );
}
