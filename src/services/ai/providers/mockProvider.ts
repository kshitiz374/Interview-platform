import type { AiProvider, CompletionRequest } from '@/services/ai/providers/types';

function hashString(input: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function pick<T>(items: readonly T[], seed: string): T {
  const index = hashString(seed) % items.length;
  return items[index] as T;
}

/** Local provider that returns structured JSON without external API calls. */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async complete(request: CompletionRequest): Promise<string> {
    const userContent =
      request.messages.find((m) => m.role === 'user')?.content ?? '';
    const systemContent =
      request.messages.find((m) => m.role === 'system')?.content ?? '';

    if (systemContent.includes('structured candidate profiles')) {
      return JSON.stringify(this.mockResumeProfile(userContent));
    }

    if (systemContent.includes('Generate one interview question')) {
      return JSON.stringify(this.mockQuestion(userContent));
    }

    if (systemContent.includes('evaluate mock interview')) {
      return JSON.stringify(this.mockEvaluation(userContent));
    }

    return JSON.stringify({ message: 'mock response' });
  }

  private mockResumeProfile(userContent: string): Record<string, unknown> {
    const nameMatch = userContent.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m);
    return {
      candidateName: nameMatch?.[1] ?? 'Candidate',
      skills: ['TypeScript', 'React', 'System Design', 'Communication'],
      experienceYears: 3,
      highlights: ['Built scalable web applications', 'Led cross-functional initiatives'],
      rawExcerpt: userContent.slice(0, 400),
    };
  }

  private mockQuestion(userContent: string): Record<string, unknown> {
    const categories = [
      'technical',
      'behavioral',
      'system-design',
      'problem-solving',
      'role-fit',
    ] as const;

    return {
      prompt: pick(
        [
          'Walk me through how you would design a rate-limited API gateway.',
          'Describe a time you resolved a production incident under pressure.',
          'How do you trade off delivery speed versus long-term maintainability?',
        ],
        userContent
      ),
      category: pick([...categories], userContent),
      expectedFocusAreas: ['architecture', 'trade-offs', 'communication'],
    };
  }

  private mockEvaluation(userContent: string): Record<string, unknown> {
    const hasAnswer = userContent.includes('Answer:') && !userContent.includes('(no answer');
    const base = hasAnswer ? 72 : 28;
    const variance = (hashString(userContent) % 15) - 7;

    const score = Math.min(95, Math.max(15, base + variance));

    return {
      accuracy: score,
      clarity: score - 4,
      depth: score - 8,
      relevance: score - 2,
      feedback: hasAnswer
        ? 'Solid structure with room to add metrics and deeper technical specifics.'
        : 'Answer was missing or too brief. Expand with concrete examples and outcomes.',
    };
  }
}
