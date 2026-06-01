import { AnthropicProvider } from '@/services/ai/providers/anthropicProvider';
import { MockAiProvider } from '@/services/ai/providers/mockProvider';
import { OpenAiProvider } from '@/services/ai/providers/openaiProvider';
import type { AiProvider, AiProviderConfig, AiProviderKind } from '@/services/ai/providers/types';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022';

export function resolveProviderFromEnv(): AiProvider {
  return createAiProvider(readEnvConfig());
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.kind) {
    case 'openai': {
      if (!config.apiKey) {
        return new MockAiProvider();
      }
      return new OpenAiProvider(
        config.apiKey,
        config.model ?? DEFAULT_OPENAI_MODEL,
        config.baseUrl
      );
    }
    case 'anthropic': {
      if (!config.apiKey) {
        return new MockAiProvider();
      }
      return new AnthropicProvider(
        config.apiKey,
        config.model ?? DEFAULT_ANTHROPIC_MODEL,
        config.baseUrl
      );
    }
    case 'mock':
    default:
      return new MockAiProvider();
  }
}

function readEnvConfig(): AiProviderConfig {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  const kind = normalizeProviderKind(meta.env?.VITE_AI_PROVIDER);
  const openAiKey = meta.env?.VITE_OPENAI_API_KEY;
  const anthropicKey = meta.env?.VITE_ANTHROPIC_API_KEY;

  if (kind === 'openai' || (openAiKey && kind !== 'anthropic')) {
    const config: AiProviderConfig = { kind: 'openai' };
    if (openAiKey) config.apiKey = openAiKey;
    const model = meta.env?.VITE_OPENAI_MODEL;
    if (model) config.model = model;
    const baseUrl = meta.env?.VITE_OPENAI_BASE_URL;
    if (baseUrl) config.baseUrl = baseUrl;
    return config;
  }

  if (kind === 'anthropic' || anthropicKey) {
    const config: AiProviderConfig = { kind: 'anthropic' };
    if (anthropicKey) config.apiKey = anthropicKey;
    const model = meta.env?.VITE_ANTHROPIC_MODEL;
    if (model) config.model = model;
    const baseUrl = meta.env?.VITE_ANTHROPIC_BASE_URL;
    if (baseUrl) config.baseUrl = baseUrl;
    return config;
  }

  return { kind: kind ?? 'mock' };
}

function normalizeProviderKind(raw: string | undefined): AiProviderKind | undefined {
  if (raw === 'openai' || raw === 'anthropic' || raw === 'mock') {
    return raw;
  }
  return undefined;
}
