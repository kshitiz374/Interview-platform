import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DifficultyLevel, InterviewQuestion } from '@/types/interview';

export interface QuestionDisplayProps {
  question: InterviewQuestion;
  questionNumber: number;
  totalQuestions: number;
  difficultyTier: DifficultyLevel;
}

const DIFFICULTY_VARIANT: Record<
  DifficultyLevel,
  'success' | 'secondary' | 'warning'
> = {
  EASY: 'success',
  MEDIUM: 'secondary',
  HARD: 'warning',
};

export function QuestionDisplay({
  question,
  questionNumber,
  totalQuestions,
  difficultyTier,
}: QuestionDisplayProps) {
  return (
    <Card className="border-primary/15 shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            Question {questionNumber} of {totalQuestions}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {question.category.replace('-', ' ')}
          </Badge>
          <Badge variant={DIFFICULTY_VARIANT[difficultyTier]}>{difficultyTier}</Badge>
        </div>
        <CardTitle className="text-xl leading-snug md:text-2xl">{question.prompt}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Focus areas: {question.expectedFocusAreas.join(' · ')}
        </p>
      </CardContent>
    </Card>
  );
}
