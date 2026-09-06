import { test, before, after, beforeEach } from "node:test";
import { describe } from "node:test";
import assert from "node:assert/strict";

type PluginResult = {
  config: (config: Record<string, unknown>) => Promise<void>;
  auth: {
    provider: string;
    methods: Array<{
      type: string;
      label: string;
      authorize?: (
        inputs: Record<string, unknown> | undefined
      ) => Promise<{ type: string; key?: string }>;
    }>;
    loader: (
      getAuth: () => Promise<{ type: string; key?: string } | null>
    ) => Promise<Record<string, unknown>>;
  };
};

type PluginModule = { default: () => Promise<PluginResult> };

let pluginFn: PluginModule["default"];

// Capture the original fetch so we can restore it.
const originalFetch = globalThis.fetch;

// Mock fetch for model discovery.
let mockFetchCalls: { url: string; options: RequestInit }[] = [];
let mockFetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> } | null = null;

function setMockFetchResponse(
  response: { ok: boolean; status: number; json: () => Promise<unknown> } | null
) {
  mockFetchResponse = response;
}

before(async () => {
  const mod = await import("../plugin.ts");
  pluginFn = mod.default;
});

beforeEach(() => {
  mockFetchCalls = [];
  mockFetchResponse = null;
  globalThis.fetch = ((
    input: RequestInfo | URL,
    options?: RequestInit
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    mockFetchCalls.push({ url, options: options ?? {} });

    if (mockFetchResponse) {
      return Promise.resolve({
        ok: mockFetchResponse.ok,
        status: mockFetchResponse.status,
        json: mockFetchResponse.json,
      } as Response);
    }

    // Default: return empty models.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    } as Response);
  }) as typeof globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe("Orvix OpenCode Plugin", () => {
  test("plugin returns correct provider name", async () => {
    const plugin = await pluginFn();
    assert.equal(plugin.auth.provider, "orvix");
  });

  test("uses OpenCode's built-in API key prompt and storage", async () => {
    const plugin = await pluginFn();
    assert.equal(plugin.auth.methods[0]!.type, "api");
    assert.equal(plugin.auth.methods[0]!.label, "API Key");
    assert.equal(plugin.auth.methods[0]!.authorize, undefined);
  });

  test("loader returns apiKey on successful auth", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => ({
      type: "api",
      key: "orv-sk_live_loaded-key",
    }));
    assert.deepEqual(result, { apiKey: "orv-sk_live_loaded-key" });
  });

  test("loader returns empty object on null auth", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => null);
    assert.deepEqual(result, {});
  });

  test("loader returns empty object on wrong auth type", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => ({
      type: "oauth",
      key: "some-token",
    } as Record<string, unknown>));
    assert.deepEqual(result, {});
  });

  test("loader returns empty object when getAuth throws", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => {
      throw new Error("auth failed");
    });
    assert.deepEqual(result, {});
  });

  test("config hook registers provider with npm and env", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { orvix: {} },
    };
    await plugin.config(config);

    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    assert.equal(orvix.npm, "@ai-sdk/openai-compatible");
    assert.equal(orvix.name, "Orvix");
    assert.deepEqual(orvix.env, ["ORVIX_API_KEY"]);
  });

  test("config hook sets baseURL in options", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { orvix: {} },
    };
    await plugin.config(config);

    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    assert.equal(
      (orvix.options as Record<string, unknown>).baseURL,
      "https://api.orvix.id/v1"
    );
  });

  test("config hook adds fallback models", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { orvix: {} },
    };
    await plugin.config(config);

    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    const models = orvix.models as Record<string, unknown>;
    assert.ok(models);
    assert.ok(Object.keys(models).length > 0);
    assert.ok(models["auto"]);
    assert.ok(models["muse-spark-1.3"]);
    assert.ok(models["mimo-v2.5"]);
  });

  test("config hook does not overwrite existing npm field", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { orvix: { npm: "custom-package" } },
    };
    await plugin.config(config);

    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    assert.equal(orvix.npm, "custom-package");
  });

  test("config hook does not overwrite existing models", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: {
        orvix: { models: { "my-model": { id: "my-model" } } },
      },
    };
    await plugin.config(config);

    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    const models = orvix.models as Record<string, unknown>;
    assert.ok(models["my-model"]);
    assert.ok(models["auto"]);
  });

  test("config hook creates provider block if missing", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {};
    await plugin.config(config);

    assert.ok(config.provider);
    const orvix = (
      config.provider as Record<string, Record<string, unknown>>
    ).orvix!;
    assert.ok(orvix);
    assert.equal(orvix.npm, "@ai-sdk/openai-compatible");
  });

  test("config hook discovers live models when API key is set", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_test-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "orvix/muse-spark-1.3",
              name: "Orvix: Muse Spark 1.3",
              context_length: 450000,
              max_completion_tokens: 80000,
              pricing: { prompt: 0.000_001, completion: 0.000_002 },
              capabilities: {
                reasoning_effort: true,
                tools: true,
                vision: true,
              },
              input_modalities: ["text", "image"],
            },
            {
              id: "custom-byok-model",
              name: "Custom BYOK",
              context_length: 32768,
              max_completion_tokens: 4096,
              capabilities: { tools: true },
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { orvix: {} },
      };
      await plugin.config(config);

      assert.ok(mockFetchCalls.length > 0);
      assert.ok(
        mockFetchCalls.some((call) =>
          call.url.includes("api.orvix.id/v1/models")
        )
      );

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      assert.ok(models["muse-spark-1.3"]);
      assert.ok(models["custom-byok-model"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
    }
  });

  test("config hook keeps fallback models when API key is absent", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    delete process.env.ORVIX_API_KEY;

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { orvix: {} },
      };
      await plugin.config(config);

      assert.equal(mockFetchCalls.length, 0);

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      assert.ok(models["auto"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      }
    }
  });

  test("config hook keeps fallback models when API fails", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_test-key";

    setMockFetchResponse({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server error" }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { orvix: {} },
      };
      await plugin.config(config);

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      assert.ok(models["auto"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
    }
  });

  test("config hook preserves user models when discovery succeeds", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_test-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "orvix/muse-spark-1.3",
              name: "Orvix: Muse Spark 1.3",
              context_length: 450000,
              max_completion_tokens: 80000,
              pricing: { prompt: 0.000_001, completion: 0.000_002 },
              capabilities: { reasoning_effort: true, tools: true },
              input_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: {
          orvix: {
            models: { "my-custom-model": { id: "my-custom-model", name: "Custom" } },
          },
        },
      };
      await plugin.config(config);

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      assert.ok(models["my-custom-model"]);
      assert.ok(models["muse-spark-1.3"]);
      // Discovered model should have full metadata including modalities
      const discovered = models["muse-spark-1.3"] as Record<string, unknown>;
      assert.ok(discovered.modalities);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
    }
  });

  test("config hook includes modalities in discovered models", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_test-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "orvix/muse-spark-1.3",
              name: "Orvix: Muse Spark 1.3",
              capabilities: { reasoning_effort: true, tools: true },
              input_modalities: ["text"],
              output_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { orvix: {} },
      };
      await plugin.config(config);

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      const model = models["muse-spark-1.3"] as Record<string, unknown>;
      assert.ok(model.modalities);
      const modalities = model.modalities as Record<string, unknown>;
      assert.deepEqual(modalities.input, ["text"]);
      assert.deepEqual(modalities.output, ["text"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
    }
  });

  test("config hook uses verified thinking variants for reasoning models", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_test-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "orvix/deepseek-v4-pro",
              name: "Orvix: DeepSeek V4 Pro",
              capabilities: { reasoning_effort: true, tools: true },
              input_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { orvix: {} },
      };
      await plugin.config(config);

      const orvix = (
        config.provider as Record<string, Record<string, unknown>>
      ).orvix!;
      const models = orvix.models as Record<string, unknown>;
      const model = models["deepseek-v4-pro"] as Record<string, unknown>;
      const variants = model.variants as Record<string, unknown>;
      assert.ok(variants);
      assert.deepEqual(variants.none, { reasoning_effort: "none" });
      assert.deepEqual(variants.low, { reasoning_effort: "low" });
      assert.deepEqual(variants.high, { reasoning_effort: "high" });
      assert.deepEqual(variants.max, { reasoning_effort: "max" });
      assert.ok(!variants.minimal);
      assert.ok(!variants.medium);
      assert.ok(!variants.xhigh);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
    }
  });
});
