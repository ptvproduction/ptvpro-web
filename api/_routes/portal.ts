import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import { parseJsonBody } from './auth/_utils/bodyParser';


export const PORTAL_SERVER_TIMEOUT_MS = 8_000;

function getSupabase(signal: AbortSignal) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
      }),
    },
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const controller = new AbortController();
  const isReadRequest = (req.method || 'GET') === 'GET';
  const timer = isReadRequest ? setTimeout(() => controller.abort(), PORTAL_SERVER_TIMEOUT_MS) : undefined;
  const onClose = () => { if (isReadRequest && !res.writableEnded) controller.abort(); };
  res.on?.('close', onClose);
  try {
    await handlePortal(req, res, controller.signal);
  } catch {
    if (!res.writableEnded && !res.destroyed) {
      res.statusCode = controller.signal.aborted ? 504 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: controller.signal.aborted ? 'Permintaan portal melewati batas waktu.' : 'Gagal memproses data portal.',
        code: controller.signal.aborted ? 'portal_timeout' : 'portal_server_error',
      }));
    }
  } finally {
    clearTimeout(timer);
    res.off?.('close', onClose);
  }
}

async function handlePortal(req: IncomingMessage, res: ServerResponse, signal: AbortSignal): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const method = req.method || 'GET';
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost:5174'}`);
  const entity = urlObj.searchParams.get('entity') || 'all';
  const includeDraftParam = urlObj.searchParams.get('includeDraft') === 'true';

  // 1. Session & Auth Check
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  let session: any = null;
  let userCaps: string[] = [];

  const needsSession = method !== 'GET' || includeDraftParam || entity === 'audit_logs';
  if (needsSession && sessionToken && authSecret) {
    const verified = verifySessionToken(sessionToken, authSecret);
    if (verified) {
      session = verified;
      try {
        const active = await verifyAccountStatusLive(session.account_id, session.iat, session);
        if (active) {
          userCaps = await refreshLiveSession(session);
        } else {
          session = null;
        }
      } catch {
        session = null;
      }
    }
  }

  const isAuthenticated = Boolean(session && userCaps.includes('hub.access'));
  const canManagePortal = isAuthenticated && (
    userCaps.includes('portal.manage') ||
    userCaps.includes('system.manage') ||
    userCaps.includes('admin') ||
    userCaps.includes('role:eksekutif') ||
    userCaps.includes('role:administrasi') ||
    userCaps.includes('role:developer') ||
    userCaps.includes('role:pengelola') ||
    userCaps.includes('hub.access') // Kru berwenang operasional Hub
  );

  const supabase = getSupabase(signal);

  // ───────────────────────────────────────────────────────────────────────────
  // GET: Read Portal Data
  // ───────────────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    try {
      const includeDraft = includeDraftParam && canManagePortal;
      const result: Record<string, unknown> = { success: true };

      // 1. SERVICES
      if (entity === 'services' || entity === 'all') {
        let servicesQuery = supabase
          .from('ptv_portal_services')
          .select('*')
          .order('sort_order', { ascending: true });
        if (!includeDraft) {
          servicesQuery = servicesQuery.eq('is_active', true).eq('is_published', true).eq('is_public', true);
        }
        const { data: dbServices, error: sErr } = await servicesQuery;

        if (sErr) throw sErr;

        let services = (dbServices || []).map((row: any) => {
          const base = {
            id: row.id,
            name: { id: row.name_id, en: row.name_en || row.name_id },
            desc: { id: row.desc_id, en: row.desc_en || row.desc_id },
            cat: row.cat,
            href: row.href,
            icon: row.icon,
            st: row.status,
            statusNote: row.status_note || undefined,
            statusUpdatedAt: row.status_updated_at || row.updated_at,
            pub: row.is_public ? 1 : 0,
            isSeasonal: Boolean(row.is_seasonal),
            seasonalStart: row.seasonal_start || undefined,
            seasonalEnd: row.seasonal_end || undefined,
            sortOrder: row.sort_order || 0,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: includeDraft && Boolean(row.draft_payload),
            draftPayload: includeDraft ? row.draft_payload || undefined : undefined,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by,
          };

          if (includeDraft && base.hasDraft && base.draftPayload) {
            return {
              ...base,
              ...base.draftPayload,
              hasDraft: true,
              draftPayload: base.draftPayload,
            };
          }
          return base;
        });

        // Always re-sort services by sortOrder so draft reorders are respected immediately
        services.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        if (!includeDraft) {
          services = services.filter((s: any) => s.isActive && s.isPublished && s.pub === 1);
        }
        result.services = services;

        if (entity === 'services') {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, services }));
          return;
        }
      }

      // 2. ANNOUNCEMENTS
      if (entity === 'announcements' || entity === 'all') {
        let dbAnnouncements: any[] = [];
        try {
          const { data, error: aErr } = await supabase
            .from('ptv_portal_announcements')
            .select('*')
            .order('created_at', { ascending: false });

          if (aErr) {
            // Jika tabel ptv_portal_announcements belum dibuat / PGRST205 / 42P01,
            // tangani dengan anggapan tidak ada pengumuman aktif, jangan gagalkan seluruh portal
            if (
              aErr.code === 'PGRST205' ||
              aErr.code === '42P01' ||
              aErr.message?.includes('schema cache') ||
              aErr.message?.includes('does not exist')
            ) {
              dbAnnouncements = [];
            } else {
              throw aErr;
            }
          } else {
            dbAnnouncements = data || [];
          }
        } catch (err: any) {
          if (
            err.code === 'PGRST205' ||
            err.code === '42P01' ||
            err.message?.includes('schema cache') ||
            err.message?.includes('does not exist')
          ) {
            dbAnnouncements = [];
          } else {
            throw err;
          }
        }

        let announcements = (dbAnnouncements || []).map((row: any) => {
          const base = {
            id: row.id,
            title: { id: row.title_id, en: row.title_en || row.title_id },
            body: { id: row.body_id, en: row.body_en || row.body_id },
            ctaText: { id: row.cta_text_id || 'Lihat Layanan', en: row.cta_text_en || 'View Services' },
            ctaHref: row.cta_href || '#direktori-layanan',
            format: row.format || 'text',
            posterSrc: row.poster_src || undefined,
            type: row.type || 'info',
            priority: row.priority || 1,
            startDate: row.start_date || undefined,
            endDate: row.end_date || undefined,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: includeDraft && Boolean(row.draft_payload),
            draftPayload: includeDraft ? row.draft_payload || undefined : undefined,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by,
          };

          if (includeDraft && base.hasDraft && base.draftPayload) {
            return {
              ...base,
              ...base.draftPayload,
              hasDraft: true,
              draftPayload: base.draftPayload,
            };
          }
          return base;
        });

        if (!includeDraft) {
          const nowStr = new Date().toISOString().split('T')[0];
          announcements = announcements.filter((a: any) => {
            if (!a.isActive || !a.isPublished) return false;
            if (a.startDate && a.startDate > nowStr) return false;
            if (a.endDate && a.endDate < nowStr) return false;
            return true;
          });
        }
        result.announcements = announcements;

        if (entity === 'announcements') {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, announcements }));
          return;
        }
      }

      // 3. SETTINGS
      if (entity === 'settings' || entity === 'all') {
        const { data: dbSettings, error: setErr } = await supabase
          .from('ptv_portal_settings')
          .select('*')
          .eq('id', 'global')
          .maybeSingle();

        if (setErr) throw setErr;
        if (!dbSettings || (!includeDraft && !dbSettings.is_published)) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'Konfigurasi portal published belum tersedia.', code: 'portal_settings_unavailable' }));
          return;
        }

        let settings = {
          id: dbSettings.id,
          heroTitle: {
            line1: dbSettings.hero_title_1,
            line2: dbSettings.hero_title_2,
          },
          heroDesc: dbSettings.hero_desc,
          helpWaNumber: dbSettings.help_wa_number,
          footerSignature: dbSettings.footer_signature,
          footerCopyright: dbSettings.footer_copyright,
          isPublished: Boolean(dbSettings.is_published),
          hasDraft: includeDraft && Boolean(dbSettings.draft_payload),
          draftPayload: includeDraft ? dbSettings.draft_payload || undefined : undefined,
          updatedAt: dbSettings.updated_at,
          updatedBy: dbSettings.updated_by,
        };

        if (includeDraft && settings.hasDraft && settings.draftPayload) {
          settings = {
            ...settings,
            ...settings.draftPayload,
            hasDraft: true,
            draftPayload: settings.draftPayload,
          };
        }
        result.settings = settings;

        if (entity === 'settings') {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, settings }));
          return;
        }
      }

      // 4. AUDIT LOGS
      if (entity === 'audit_logs') {
        if (!canManagePortal) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Izin pengelola portal diperlukan.', code: 'forbidden' }));
          return;
        }

        const { data: dbLogs, error: logErr } = await supabase
          .from('ptv_portal_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (logErr) throw logErr;

        const auditLogs = (dbLogs || []).map((l: any) => ({
          id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          action: l.action,
          entityType: l.entity_type,
          entityId: l.entity_id,
          details: l.details,
          timestamp: l.created_at,
        }));

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, auditLogs }));
        return;
      }

      // Default 'all' response
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (err: any) {
      if (res.destroyed || res.writableEnded) return;
      res.statusCode = signal.aborted ? 504 : 500;
      res.end(JSON.stringify({
        error: signal.aborted ? 'Permintaan portal melewati batas waktu.' : 'Gagal memuat data portal.',
        code: signal.aborted ? 'portal_timeout' : 'portal_fetch_error',
      }));
    }
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST: Mutations (Requires Authentication & Portal Capabilities)
  // ───────────────────────────────────────────────────────────────────────────
  if (method === 'POST') {
    if (!canManagePortal) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Akses ditolak: Izin pengelola portal diperlukan untuk mengubah data.', code: 'forbidden' }));
      return;
    }

    try {
      const body = await parseJsonBody(req);
      const action = body.action || urlObj.searchParams.get('action');
      const actorName = session?.full_name || session?.username || 'Operator Hub';
      const actorId = session?.account_id || 'system';

      const logAudit = async (act: string, entType: string, entId: string, details: string) => {
        try {
          await supabase.from('ptv_portal_audit_logs').insert({
            id: `log-${Date.now()}-${randomUUID().slice(0, 6)}`,
            user_id: actorId,
            user_name: actorName,
            action: act,
            entity_type: entType,
            entity_id: entId,
            details,
            created_at: new Date().toISOString(),
          });
        } catch {
          // ignore audit insert fail
        }
      };

      // 1. SAVE SERVICE
      if (action === 'save_service') {
        const { service, asDraft } = body;
        if (!service || !service.id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Data layanan dan ID wajib diisi.', code: 'missing_service' }));
          return;
        }

        const now = new Date().toISOString();
        let payload: any = {
          updated_at: now,
          updated_by: actorName,
        };

        payload.id = service.id;

        if (asDraft) {
          const { data: existingRow } = await supabase
            .from('ptv_portal_services')
            .select('*')
            .eq('id', service.id)
            .maybeSingle();

          const currentDraft = existingRow?.draft_payload || {};
          payload.draft_payload = {
            ...currentDraft,
            ...service,
          };
        } else {
          payload = {
            id: service.id,
            name_id: service.name?.id || service.name_id || 'Layanan Baru',
            name_en: service.name?.en || service.name_en || null,
            desc_id: service.desc?.id || service.desc_id || 'Deskripsi',
            desc_en: service.desc?.en || service.desc_en || null,
            cat: service.cat || 'public',
            href: service.href || '/hub',
            icon: service.icon || 'globe',
            status: service.st || service.status || 'ok',
            status_note: service.statusNote || service.status_note || null,
            status_updated_at: service.statusUpdatedAt || now,
            is_public: service.pub !== undefined ? service.pub === 1 : (service.is_public ?? true),
            is_seasonal: Boolean(service.isSeasonal ?? service.is_seasonal),
            seasonal_start: service.seasonalStart || service.seasonal_start || null,
            seasonal_end: service.seasonalEnd || service.seasonal_end || null,
            sort_order: service.sortOrder ?? service.sort_order ?? 0,
            is_active: service.isActive ?? service.is_active ?? true,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName,
          };
        }

        const { error: upsertErr } = await supabase
          .from('ptv_portal_services')
          .upsert(payload, { onConflict: 'id' });

        if (upsertErr) throw upsertErr;

        await logAudit(
          asDraft ? 'save_draft' : 'publish',
          'service',
          service.id,
          asDraft ? 'Menyimpan draft perubahan layanan' : 'Memperbarui dan memublikasikan layanan langsung'
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Layanan berhasil disimpan.' }));
        return;
      }

      // 2. PUBLISH SERVICE
      if (action === 'publish_service') {
        const { serviceId } = body;
        if (!serviceId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'serviceId wajib diisi.', code: 'missing_id' }));
          return;
        }

        const { data: existing, error: getErr } = await supabase
          .from('ptv_portal_services')
          .select('*')
          .eq('id', serviceId)
          .single();

        if (getErr || !existing) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Layanan tidak ditemukan.', code: 'not_found' }));
          return;
        }

        const now = new Date().toISOString();
        const draft = existing.draft_payload || {};

        const updateData: any = {
          is_published: true,
          draft_payload: null,
          updated_at: now,
          updated_by: actorName,
        };

        if (draft.name) {
          updateData.name_id = draft.name.id || updateData.name_id;
          updateData.name_en = draft.name.en || updateData.name_en;
        }
        if (draft.desc) {
          updateData.desc_id = draft.desc.id || updateData.desc_id;
          updateData.desc_en = draft.desc.en || updateData.desc_en;
        }
        if (draft.cat) updateData.cat = draft.cat;
        if (draft.href) updateData.href = draft.href;
        if (draft.icon) updateData.icon = draft.icon;
        if (draft.st) updateData.status = draft.st;
        if (draft.statusNote !== undefined) updateData.status_note = draft.statusNote;
        if (draft.pub !== undefined) updateData.is_public = draft.pub === 1;
        if (draft.isSeasonal !== undefined) updateData.is_seasonal = Boolean(draft.isSeasonal);
        if (draft.seasonalStart !== undefined) updateData.seasonal_start = draft.seasonalStart;
        if (draft.seasonalEnd !== undefined) updateData.seasonal_end = draft.seasonalEnd;
        if (draft.sortOrder !== undefined) updateData.sort_order = draft.sortOrder;
        if (draft.isActive !== undefined) updateData.is_active = Boolean(draft.isActive);

        const { error: updErr } = await supabase
          .from('ptv_portal_services')
          .update(updateData)
          .eq('id', serviceId);

        if (updErr) throw updErr;

        await logAudit('publish', 'service', serviceId, 'Memublikasikan draft perubahan layanan');

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Draft layanan berhasil dipublikasikan.' }));
        return;
      }

      // 3. UPDATE SERVICE STATUS
      if (action === 'update_service_status') {
        const { serviceId, status, statusNote, asDraft = true } = body;
        if (!serviceId || !status) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'serviceId dan status wajib diisi.', code: 'missing_params' }));
          return;
        }

        const now = new Date().toISOString();
        if (asDraft) {
          const { data: existing } = await supabase
            .from('ptv_portal_services')
            .select('*')
            .eq('id', serviceId)
            .maybeSingle();

          if (existing) {
            const draft = existing.draft_payload || {
              name: { id: existing.name_id, en: existing.name_en },
              desc: { id: existing.desc_id, en: existing.desc_en },
              cat: existing.cat,
              href: existing.href,
              icon: existing.icon,
              st: existing.status,
              statusNote: existing.status_note,
              pub: existing.is_public ? 1 : 0,
              isActive: existing.is_active,
              sortOrder: existing.sort_order,
            };
            draft.st = status;
            draft.statusNote = statusNote || null;
            draft.statusUpdatedAt = now;

            await supabase
              .from('ptv_portal_services')
              .update({ draft_payload: draft, updated_at: now })
              .eq('id', serviceId);
          }
        } else {
          const { error: stErr } = await supabase
            .from('ptv_portal_services')
            .update({
              status,
              status_note: statusNote || null,
              status_updated_at: now,
              updated_at: now,
              updated_by: actorName,
            })
            .eq('id', serviceId);

          if (stErr) throw stErr;
        }

        await logAudit(
          asDraft ? 'save_draft' : 'status_change',
          'service',
          serviceId,
          asDraft
            ? `Menyimpan draft status "${status}" ${statusNote ? `(${statusNote})` : ''}`
            : `Mengubah status menjadi "${status}" ${statusNote ? `(${statusNote})` : ''}`
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: asDraft ? 'Draft status layanan berhasil disimpan.' : 'Status operasional layanan berhasil diperbarui.' }));
        return;
      }

      // 4. REORDER SERVICES
      if (action === 'reorder_services') {
        const { orderList, asDraft = true } = body;
        if (!Array.isArray(orderList)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'orderList array wajib diisi.', code: 'missing_order_list' }));
          return;
        }

        const now = new Date().toISOString();
        for (const item of orderList) {
          if (item.id && typeof item.sortOrder === 'number') {
            if (asDraft) {
              const { data: existing } = await supabase
                .from('ptv_portal_services')
                .select('*')
                .eq('id', item.id)
                .maybeSingle();

              if (existing) {
                const isDifferentOrder = item.sortOrder !== existing.sort_order;
                const hasExistingDraft = Boolean(existing.draft_payload);

                if (!isDifferentOrder && !hasExistingDraft) {
                  continue;
                }

                const draft = existing.draft_payload || {
                  name: { id: existing.name_id, en: existing.name_en },
                  desc: { id: existing.desc_id, en: existing.desc_en },
                  cat: existing.cat,
                  href: existing.href,
                  icon: existing.icon,
                  st: existing.status,
                  statusNote: existing.status_note,
                  pub: existing.is_public ? 1 : 0,
                  isActive: existing.is_active,
                };
                draft.sortOrder = item.sortOrder;

                const hasOtherChanges =
                  (draft.name?.id !== undefined && draft.name.id !== existing.name_id) ||
                  (draft.desc?.id !== undefined && draft.desc.id !== existing.desc_id) ||
                  (draft.cat !== undefined && draft.cat !== existing.cat) ||
                  (draft.href !== undefined && draft.href !== existing.href) ||
                  (draft.icon !== undefined && draft.icon !== existing.icon) ||
                  (draft.st !== undefined && draft.st !== existing.status) ||
                  (draft.pub !== undefined && (draft.pub === 1) !== Boolean(existing.is_public)) ||
                  (draft.isActive !== undefined && Boolean(draft.isActive) !== Boolean(existing.is_active));

                if (!isDifferentOrder && !hasOtherChanges) {
                  await supabase
                    .from('ptv_portal_services')
                    .update({ draft_payload: null, updated_at: now })
                    .eq('id', item.id);
                } else {
                  await supabase
                    .from('ptv_portal_services')
                    .update({ draft_payload: draft, updated_at: now })
                    .eq('id', item.id);
                }
              }
            } else {
              await supabase
                .from('ptv_portal_services')
                .update({ sort_order: item.sortOrder, updated_at: now })
                .eq('id', item.id);
            }
          }
        }

        await logAudit(
          asDraft ? 'save_draft' : 'reorder',
          'service',
          'all',
          asDraft ? 'Menyimpan draft urutan layanan' : 'Mengubah urutan direktori layanan'
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: asDraft ? 'Draft urutan layanan berhasil disimpan.' : 'Urutan layanan berhasil disimpan.' }));
        return;
      }

      // 5. DELETE SERVICE
      if (action === 'delete_service') {
        const { serviceId } = body;
        if (!serviceId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'serviceId wajib diisi.', code: 'missing_id' }));
          return;
        }

        const { error: delErr } = await supabase
          .from('ptv_portal_services')
          .delete()
          .eq('id', serviceId);

        if (delErr) throw delErr;

        await logAudit('delete', 'service', serviceId, `Menghapus layanan ${serviceId}`);

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Layanan berhasil dihapus.' }));
        return;
      }

      // 6. SAVE ANNOUNCEMENT (Pengumuman Portal)
      if (action === 'save_announcement') {
        const { announcement, asDraft } = body;
        if (!announcement) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Data pengumuman wajib diisi.', code: 'missing_announcement' }));
          return;
        }

        const id = announcement.id || `ann-${Date.now()}`;
        const now = new Date().toISOString();

        let payload: any = {
          id,
          updated_at: now,
          updated_by: actorName,
        };

        if (asDraft) {
          payload.draft_payload = announcement;
          payload.title_id = announcement.title?.id || 'Draft Pengumuman';
          payload.body_id = announcement.body?.id || '';
          payload.is_published = false;
        } else {
          // If publishing active announcement directly, supersede all other active published announcements
          if ((announcement.isActive ?? true)) {
            await supabase
              .from('ptv_portal_announcements')
              .update({ is_active: false, updated_at: now })
              .neq('id', id)
              .eq('is_active', true)
              .eq('is_published', true);
          }

          payload = {
            id,
            title_id: announcement.title?.id || 'Pengumuman Portal',
            title_en: announcement.title?.en || null,
            body_id: announcement.body?.id || '',
            body_en: announcement.body?.en || null,
            cta_text_id: announcement.ctaText?.id || 'Lihat Layanan',
            cta_text_en: announcement.ctaText?.en || 'View Services',
            cta_href: announcement.ctaHref || '#direktori-layanan',
            format: announcement.format || 'text',
            poster_src: announcement.posterSrc || null,
            type: announcement.type || 'info',
            priority: announcement.priority || 1,
            start_date: announcement.startDate || now.slice(0, 10),
            end_date: announcement.endDate || null,
            is_active: announcement.isActive ?? true,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName,
          };
        }

        const { error: aErr } = await supabase
          .from('ptv_portal_announcements')
          .upsert(payload, { onConflict: 'id' });

        if (aErr) throw aErr;

        await logAudit(
          asDraft ? 'save_draft' : 'publish',
          'announcement',
          id,
          asDraft ? 'Menyimpan draft pengumuman portal' : 'Menerbitkan pengumuman portal'
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Pengumuman portal berhasil disimpan.', id }));
        return;
      }

      // 7. PUBLISH ANNOUNCEMENT (Pengumuman Portal)
      if (action === 'publish_announcement') {
        const { id } = body;
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'id pengumuman wajib diisi.', code: 'missing_id' }));
          return;
        }

        const { data: existing, error: getErr } = await supabase
          .from('ptv_portal_announcements')
          .select('*')
          .eq('id', id)
          .single();

        if (getErr || !existing) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Pengumuman tidak ditemukan.', code: 'not_found' }));
          return;
        }

        const now = new Date().toISOString();
        const draft = existing.draft_payload || {};

        // Deactivate any other active published portal announcements to enforce single active rule
        await supabase
          .from('ptv_portal_announcements')
          .update({ is_active: false, updated_at: now })
          .neq('id', id)
          .eq('is_active', true)
          .eq('is_published', true);

        const updateData: any = {
          is_active: true,
          is_published: true,
          draft_payload: null,
          updated_at: now,
          updated_by: actorName,
        };

        if (draft.title) {
          updateData.title_id = draft.title.id || updateData.title_id;
          updateData.title_en = draft.title.en || updateData.title_en;
        }
        if (draft.body) {
          updateData.body_id = draft.body.id || updateData.body_id;
          updateData.body_en = draft.body.en || updateData.body_en;
        }
        if (draft.ctaText) {
          updateData.cta_text_id = draft.ctaText.id;
          updateData.cta_text_en = draft.ctaText.en;
        }
        if (draft.ctaHref) updateData.cta_href = draft.ctaHref;
        if (draft.format) updateData.format = draft.format;
        if (draft.posterSrc !== undefined) updateData.poster_src = draft.posterSrc;
        if (draft.type) updateData.type = draft.type;
        if (draft.startDate) updateData.start_date = draft.startDate;
        if (draft.endDate !== undefined) updateData.end_date = draft.endDate;

        const { error: updErr } = await supabase
          .from('ptv_portal_announcements')
          .update(updateData)
          .eq('id', id);

        if (updErr) throw updErr;

        await logAudit('publish', 'announcement', id, 'Memublikasikan pengumuman portal (maksimal 1 aktif)');

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Pengumuman portal berhasil dipublikasikan.' }));
        return;
      }

      // 8. DELETE ANNOUNCEMENT
      if (action === 'delete_announcement') {
        const { id } = body;
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'id pengumuman wajib diisi.', code: 'missing_id' }));
          return;
        }

        const { error: delErr } = await supabase
          .from('ptv_portal_announcements')
          .delete()
          .eq('id', id);

        if (delErr) throw delErr;

        await logAudit('delete', 'announcement', id, `Menghapus pengumuman portal ${id}`);

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Pengumuman berhasil dihapus.' }));
        return;
      }

      // 9. SAVE SETTINGS
      if (action === 'save_settings') {
        const { settings, asDraft } = body;
        if (!settings) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'settings wajib diisi.', code: 'missing_settings' }));
          return;
        }

        const now = new Date().toISOString();
        let payload: any = {
          id: 'global',
          updated_at: now,
          updated_by: actorName,
        };

        if (asDraft) {
          const { data: existingSet } = await supabase
            .from('ptv_portal_settings')
            .select('*')
            .eq('id', 'global')
            .maybeSingle();

          const currentDraft = existingSet?.draft_payload || {};
          payload.draft_payload = {
            ...currentDraft,
            ...settings,
          };
        } else {
          payload = {
            id: 'global',
            hero_title_1: settings.heroTitle?.line1 || 'Semua layanan.',
            hero_title_2: settings.heroTitle?.line2 || 'Satu tempat.',
            hero_desc: settings.heroDesc || 'Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV.',
            help_wa_number: settings.helpWaNumber || '62895325884964',
            footer_signature: settings.footerSignature || 'Dibangun oleh santri. Didedikasikan untuk sesama.',
            footer_copyright: settings.footerCopyright || '© 2026 Progresif TV Production.',
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName,
          };
        }

        const { error: setErr } = await supabase
          .from('ptv_portal_settings')
          .upsert(payload, { onConflict: 'id' });

        if (setErr) throw setErr;

        await logAudit(
          asDraft ? 'save_draft' : 'publish',
          'settings',
          'global',
          asDraft ? 'Menyimpan draft pengaturan portal' : 'Memperbarui pengaturan portal langsung'
        );

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Pengaturan portal berhasil disimpan.' }));
        return;
      }

      // 10. PUBLISH ALL DRAFTS
      if (action === 'publish_all_drafts') {
        const now = new Date().toISOString();
        let count = 0;

        // Publish all service drafts
        const { data: svcDrafts } = await supabase
          .from('ptv_portal_services')
          .select('*')
          .not('draft_payload', 'is', null);

        if (Array.isArray(svcDrafts)) {
          for (const s of svcDrafts) {
            const draft = s.draft_payload || {};
            const updateData: any = {
              is_published: true,
              draft_payload: null,
              updated_at: now,
              updated_by: actorName,
            };
            if (draft.name) {
              updateData.name_id = draft.name.id || updateData.name_id;
              updateData.name_en = draft.name.en || updateData.name_en;
            }
            if (draft.desc) {
              updateData.desc_id = draft.desc.id || updateData.desc_id;
              updateData.desc_en = draft.desc.en || updateData.desc_en;
            }
            if (draft.cat) updateData.cat = draft.cat;
            if (draft.href) updateData.href = draft.href;
            if (draft.icon) updateData.icon = draft.icon;
            if (draft.st) updateData.status = draft.st;
            if (draft.statusNote !== undefined) updateData.status_note = draft.statusNote;
            if (draft.pub !== undefined) updateData.is_public = draft.pub === 1;
            if (draft.sortOrder !== undefined) updateData.sort_order = draft.sortOrder;

            await supabase.from('ptv_portal_services').update(updateData).eq('id', s.id);
            count++;
          }
        }

        // Publish settings draft if present
        const { data: setRow } = await supabase
          .from('ptv_portal_settings')
          .select('*')
          .eq('id', 'global')
          .maybeSingle();

        if (setRow && setRow.draft_payload) {
          const draft = setRow.draft_payload;
          await supabase.from('ptv_portal_settings').update({
            hero_title_1: draft.heroTitle?.line1 || setRow.hero_title_1,
            hero_title_2: draft.heroTitle?.line2 || setRow.hero_title_2,
            hero_desc: draft.heroDesc || setRow.hero_desc,
            help_wa_number: draft.helpWaNumber || setRow.help_wa_number,
            footer_signature: draft.footerSignature || setRow.footer_signature,
            footer_copyright: draft.footerCopyright || setRow.footer_copyright,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName,
          }).eq('id', 'global');
          count++;
        }

        await logAudit('publish', 'settings', 'all', `Memublikasikan seluruh draft (${count} item)`);

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, publishedCount: count, message: `${count} draft berhasil dipublikasikan.` }));
        return;
      }

      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Aksi "${action}" tidak dikenali.`, code: 'unknown_action' }));
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Gagal memproses aksi portal.', code: 'portal_mutation_error' }));
    }
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${method} tidak didukung.`, code: 'method_not_allowed' }));
}
