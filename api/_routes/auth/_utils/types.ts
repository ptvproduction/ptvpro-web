import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  body?: any;
};

export type ApiResponse = ServerResponse & {
  status?: (statusCode: number) => ApiResponse;
  json?: (data: any) => void;
  send?: (data: string | Buffer) => void;
  redirect?: (url: string, status?: number) => void;
};

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface SessionPayload {
  account_id: string;
  identity_id: string;
  ptv_id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  division?: string;
  position?: string;
  status_akun: 'active' | 'inactive';
  status_organisasi: 'active' | 'inactive' | 'archived';
  assigned_profiles: string[];
  capabilities: string[];
  iat: number;
  exp: number;
  session_id?: string;
  /** Server-derived, never trusted from token claims or client state. */
  token_fingerprint?: string;
}
