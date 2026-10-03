---
"opencode-provider-orvix": patch
---

Fix the OpenCode 2.x plugin, which failed to load with `ctx.catalog.transform` undefined since `@opencode/plugin` 2.0.4. Providers and models now register through `ctx.provider.transform`, and reasoning variants send `reasoning_effort` in the request body.
