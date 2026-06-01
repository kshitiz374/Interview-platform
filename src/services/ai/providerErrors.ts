import type { AiServiceError } from '@/types/interview';
import { mapUnknownToAiError } from '@/services/ai/payloadParser';

export function getAiErrorFromProvider(err: unknown): AiServiceError {
  if (err instanceof Error && 'aiError' in err) {
    return (err as Error & { aiError: AiServiceError }).aiError;
  }
  return mapUnknownToAiError(err);
}
