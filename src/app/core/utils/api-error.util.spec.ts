import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import {
  applyServerFieldErrors,
  clearServerFieldErrors,
  formatApiError,
  getServerFieldError,
  parseApiError
} from './api-error.util';

describe('api-error.util', () => {
  const fb = new FormBuilder();

  it('should parse backend ApiError without duplicating fieldErrors already present in message', () => {
    const err = new HttpErrorResponse({
      status: 400,
      url: '/api/v1/customers',
      error: {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request has invalid fields: code: Code cannot exceed 20 characters',
        path: '/api/v1/customers',
        fieldErrors: [{ field: 'code', message: 'Code cannot exceed 20 characters' }]
      }
    });

    const parsed = parseApiError(err);

    expect(parsed.status).toBe(400);
    expect(parsed.code).toBe('VALIDATION_FAILED');
    expect(parsed.fieldErrors.length).toBe(1);
    expect(parsed.fullText).toBe('Request has invalid fields: code: Code cannot exceed 20 characters');
  });

  it('should parse serialized JSON string error payloads cleanly', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: JSON.stringify({
        code: 'BAD_REQUEST',
        message: 'Customer code already exists'
      })
    });

    expect(formatApiError(err)).toBe('Customer code already exists');
  });

  it('should attach 400 validation fieldErrors onto matching FormGroup controls and clear on reset', () => {
    const form = fb.group({
      code: ['LONG-CODE-VALUE-OVER-20'],
      name: ['Acme LLC'],
      arAccountId: [null]
    });

    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request has invalid fields',
        fieldErrors: [
          { field: 'code', message: 'Code cannot exceed 20 characters' },
          { field: 'arAccountId', message: 'AR account ID is required' }
        ]
      }
    });

    const parsed = applyServerFieldErrors(form, err);

    expect(parsed.fullText).toBe(
      'Request has invalid fields (code: Code cannot exceed 20 characters, arAccountId: AR account ID is required)'
    );
    expect(getServerFieldError(form, 'code')).toBe('Code cannot exceed 20 characters');
    expect(getServerFieldError(form, 'arAccountId')).toBe('AR account ID is required');
    expect(getServerFieldError(form, 'name')).toBeNull();
    expect(form.get('code')?.touched).toBe(true);

    clearServerFieldErrors(form);
    expect(getServerFieldError(form, 'code')).toBeNull();
    expect(getServerFieldError(form, 'arAccountId')).toBeNull();
  });
});

