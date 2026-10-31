import type { IncomingMessage } from 'node:http';

export class BodyParserError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = 'invalid_json') {
    super(message);
    this.name = 'BodyParserError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ParseOptions {
  /** Maksimum ukuran payload dalam bytes. Default: 2MB (2 * 1024 * 1024) */
  maxBytes?: number;
  /** Timeout pembacaan stream dalam milidetik. Default: 5000ms */
  timeoutMs?: number;
}

export interface ParseJsonOptions extends ParseOptions {
  /** Jika true, menolak payload yang bukan objek (misal array atau primitive). Default: false */
  strictObject?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${Number.isInteger(kb) ? kb : kb.toFixed(1)}KB`;
  }
  return `${bytes} bytes`;
}

/**
 * Membaca buffer biner mentah dari IncomingMessage dengan batas ukuran dan timeout terkontrol.
 */
export async function readRawBody(
  req: IncomingMessage | (IncomingMessage & { body?: unknown }),
  options?: ParseOptions
): Promise<Buffer> {
  const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = options?.timeoutMs ?? 5000;

  // Shortcut untuk metode tanpa body
  const method = (req as any).method ? String((req as any).method).toUpperCase() : '';
  if (method === 'GET' || method === 'HEAD') {
    return Buffer.alloc(0);
  }

  // Shortcut jika Content-Length eksplisit 0
  const rawCl = (req as any).headers?.['content-length'];
  if (rawCl === '0') {
    return Buffer.alloc(0);
  }

  // Cek existing parsed/buffered body
  const existingBody = (req as any).body;
  if (existingBody !== undefined && existingBody !== null) {
    if (Buffer.isBuffer(existingBody)) {
      if (existingBody.length > maxBytes) {
        throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
      }
      return existingBody;
    }
    if (typeof existingBody === 'string') {
      const buf = Buffer.from(existingBody, 'utf8');
      if (buf.length > maxBytes) {
        throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
      }
      return buf;
    }
    // Jika sudah berupa object ter-parse
    const buf = Buffer.from(JSON.stringify(existingBody), 'utf8');
    if (buf.length > maxBytes) {
      throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
    }
    return buf;
  }

  // Upfront content-length check
  const contentLength = Number(rawCl);
  if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
    throw new BodyParserError(
      `Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`,
      413,
      'payload_too_large'
    );
  }

  // Cek apakah stream sudah berakhir atau tidak dapat dibaca
  if (typeof req.on !== 'function' || (req as any).readableEnded || (req as any).complete) {
    return Buffer.alloc(0);
  }

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAbort);
    };

    const settleResolve = (value: Buffer) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    timer = setTimeout(() => {
      if ((req as any).readableEnded || (req as any).complete) {
        settleResolve(Buffer.concat(chunks));
      } else {
        settleReject(new BodyParserError('Request timeout: pembacaan body stream melebihi batas waktu.', 408, 'request_timeout'));
      }
    }, timeoutMs);

    const onData = (chunk: any) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buf.length;
      if (receivedBytes > maxBytes) {
        settleReject(new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large'));
        return;
      }
      chunks.push(buf);
    };

    const onEnd = () => {
      settleResolve(Buffer.concat(chunks));
    };

    const onError = (err: any) => {
      settleReject(new BodyParserError(err?.message || 'Gagal membaca data request.', 400, 'stream_error'));
    };

    const onAbort = () => {
      settleReject(new BodyParserError('Koneksi request diputus oleh client.', 400, 'request_aborted'));
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAbort);
  });
}

/**
 * Centralized, bulletproof HTTP request JSON body parser for PTVPRO Serverless API.
 * 
 * Menangani secara teruji:
 * 1. Body yang sudah diparsing oleh runtime middleware (Vercel/Connect/Express).
 * 2. Body berupa Buffer atau String yang belum di-parse.
 * 3. Stream yang sudah berakhir (readableEnded / complete) tanpa re-read stream yang hang.
 * 4. Request tanpa body (GET/HEAD/DELETE tanpa content) menghasilkan objek kosong {}.
 * 5. Format JSON tidak valid menghasilkan BodyParserError(400, 'invalid_json').
 * 6. Payload melebihi batas ukuran (upfront Content-Length & rolling chunks) menghasilkan BodyParserError(413, 'payload_too_large').
 * 7. Stream error & abort dibersihkan secara aman tanpa unhandled rejections.
 * 8. Fallback timeout terkontrol untuk menjamin Promise selesai tepat 1 kali.
 */
export async function parseJsonBody<T = any>(
  req: IncomingMessage | (IncomingMessage & { body?: unknown }),
  options?: ParseJsonOptions
): Promise<T> {
  const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024; // 2MB default

  // Shortcut untuk metode tanpa body
  const method = (req as any).method ? String((req as any).method).toUpperCase() : '';
  if (method === 'GET' || method === 'HEAD') {
    return {} as T;
  }

  // Shortcut jika Content-Length eksplisit 0
  const rawCl = (req as any).headers?.['content-length'];
  if (rawCl === '0') {
    return {} as T;
  }

  // 1. Tangani body yang sudah di-parse oleh runtime serverless middleware
  const existingBody = (req as any).body;
  if (existingBody !== undefined && existingBody !== null) {
    if (typeof existingBody === 'object' && !Buffer.isBuffer(existingBody)) {
      if (options?.strictObject && (Array.isArray(existingBody) || existingBody === null)) {
        throw new BodyParserError('Payload harus berupa objek JSON.', 400, 'invalid_json');
      }
      const serialized = JSON.stringify(existingBody);
      if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
        throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
      }
      return existingBody as T;
    }

    if (typeof existingBody === 'string') {
      const trimmed = existingBody.trim();
      if (!trimmed) {
        return {} as T;
      }
      if (Buffer.byteLength(existingBody, 'utf8') > maxBytes) {
        throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
      }
      try {
        const parsed = JSON.parse(existingBody);
        if (options?.strictObject && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
          throw new BodyParserError('Payload harus berupa objek JSON.', 400, 'invalid_json');
        }
        return parsed as T;
      } catch (err: any) {
        if (err instanceof BodyParserError) throw err;
        throw new BodyParserError('Format data JSON tidak valid.', 400, 'invalid_json');
      }
    }

    if (Buffer.isBuffer(existingBody)) {
      if (existingBody.length > maxBytes) {
        throw new BodyParserError(`Ukuran payload melebihi batas ${formatBytes(maxBytes)}.`, 413, 'payload_too_large');
      }
      const str = existingBody.toString('utf8').trim();
      if (!str) {
        return {} as T;
      }
      try {
        const parsed = JSON.parse(str);
        if (options?.strictObject && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
          throw new BodyParserError('Payload harus berupa objek JSON.', 400, 'invalid_json');
        }
        return parsed as T;
      } catch (err: any) {
        if (err instanceof BodyParserError) throw err;
        throw new BodyParserError('Format data JSON tidak valid.', 400, 'invalid_json');
      }
    }
  }

  // 2. Baca dari stream secara terkontrol
  const buf = await readRawBody(req, options);
  const text = buf.toString('utf8').trim();
  if (!text) {
    return {} as T;
  }

  try {
    const parsed = JSON.parse(text);
    if (options?.strictObject && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
      throw new BodyParserError('Payload harus berupa objek JSON.', 400, 'invalid_json');
    }
    return parsed as T;
  } catch (err: any) {
    if (err instanceof BodyParserError) throw err;
    throw new BodyParserError('Format data JSON tidak valid.', 400, 'invalid_json');
  }
}

// Alias untuk kompatibilitas drop-in
export const parseBody = parseJsonBody;
