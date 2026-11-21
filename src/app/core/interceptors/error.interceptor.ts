import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { parseApiError } from '../utils/api-error.util';
import { NotificationService } from '../services/notification.service';

export const IS_AUTH_RETRY = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle HTTP 401 with silent JWT refresh rotation for non-auth requests (retry at most once)
      if (
        error.status === 401 &&
        !req.context.get(IS_AUTH_RETRY) &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/logout')
      ) {
        return authService.refreshToken().pipe(
          switchMap(tokenRes => {
            const retried = req.clone({
              setHeaders: {
                Authorization: `Bearer ${tokenRes.accessToken}`
              },
              context: req.context.set(IS_AUTH_RETRY, true)
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

      const parsed = parseApiError(error);
      console.error('[FinLedger API Error]', {
        status: error.status,
        url: error.url,
        code: parsed.code,
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        rawError: error.error
      });

      notificationService.error(parsed.fullText);
      return throwError(() => error);
    })
  );
};
