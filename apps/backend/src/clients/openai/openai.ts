import { parseOpenAIEnv } from "@remora/env";
import OpenAI from "openai";

export type OpenAIEnv = ReturnType<typeof parseOpenAIEnv>;
export type OpenAIResponsesClient = Pick<OpenAI, "responses">;

let configuredOpenAIClient: OpenAI | null = null;

export function createOpenAIClient(
  env: OpenAIEnv = parseOpenAIEnv(process.env),
) {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export function getOpenAIClient() {
  configuredOpenAIClient ??= createOpenAIClient();

  return configuredOpenAIClient;
}
