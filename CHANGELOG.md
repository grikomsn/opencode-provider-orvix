# opencode-provider-orvix

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
