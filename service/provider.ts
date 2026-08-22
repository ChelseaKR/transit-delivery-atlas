import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import type { z } from "zod";
import type { AskConfig, Provider } from "./config.ts";

/**
 * The one place the service talks to a model.
 *
 * Both clients resolve credentials from the environment on their own
 * (`ANTHROPIC_API_KEY`, or the AWS credential chain); nothing here reads,
 * stores, or prints a secret. Every call asks for a structured output parsed
 * against a zod schema; a response that does not parse is a provider failure.
 */

export type ProviderErrorKind =
  | "authentication"
  | "rate-limit"
  | "bad-request"
  | "connection"
  | "refusal"
  | "parse"
  | "unknown";

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  retryable: boolean;
  constructor(kind: ProviderErrorKind, message: string, retryable: boolean) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface CompletionRequest<T> {
  /** Stable-first system blocks; the last one carries the cache breakpoint. */
  system: string[];
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}

export interface CompletionResult<T> {
  parsed: T;
  usage: Usage;
  model: string;
}

export interface ModelProvider {
  readonly name: Provider;
  readonly model: string;
  complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>>;
}

type Client = Anthropic | AnthropicBedrock;

function createClient(config: AskConfig): Client {
  if (config.provider === "bedrock") {
    return new AnthropicBedrock({ awsRegion: config.awsRegion });
  }
  return new Anthropic();
}

function classify(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError("authentication", "The model provider rejected the service's credentials.", false);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError("rate-limit", "The model provider is rate limiting the service.", true);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ProviderError("bad-request", `The model provider rejected the request: ${error.message}`, false);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError("connection", "The model provider could not be reached.", true);
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return new ProviderError("unknown", `The model provider returned ${status}.`, status >= 500);
  }
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), false);
}

export function createProvider(config: AskConfig): ModelProvider {
  const client = createClient(config);
  return {
    name: config.provider,
    model: config.model,
    async complete<T>(request: CompletionRequest<T>): Promise<CompletionResult<T>> {
      const system = request.system.map((text, index) => ({
        type: "text" as const,
        text,
        ...(index === request.system.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
      }));
      let response;
      try {
        response = await client.messages.parse({
          model: config.model,
          max_tokens: request.maxTokens,
          system,
          messages: [{ role: "user", content: request.user }],
          output_config: { format: zodOutputFormat(request.schema) },
        });
      } catch (error) {
        throw classify(error);
      }
      if (response.stop_reason === "refusal") {
        throw new ProviderError("refusal", "The model declined to answer.", false);
      }
      if (response.stop_reason === "max_tokens") {
        throw new ProviderError("parse", "The model's answer was cut off before it finished.", false);
      }
      const parsed = response.parsed_output;
      if (parsed === null || parsed === undefined) {
        throw new ProviderError("parse", "The model's answer did not match the required shape.", false);
      }
      return {
        parsed,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}
