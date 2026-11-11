import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { ApiError, FieldError } from '../models/api-error.model';

export interface ParsedApiError {
  status?: number;
  code?: string;
  message: string;
  path?: string;
  fieldErrors: FieldError[];
  fullText: string;
}

const HTTP_STATUS_FALLBACKS: Record<number, string> = {
  0: 'Unable to connect to the FinLedger server. Please check your connection.',
  401: 'Your session has expired. Please log in again.',
  403: 'Access denied. You do not have permission for this action.',
  404: 'Requested resource was not found.',
  409: 'Conflict detected: this record was modified by another user.'
};

/**
 * Normalizes an Angular HttpErrorResponse (or thrown API error) into structured fields
 * and a complete human-readable message containing code, message, and fieldErrors.
 */
export function parseApiError(
  err: unknown,
  fallback = 'An unexpected error occurred. Please try again.'
): ParsedApiError {
  const httpErr = err instanceof HttpErrorResponse ? err : (err as { status?: number; error?: unknown; message?: string } | null);
  const status = typeof httpErr?.status === 'number' ? httpErr.status : undefined;
  let rawBody = httpErr && 'error' in httpErr ? httpErr.error : err;

  if (typeof rawBody === 'string') {
    const trimmed = rawBody.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        rawBody = JSON.parse(trimmed);
      } catch {
        // Keep plain string error body when JSON parsing fails.
      }
    }
  }

  let message = fallback;
  let code: string | undefined;
  let path: string | undefined;
  let fieldErrors: FieldError[] = [];

  if (rawBody && typeof rawBody === 'object' && ('message' in rawBody || 'code' in rawBody || 'fieldErrors' in rawBody)) {
    const apiError = rawBody as Partial<ApiError>;
    code = apiError.code;
    path = apiError.path;
    fieldErrors = Array.isArray(apiError.fieldErrors) ? apiError.fieldErrors : [];

    if (apiError.message) {
      message = apiError.message;
    } else if (apiError.code) {
      message = `Error: ${apiError.code}`;
    }
  } else if (typeof rawBody === 'string' && rawBody.trim().length > 0) {
    message = rawBody.trim();
  } else if (status !== undefined && HTTP_STATUS_FALLBACKS[status]) {
    message = HTTP_STATUS_FALLBACKS[status];
  } else if (httpErr?.message) {
    message = httpErr.message;
  }

  let fullText = message;
  if (fieldErrors.length > 0) {
    const missingFromMessage = fieldErrors.filter(
      f => !message.includes(`${f.field}: ${f.message}`)
    );
    if (missingFromMessage.length > 0) {
      const fieldMsgs = fieldErrors.map(f => `${f.field}: ${f.message}`).join(', ');
      fullText = `${message} (${fieldMsgs})`;
    }
  }

  return {
    status,
    code,
    message,
    path,
    fieldErrors,
    fullText
  };
}

/**
 * Formats an HTTP/API error into a single full-detail display string.
 */
export function formatApiError(
  err: unknown,
  fallback = 'An unexpected error occurred. Please try again.'
): string {
  return parseApiError(err, fallback).fullText;
}

/**
 * Recursively removes prior serverError validation entries from a FormGroup or FormArray.
 */
export function clearServerFieldErrors(control: AbstractControl): void {
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach(child => clearServerFieldErrors(child));
  } else if (control instanceof FormArray) {
    control.controls.forEach(child => clearServerFieldErrors(child));
  }

  if (control.errors && 'serverError' in control.errors) {
    const { serverError: _, ...remaining } = control.errors;
    control.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
  }
}

/**
 * Attaches backend 400 validation fieldErrors to matching Reactive Form controls by field name
 * (per FinLedger Spec Section 3.3) and returns the full parsed error for inline modal display.
 */
export function applyServerFieldErrors(
  form: FormGroup,
  err: unknown,
  fallback = 'Request failed validation.'
): ParsedApiError {
  clearServerFieldErrors(form);
  const parsed = parseApiError(err, fallback);

  for (const fieldErr of parsed.fieldErrors) {
    const targetControl = form.get(fieldErr.field);
    if (targetControl) {
      targetControl.setErrors({
        ...(targetControl.errors ?? {}),
        serverError: fieldErr.message
      });
      targetControl.markAsTouched();
    }
  }

  return parsed;
}

/**
 * Returns the server-side validation message attached to a form control, if present.
 */
export function getServerFieldError(form: FormGroup, controlName: string): string | null {
  const err = form.get(controlName)?.errors?.['serverError'];
  return typeof err === 'string' ? err : null;
}
