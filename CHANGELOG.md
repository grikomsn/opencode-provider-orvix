# opencode-provider-orvix

## 0.3.0

### Minor Changes

- 3b2eaa3: Support the OpenCode V2 plugin API from the same package while keeping the V1 plugin API.

  - Ship the dual entrypoint recommended by [OpenCode's V1 plugin migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1): the default export spreads a V2 `Plugin.define({ id: "orvix", setup })` with the V1 `server()` function returning the classic `config` and `auth` hooks. OpenCode 1.x (≥ 1.18.29) calls `server()`; OpenCode 2.x reads `id` and `setup`.
  - V2 registration lives in the new `src/v2.ts`: a catalog transform creates the `orvix` provider (`aisdk:@ai-sdk/openai-compatible`, base URL `https://api.orvix.id/v1`) and upserts the model catalog in the V2 model shape (variant array, tiered costs, capabilities), plus integration transforms that register `env` (`ORVIX_API_KEY`) and `key` credential methods on the `orvix` integration.
  - User-configured models and provider fields are never overwritten; live `/models` discovery and the fallback catalog behave exactly as in V1.
  - Add `@opencode/plugin` as a dependency. Users on OpenCode versions older than 1.18.29 should stay on `opencode-provider-orvix@0.2`.

## 0.2.1

### Patch Changes

- 57ca4cc: Sync model metadata with the live Orvix `/models` directory: filter image-generation routes (`orvix/flux-2-pro`, `orvix/gpt-image-2`, `orvix/gemini-3-pro-image`, `orvix/grok-imagine-image`, `orvix/midjourney`, `orvix/qwen-image-3.0`, `orvix/seedream-5.0-pro`) out of the chat catalog by ID pattern and the `image_generation` capability flag, and fix the `orvix/glm-5.3-flash` fallback to advertise tool calls as reported live and verified against the inference API.

## 0.2.0

### Minor Changes

- 3a53fee: Initial release of the OpenCode plugin for the Orvix AI model provider.

  - Registers the `orvix` provider using `@ai-sdk/openai-compatible` with the correct base URL (`https://api.orvix.id/v1`)
  - Live model discovery from the Orvix API at startup, with fallback to a static catalog of managed models
  - API key management via OpenCode's `/connect orvix` command
  - Managed `orvix/*` models plus unprefixed BYOK routes preserved verbatim
  - Verified per-model `reasoning_effort` variants for Muse Spark, GPT-5.6, GLM 5.2, and DeepSeek V4 Pro
