
// apps/web/src/app/api/cron/warm/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    const origin = process.env.API_ORIGIN;

    if (!secret || !origin) {
        return NextResponse.json(
            { ok: false, error: "Missing CRON_SECRET or API_ORIGIN" },
            { status: 500 }
        );
    }

    const url = new URL(req.url);
    const token = req.headers.get("authorization") || "";
    const q = url.searchParams.get("secret") || "";

    const ok =
        token === `Bearer ${secret}` ||
        q === secret;

    if (!ok) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12_000);

    const started = Date.now();
    try {
        const res = await fetch(`${origin}/health`, {
            cache: "no-store",
            signal: ac.signal,
            headers: { "cache-control": "no-store" },
        });

        const ms = Date.now() - started;

        return NextResponse.json({
            ok: res.ok,
            status: res.status,
            ms,
            origin,
        });
    } catch (e: any) {
        const ms = Date.now() - started;
        return NextResponse.json(
            { ok: false, error: e?.name === "AbortError" ? "timeout" : String(e), ms, origin },
            { status: 200 }
        );
    } finally {
        clearTimeout(t);
    }
}