import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { parseJsonBody, parseBody, readRawBody, BodyParserError } from '../../api/_routes/auth/_utils/bodyParser';

function createMockRequest(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  readableEnded?: boolean;
  complete?: boolean;
  chunks?: string[];
  emitError?: Error;
  emitAbort?: boolean;
  delayMs?: number;
}) {
  const req = new EventEmitter() as any;
  req.method = options.method || 'POST';
  req.headers = options.headers || {};
  req.body = options.body;
  req.readableEnded = options.readableEnded ?? false;
  req.complete = options.complete ?? false;
  req.resume = vi.fn();

  // If chunks or events are scheduled, simulate them
  if (options.chunks || options.emitError || options.emitAbort) {
    setTimeout(() => {
      if (options.chunks) {
        options.chunks.forEach((chunk) => req.emit('data', Buffer.from(chunk)));
      }
      if (options.emitError) {
        req.emit('error', options.emitError);
      } else if (options.emitAbort) {
        req.emit('aborted');
      } else {
        req.emit('end');
      }
    }, options.delayMs || 10);
  }

  return req;
}

describe('Centralized Request Body Parser (bodyParser.ts)', () => {
  it('mengembalikan pre-parsed object body tanpa membaca stream', async () => {
    const mock = createMockRequest({ body: { title: 'Acara PTV', active: true } });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({ title: 'Acara PTV', active: true });
    expect(mock.listenerCount('data')).toBe(0);
  });

  it('mem-parsing pre-parsed Buffer body dengan aman', async () => {
    const mock = createMockRequest({ body: Buffer.from(JSON.stringify({ note: 'Notulensi' })) });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({ note: 'Notulensi' });
  });

  it('mem-parsing pre-parsed string body dengan aman', async () => {
    const mock = createMockRequest({ body: JSON.stringify({ amount: 50000 }) });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({ amount: 50000 });
  });

  it('mengembalikan objek kosong {} untuk pre-parsed string/Buffer kosong', async () => {
    const mock1 = createMockRequest({ body: '' });
    expect(await parseJsonBody(mock1)).toEqual({});

    const mock2 = createMockRequest({ body: Buffer.from('   ') });
    expect(await parseJsonBody(mock2)).toEqual({});
  });

  it('mengembalikan objek kosong {} seketika untuk metode GET dan HEAD', async () => {
    const mockGet = createMockRequest({ method: 'GET' });
    expect(await parseJsonBody(mockGet)).toEqual({});

    const mockHead = createMockRequest({ method: 'HEAD' });
    expect(await parseJsonBody(mockHead)).toEqual({});
  });

  it('mengembalikan objek kosong {} jika stream sudah berakhir (readableEnded)', async () => {
    const mock = createMockRequest({ readableEnded: true });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({});
  });

  it('mengembalikan objek kosong {} jika content-length = 0', async () => {
    const mock = createMockRequest({ headers: { 'content-length': '0' } });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({});
  });

  it('berhasil membaca dan mem-parsing chunked JSON stream normal', async () => {
    const mock = createMockRequest({
      chunks: ['{"name":"Zaidan",', '"role":"Ketua"}'],
    });
    const result = await parseJsonBody(mock);
    expect(result).toEqual({ name: 'Zaidan', role: 'Ketua' });
  });

  it('menolak format JSON yang tidak valid dengan status 400', async () => {
    const mock1 = createMockRequest({ chunks: ['{invalid json}'] });
    await expect(parseJsonBody(mock1)).rejects.toThrow('Format data JSON tidak valid.');

    const mock2 = createMockRequest({ chunks: ['{bad: true'] });
    try {
      await parseJsonBody(mock2);
    } catch (err: any) {
      expect(err).toBeInstanceOf(BodyParserError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('invalid_json');
    }
  });

  it('menolak jika payload Content-Length melebihi batas maxBytes (upfront 413)', async () => {
    const mock = createMockRequest({
      headers: { 'content-length': '1000000' },
    });
    await expect(parseJsonBody(mock, { maxBytes: 65536 })).rejects.toThrow(
      'Ukuran payload melebihi batas 64KB.'
    );
  });

  it('menolak jika akumulasi chunk stream melebihi batas maxBytes (rolling 413)', async () => {
    const bigChunk = 'A'.repeat(5000);
    const mock = createMockRequest({ chunks: [bigChunk, bigChunk] });
    await expect(parseJsonBody(mock, { maxBytes: 4096 })).rejects.toThrow(
      'Ukuran payload melebihi batas 4KB.'
    );
  });

  it('menolak secara aman jika stream mengalami error', async () => {
    const mock = createMockRequest({ emitError: new Error('Socket reset by peer') });
    await expect(parseJsonBody(mock)).rejects.toThrow('Socket reset by peer');
  });

  it('menolak secara aman jika stream diaborsi client', async () => {
    const mock = createMockRequest({ emitAbort: true });
    await expect(parseJsonBody(mock)).rejects.toThrow('Koneksi request diputus oleh client.');
  });

  it('menolak dengan timeout jika stream menggantung tanpa respons', async () => {
    // Request menggantung (tidak emit chunk, tidak emit end, readableEnded false)
    const mock = new EventEmitter() as any;
    mock.method = 'POST';
    mock.headers = {};
    mock.readableEnded = false;
    mock.resume = vi.fn();

    // Jalur timeout dengan timeoutMs sangat pendek (50ms)
    await expect(parseJsonBody(mock, { timeoutMs: 50 })).rejects.toThrow(
      'Request timeout: pembacaan body stream melebihi batas waktu.'
    );
  });

  it('memverifikasi alias parseBody berfungsi identik', async () => {
    const mock = createMockRequest({ body: { success: true } });
    expect(await parseBody(mock)).toEqual({ success: true });
  });

  it('mendukung opsi strictObject untuk menolak JSON array jika diminta', async () => {
    const mock = createMockRequest({ body: ['item1', 'item2'] });
    await expect(parseJsonBody(mock, { strictObject: true })).rejects.toThrow(
      'Payload harus berupa objek JSON.'
    );
  });

  it('readRawBody membaca stream Buffer biner dengan aman', async () => {
    const mock = createMockRequest({ chunks: ['halo ', 'dunia'] });
    const buf = await readRawBody(mock);
    expect(buf.toString('utf8')).toBe('halo dunia');
  });
});
