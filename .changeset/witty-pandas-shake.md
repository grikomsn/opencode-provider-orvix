---
"opencode-provider-orvix": minor
---

Initial release of the OpenCode plugin for the Orvix AI model provider.

- Registers the `orvix` provider using `@ai-sdk/openai-compatible` with the correct base URL (`https://api.orvix.id/v1`)
- Live model discovery from the Orvix API at startup, with fallback to a static catalog of managed models
- API key management via OpenCode's `/connect orvix` command
- Managed `orvix/*` models plus unprefixed BYOK routes preserved verbatim
- Verified per-model `reasoning_effort` variants for Muse Spark, GPT-5.6, GLM 5.2, and DeepSeek V4 Pro
