import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  error: Error | { response?: { data?: { error?: { message?: string } } }; message?: string } | unknown;
  title?: string;
  retry?: () => void;
}

export default function ErrorMessage({ error, title, retry }: ErrorMessageProps) {
  const errorMessage =
    error?.response?.data?.error?.message ||
    error?.message ||
    'An unexpected error occurred';

  return (
    <div className="flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">
            {title || 'Error'}
          </h3>
        </div>
        <p className="text-red-700 mb-4">{errorMessage}</p>
        {retry && (
          <button
            onClick={retry}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
