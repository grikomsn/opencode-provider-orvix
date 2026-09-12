/**
 * OpenCode V2 plugin implementation for the Orvix provider.
 *
 * V2 plugins default-export a definition with an `id` and `setup(ctx)`.
 * The V1 `config` and `auth` hooks map to V2 domain APIs:
 *
 * - V1 `config` hook  -> `ctx.catalog.transform` (provider + models)
 * - V1 `auth` hook    -> `ctx.integration.transform` (credential methods)
 *
 * The context is typed structurally instead of importing the full
 * `@opencode/plugin` context so this module stays decoupled from the
 * runtime dependency (see the note in `toV2Model` about the flat
 * `provider.list()` shape observed at runtime).
 */
import {
  FALLBACK_MODELS,
  ORVIX_API_KEY_ENV,
  ORVIX_BASE_URL,
  PROVIDER_ID,
  PROVIDER_NAME,
} from "./constants.ts";
import { fetchModels, modelsToConfigMap } from "./models.ts";
import type { OpenCodeModelConfig } from "./types.ts";

/**
 * Runtime package OpenCode V2 uses to load OpenAI-compatible providers.
 *
 * The `aisdk:` prefix tells OpenCode to instantiate the provider through
 * the AI SDK package installed alongside the plugin. This mirrors the
 * built-in providers (e.g. `ollama-cloud`) and keeps the optional
 * `@ai-sdk/openai-compatible` peer dependency meaningful.
 */
export const V2_PROVIDER_PACKAGE = "aisdk:@ai-sdk/openai-compatible";

/**
 * Fallback release timestamp for models without known release dates.
 *
 * V2's model schema requires `time.released`; the value only orders
 * models, so a stable fixed epoch is used when the API does not supply
 * one.
 */
const MODEL_RELEASED_FALLBACK = 1_700_000_000_000;

/**
 * Mutable provider record exposed by `catalog.transform`.
 *
 * Fields are optional because the editor may hand the callback a fresh
 * (empty) record when the provider does not exist yet; updates replay
 * when the registry rebuilds.
 */
export interface V2ProviderInfo {
  id?: string;
  name?: string;
  package?: string;
  integrationID?: string;
  activation?: string;
  settings?: Record<string, unknown>;
}

/**
 * Mutable model record exposed by `catalog.transform`.
 */
export interface V2ModelInfo {
  id?: string;
  name?: string;
  status?: string;
  enabled?: boolean;
  time?: { released: number };
  cost?: Array<{
    input: number;
    output: number;
    cache: { read: number; write: number };
  }>;
  limit?: { context: number; output: number };
  capabilities?: { tools: boolean; input: string[]; output: string[] };
  variants?: Array<{ id: string; settings: Record<string, unknown> }>;
}

export interface V2CatalogEditor {
  provider: {
    update(
      providerID: string,
      update: (provider: V2ProviderInfo) => void
    ): void;
  };
  model: {
    get(providerID: string, modelID: string): unknown;
    update(
      providerID: string,
      modelID: string,
      update: (model: V2ModelInfo) => void
    ): void;
  };
}

export interface V2IntegrationMethod {
  type: "env" | "key";
  label?: string;
  names?: string[];
}

export interface V2IntegrationEditor {
  get(id: string): unknown;
  update(id: string, update: (integration: unknown) => void): void;
  method: {
    update(input: {
      integrationID: string;
      method: V2IntegrationMethod;
    }): void;
  };
}

export interface V2PluginContext {
  catalog: {
    transform(callback: (catalog: V2CatalogEditor) => void): Promise<unknown>;
  };
  integration: {
    transform(callback: (editor: V2IntegrationEditor) => void): Promise<unknown>;
    connection: {
      active(integrationID: string): Promise<unknown>;
      resolve(connection: unknown): Promise<unknown>;
    };
  };
}

/**
 * Map an OpenCode model config (V1 shape) onto the V2 model record.
 *
 * Differences from the V1 config entry:
 * - `variants` becomes an array of `{ id, settings }` instead of a map.
 * - `cost` becomes an array of tiered entries in dollars per million
 *   tokens. When the pricing payload is missing, cost stays empty —
 *   prices are never guessed.
 * - `modalities` move into `capabilities.input` / `capabilities.output`.
 */
export function toV2Model(
  target: V2ModelInfo,
  model: OpenCodeModelConfig
): void {
  applyV2Model(target, model);
}

function applyV2Model(m: V2ModelInfo, model: OpenCodeModelConfig): void {
  m.name = model.name;
  m.status = "active";
  m.enabled = true;
  m.time = { released: MODEL_RELEASED_FALLBACK };
  m.limit = {
    context: model.limit?.context ?? 0,
    output: model.limit?.output ?? 0,
  };
  m.capabilities = {
    tools: model.tool_call ?? false,
    input: model.modalities?.input?.length
      ? [...model.modalities.input]
      : ["text"],
    output: model.modalities?.output?.length
      ? [...model.modalities.output]
      : ["text"],
  };
  m.variants = Object.entries(model.variants ?? {}).map(([id, settings]) => ({
    id,
    settings: (settings ?? {}) as Record<string, unknown>,
  }));
  m.cost = model.cost
    ? [
        {
          input: model.cost.input,
          output: model.cost.output,
          cache: {
            read: model.cost.cache_read ?? 0,
            write: 0,
          },
        },
      ]
    : [];
}

/**
 * Resolve the Orvix API key from the plugin connection state.
 *
 * Returns the credential stored via `/connect orvix` (key method) or the
 * value of the `ORVIX_API_KEY` environment variable resolved through the
 * env method. Returns `undefined` when neither is available.
 */
async function resolveApiKey(ctx: V2PluginContext): Promise<string | undefined> {
  try {
    const connection = await ctx.integration.connection.active(PROVIDER_ID);
    if (!connection) return undefined;
    const credential = (await ctx.integration.connection.resolve(connection)) as
      | { type?: string; key?: string }
      | undefined;
    if (credential?.type === "key" && credential.key) return credential.key;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Register the Orvix provider, models, and credential methods.
 *
 * This is the V2 `setup` implementation. It:
 * 1. Registers `env` and `key` auth methods on the `orvix` integration so
 *    the `ORVIX_API_KEY` environment variable and `/connect orvix` both
 *    resolve credentials (the V2 replacement for the V1 `auth` hook).
 * 2. Discovers live models when a credential is available, falling back
 *    to the static catalog otherwise.
 * 3. Upserts the provider record and model catalog through a single
 *    catalog transform (the V2 replacement for the V1 `config` hook).
 *    User-configured models already present in the catalog are never
 *    overwritten.
 */
export async function setupOrvix(ctx: V2PluginContext): Promise<void> {
  // 1. Credential methods first: the env method lets OpenCode resolve
  // `ORVIX_API_KEY` immediately, and the key method enables `/connect`.
  await ctx.integration.transform((editor) => {
    if (!editor.get(PROVIDER_ID)) {
      editor.update(PROVIDER_ID, () => {});
    }
    editor.method.update({
      integrationID: PROVIDER_ID,
      method: { type: "env", names: [ORVIX_API_KEY_ENV] },
    });
    editor.method.update({
      integrationID: PROVIDER_ID,
      method: { type: "key", label: "API Key" },
    });
  });

  // 2. Live model discovery using the resolved credential, keeping the
  // fallback catalog through transient failures (same policy as V1).
  let discovered: OpenCodeModelConfig[] = [];
  const apiKey = (await resolveApiKey(ctx)) ?? process.env[ORVIX_API_KEY_ENV];
  if (apiKey) {
    try {
      discovered = await fetchModels(apiKey);
    } catch {
      discovered = [];
    }
  }

  // Merge precedence: fallback first, then discovered (overwrites
  // fallback). User-configured models are preserved by the `model.get`
  // check inside the transform below.
  const merged = { ...modelsToConfigMap(FALLBACK_MODELS), ...modelsToConfigMap(discovered) };

  // 3. Upsert the provider and models. Transforms are replayed on every
  // registry rebuild, so the callback must be synchronous and repeatable.
  await ctx.catalog.transform((catalog) => {
    catalog.provider.update(PROVIDER_ID, (provider) => {
      if (!provider.package) provider.package = V2_PROVIDER_PACKAGE;
      if (!provider.name) provider.name = PROVIDER_NAME;
      if (!provider.settings || typeof provider.settings !== "object") {
        provider.settings = {};
      }
      if (!provider.settings.baseURL) provider.settings.baseURL = ORVIX_BASE_URL;
      if (!provider.activation) provider.activation = "enabled";
      provider.integrationID = PROVIDER_ID;
    });

    for (const [key, model] of Object.entries(merged)) {
      // Never overwrite models the user has already configured.
      if (catalog.model.get(PROVIDER_ID, key)) continue;
      catalog.model.update(PROVIDER_ID, key, (m) => applyV2Model(m, model));
    }
  });
}