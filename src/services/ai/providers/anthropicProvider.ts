import { mapHttpStatusToAiError } from '@/services/ai/payloadParser';
import type { AiProvider, CompletionRequest } from '@/services/ai/providers/types';
import type { AiServiceError } from '@/types/interview';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = 'https://api.anthropic.com/v1'
  ) {}

  async complete(request: CompletionRequest): Promise<string> {
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1_200,
        temperature: request.temperature ?? 0.4,
        system: systemMessage?.content,
        messages: nonSystemMessages,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = mapHttpStatusToAiError(
        response.status,
        body || `Anthropic request failed (${response.status})`
      );
      throw toProviderError(error);
    }

    const payload: unknown = await response.json();
    const content = extractAnthropicContent(payload);
    if (!content) {
      throw toProviderError({
        code: 'INVALID_PAYLOAD',
        message: 'Anthropic returned an empty completion.',
        retryable: false,
      });
    }

    return content;
  }
}

function extractAnthropicContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return null;
  }
  const textBlock = content.find(
    (block) =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: string }).type === 'text'
  ) as { text?: unknown } | undefined;

  return typeof textBlock?.text === 'string' ? textBlock.text : null;
}

function toProviderError(error: AiServiceError): Error {
  const err = new Error(error.message);
  (err as Error & { aiError: AiServiceError }).aiError = error;
  return err;
}
