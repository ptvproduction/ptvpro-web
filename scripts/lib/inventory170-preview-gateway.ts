import type { IncomingMessage, ServerResponse } from 'node:http';
import h0 from '../../api/acara';
import h1 from '../../api/akses';
import h2 from '../../api/auth/google/callback';
import h3 from '../../api/auth/google/login';
import h4 from '../../api/auth/google/status';
import h5 from '../../api/auth/google/unlink';
import h6 from '../../api/auth/login';
import h7 from '../../api/auth/logout';
import h8 from '../../api/auth/session';
import h9 from '../../api/broadcast';
import h10 from '../../api/catatan';
import h11 from '../../api/dokumen';
import h12 from '../../api/finance';
import h13 from '../../api/inventaris';
import h14 from '../../api/kontak';
import h15 from '../../api/kru';
import h16 from '../../api/lapor-kerusakan';
import h17 from '../../api/lost-found';
import h18 from '../../api/peminjaman';
import h19 from '../../api/planner';
import h20 from '../../api/verifikasi-surat';
const handlers: Record<string, (req: never,res: never) => unknown> = {"acara":h0,"akses":h1,"auth/google/callback":h2,"auth/google/login":h3,"auth/google/status":h4,"auth/google/unlink":h5,"auth/login":h6,"auth/logout":h7,"auth/session":h8,"broadcast":h9,"catatan":h10,"dokumen":h11,"finance":h12,"inventaris":h13,"kontak":h14,"kru":h15,"lapor-kerusakan":h16,"lost-found":h17,"peminjaman":h18,"planner":h19,"verifikasi-surat":h20};
export default async function handler(req: IncomingMessage & {query?:Record<string,unknown>}, res:ServerResponse) {
 if(process.env.VERCEL_ENV !== 'preview' || process.env.VITE_APP_ENV !== 'staging' || process.env.VITE_SUPABASE_URL !== 'https://swadgljnyelsjstqqxbm.supabase.co') {res.statusCode=503;res.end('Staging configuration required');return;}
 const url=new URL(req.url||'/', 'http://localhost');
 const key=req.query?.__ptv_path ?? url.searchParams.get('__ptv_path');
 if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(handlers,key)){res.statusCode=404;res.end('Unknown API route');return;}
 res.setHeader('Cache-Control','no-store');
 return handlers[key](req as never,res as never);
}
