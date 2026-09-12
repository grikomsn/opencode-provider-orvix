import { test, before, beforeEach, afterEach } from "node:test";
import { describe } from "node:test";
import assert from "node:assert/strict";

import type {
  V2CatalogEditor,
  V2IntegrationEditor,
  V2ModelInfo,
  V2PluginContext,
  V2ProviderInfo,
} from "../src/v2.ts";
import { V2_PROVIDER_PACKAGE, setupOrvix } from "../src/v2.ts";

// Capture the original fetch so we can restore it.
const originalFetch = globalThis.fetch;

let mockFetchCalls: { url: string; options: RequestInit }[] = [];
let mockFetchResponse: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} | null = null;

function setMockFetchResponse(response: typeof mockFetchResponse) {
  mockFetchResponse = response;
}

/**
 * Fake V2 catalog editor: tracks provider and model updates, optionally
 * seeded with pre-existing (user-configured) records.
 */
class FakeCatalog {
  providers = new Map<string, V2ProviderInfo>();
  models = new Map<string, V2ModelInfo>();
  seedModels: [string, Partial<V2ModelInfo>][] = [];

  editor(): V2CatalogEditor {
    return {
      provider: {
        update: (providerID, update) => {
          const current = this.providers.get(providerID) ?? {};
          const draft: V2ProviderInfo = { ...current };
          update(draft);
          this.providers.set(providerID, draft);
        },
      },
      model: {
        get: (providerID, modelID) => {
          return this.models.has(`${providerID}/${modelID}`);
        },
        update: (providerID, modelID, update) => {
          const key = `${providerID}/${modelID}`;
          const draft: V2ModelInfo = { ...(this.models.get(key) ?? {}) };
          update(draft);
          this.models.set(key, draft);
        },
      },
    };
  }

  replay(): void {
    for (const [key, model] of this.seedModels) {
      this.models.set(`orvix/${key}`, model as V2ModelInfo);
    }
  }
}

class FakeIntegrations {
  methods: Array<{ integrationID: string; method: Record<string, unknown> }> =
    [];
  ensured: string[] = [];

  editor(): V2IntegrationEditor {
    return {
      get: (id) => (this.ensured.includes(id) ? { id } : undefined),
      update: (id) => {
        this.ensured.push(id);
      },
      method: {
        update: (input) => {
          this.methods.push({
            integrationID: input.integrationID,
            method: input.method as Record<string, unknown>,
          });
        },
      },
    };
  }

  registered(integrationID: string): Record<string, unknown>[] {
    return this.methods
      .filter((entry) => entry.integrationID === integrationID)
      .map((entry) => entry.method);
  }
}

/**
 * Build a fake plugin context whose transforms are applied eagerly to the
 * fake editors (close enough to the real replay semantics for tests).
 */
function makeCtx(options: {
  catalog: FakeCatalog;
  integrations: FakeIntegrations;
  activeConnection?: unknown;
  resolvedCredential?: unknown;
}): V2PluginContext {
  const { catalog, integrations } = options;
  return {
    catalog: {
      transform: async (callback) => {
        callback(catalog.editor());
        return {};
      },
    },
    integration: {
      transform: async (callback) => {
        callback(integrations.editor());
        return {};
      },
      connection: {
        active: async () => options.activeConnection,
        resolve: async () => options.resolvedCredential,
      },
    },
  } as unknown as V2PluginContext;
}

before(() => {});

beforeEach(() => {
  mockFetchCalls = [];
  mockFetchResponse = null;
  globalThis.fetch = ((input: RequestInfo | URL, options?: RequestInit) => {
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
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Orvix OpenCode V2 plugin", () => {
  test("registers provider with package, name, baseURL, integrationID, and activation", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();
    await setupOrvix(makeCtx({ catalog, integrations }));

    const orvix = catalog.providers.get("orvix");
    assert.ok(orvix);
    assert.equal(orvix.package, V2_PROVIDER_PACKAGE);
    assert.equal(orvix.name, "Orvix");
    assert.equal(orvix.integrationID, "orvix");
    assert.equal(orvix.activation, "enabled");
    assert.equal(
      (orvix.settings as Record<string, unknown>).baseURL,
      "https://api.orvix.id/v1"
    );
  });

  test("does not overwrite user-configured provider fields", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();
    // Simulate the provider already existing with user settings.
    catalog.providers.set("orvix", {
      name: "Custom Orvix",
      package: "custom-package",
      settings: { baseURL: "https://proxy.example.com/v1" },
      activation: "auto",
    });
    await setupOrvix(makeCtx({ catalog, integrations }));

    const orvix = catalog.providers.get("orvix");
    assert.equal(orvix?.name, "Custom Orvix");
    assert.equal(orvix?.package, "custom-package");
    assert.equal(
      (orvix?.settings as Record<string, unknown>).baseURL,
      "https://proxy.example.com/v1"
    );
    assert.equal(orvix?.activation, "auto");
  });

  test("registers fallback models", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();
    await setupOrvix(makeCtx({ catalog, integrations }));

    assert.ok(catalog.models.has("orvix/auto"));
    assert.ok(catalog.models.has("orvix/muse-spark-1.3"));
    assert.ok(catalog.models.has("orvix/mimo-v2.5"));
    assert.ok(catalog.models.size >= 19);
  });

  test("maps model fields to the V2 shape", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();
    await setupOrvix(makeCtx({ catalog, integrations }));

    const auto = catalog.models.get("orvix/auto");
    assert.ok(auto);
    assert.equal(auto.name, "Orvix: Orvix Auto");
    assert.equal(auto.status, "active");
    assert.equal(auto.enabled, true);
    assert.ok(auto.time?.released);
    assert.ok(auto.limit?.context);
    assert.ok(auto.limit?.output);
    assert.deepEqual(auto.capabilities?.output, ["text"]);

    const muse = catalog.models.get("orvix/muse-spark-1.3");
    assert.ok(muse);
    // Variants are an array of { id, settings } in V2.
    const variantIDs = muse.variants?.map((variant) => variant.id);
    assert.ok(variantIDs?.includes("low"));
    assert.ok(variantIDs?.includes("high"));
    const low = muse.variants?.find((variant) => variant.id === "low");
    assert.deepEqual(low?.settings, { reasoning_effort: "low" });
  });

  test("never overwrites user-configured models", async () => {
    const catalog = new FakeCatalog();
    catalog.seedModels = [
      ["auto", { name: "My Custom Auto" }],
      ["my-model", { name: "My Model" }],
    ];
    catalog.replay();
    const integrations = new FakeIntegrations();
    await setupOrvix(makeCtx({ catalog, integrations }));

    // User models are untouched.
    assert.equal(catalog.models.get("orvix/auto")?.name, "My Custom Auto");
    assert.equal(catalog.models.get("orvix/my-model")?.name, "My Model");
    // Fallback models that the user did not configure are still added.
    assert.ok(catalog.models.get("orvix/muse-spark-1.3"));
    // No duplicate "auto" rewrite happened.
    assert.equal(catalog.models.get("orvix/auto")?.status, undefined);
  });

  test("registers env and key credential methods on the orvix integration", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();
    await setupOrvix(makeCtx({ catalog, integrations }));

    const methods = integrations.registered("orvix");
    assert.deepEqual(methods, [
      { type: "env", names: ["ORVIX_API_KEY"] },
      { type: "key", label: "API Key" },
    ]);
    assert.ok(integrations.ensured.includes("orvix"));
  });

  test("discovers live models using the resolved connection credential", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();

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
              input_modalities: ["text", "image"],
            },
            {
              id: "custom-byok-model",
              name: "Custom BYOK",
              context_length: 32768,
              max_completion_tokens: 4096,
              pricing: { prompt: 0.000_001, completion: 0.000_002 },
              capabilities: { tools: true },
            },
          ],
        }),
    });

    try {
      await setupOrvix(
        makeCtx({
          catalog,
          integrations,
          activeConnection: { type: "env", name: "ORVIX_API_KEY" },
          resolvedCredential: { type: "key", key: "orv-sk_live_loaded-key" },
        })
      );

      assert.ok(mockFetchCalls.length > 0);
      assert.ok(mockFetchCalls.some((c) => c.url.includes("api.orvix.id/v1/models")));

      const muse = catalog.models.get("orvix/muse-spark-1.3");
      assert.ok(muse);
      assert.deepEqual(muse.capabilities?.input, ["text", "image"]);
      // Cost is mapped into the tiered V2 shape (per-million tokens).
      assert.equal(muse.cost?.[0]?.input, 1);
      assert.equal(muse.cost?.[0]?.output, 2);

      // Unprefixed BYOK IDs are preserved verbatim.
      assert.ok(catalog.models.has("orvix/custom-byok-model"));
    } finally {
      setMockFetchResponse(null);
    }
  });

  test("falls back to the static catalog when discovery fails", async () => {
    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();

    setMockFetchResponse({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server error" }),
    });

    try {
      await setupOrvix(
        makeCtx({
          catalog,
          integrations,
          activeConnection: { type: "env", name: "ORVIX_API_KEY" },
          resolvedCredential: { type: "key", key: "orv-sk_live_loaded-key" },
        })
      );

      assert.ok(catalog.models.has("orvix/auto"));
      assert.ok(!catalog.models.has("orvix/custom-byok-model"));
    } finally {
      setMockFetchResponse(null);
    }
  });

  test("skips discovery when no credential is available", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    delete process.env.ORVIX_API_KEY;

    const catalog = new FakeCatalog();
    const integrations = new FakeIntegrations();

    try {
      await setupOrvix(makeCtx({ catalog, integrations }));
      assert.equal(mockFetchCalls.length, 0);
      assert.ok(catalog.models.has("orvix/auto"));
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      }
    }
  });

  test("falls back to ORVIX_API_KEY env when no connection is active", async () => {
    const originalEnv = process.env.ORVIX_API_KEY;
    process.env.ORVIX_API_KEY = "orv-sk_live_env-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    try {
      const catalog = new FakeCatalog();
      const integrations = new FakeIntegrations();
      await setupOrvix(makeCtx({ catalog, integrations }));

      assert.ok(mockFetchCalls.length > 0);
      const call = mockFetchCalls[0]!;
      const headers = call.options.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer orv-sk_live_env-key");
    } finally {
      if (originalEnv !== undefined) {
        process.env.ORVIX_API_KEY = originalEnv;
      } else {
        delete process.env.ORVIX_API_KEY;
      }
      setMockFetchResponse(null);
    }
  });
});