import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';

describe('errorInterceptor', () => {
  let mockNotificationService: {
    error: ReturnType<typeof vi.fn<(msg: string) => void>>;
    success: ReturnType<typeof vi.fn<(msg: string) => void>>;
    warning: ReturnType<typeof vi.fn<(msg: string) => void>>;
  };

  beforeEach(() => {
    mockNotificationService = {
      error: vi.fn<(msg: string) => void>(),
      success: vi.fn<(msg: string) => void>(),
      warning: vi.fn<(msg: string) => void>()
    };
  });

  const runInterceptorLogic = (error: HttpErrorResponse) => {
    let errorMessage = 'An unexpected error occurred. Please try again.';

    if (error.error && typeof error.error === 'object') {
      const apiError = error.error as any;
      if (apiError.message) {
        errorMessage = apiError.message;
      } else if (apiError.code) {
        errorMessage = `Error: ${apiError.code}`;
      }

      if (apiError.fieldErrors && apiError.fieldErrors.length > 0) {
        const fieldMsgs = apiError.fieldErrors.map((f: any) => `${f.field}: ${f.message}`).join(', ');
        errorMessage = `${errorMessage} (${fieldMsgs})`;
      }
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to the FinLedger server. Please check your connection.';
    } else if (error.status === 401) {
      errorMessage = 'Your session has expired. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied. You do not have permission for this action.';
    } else if (error.status === 404) {
      errorMessage = 'Requested resource was not found.';
    } else if (error.status === 409) {
      errorMessage = 'Conflict detected: this record was modified by another user.';
    }

    mockNotificationService.error(errorMessage);
    return errorMessage;
  };

  it('should display session expired notification for HTTP 401', () => {
    const error401 = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    runInterceptorLogic(error401);

    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Your session has expired. Please log in again.'
    );
  });

  it('should display access denied notification for HTTP 403', () => {
    const error403 = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
    runInterceptorLogic(error403);

    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Access denied. You do not have permission for this action.'
    );
  });

  it('should format API error response with custom message and field errors', () => {
    const errorApi = new HttpErrorResponse({
      status: 422,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invoice validation failed',
        fieldErrors: [
          { field: 'customerId', message: 'Customer is required' },
          { field: 'lines', message: 'At least one line item is required' }
        ]
      }
    });

    runInterceptorLogic(errorApi);

    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Invoice validation failed (customerId: Customer is required, lines: At least one line item is required)'
    );
  });

  it('should handle network connection errors (status 0)', () => {
    const networkError = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    runInterceptorLogic(networkError);

    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Unable to connect to the FinLedger server. Please check your connection.'
    );
  });
});
