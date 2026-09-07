import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseModelsResponse, modelsToConfigMap } from "../src/models.ts";
import { FALLBACK_MODELS } from "../src/constants.ts";
import type { OrvixModelsResponse } from "../src/types.ts";

describe("parseModelsResponse", () => {
  test("returns empty array for non-array data", () => {
    const result = parseModelsResponse({ data: "not-an-array" });
    assert.deepEqual(result, []);
  });

  test("returns empty array for missing data", () => {
    const result = parseModelsResponse({});
    assert.deepEqual(result, []);
  });

  test("parses a valid managed model entry", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/muse-spark-1.3",
          name: "Orvix: Muse Spark 1.3",
          context_length: 450000,
          max_completion_tokens: 80000,
          pricing: { prompt: 0.000_001, completion: 0.000_002 },
          capabilities: { reasoning_effort: true, tools: true, vision: true },
          input_modalities: ["text", "image"],
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);

    const model = result[0]!;
    assert.equal(model.id, "orvix/muse-spark-1.3");
    assert.equal(model.name, "Orvix: Muse Spark 1.3");
    assert.equal(model.reasoning, true);
    assert.equal(model.tool_call, true);
    assert.deepEqual(model.limit, { context: 450000, output: 80000 });
    assert.deepEqual(model.cost, {
      input: 1,
      output: 2,
    });
    assert.ok(model.variants);
    assert.ok(model.modalities);
    assert.deepEqual(model.modalities!.input, ["text", "image"]);
    assert.deepEqual(model.modalities!.output, ["text"]);
  });

  test("parses nested capabilities and architecture fields", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/gpt-5.6-luna",
          capabilities: {
            reasoning_effort: true,
            tools: true,
            vision: true,
            max_output_tokens: 128000,
          },
          architecture: { input_modalities: ["text", "image"] },
          max_model_len: 450000,
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.reasoning, true);
    assert.equal(result[0]!.tool_call, true);
    assert.deepEqual(result[0]!.limit, {
      context: 450000,
      output: 128000,
    });
  });

  test("preserves unprefixed BYOK model IDs verbatim", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "my-finetune-v2",
          name: "My Finetune",
          context_length: 32768,
          max_completion_tokens: 4096,
          capabilities: { tools: true },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "my-finetune-v2");
    assert.equal(result[0]!.name, "My Finetune");
    assert.equal(result[0]!.reasoning, false);
    assert.equal(result[0]!.tool_call, true);
    assert.equal(result[0]!.variants, undefined);
  });

  test("skips non-chat models (embeddings, image, rerank, etc.)", () => {
    const payload: OrvixModelsResponse = {
      data: [
        { id: "orvix/muse-spark-1.3", capabilities: { tools: true } },
        { id: "orvix/text-embedding-3-small" },
        { id: "orvix/image-gen" },
        { id: "orvix/rerank-v1" },
        { id: "orvix/whisper-audio" },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "orvix/muse-spark-1.3");
  });

  test("skips live image-generation routes by id and capability flag", () => {
    const payload: OrvixModelsResponse = {
      data: [
        { id: "orvix/muse-spark-1.3", capabilities: { tools: true } },
        { id: "orvix/flux-2-pro", capabilities: { image_generation: true } },
        { id: "orvix/midjourney", capabilities: { image_generation: true } },
        {
          id: "orvix/seedream-5.0-pro",
          capabilities: { image_generation: true },
        },
        {
          id: "orvix/grok-imagine-image",
          capabilities: { image_generation: true },
        },
        {
          id: "orvix/gpt-image-2",
          capabilities: { image_generation: true },
        },
        {
          id: "orvix/gemini-3-pro-image",
          capabilities: { image_generation: true },
        },
        {
          id: "orvix/qwen-image-3.0",
          capabilities: { image_generation: true },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "orvix/muse-spark-1.3");
  });

  test("filters image-generation routes even when the id looks chat-like", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/future-painter",
          capabilities: { image_generation: true, tools: false },
        },
      ],
    };
    assert.deepEqual(parseModelsResponse(payload), []);
  });

  test("keeps chat routers that advertise image generation with tools", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/auto",
          capabilities: { image_generation: true, tools: true },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "orvix/auto");
  });

  test("skips entries without a valid id", () => {
    const payload: OrvixModelsResponse = {
      data: [
        { id: "" },
        { id: "   " },
        { id: 123 },
        { id: null },
        { foo: "bar" },
        { id: "orvix/muse-spark-1.3" },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "orvix/muse-spark-1.3");
  });

  test("skips non-object entries", () => {
    const payload: OrvixModelsResponse = {
      data: ["string", 42, null, { id: "orvix/muse-spark-1.3" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
  });

  test("uses fallback values when API fields are missing", () => {
    const payload: OrvixModelsResponse = {
      data: [{ id: "orvix/muse-spark-1.3" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);

    const model = result[0]!;
    assert.equal(model.reasoning, true);
    assert.equal(model.tool_call, true);
    assert.equal(model.limit!.context, 450000);
    assert.equal(model.limit!.output, 80000);
  });

  test("uses fallback tool_call for glm-5.3-flash when API omits it", () => {
    const payload: OrvixModelsResponse = {
      data: [{ id: "orvix/glm-5.3-flash" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.tool_call, true);
  });

  test("omits cost when pricing is missing or incomplete", () => {
    const missing = parseModelsResponse({ data: [{ id: "custom-model" }] });
    assert.equal(missing[0]!.cost, undefined);

    const partial = parseModelsResponse({
      data: [{ id: "custom-model", pricing: { prompt: 0.1 } }],
    });
    assert.equal(partial[0]!.cost, undefined);
  });

  test("converts per-token pricing to per-million costs", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "custom-model",
          pricing: {
            prompt: "0.00000018",
            completion: "0.00000072",
            cache_prompt: "0.00000002",
          },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.deepEqual(result[0]!.cost, {
      input: 0.18,
      output: 0.72,
      cache_read: 0.02,
    });
  });

  test("sets reasoning to false when capabilities omit it", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/mimo-v2.5",
          capabilities: { tools: true },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.reasoning, false);
    assert.equal(result[0]!.variants, undefined);
  });

  test("sets tool_call to false when not in capabilities", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/auto",
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.tool_call, false);
  });

  test("uses API name when available", () => {
    const payload: OrvixModelsResponse = {
      data: [{ id: "orvix/muse-spark-1.3", name: "Custom Name" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.name, "Custom Name");
  });

  test("falls back to display name when API name is missing", () => {
    const payload: OrvixModelsResponse = {
      data: [{ id: "orvix/muse-spark-1.3" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.name, "Orvix: Muse Spark 1.3");
  });

  test("handles image input modality", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/muse-spark-1.3",
          input_modalities: ["text", "image"],
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.deepEqual(result[0]!.modalities!.input, ["text", "image"]);
  });

  test("exposes verified thinking variants for reasoning models", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/deepseek-v4-pro",
          capabilities: { reasoning_effort: true, tools: true },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.deepEqual(Object.keys(result[0]!.variants!).sort(), [
      "high",
      "low",
      "max",
      "none",
    ]);
  });

  test("preserves verified limits when the API reports stale values", () => {
    const payload: OrvixModelsResponse = {
      data: [
        {
          id: "orvix/muse-spark-1.3",
          context_length: 32_768,
          max_completion_tokens: 4_096,
        },
      ],
    };
    const result = parseModelsResponse(payload);

    assert.deepEqual(result[0]!.limit, {
      context: 450_000,
      output: 80_000,
    });
  });
});

describe("modelsToConfigMap", () => {
  test("uses unprefixed OpenCode keys while preserving upstream IDs", () => {
    const models = [
      { id: "orvix/muse-spark-1.3", name: "Muse Spark 1.3" },
      { id: "orvix/auto", name: "Orvix Auto" },
    ];
    const map = modelsToConfigMap(models as never);
    assert.equal(Object.keys(map).length, 2);
    assert.equal(map["muse-spark-1.3"]!.name, "Muse Spark 1.3");
    assert.equal(map["muse-spark-1.3"]!.id, "orvix/muse-spark-1.3");
    assert.equal(map["auto"]!.name, "Orvix Auto");
    assert.ok(!map["orvix/muse-spark-1.3"]);
  });

  test("preserves BYOK IDs that do not use the provider prefix", () => {
    const map = modelsToConfigMap([
      { id: "custom-model", name: "Custom" },
    ] as never);
    assert.equal(map["custom-model"]!.id, "custom-model");
  });

  test("returns empty object for empty array", () => {
    const map = modelsToConfigMap([]);
    assert.deepEqual(map, {});
  });
});

describe("FALLBACK_MODELS", () => {
  test("includes the managed Orvix catalog", () => {
    const ids = FALLBACK_MODELS.map((m) => m.id);
    for (const expected of [
      "orvix/auto",
      "orvix/muse-spark-1.2",
      "orvix/muse-spark-1.3",
      "orvix/mimo-v2.5",
      "orvix/glm-5.2",
      "orvix/gpt-5.6-luna",
      "orvix/deepseek-v4-pro",
      "orvix/kimi-k3",
    ]) {
      assert.ok(ids.includes(expected), `missing ${expected}`);
    }
  });

  test("only reasoning-capable models have variants", () => {
    for (const model of FALLBACK_MODELS) {
      if (model.reasoning) {
        assert.ok(model.variants);
        assert.ok(Object.keys(model.variants!).length > 0);
      } else {
        assert.equal(model.variants, undefined);
      }
    }
  });

  test("uses the enforced per-request context and output limits", () => {
    const limits = Object.fromEntries(
      FALLBACK_MODELS.map((model) => [model.id, model.limit])
    );
    assert.deepEqual(limits["orvix/auto"], {
      context: 450_000,
      output: 16_384,
    });
    assert.deepEqual(limits["orvix/muse-spark-1.3"], {
      context: 450_000,
      output: 80_000,
    });
    assert.deepEqual(limits["orvix/deepseek-v4-pro"], {
      context: 450_000,
      output: 384_000,
    });
  });
});
