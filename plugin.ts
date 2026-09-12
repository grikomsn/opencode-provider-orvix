import { Plugin } from "@opencode/plugin";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import {
  FALLBACK_MODELS,
  ORVIX_API_KEY_ENV,
  ORVIX_BASE_URL,
  PROVIDER_ID,
  PROVIDER_NAME,
} from "./src/constants.ts";
import { ensureProviderConfig, fetchModels, modelsToConfigMap } from "./src/models.ts";
import { setupOrvix } from "./src/v2.ts";
import type { V2PluginContext } from "./src/v2.ts";

/**
 * OpenCode plugin that registers the Orvix AI model provider.
 *
 * The plugin:
 * 1. Registers the `orvix` provider using `@ai-sdk/openai-compatible`
 *    with the correct base URL and environment variable.
 * 2. Discovers live models from the Orvix API at config time, falling
 *    back to a static catalog when the API is unreachable.
 * 3. Handles API key management via the auth hook (V1) or the
 *    `orvix` integration's credential methods (V2).
 *
 * Usage in `opencode.json` (OpenCode 1.x):
 * ```json
 * {
 *   "plugin": ["opencode-provider-orvix"],
 *   "provider": {
 *     "orvix": {
 *       "npm": "@ai-sdk/openai-compatible",
 *       "name": "Orvix",
 *       "env": ["ORVIX_API_KEY"]
 *     }
 *   }
 * }
 * ```
 *
 * Usage in `opencode.json` (OpenCode 2.x):
 * ```json
 * {
 *   "plugins": ["opencode-provider-orvix"]
 * }
 * ```
 */
export async function orvixPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    /**
     * Config hook: registers the Orvix provider and discovers models.
     *
     * Called once during OpenCode startup with the full config object.
     * The hook mutates the config in place to add or update the `orvix`
     * provider entry.
     */
    config: async (config): Promise<void> => {
      const providerConfig = ensureProviderConfig(
        config as Record<string, unknown>,
        PROVIDER_ID
      );

      // Set provider metadata if not already configured.
      if (!providerConfig.npm) {
        providerConfig.npm = "@ai-sdk/openai-compatible";
      }
      if (!providerConfig.name) {
        providerConfig.name = PROVIDER_NAME;
      }
      if (!providerConfig.env || !Array.isArray(providerConfig.env)) {
        providerConfig.env = ["ORVIX_API_KEY"];
      }

      // Set the OpenAI-compatible base URL.
      if (!providerConfig.options) {
        providerConfig.options = {};
      }
      if (!providerConfig.options.baseURL) {
        providerConfig.options.baseURL = ORVIX_BASE_URL;
      }

      // Preserve any models the user has already configured so they
      // are never overwritten by fallbacks or discovery.
      const userModels = providerConfig.models ?? {};
      const fallbackModels = modelsToConfigMap(FALLBACK_MODELS);

      // Attempt live model discovery using the API key from the environment.
      const apiKey = process.env[ORVIX_API_KEY_ENV];
      if (apiKey) {
        try {
          const discovered = await fetchModels(apiKey);
          const discoveredMap = modelsToConfigMap(discovered);
          // Merge: fallback first, then discovered (overwrites fallback),
          // then user models (never overwritten).
          providerConfig.models = {
            ...fallbackModels,
            ...discoveredMap,
            ...userModels,
          };
        } catch {
          // Keep the fallback catalog through transient failures.
          providerConfig.models = { ...fallbackModels, ...userModels };
        }
      } else {
        // No API key: use fallback models alongside any user models.
        providerConfig.models = { ...fallbackModels, ...userModels };
      }
    },

    /**
     * Auth hook: manages Orvix API key credentials.
     *
     * Supports the standard API key auth method. The loader returns the
     * key as `{ apiKey }` so OpenCode can inject it into the provider's
     * environment.
     */
    auth: {
      provider: PROVIDER_ID,
      methods: [
        {
          type: "api" as const,
          label: "API Key",
        },
      ],
      loader: async (getAuth): Promise<Record<string, unknown>> => {
        try {
          const auth = await getAuth();
          if (!auth) return {};
          if (auth.type === "api" && auth.key) return { apiKey: auth.key };
          return {};
        } catch {
          return {};
        }
      },
    },
  };
}

/**
 * V2 plugin definition (OpenCode 2.x).
 *
 * `Plugin.define` registers the stable plugin `id` used for status,
 * diagnostics, and scoped plugin storage. The `setup` callback registers
 * the provider, models, and credential methods through the catalog and
 * integration domains.
 */
const orvixPluginV2 = Plugin.define({
  id: PROVIDER_ID,
  setup: (ctx) => setupOrvix(ctx as unknown as V2PluginContext),
});

/**
 * Dual V1/V2 entrypoint.
 *
 * - OpenCode V1 (1.18.29+) calls `server()` and consumes the returned
 *   hooks (`config`, `auth`).
 * - OpenCode V2 reads the default export's `id` and `setup()`, ignoring
 *   `server()`.
 *
 * Both implementations target their own API surface; hooks are not
 * translated between them.
 */
export default {
  ...orvixPluginV2,
  server: orvixPlugin,
};