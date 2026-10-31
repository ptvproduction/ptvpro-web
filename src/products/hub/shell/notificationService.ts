/**
 * PTV PRO — Smart Notification Service
 * Layanan notifikasi terarah (recipient-aware), bebas spam global,
 * isolasi inbox per-akun pengguna, serta proteksi idempotency.
 */

import { AuthUser } from '@core/auth';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';

export interface NotificationItem {
  id: string;
  idempotency_key?: string;
  recipient_ptv_id?: string;
  recipient_role?: string;
  title: string;
  message: string;
  type: 'event' | 'loan' | 'document' | 'damage' | 'system';
  icon?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  is_read: boolean;
  is_protected: boolean;
  created_at: string;
  when?: string;
}

type NotificationListener = (unreadCount: number) => void;

class NotificationService {
  private static instance: NotificationService;
  private listeners: Set<NotificationListener> = new Set();
  private seenIdempotencyKeys: Set<string> = new Set();

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Mendapatkan key storage lokal yang terisolasi per user akun
   */
  getStorageKey(user: AuthUser | null | undefined): string {
    if (!user) return 'ptv_notifications_cache_guest';
    const identifier = user.ptv_id || user.id || user.username || 'anon';
    return `ptv_notifications_cache_${identifier}`;
  }

  /**
   * Subscribe ke perubahan jumlah unread
   */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(count: number) {
    this.listeners.forEach((listener) => {
      try {
        listener(count);
      } catch (err) {
        console.error('[NotificationService] Listener error:', err);
      }
    });
  }

  /**
   * Mengambil daftar notifikasi untuk user aktif secara kanonikal
   */
  async getNotifications(user: AuthUser | null | undefined): Promise<NotificationItem[]> {
    let list: NotificationItem[] = [];

    // 1. Fetch from Supabase Staging if configured (Authoritative Cloud Source)
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_notifications')
          .select('id, tipe, judul, pesan, target_role, is_read, created_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data) && data.length > 0) {
          list = data.map((d: any) => ({
            id: String(d.id),
            title: d.judul || 'Pemberitahuan Sistem',
            message: d.pesan || '',
            type: (d.tipe as any) || 'system',
            icon: d.tipe === 'approval' ? 'fa-solid fa-file-signature' : d.tipe === 'loan' ? 'fa-solid fa-boxes-stacked' : 'fa-solid fa-bell',
            recipient_role: d.target_role || undefined,
            is_read: Boolean(d.is_read),
            is_protected: false,
            created_at: d.created_at || new Date().toISOString(),
            when: new Date(d.created_at || Date.now()).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }));
        }
      } catch (err) {
        console.warn('[NotificationService] Supabase fetch fallback to local cache:', err);
      }
    }

    // 2. Load and merge user-scoped local notifications cache (offline fallback)
    const storageKey = this.getStorageKey(user);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const localItems = JSON.parse(raw);
        if (Array.isArray(localItems)) {
          const existingIds = new Set(list.map((n) => n.id));
          localItems.forEach((item) => {
            if (!existingIds.has(item.id)) {
              list.push(item);
              existingIds.add(item.id);
            }
          });
        }
      }
    } catch {
      // ignore
    }

    // Filter notifications strictly relevant to current user:
    // - Specific recipient PTV-ID matches user.ptv_id
    // - Target role matches user's role or 'all'
    // - General system notifications without specific recipient
    const userRole = (user as any)?.role || (user as any)?.assigned_profiles?.[0];
    const filtered = list.filter((n) => {
      if (n.recipient_ptv_id && n.recipient_ptv_id !== 'all') {
        return Boolean(user?.ptv_id && n.recipient_ptv_id.toUpperCase() === user.ptv_id.toUpperCase());
      }
      if (n.recipient_role && n.recipient_role !== 'all') {
        return Boolean(userRole && n.recipient_role.toLowerCase() === String(userRole).toLowerCase());
      }
      return true;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const unread = filtered.filter((n) => !n.is_read).length;
    this.notifyListeners(unread);

    return filtered;
  }

  /**
   * Simpan perubahan notifikasi ke storage user saat ini
   */
  saveNotifications(user: AuthUser | null | undefined, items: NotificationItem[]): void {
    const storageKey = this.getStorageKey(user);
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore
    }
    const unread = items.filter((n) => !n.is_read).length;
    this.notifyListeners(unread);
  }

  /**
   * Publikasi event notifikasi baru secara terarah, backend-persisted, dan idempotent
   */
  async dispatchEventNotification(
    recipientUser: { ptv_id?: string; role?: string } | null,
    notif: Omit<NotificationItem, 'id' | 'is_read' | 'is_protected' | 'created_at'>
  ): Promise<boolean> {
    // 1. In-memory & Local Idempotency check:
    if (notif.idempotency_key) {
      if (this.seenIdempotencyKeys.has(notif.idempotency_key)) {
        return false;
      }
      this.seenIdempotencyKeys.add(notif.idempotency_key);
    }

    const storageKey = recipientUser?.ptv_id
      ? `ptv_notifications_cache_${recipientUser.ptv_id}`
      : 'ptv_notifications_cache_guest';

    let currentItems: NotificationItem[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) currentItems = JSON.parse(raw);
      if (!Array.isArray(currentItems)) currentItems = [];
    } catch {
      currentItems = [];
    }

    if (notif.idempotency_key && currentItems.some((n) => n.idempotency_key === notif.idempotency_key)) {
      return false;
    }

    const newItem: NotificationItem = {
      ...notif,
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipient_ptv_id: recipientUser?.ptv_id,
      recipient_role: recipientUser?.role,
      is_read: false,
      is_protected: false,
      created_at: new Date().toISOString(),
      when: 'Baru saja',
    };

    // 2. Persist to Supabase Cloud Staging if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        // Dispatch melalui stored procedure terpercaya (Rev 3 canonical producer)
        const { error: rpcErr } = await supabase.rpc('dispatch_smart_notification', {
          p_tipe: notif.type === 'document' ? 'approval' : notif.type === 'loan' ? 'loan' : notif.type,
          p_judul: notif.title,
          p_pesan: notif.message,
          p_recipient_ptv_id: recipientUser?.ptv_id || null,
          p_target_role: recipientUser?.role || 'all',
          p_idempotency_key: notif.idempotency_key || null,
          p_is_protected: Boolean((notif as any).is_protected),
        });

        if (rpcErr) {
          // Direct table INSERT dilarang demi keamanan RLS / anti-spoofing
          console.warn(
            '[NotificationService] RPC dispatch_smart_notification failed or pending database migration ACC:',
            rpcErr.message
          );
          return false;
        }
      } catch (cloudErr) {
        console.warn('[NotificationService] Cloud dispatch error:', cloudErr);
        return false;
      }
    }

    currentItems.unshift(newItem);
    try {
      localStorage.setItem(storageKey, JSON.stringify(currentItems));
    } catch {
      // ignore
    }

    const unread = currentItems.filter((n) => !n.is_read).length;
    this.notifyListeners(unread);

    return true;
  }

  /**
   * Helper dispatch: Surat disetujui
   */
  async notifyDocApproved(doc: {
    id: string;
    no: string;
    title: string;
    applicant_ptv_id?: string;
    type: string;
  }) {
    if (!doc.applicant_ptv_id) return;
    return this.dispatchEventNotification(
      { ptv_id: doc.applicant_ptv_id },
      {
        idempotency_key: `doc_approved_${doc.id}_${doc.no}`,
        title: `Surat ${doc.type} Disetujui (${doc.no})`,
        message: `Pengajuan surat "${doc.title}" telah disetujui resmi dengan nomor ${doc.no}. Unduh PDF resmi melalui Dokumen Saya.`,
        type: 'document',
        icon: 'fa-solid fa-file-circle-check',
        entity_type: 'document',
        entity_id: doc.id,
        action_url: `/hub/dokumen-saya?doc=${encodeURIComponent(doc.no)}`,
      }
    );
  }

  /**
   * Helper dispatch: Peminjaman multi-unit berhasil diajukan
   */
  async notifyLoanCheckout(loan: {
    transaction_id: string;
    borrower_ptv_id?: string;
    borrower_name: string;
    unit_count: number;
    due_date: string;
  }) {
    return this.dispatchEventNotification(
      { ptv_id: loan.borrower_ptv_id, role: 'technical' },
      {
        idempotency_key: `loan_checkout_${loan.transaction_id}`,
        title: `Peminjaman Alat ${loan.transaction_id}`,
        message: `Peminjaman ${loan.unit_count} unit oleh ${loan.borrower_name} berhasil dikonfirmasi. Tenggat pengembalian: ${loan.due_date}.`,
        type: 'loan',
        icon: 'fa-solid fa-boxes-stacked',
        entity_type: 'loan',
        entity_id: loan.transaction_id,
        action_url: '/hub/peminjaman',
      }
    );
  }

  /**
   * Helper dispatch: Penugasan Kru Acara
   */
  async notifyCrewAssigned(event: {
    id: string;
    name: string;
    crew_ptv_id: string;
    role_name: string;
    date: string;
  }) {
    return this.dispatchEventNotification(
      { ptv_id: event.crew_ptv_id },
      {
        idempotency_key: `event_crew_${event.id}_${event.crew_ptv_id}_${event.role_name}`,
        title: `Penugasan Acara: ${event.name}`,
        message: `Anda ditugaskan sebagai ${event.role_name} untuk liputan ${event.name} pada ${event.date}.`,
        type: 'event',
        icon: 'fa-solid fa-calendar-check',
        entity_type: 'event',
        entity_id: event.id,
        action_url: `/hub/acara/${event.id}`,
      }
    );
  }
}

export const notificationService = NotificationService.getInstance();
