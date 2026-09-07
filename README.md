<p align="center">
  <img src="https://raw.githubusercontent.com/grikomsn/opencode-provider-orvix/main/assets/cover.jpg" alt="Orvix and OpenCode" width="960">
</p>

<h1 align="center">OpenCode Provider for Orvix</h1>

<p align="center">
  Use Orvix managed and BYOK models directly from <a href="https://opencode.ai">OpenCode</a> with live model discovery and API key management.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/opencode-provider-orvix"><img src="https://img.shields.io/npm/v/opencode-provider-orvix?style=flat-square&logo=npm" alt="npm version"></a>
  <a href="https://github.com/grikomsn/opencode-provider-orvix/blob/main/LICENSE"><img src="https://img.shields.io/github/license/grikomsn/opencode-provider-orvix?style=flat-square" alt="MIT license"></a>
</p>

## Features

- **Live model discovery** — fetches the current model catalog from the Orvix API at startup, with a sensible fallback catalog when the API is unreachable.
- **OpenAI-compatible** — uses [`@ai-sdk/openai-compatible`](https://ai-sdk.dev/providers/open-source-providers/openai-compatible) under the hood, so streaming, tool calls, and JSON mode work out of the box.
- **API key management** — built-in auth hook for storing and loading your Orvix API key via OpenCode's `/connect` command.
- **Managed + BYOK** — `orvix/*` models spend Orvix Credits; unprefixed IDs use upstream credentials configured in Orvix and are billed by that provider.
- **Reasoning support** — models with verified `reasoning_effort` profiles expose their supported `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` modes through OpenCode's variant picker.
- **Zero config** — add the plugin to your `opencode.json` and you're ready to go.

## Quick start

### 1. Install the plugin

Add the package to your OpenCode config. OpenCode installs it automatically:

```jsonc
// ~/.config/opencode/opencode.json  or  .opencode/opencode.json
{
  "plugin": ["opencode-provider-orvix"]
}
```

The legacy `opencode-provider-orvix/server` entry point remains supported.

### 2. Get an Orvix API key

Create a project API key with the `ai:invoke` scope at [platform.orvix.id](https://platform.orvix.id/api-keys).

### 3. Connect your API key

In OpenCode, run:

```
/connect orvix
```

Follow the prompts to enter your API key. OpenCode stores it securely and the plugin loads it automatically.

Alternatively, set the environment variable:

```bash
export ORVIX_API_KEY="orv-sk_live_your-key"
```

### 4. Start using Orvix models

```bash
opencode -m orvix/muse-spark-1.3
```

Or set a default model in your config:

```jsonc
{
  "model": "orvix/muse-spark-1.3",
  "small_model": "orvix/auto"
}
```

## Available models

| Model | Context | Max output | Reasoning |
|---|---:|---:|---|
| `orvix/auto` | 450,000 | 16,384 | — |
| `orvix/muse-spark-1.2` | 450,000 | 80,000 | `minimal`–`xhigh` |
| `orvix/muse-spark-1.3` | 450,000 | 80,000 | `minimal`–`xhigh` |
| `orvix/mimo-v2.5` | 450,000 | 128,000 | — |
| `orvix/mimo-v2.5-pro` | 450,000 | 128,000 | — |
| `orvix/glm-5.2` | 450,000 | 32,768 | `none`–`max` |
| `orvix/glm-5.3-flash` | 450,000 | 131,072 | — |
| `orvix/gpt-5.6-luna` | 450,000 | 128,000 | `none`–`max` |
| `orvix/gpt-5.6-sol` | 450,000 | 128,000 | `none`–`max` |
| `orvix/gpt-5.6-terra` | 450,000 | 128,000 | `none`–`max` |
| `orvix/grok-4.6` | 450,000 | 32,768 | — |
| `orvix/deepseek-v4-flash` | 450,000 | 384,000 | — |
| `orvix/deepseek-v4-pro` | 450,000 | 384,000 | `none`, `low`, `high`, `max` |
| `orvix/gemini-3.7-flash` | 450,000 | 32,000 | — |
| `orvix/gemini-3.8-flash` | 450,000 | 32,000 | — |
| `orvix/minimax-m3` | 450,000 | 32,768 | — |
| `orvix/qwen-3.8-flash` | 450,000 | 65,536 | — |
| `orvix/qwen-3.8-max` | 450,000 | 32,768 | — |
| `orvix/kimi-k3` | 450,000 | 16,384 | — |

The static catalog uses Orvix's enforced per-request ceilings. Authenticated model discovery enriches the catalog with live capabilities and pricing, while preserving these limits when the `/models` response is incomplete or stale. Unprefixed BYOK model IDs from your Orvix project appear automatically after discovery. Image-generation routes listed by the API (e.g. `orvix/flux-2-pro`, `orvix/midjourney`) are filtered out of the chat catalog.

## Configuration

### Provider options

The plugin sets these defaults automatically, but you can override them in your config:

```jsonc
{
  "provider": {
    "orvix": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Orvix",
      "env": ["ORVIX_API_KEY"],
      "options": {
        "baseURL": "https://api.orvix.id/v1"
      }
    }
  }
}
```

### Environment variable

```bash
export ORVIX_API_KEY="orv-sk_live_your-key"
```

## How it works

1. **Config hook** — On startup, the plugin registers the `orvix` provider with `@ai-sdk/openai-compatible`, sets the base URL and environment variable, and populates the model catalog.
2. **Model discovery** — If `ORVIX_API_KEY` is available, the plugin fetches the live model list from `https://api.orvix.id/v1/models`. If the API is unreachable, it falls back to a static catalog of known Orvix models; verified limits remain in place if the endpoint reports stale values.
3. **Model aliases** — OpenCode exposes managed models as `orvix/<name>` while sending Orvix's required `orvix/<name>` upstream IDs without duplicating the provider prefix. BYOK IDs without a prefix are passed through verbatim.
4. **Auth hook** — The plugin provides an API key auth method so you can manage your key with OpenCode's `/connect orvix` command.

## Related projects

- [Orvix for GitHub Copilot Chat](https://github.com/grikomsn/orvix-copilot-chat) — Use Orvix models directly in VS Code's Copilot Chat.

Unofficial project; not affiliated with Orvix or OpenCode. Orvix and upstream-provider usage limits and charges still apply. Licensed under [MIT](LICENSE).
