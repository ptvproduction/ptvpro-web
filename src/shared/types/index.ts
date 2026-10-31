/**
 * Shared Common Types
 */

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}
