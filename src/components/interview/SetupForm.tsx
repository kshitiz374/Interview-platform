import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface SetupFormProps {
  onSubmit: (input: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
  }) => void;
  disabled?: boolean;
}

export function SetupForm({ onSubmit, disabled = false }: SetupFormProps) {
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const isValid =
    targetRole.trim().length > 0 &&
    resumeText.trim().length > 20 &&
    jobDescription.trim().length > 20;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session setup</CardTitle>
        <CardDescription>
          Paste your resume and target job description. Questions adapt to your profile and
          performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target-role">Target role</Label>
          <Input
            id="target-role"
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resume">Resume text</Label>
          <Textarea
            id="resume"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste resume plain text…"
            className="min-h-[140px]"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-description">Job description</Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job description…"
            className="min-h-[140px]"
            disabled={disabled}
          />
        </div>
        <Button
          className="w-full"
          disabled={!isValid || disabled}
          onClick={() =>
            onSubmit({
              targetRole: targetRole.trim(),
              resumeText: resumeText.trim(),
              jobDescription: jobDescription.trim(),
            })
          }
        >
          Prepare interview
        </Button>
      </CardContent>
    </Card>
  );
}
