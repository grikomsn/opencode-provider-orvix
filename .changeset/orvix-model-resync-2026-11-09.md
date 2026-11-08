---
"opencode-provider-orvix": patch
---

Resync the bundled Orvix catalog with the live service and the verified
Copilot-bridge metadata (2026-11-09):

- `orvix/auto` now mirrors the live route: 384,000-token output ceiling with
  vision, tool calling, and reasoning advertised. The old fallback entry
  recorded 16,384 output with no capability flags. Per-request budgets are
  still capped by the server, so this affects only metadata.
- New managed routes: `orvix/grok-4.7` (replacing the retired `grok-4.6`),
  `orvix/deepseek-v4.1-flash` (+ `-uncensored`), `orvix/gemini-4-argon`,
  `orvix/minimax-m3.1-flash`, `orvix/mimo-v2.6-flash`, `orvix/mimo-v2.6-pro`,
  `orvix/claude-haiku-5.5`, `orvix/claude-sonnet-5.5`, `orvix/gpt-6-astra`,
  `orvix/gpt-6-luna`, `orvix/gpt-6-sol`, and `orvix/muse-wonder-1.0`.
- Thinking profiles added from the live-verified Copilot bridge:
  `orvix/glm-5.3-flash` accepts `none`/`low`/`high`/`max`,
  `orvix/deepseek-v4.1-flash` accepts `none`/`low`/`high`/`max`, and the
  MiMo routes accept `none`/`low`/`high`. Routes without a verified profile
  (`orvix/auto`, `gpt-6-*`) expose no effort variants.
- A second verification round with the rotated project key added live-
  verified profiles for `orvix/grok-4.7`, `orvix/minimax-m3.1-flash`,
  `orvix/mimo-v2.6-flash`, and `orvix/kimi-k3` (`none`/`low`/`high`; the
  ladder demonstrably toggles the reasoning channel, and kimi-k3 rejects
  `none`/`minimal` with HTTP 503). Premium routes behind a higher credit
  tier (gpt-5.6-sol, gpt-6-astra/-fast/sol, gemini-4-argon, muse-wonder-1.0,
  claude-fable/opus-5.5) stay unprofiled rather than guessed.
- The package test now parses both the npm <= 11 array shape and the npm 12
  object shape of `npm pack --dry-run --json` output.
- Catalog discovery now retries transient failures (429/502/503/504) twice
  with bounded backoff, honoring `Retry-After` with a 5-second cap. Non-
  transient failures (401/403/404) still fail fast.
