

// apps/web/src/app/pricing/page.tsx

import Link from "next/link";

const features = [
    { label: "AI providers", free: "1 (Gemini Flash)", premium: "All (OpenAI, Claude, Gemini, Groq, DeepSeek, OpenRouter)" },
    { label: "Context window", free: "2,048 tokens", premium: "8,192 tokens (4× more)" },
    { label: "Usage limits", free: "Limited", premium: "Higher limits" },
    { label: "File attachments", free: "✗", premium: "✓" },
    { label: "Image-aware prompting", free: "✗", premium: "✓" },
    { label: "Chat history", free: "✓", premium: "✓" },
    { label: "Markdown & code rendering", free: "✓", premium: "✓" },
];

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-[#1f1f1f] text-white px-6 py-12">
            <div className="mx-auto max-w-4xl">

                {/* Back link */}
                <Link
                    href="/"
                    className="inline-block mb-8 rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                    ← Back to chat
                </Link>

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold tracking-tight">Simple pricing</h1>
                    <p className="mt-4 text-white/60 text-lg max-w-xl mx-auto">
                        One platform, every leading AI model. Pay for what you need — cancel anytime.
                    </p>
                </div>

                {/* Plan cards */}
                <div className="grid gap-6 md:grid-cols-3 mb-14">

                    {/* Free */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
                        <div>
                            <h2 className="text-lg font-semibold text-white/80">Free</h2>
                            <p className="mt-4 text-4xl font-bold">$0</p>
                            <p className="mt-1 text-sm text-white/40">Forever free</p>
                            <p className="mt-4 text-sm text-white/60">
                                Get started with Gemini Flash and basic features — no credit card required.
                            </p>
                        </div>
                        <Link
                            href="/"
                            className="mt-8 block text-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                            Start for free
                        </Link>
                    </div>

                    {/* Monthly */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
                        <div>
                            <h2 className="text-lg font-semibold text-white/80">Monthly</h2>
                            <p className="mt-4 text-4xl font-bold">
                                $5<span className="text-base font-medium text-white/50">/mo</span>
                            </p>
                            <p className="mt-1 text-sm text-white/40">Billed monthly</p>
                            <p className="mt-4 text-sm text-white/60">
                                Full access to all AI providers and premium features. Flexible month-to-month.
                            </p>
                        </div>
                        <Link
                            href="/?upgrade=monthly"
                            className="mt-8 block text-center rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                        >
                            Get Monthly
                        </Link>
                    </div>

                    {/* Yearly */}
                    <div className="rounded-2xl border border-teal-400/30 bg-teal-500/10 p-6 flex flex-col relative">
                        <span className="absolute right-4 top-4 rounded-full bg-teal-400 px-3 py-1 text-xs font-bold text-black">
                            Best Value
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold">Yearly</h2>
                            <p className="mt-4 text-4xl font-bold">
                                $3.50<span className="text-base font-medium text-white/50">/mo</span>
                            </p>
                            <p className="mt-1 text-sm text-teal-300">Billed annually at $42/year · Save 30%</p>
                            <p className="mt-4 text-sm text-white/60">
                                Everything in Monthly, at a 30% discount. Best for daily AI users.
                            </p>
                        </div>
                        <Link
                            href="/?upgrade=yearly"
                            className="mt-8 block text-center rounded-full bg-gradient-to-r from-teal-300 to-cyan-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                        >
                            Get Yearly
                        </Link>
                    </div>
                </div>

                {/* Feature comparison table */}
                <div className="rounded-2xl border border-white/10 overflow-hidden mb-12">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left px-6 py-4 text-white/50 font-medium">Feature</th>
                                <th className="text-center px-4 py-4 text-white/50 font-medium">Free</th>
                                <th className="text-center px-4 py-4 text-teal-300 font-medium">Premium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((f, i) => (
                                <tr
                                    key={f.label}
                                    className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                                >
                                    <td className="px-6 py-4 text-white/70">{f.label}</td>
                                    <td className="px-4 py-4 text-center text-white/50">{f.free}</td>
                                    <td className="px-4 py-4 text-center text-white/80">{f.premium}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Guarantees */}
                <div className="grid gap-4 md:grid-cols-3 mb-12 text-center">
                    {[
                        { icon: "🔒", title: "Secure payments", body: "All transactions processed by Polar (polar.sh), a trusted Merchant of Record." },
                        { icon: "↩️", title: "14-day refund", body: "Not happy? Email us within 14 days for a full refund, no questions asked." },
                        { icon: "✕", title: "Cancel anytime", body: "No lock-in. Cancel from your account settings whenever you want." },
                    ].map((g) => (
                        <div key={g.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                            <div className="text-3xl mb-3">{g.icon}</div>
                            <h3 className="font-semibold mb-1">{g.title}</h3>
                            <p className="text-sm text-white/50">{g.body}</p>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">Common questions</h2>
                    <div className="space-y-4">
                        {[
                            {
                                q: "What AI models are included in Premium?",
                                a: "Premium unlocks all supported models: OpenAI (GPT-5, GPT-5 Mini, GPT-5 Nano), Anthropic (Claude Haiku, Sonnet, and Opus), Google Gemini (2.5 Flash, 2.5 Flash Lite, 2.5 Pro), Groq (Llama 3.1 8B, Llama 3.3 70B), and via OpenRouter: DeepSeek, Grok 4.3, GPT-4o Mini, and Mistral Large — all in one interface.",
                            },
                            {
                                q: "Can I switch between monthly and yearly?",
                                a: "Yes. You can upgrade to yearly at any time from your account settings. The remaining balance from your monthly plan will be prorated.",
                            },
                            {
                                q: "Who processes my payment?",
                                a: "Payments are handled by Polar (polar.sh), who acts as the Merchant of Record. Your card statement will show a charge from Polar Software, Inc.",
                            },
                            {
                                q: "Is my data private?",
                                a: "Yes. Each user's chat history is stored in an isolated database — no other user can access your conversations. See our Privacy Policy for full details.",
                            },
                        ].map((item) => (
                            <div key={item.q} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <h3 className="font-semibold mb-2">{item.q}</h3>
                                <p className="text-sm text-white/60">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="text-center py-8 border-t border-white/10">
                    <p className="text-white/40 text-sm">
                        Questions?{" "}
                        <a href="mailto:support@multillm.net" className="text-teal-400 hover:underline">
                            support@multillm.net
                        </a>
                    </p>
                </div>

            </div>
        </main>
    );
}