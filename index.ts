export {
  ORVIX_BASE_URL,
  ORVIX_API_KEY_ENV,
  PROVIDER_ID,
  PROVIDER_NAME,
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORTS,
  THINKING_VARIANTS,
  FALLBACK_MODELS,
} from "./src/constants.ts";

export type { ReasoningEffort } from "./src/constants.ts";

export { parseModelsResponse, fetchModels, modelsToConfigMap } from "./src/models.ts";

export {
  nonNegativeNumber,
  positiveNumber,
  strings,
  record,
  boolean,
  canonicalModelId,
  displayName,
  orvixDisplayName,
  isNonChatModel,
} from "./src/utils.ts";

export type {
  OrvixApiModel,
  OrvixModelsResponse,
  OpenCodeModelConfig,
  OpenCodeProviderConfig,
} from "./src/types.ts";
