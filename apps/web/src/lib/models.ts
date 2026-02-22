
// apps/web/src/lib/models.ts

import type { SelectOpt } from "@/components/chat/Composer";

export const MODEL_OPTIONS = [
    "openai:gpt-5-nano",
    "openai:gpt-5-mini",
    "openai:gpt-5",
    "openrouter:deepseek/deepseek-chat",
    "openrouter:x-ai/grok-4.1-fast",
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
    "openrouter:x-ai/grok-4.1-fast": 0.7,
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
