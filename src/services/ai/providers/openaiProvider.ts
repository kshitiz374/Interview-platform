import { mapHttpStatusToAiError } from '@/services/ai/payloadParser';
import type { AiProvider, CompletionRequest } from '@/services/ai/providers/types';
import type { AiServiceError } from '@/types/interview';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = 'https://api.openai.com/v1'
  ) {}

  async complete(request: CompletionRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 1_200,
        messages: request.messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = mapHttpStatusToAiError(
        response.status,
        body || `OpenAI request failed (${response.status})`
      );
      throw toProviderError(error);
    }

    const payload: unknown = await response.json();
    const content = extractOpenAiContent(payload);
    if (!content) {
      throw toProviderError({
        code: 'INVALID_PAYLOAD',
        message: 'OpenAI returned an empty completion.',
        retryable: false,
      });
    }

    return content;
  }
}

function extractOpenAiContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (typeof first !== 'object' || first === null) {
    return null;
  }
  const message = (first as { message?: { content?: unknown } }).message;
  const content = message?.content;
  return typeof content === 'string' ? content : null;
}

function toProviderError(error: AiServiceError): Error {
  const err = new Error(error.message);
  (err as Error & { aiError: AiServiceError }).aiError = error;
  return err;
}
