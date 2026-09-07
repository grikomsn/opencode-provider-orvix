---
"opencode-provider-orvix": patch
---

Sync model metadata with the live Orvix `/models` directory: filter image-generation routes (`orvix/flux-2-pro`, `orvix/gpt-image-2`, `orvix/gemini-3-pro-image`, `orvix/grok-imagine-image`, `orvix/midjourney`, `orvix/qwen-image-3.0`, `orvix/seedream-5.0-pro`) out of the chat catalog by ID pattern and the `image_generation` capability flag, and fix the `orvix/glm-5.3-flash` fallback to advertise tool calls as reported live and verified against the inference API.
