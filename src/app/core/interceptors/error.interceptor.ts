import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../models/api-error.model';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle HTTP 401 with silent JWT refresh rotation for non-auth requests
      if (
        error.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/logout')
      ) {
        return authService.refreshToken().pipe(
          switchMap(tokenRes => {
            const retried = req.clone({
              setHeaders: {
                Authorization: `Bearer ${tokenRes.accessToken}`
              }
            });
            return next(retried);
          }),
          catchError(refreshErr => {
            notificationService.error('Your session has expired. Please log in again.');
            authService.logout(true);
            return throwError(() => refreshErr);
          })
        );
      }

      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (error.error && typeof error.error === 'object') {
        const apiError = error.error as ApiError;
        if (apiError.message) {
          errorMessage = apiError.message;
        } else if (apiError.code) {
          errorMessage = `Error: ${apiError.code}`;
        }

        if (apiError.fieldErrors && apiError.fieldErrors.length > 0) {
          const fieldMsgs = apiError.fieldErrors.map(f => `${f.field}: ${f.message}`).join(', ');
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

      notificationService.error(errorMessage);
      return throwError(() => error);
    })
  );
};
