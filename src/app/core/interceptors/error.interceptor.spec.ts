import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { formatApiError } from '../utils/api-error.util';

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
    const errorMessage = formatApiError(error);
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
