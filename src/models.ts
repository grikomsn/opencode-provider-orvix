import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  FALLBACK_MODELS,
  ORVIX_BASE_URL,
  PROVIDER_ID,
  THINKING_VARIANTS,
} from "./constants.ts";
import type {
  OpenCodeModelConfig,
  OpenCodeProviderConfig,
  OrvixApiModel,
  OrvixModelsResponse,
} from "./types.ts";
import {
  boolean,
  canonicalModelId,
  displayName,
  isNonChatModel,
  nonNegativeNumber,
  orvixDisplayName,
  positiveNumber,
  record,
  strings,
} from "./utils.ts";

/**
 * Resolve a display name for a model.
 *
 * Uses the API-provided name when it is a non-empty string that differs
 * from the raw model ID (with any `Orvix:` prefix stripped). Otherwise
 * falls back to a formatted name.
 */
function resolveModelName(id: string, apiName: unknown): string {
  if (typeof apiName === "string" && apiName.trim()) {
    const cleaned = apiName.replace(/^Orvix(?::|\s)\s*/i, "").trim();
    if (cleaned && cleaned !== id) return apiName.trim();
  }
  return orvixDisplayName(id);
}

/**
 * Parse per-million-token costs from the Orvix pricing payload.
 *
 * Orvix reports per-token prices (`prompt`, `completion`, optional
 * `cache_prompt`); OpenCode expects per-million-token costs. Returns
 * `undefined` when the payload is missing or incomplete — costs are never
 * guessed.
 */
function costFromPricing(pricing: unknown): OpenCodeModelConfig["cost"] {
  const fields = record(pricing);
  if (!fields) return undefined;
  const prompt = fields.prompt;
  const completion = fields.completion;
  const promptRate =
    typeof prompt === "number" ? prompt : Number.parseFloat(String(prompt));
  const completionRate =
    typeof completion === "number"
      ? completion
      : Number.parseFloat(String(completion));
  if (!Number.isFinite(promptRate) || promptRate < 0) return undefined;
  if (!Number.isFinite(completionRate) || completionRate < 0) return undefined;
  const cacheRate = fields.cache_prompt;
  const parsedCache =
    typeof cacheRate === "number"
      ? cacheRate
      : cacheRate === undefined
        ? undefined
        : Number.parseFloat(String(cacheRate));
  const perMillion = (value: number): number =>
    Number((value * 1_000_000).toFixed(6));
  return {
    input: perMillion(promptRate),
    output: perMillion(completionRate),
    ...(parsedCache !== undefined &&
    Number.isFinite(parsedCache) &&
    parsedCache >= 0
      ? { cache_read: perMillion(parsedCache) }
      : {}),
  };
}

/**
 * Convert the rich Orvix `/models` response into OpenCode model configs.
 *
 * Each raw API entry is mapped to an OpenCode model config with id, name,
 * reasoning support, tool-call support, cost, limits, and reasoning
 * variants. Models that are not chat-capable (embeddings, image-generation
 * routes, etc.) are filtered out. Both managed `orvix/*` IDs and unprefixed
 * BYOK IDs are preserved verbatim.
 */
export function parseModelsResponse(
  payload: OrvixModelsResponse
): OpenCodeModelConfig[] {
  if (!Array.isArray(payload.data)) return [];

  const known = new Map(FALLBACK_MODELS.map((item) => [item.id, item]));
  return payload.data.flatMap((raw): OpenCodeModelConfig[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as OrvixApiModel;
    if (typeof item.id !== "string") return [];
    const id = item.id.trim();
    if (!id) return [];

    // Skip non-chat models (embeddings, image-generation routes, etc.).
    // The live `/models` directory lists image-generation routes (e.g.
    // `orvix/flux-2-pro`, `orvix/midjourney`) that advertise
    // `image_generation: true` without tool support. The flag alone is not
    // enough to filter on: `orvix/auto` is a chat router that also
    // advertises `image_generation: true` alongside `tools: true`.
    if (isNonChatModel(id)) return [];

    const canonical = canonicalModelId(id);
    const fallback = known.get(canonical) ?? known.get(id);
    const capabilities = record(item.capabilities);
    if (
      capabilities?.image_generation === true &&
      capabilities?.tools !== true
    )
      return [];
    const architecture = record(item.architecture);
    const modalities =
      strings(item.input_modalities).length > 0
        ? strings(item.input_modalities)
        : strings(architecture?.input_modalities);

    const reasoning =
      boolean(capabilities?.reasoning_effort) ??
      fallback?.reasoning ??
      false;
    const toolCall =
      boolean(item.tool_calling ?? item.tool_call ?? capabilities?.tools) ??
      fallback?.tool_call ??
      false;
    const imageInput =
      boolean(capabilities?.vision) ??
      (modalities.length > 0
        ? modalities.some((value) => value.toLowerCase() === "image")
        : undefined) ??
      (fallback?.modalities?.input.includes("image") ? true : undefined) ??
      (typeof item.name === "string"
        ? /(?:vision|\bvl\b)/i.test(item.name)
        : false);

    const variants = reasoning
      ? (THINKING_VARIANTS[canonical] ?? THINKING_VARIANTS[id] ?? undefined)
      : undefined;

    const input = (["text", "image"] as const).filter((kind) =>
      modalities.map((entry) => entry.toLowerCase()).includes(kind)
    );
    const resolvedInput = input.length
      ? [...input]
      : imageInput
        ? ["text", "image"]
        : ["text"];

    const cost = costFromPricing(item.pricing);

    return [
      {
        id,
        name: resolveModelName(id, item.name),
        reasoning,
        tool_call: toolCall,
        ...(cost ? { cost } : {}),
        // The verified static catalog is authoritative for known models.
        // Live metadata fills in missing fields but must not shrink the
        // advertised capacity of managed routes.
        limit: {
          context:
            fallback?.limit?.context ??
            positiveNumber(
              item.context_length ??
                item.max_context_tokens ??
                item.max_model_len,
              DEFAULT_CONTEXT_WINDOW
            ),
          output:
            fallback?.limit?.output ??
            positiveNumber(
              item.max_completion_tokens ??
                item.max_output_tokens ??
                capabilities?.max_output_tokens,
              DEFAULT_MAX_TOKENS
            ),
        },
        ...(variants ? { variants } : {}),
        modalities: {
          input: resolvedInput,
          output: ["text"],
        },
      },
    ];
  });
}

/**
 * Fetch the live model catalog from the Orvix API.
 *
 * @param apiKey - Orvix project API key (Bearer token, `orv-sk_live_…`).
 * @param signal - Optional abort signal for cancellation.
 * @returns Parsed model configs.
 * @throws When the API returns an error or no models.
 */
export async function fetchModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<OpenCodeModelConfig[]> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`${ORVIX_BASE_URL}/models`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`Orvix /models returned HTTP ${response.status}`);
  }

  const models = parseModelsResponse(
    (await response.json()) as OrvixModelsResponse
  );
  if (!models.length) {
    throw new Error("Orvix /models returned no models");
  }
  return models;
}

/**
 * Convert an array of model configs into the OpenCode provider `models` map.
 *
 * OpenCode addresses a model as `<provider>/<config key>` but sends the
 * config entry's `id` to the upstream API. Orvix's managed upstream IDs
 * already start with `orvix/`, so using the full ID as the key would expose
 * the incorrect doubled name `orvix/orvix/muse-spark-1.3`. Unprefixed BYOK
 * IDs are kept as-is.
 */
export function modelsToConfigMap(
  models: OpenCodeModelConfig[]
): Record<string, OpenCodeModelConfig> {
  const map: Record<string, OpenCodeModelConfig> = {};
  for (const model of models) {
    const prefix = `${PROVIDER_ID}/`;
    const key = model.id.startsWith(prefix)
      ? model.id.slice(prefix.length)
      : model.id;
    map[key] = model;
  }
  return map;
}

/**
 * Ensure the provider config block exists and is properly initialized.
 *
 * Creates the provider entry with the correct npm package, name, env, and
 * baseURL if they are not already set. Does not overwrite existing values.
 */
export function ensureProviderConfig(
  config: Record<string, unknown>,
  providerId: string
): OpenCodeProviderConfig {
  if (!config || typeof config !== "object") {
    return {};
  }

  if (!config.provider || typeof config.provider !== "object") {
    config.provider = {};
  }

  const providers = config.provider as Record<string, unknown>;
  if (!providers[providerId] || typeof providers[providerId] !== "object") {
    providers[providerId] = {};
  }

  return providers[providerId] as OpenCodeProviderConfig;
}

/**
 * Apply the fallback model catalog to a provider config, preserving any
 * existing models that the user has already configured.
 */
export function applyFallbackModels(
  providerConfig: OpenCodeProviderConfig
): void {
  const existing = providerConfig.models ?? {};
  const fallback = modelsToConfigMap(FALLBACK_MODELS);
  providerConfig.models = { ...fallback, ...existing };
}

export { displayName, nonNegativeNumber, orvixDisplayName, positiveNumber };
