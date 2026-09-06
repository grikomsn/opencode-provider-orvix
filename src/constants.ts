/**
 * Orvix API base URL.
 *
 * Orvix exposes an OpenAI-compatible API at this path. Chat completions
 * are served at `/chat/completions` and model discovery at `/models`.
 */
export const ORVIX_BASE_URL = "https://api.orvix.id/v1";

/**
 * Environment variable name that holds the Orvix API key.
 *
 * Keys are project-scoped, start with `orv-sk_live_`, and need the
 * `ai:invoke` scope.
 */
export const ORVIX_API_KEY_ENV = "ORVIX_API_KEY";

/**
 * Display name for the Orvix provider in OpenCode.
 */
export const PROVIDER_NAME = "Orvix";

/**
 * Provider ID used in OpenCode config and auth.
 */
export const PROVIDER_ID = "orvix";

/**
 * Default reasoning effort when none is specified.
 *
 * Matches the per-model thinking profiles verified against the live Orvix
 * API: every profile that supports reasoning defaults to `high`.
 */
export const DEFAULT_REASONING_EFFORT = "high";

/**
 * Reasoning effort values accepted by the Orvix API.
 *
 * Orvix forwards `reasoning_effort` to the upstream provider, so values
 * the upstream rejects surface as HTTP 502. Only expose values listed in
 * a model's verified thinking profile (see `THINKING_VARIANTS`).
 */
export const REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/**
 * Reasoning effort variants injected into OpenCode model config.
 *
 * Each entry maps an OpenCode variant to the OpenAI-compatible
 * `reasoning_effort` field accepted by the Orvix API.
 */
function variant(effort: ReasoningEffort): {
  reasoning_effort: ReasoningEffort;
} {
  return { reasoning_effort: effort };
}

const FULL_VARIANTS = {
  none: variant("none"),
  minimal: variant("minimal"),
  low: variant("low"),
  medium: variant("medium"),
  high: variant("high"),
  xhigh: variant("xhigh"),
  max: variant("max"),
} as const;

/**
 * Verified per-model reasoning profiles.
 *
 * Keys are full upstream model IDs. Values list the `reasoning_effort`
 * modes that model accepts. Models without an entry do not support
 * reasoning and get no variants.
 *
 * Verified against the live Orvix API (see orvix-copilot-chat
 * `src/models/options.ts`).
 */
export const THINKING_VARIANTS: Record<
  string,
  Record<string, Record<string, unknown>>
> = {
  "orvix/muse-spark-1.2": {
    minimal: variant("minimal"),
    low: variant("low"),
    medium: variant("medium"),
    high: variant("high"),
    xhigh: variant("xhigh"),
  },
  "orvix/muse-spark-1.3": {
    minimal: variant("minimal"),
    low: variant("low"),
    medium: variant("medium"),
    high: variant("high"),
    xhigh: variant("xhigh"),
  },
  "orvix/gpt-5.6-luna": {
    none: variant("none"),
    low: variant("low"),
    medium: variant("medium"),
    high: variant("high"),
    xhigh: variant("xhigh"),
    max: variant("max"),
  },
  "orvix/gpt-5.6-sol": FULL_VARIANTS,
  "orvix/gpt-5.6-terra": FULL_VARIANTS,
  "orvix/glm-5.2": FULL_VARIANTS,
  "orvix/deepseek-v4-pro": {
    none: variant("none"),
    low: variant("low"),
    high: variant("high"),
    max: variant("max"),
  },
};

/**
 * Fallback context window and output token limits for unknown models.
 */
const DEFAULT_CONTEXT_WINDOW = 32_768;
const DEFAULT_MAX_TOKENS = 4_096;

/**
 * Orvix's enforced per-request context ceiling for managed models.
 */
const MANAGED_CONTEXT_WINDOW = 450_000;

type FallbackModelDef = {
  id: string;
  name: string;
  reasoning: boolean;
  tool_call: boolean;
  image: boolean;
  limit: { context: number; output: number };
};

/**
 * Static fallback model catalog, available before authenticated refresh.
 *
 * These mirror Orvix's enforced per-request ceilings and route
 * capabilities so the provider works even when the API is unreachable.
 * The config hook replaces these with account-specific data at startup.
 */
const FALLBACK_DEFS: FallbackModelDef[] = [
  {
    id: "orvix/auto",
    name: "Orvix: Orvix Auto",
    reasoning: false,
    tool_call: false,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 16_384 },
  },
  {
    id: "orvix/muse-spark-1.2",
    name: "Orvix: Muse Spark 1.2",
    reasoning: true,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 80_000 },
  },
  {
    id: "orvix/muse-spark-1.3",
    name: "Orvix: Muse Spark 1.3",
    reasoning: true,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 80_000 },
  },
  {
    id: "orvix/mimo-v2.5",
    name: "Orvix: MiMo-V2.5",
    reasoning: false,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 128_000 },
  },
  {
    id: "orvix/mimo-v2.5-pro",
    name: "Orvix: MiMo-V2.5-Pro",
    reasoning: false,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 128_000 },
  },
  {
    id: "orvix/glm-5.2",
    name: "Orvix: GLM 5.2",
    reasoning: true,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_768 },
  },
  {
    id: "orvix/glm-5.3-flash",
    name: "Orvix: GLM 5.3 Flash",
    reasoning: false,
    tool_call: false,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 131_072 },
  },
  {
    id: "orvix/gpt-5.6-luna",
    name: "Orvix: GPT-5.6 Luna",
    reasoning: true,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 128_000 },
  },
  {
    id: "orvix/gpt-5.6-sol",
    name: "Orvix: GPT-5.6 Sol",
    reasoning: true,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 128_000 },
  },
  {
    id: "orvix/gpt-5.6-terra",
    name: "Orvix: GPT-5.6 Terra",
    reasoning: true,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 128_000 },
  },
  {
    id: "orvix/grok-4.6",
    name: "Orvix: Grok 4.6",
    reasoning: false,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_768 },
  },
  {
    id: "orvix/deepseek-v4-flash",
    name: "Orvix: DeepSeek V4 Flash",
    reasoning: false,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 384_000 },
  },
  {
    id: "orvix/deepseek-v4-pro",
    name: "Orvix: DeepSeek V4 Pro",
    reasoning: true,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 384_000 },
  },
  {
    id: "orvix/gemini-3.7-flash",
    name: "Orvix: Gemini 3.7 Flash",
    reasoning: false,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_000 },
  },
  {
    id: "orvix/gemini-3.8-flash",
    name: "Orvix: Gemini 3.8 Flash",
    reasoning: false,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_000 },
  },
  {
    id: "orvix/minimax-m3",
    name: "Orvix: MiniMax M3",
    reasoning: false,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_768 },
  },
  {
    id: "orvix/qwen-3.8-flash",
    name: "Orvix: Qwen 3.8 Flash",
    reasoning: false,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 65_536 },
  },
  {
    id: "orvix/qwen-3.8-max",
    name: "Orvix: Qwen 3.8 Max",
    reasoning: false,
    tool_call: true,
    image: true,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 32_768 },
  },
  {
    id: "orvix/kimi-k3",
    name: "Orvix: Kimi K3",
    reasoning: false,
    tool_call: true,
    image: false,
    limit: { context: MANAGED_CONTEXT_WINDOW, output: 16_384 },
  },
];

/**
 * Current Orvix Platform models, available before authenticated refresh.
 *
 * The live `/models` response is authoritative for discovered models; these
 * entries keep the provider usable when the API is unreachable and provide
 * verified limits that live metadata must not shrink.
 */
export const FALLBACK_MODELS = FALLBACK_DEFS.map((def) => {
  const variants = THINKING_VARIANTS[def.id];
  return {
    id: def.id,
    name: def.name,
    reasoning: def.reasoning,
    tool_call: def.tool_call,
    limit: def.limit,
    ...(variants ? { variants } : {}),
    modalities: {
      input: def.image ? ["text", "image"] : ["text"],
      output: ["text"],
    },
  };
});

export { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, MANAGED_CONTEXT_WINDOW };
