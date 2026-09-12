---
"opencode-provider-orvix": minor
---

Support the OpenCode V2 plugin API from the same package while keeping the V1 plugin API.

- Ship the dual entrypoint recommended by [OpenCode's V1 plugin migration guide](https://opencode.ai/v2/docs/build/plugins/migrate-v1): the default export spreads a V2 `Plugin.define({ id: "orvix", setup })` with the V1 `server()` function returning the classic `config` and `auth` hooks. OpenCode 1.x (≥ 1.18.29) calls `server()`; OpenCode 2.x reads `id` and `setup`.
- V2 registration lives in the new `src/v2.ts`: a catalog transform creates the `orvix` provider (`aisdk:@ai-sdk/openai-compatible`, base URL `https://api.orvix.id/v1`) and upserts the model catalog in the V2 model shape (variant array, tiered costs, capabilities), plus integration transforms that register `env` (`ORVIX_API_KEY`) and `key` credential methods on the `orvix` integration.
- User-configured models and provider fields are never overwritten; live `/models` discovery and the fallback catalog behave exactly as in V1.
- Add `@opencode/plugin` as a dependency. Users on OpenCode versions older than 1.18.29 should stay on `opencode-provider-orvix@0.2`.