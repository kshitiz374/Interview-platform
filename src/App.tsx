import { InterviewErrorBoundary } from '@/components/InterviewErrorBoundary';
import { InterviewDashboard } from '@/components/interview/InterviewDashboard';

export default function App() {
  return (
    <InterviewErrorBoundary>
      <InterviewDashboard />
    </InterviewErrorBoundary>
  );
}
