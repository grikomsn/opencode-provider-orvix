/**
 * Raw model entry returned by the Orvix `/v1/models` endpoint.
 *
 * Fields are typed as `unknown` because the API may omit or change them.
 * Orvix nests capability metadata under `capabilities` and `architecture`
 * in addition to top-level fields.
 */
export type OrvixApiModel = {
  id?: unknown;
  name?: unknown;
  version?: unknown;
  description?: unknown;
  context_length?: unknown;
  max_context_tokens?: unknown;
  max_model_len?: unknown;
  max_output_tokens?: unknown;
  max_completion_tokens?: unknown;
  input_modalities?: unknown;
  output_modalities?: unknown;
  architecture?: unknown;
  capabilities?: unknown;
  pricing?: unknown;
  tool_calling?: unknown;
  tool_call?: unknown;
  created?: unknown;
  owned_by?: unknown;
};

/**
 * Top-level shape of the `/v1/models` response.
 */
export type OrvixModelsResponse = {
  data?: unknown;
  object?: string;
};

/**
 * A single model config entry injected into the OpenCode provider config.
 */
export type OpenCodeModelConfig = {
  id: string;
  name: string;
  reasoning?: boolean;
  tool_call?: boolean;
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context: number;
    output: number;
  };
  variants?: Record<string, Record<string, unknown>>;
  modalities?: {
    input: string[];
    output: string[];
  };
};

/**
 * Provider-level config entry in OpenCode's `provider` object.
 */
export type OpenCodeProviderConfig = {
  npm?: string;
  name?: string;
  env?: string[];
  options?: Record<string, unknown>;
  models?: Record<string, OpenCodeModelConfig>;
};
