export interface FieldError {
  field: string;
  message: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  path: string;
  fieldErrors?: FieldError[];
}

