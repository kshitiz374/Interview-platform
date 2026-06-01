import { AlertCircle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface InterviewErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface InterviewErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class InterviewErrorBoundary extends Component<
  InterviewErrorBoundaryProps,
  InterviewErrorBoundaryState
> {
  state: InterviewErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): InterviewErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[InterviewErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>{this.state.message || 'An unexpected error occurred in the interview UI.'}</p>
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
