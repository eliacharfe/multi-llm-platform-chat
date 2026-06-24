
// apps/web/src/lib/models.ts

import type { SelectOpt } from "@/components/chat/Composer";

export const MODEL_OPTIONS = [
    "openai:gpt-5-nano",
    "openai:gpt-5-mini",
    "openai:gpt-5",
    "openrouter:deepseek/deepseek-chat",
    "openrouter:x-ai/grok-4.3",
    "openrouter:openai/gpt-4o-mini",
    "openrouter:mistralai/mistral-large-2512",
    "groq:llama-3.1-8b-instant",
    "groq:llama-3.3-70b-versatile",
    "anthropic:claude-sonnet-4-6",
    "anthropic:claude-opus-4-6",
    "anthropic:claude-haiku-4-5",
    "gemini:models/gemini-2.5-flash-lite",
    "gemini:models/gemini-2.5-flash",
] as const;

const DEFAULT_TEMPERATURE = 0.7;
const TEMPERATURE_BY_MODEL: Record<string, number> = {
    "openrouter:deepseek/deepseek-chat": 0.7,
    "openrouter:x-ai/grok-4.3": 0.7,
    "openrouter:openai/gpt-4o-mini": 0.7,
    "openrouter:mistralai/mistral-large-2512": 0.6,
    "groq:llama-3.1-8b-instant": 0.7,
    "groq:llama-3.2-3b": 0.6,
    "groq:llama-3.3-70b-versatile": 0.7,
    "anthropic:claude-sonnet-4-6": 0.6,
    "anthropic:claude-opus-4-6": 0.6,
    "anthropic:claude-haiku-4-5": 0.7,
    "gemini:models/gemini-2.5-flash-lite": 0.7,
    "gemini:models/gemini-2.5-flash": 0.7,
};

// Cost per 1M tokens in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    "openai:gpt-5-nano": { input: 0.15, output: 0.60 },
    "openai:gpt-5-mini": { input: 1.10, output: 4.40 },
    "openai:gpt-5": { input: 2.50, output: 10.00 },
    "openrouter:deepseek/deepseek-chat": { input: 0.27, output: 1.10 },
    "openrouter:x-ai/grok-4.3": { input: 3.00, output: 15.00 },
    "openrouter:openai/gpt-4o-mini": { input: 0.15, output: 0.60 },
    "openrouter:mistralai/mistral-large-2512": { input: 2.00, output: 6.00 },
    "groq:llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
    "groq:llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
    "anthropic:claude-sonnet-4-6": { input: 3.00, output: 15.00 },
    "anthropic:claude-opus-4-6": { input: 15.00, output: 75.00 },
    "anthropic:claude-haiku-4-5": { input: 0.80, output: 4.00 },
    "gemini:models/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
    "gemini:models/gemini-2.5-flash": { input: 0.30, output: 2.50 },
};

export function estimateTokens(text: string): number {
    return Math.ceil((text || "").length / 4);
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export function formatCost(usd: number): string {
    if (usd === 0) return "$0.00";
    if (usd < 0.0001) return "<$0.0001";
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(3)}`;
}


const PROVIDER_TITLES: Record<string, string> = {
    openai: "OpenAI",
    openrouter: "OpenRouter",
    groq: "Groq",
    anthropic: "Anthropic",
    gemini: "Gemini",
    nebius: "Nebius",
};

const PROVIDER_ICONS: Record<string, string> = {
    openai: "🟢",
    openrouter: "⚡",
    groq: "🟠",
    anthropic: "🟣",
    gemini: "🔵",
    nebius: "🟤",
};

export function getTemperature(providerModel: string) {
    const t = TEMPERATURE_BY_MODEL[providerModel];
    return typeof t === "number" ? t : DEFAULT_TEMPERATURE;
}

export function prettifyModelName(modelName: string) {
    const raw = (modelName || "").trim().split("/").pop() || modelName;
    const spaced = raw.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

    return spaced
        .split(" ")
        .map((w) => {
            const lw = w.toLowerCase();
            if (lw === "gpt") return "GPT";
            if (lw === "llama") return "Llama";
            if (lw === "claude") return "Claude";
            if (lw === "gemini") return "Gemini";
            return /^[0-9.]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(" ");
}

export function thinkingText(providerModel: string) {
    const [, modelName = ""] = providerModel.split(":", 2);
    const pretty = prettifyModelName(modelName);
    return `${pretty} is thinking about it...`;
}

export function buildSectionedChoices(models: readonly string[]): SelectOpt[] {
    const grouped = new Map<string, string[]>();

    for (const pm of models) {
        const [provider] = pm.split(":", 1);
        if (!provider) continue;
        grouped.set(provider, [...(grouped.get(provider) || []), pm]);
    }

    const order = ["openai", "openrouter", "groq", "anthropic", "gemini", "nebius"];
    const out: SelectOpt[] = [];

    for (const provider of order) {
        const items = grouped.get(provider);
        if (!items?.length) continue;

        const icon = PROVIDER_ICONS[provider] ?? "•";
        const title = PROVIDER_TITLES[provider] ?? provider;

        out.push({
            value: `__header__:${provider}`,
            label: `--- ${icon} ${title} ${icon} ---`,
            disabled: true,
        });

        for (const pm of items) {
            const [, modelName = ""] = pm.split(":", 2);
            out.push({
                value: pm,
                label: `${icon}  ${prettifyModelName(modelName)}`
            });
        }
    }

    return out;
}


export type ModeTier = "auto" | "instant" | "thinking";

export function getProvider(providerModel: string): string {
    return (providerModel || "").split(":", 1)[0] || "";
}

export const TIER_MODEL_BY_PROVIDER: Record<
    string,
    { instant: string; thinking: string }
> = {
    //  Gemini 
    gemini: {
        instant: "gemini:models/gemini-2.5-flash-lite",
        thinking: "gemini:models/gemini-2.5-flash",
    },

    // OpenAI
    openai: {
        instant: "openai:gpt-5-nano",
        thinking: "openai:gpt-5",
    },

    // Groq
    groq: {
        instant: "groq:llama-3.1-8b-instant",
        thinking: "groq:llama-3.3-70b-versatile",
    },

    // Anthropic
    anthropic: {
        instant: "anthropic:claude-haiku-4-5",
        thinking: "anthropic:claude-opus-4-6",
    },

    // OpenRouter 
    openrouter: {
        instant: "openrouter:openai/gpt-4o-mini",
        thinking: "openrouter:mistralai/mistral-large-2512",
    },
};

export function inferTierFromModel(model: string): ModeTier {
    const p = getProvider(model);
    const m = TIER_MODEL_BY_PROVIDER[p];
    if (!m) return "auto";
    if (model === m.instant) return "instant";
    if (model === m.thinking) return "thinking";
    return "auto";
}