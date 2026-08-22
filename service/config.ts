/**
 * Service configuration, read from the environment once.
 *
 * Credentials are never read here and never appear in the config object: the
 * Anthropic SDK resolves `ANTHROPIC_API_KEY` and the AWS credential chain
 * itself. Nothing in this module, and nothing that imports it, writes a key to
 * a file or a log.
 */

export type Provider = "anthropic" | "bedrock";

export interface AskConfig {
  provider: Provider;
  model: string;
  port: number;
  /** Origin allowed to call the service cross-origin; empty means same-origin only. */
  allowedOrigin: string;
  ratePerMinute: number;
  clientDailyCap: number;
  dailyCap: number;
  maxQuestionChars: number;
  maxOutputTokens: number;
  trustProxy: boolean;
  awsRegion: string;
  /** The site commit this service was built from, for answer provenance. */
  commit: string;
  /** Include the model's raw, unverified narration in responses. Evals only; never in production. */
  debug: boolean;
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  bedrock: "global.anthropic.claude-sonnet-4-6",
};

function integer(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (received ${JSON.stringify(raw)}).`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AskConfig {
  const providerRaw = (env.ASK_PROVIDER ?? "anthropic").trim();
  if (providerRaw !== "anthropic" && providerRaw !== "bedrock") {
    throw new Error(`ASK_PROVIDER must be "anthropic" or "bedrock" (received ${JSON.stringify(providerRaw)}).`);
  }
  const provider: Provider = providerRaw;
  return {
    provider,
    model: env.ASK_MODEL?.trim() || DEFAULT_MODEL[provider],
    port: integer("ASK_PORT", 8787, env),
    allowedOrigin: env.ASK_ALLOWED_ORIGIN?.trim() ?? "",
    ratePerMinute: integer("ASK_RATE_PER_MINUTE", 6, env),
    clientDailyCap: integer("ASK_CLIENT_DAILY_CAP", 40, env),
    dailyCap: integer("ASK_DAILY_CAP", 300, env),
    maxQuestionChars: integer("ASK_MAX_QUESTION_CHARS", 600, env),
    maxOutputTokens: integer("ASK_MAX_OUTPUT_TOKENS", 2000, env),
    trustProxy: env.ASK_TRUST_PROXY === "1" || env.ASK_TRUST_PROXY === "true",
    awsRegion: env.AWS_REGION?.trim() || "us-east-1",
    commit: env.BUILD_SHA?.trim() || "unknown",
    debug: env.ASK_DEBUG === "1" || env.ASK_DEBUG === "true",
  };
}
