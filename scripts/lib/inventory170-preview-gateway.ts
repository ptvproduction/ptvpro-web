import type { IncomingMessage, ServerResponse } from 'node:http';
import h0 from '../../api/_routes/acara';
import h1 from '../../api/_routes/akses';
import h2 from '../../api/_routes/auth/google/callback';
import h3 from '../../api/_routes/auth/google/login';
import h4 from '../../api/_routes/auth/google/status';
import h5 from '../../api/_routes/auth/google/unlink';
import h6 from '../../api/_routes/auth/login';
import h7 from '../../api/_routes/auth/logout';
import h8 from '../../api/_routes/auth/session';
import h9 from '../../api/_routes/broadcast';
import h10 from '../../api/_routes/catatan';
import h11 from '../../api/_routes/dokumen';
import h12 from '../../api/_routes/finance';
import h13 from '../../api/_routes/inventaris';
import h14 from '../../api/_routes/kontak';
import h15 from '../../api/_routes/kru';
import h16 from '../../api/_routes/lapor-kerusakan';
import h17 from '../../api/_routes/lost-found';
import h18 from '../../api/_routes/peminjaman';
import h19 from '../../api/_routes/planner';
import h20 from '../../api/_routes/verifikasi-surat';
const handlers: Record<string, (req: never,res: never) => unknown> = {"acara":h0,"akses":h1,"auth/google/callback":h2,"auth/google/login":h3,"auth/google/status":h4,"auth/google/unlink":h5,"auth/login":h6,"auth/logout":h7,"auth/session":h8,"broadcast":h9,"catatan":h10,"dokumen":h11,"finance":h12,"inventaris":h13,"kontak":h14,"kru":h15,"lapor-kerusakan":h16,"lost-found":h17,"peminjaman":h18,"planner":h19,"verifikasi-surat":h20};
export default async function handler(req: IncomingMessage & {query?:Record<string,unknown>}, res:ServerResponse) {
 if(process.env.VERCEL_ENV !== 'preview' || process.env.VITE_APP_ENV !== 'staging' || process.env.VITE_SUPABASE_URL !== 'https://swadgljnyelsjstqqxbm.supabase.co') {res.statusCode=503;res.end('Staging configuration required');return;}
 const url=new URL(req.url||'/', 'http://localhost');
 const key=req.query?.__ptv_path ?? url.searchParams.get('__ptv_path');
 if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(handlers,key)){res.statusCode=404;res.end('Unknown API route');return;}
 res.setHeader('Cache-Control','no-store');
 return handlers[key](req as never,res as never);
}
