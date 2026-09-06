/**
 * Parse a value into a non-negative number, falling back when invalid.
 */
export function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Parse a value into a positive number, falling back when invalid.
 */
export function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Extract an array of strings from an unknown value.
 */
export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Extract a record from an unknown value.
 */
export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Extract a boolean from an unknown value.
 */
export function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Normalize a model ID for comparison and lookup.
 */
export function canonicalModelId(id: string): string {
  return id.trim().toLowerCase();
}

// Casing for recurring model-family tokens that plain capitalization gets
// wrong, so unknown future managed IDs render close to vendor naming.
const MANAGED_FAMILY_TOKENS = new Map<string, string>([
  ["ai", "AI"],
  ["gpt", "GPT"],
  ["glm", "GLM"],
  ["vl", "VL"],
  ["mimo", "MiMo"],
  ["deepseek", "DeepSeek"],
  ["minimax", "MiniMax"],
]);

/**
 * Convert a model ID like `orvix/muse-spark-1.3` into a human-friendly name.
 *
 * Falls back to the raw ID when the name is not available from the API.
 */
export function displayName(id: string): string {
  const parts = id
    .replace(/^orvix\//i, "")
    .split(/[-/\s]+/)
    .filter(Boolean);
  if (!parts.length) return id;
  return parts
    .map((part) => {
      const family = MANAGED_FAMILY_TOKENS.get(part.toLowerCase());
      if (family) return family;
      if (/^v\d+(?:\.\d+)?$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/**
 * Convert a model ID into a display name prefixed with "Orvix:".
 */
export function orvixDisplayName(id: string): string {
  return `Orvix: ${displayName(id)}`;
}

/**
 * Check whether a model ID is a non-chat model (embedding, image, etc.).
 *
 * BYOK routes can expose arbitrary upstream IDs, so anything that is not
 * chat-capable is filtered out of the OpenCode catalog.
 */
export function isNonChatModel(id: string): boolean {
  const value = id.trim().toLowerCase();
  return (
    Boolean(value) &&
    /(?:^|[-/])(point|embed(?:ding)?s?|image|video|audio|voice|rerank)(?:[-/.]|$)/.test(
      value
    )
  );
}
