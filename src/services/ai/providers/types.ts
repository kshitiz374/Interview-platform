export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<string>;
}

export type AiProviderKind = 'mock' | 'openai' | 'anthropic';

export interface AiProviderConfig {
  kind: AiProviderKind;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
