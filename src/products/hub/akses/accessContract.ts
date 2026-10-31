import { z } from 'zod';

export const accessChangeSchema = z.object({
  accountId: z.string().uuid(),
  expectedVersion: z.string().min(1).max(128),
  profiles: z.array(z.string().min(1)).min(1),
  allowed: z.array(z.string().min(1)),
  denied: z.array(z.string().min(1)),
  status: z.enum(['active', 'inactive']),
  reason: z.string().trim().min(5).max(500),
  confirmed: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if ([value.profiles, value.allowed, value.denied].some(list => new Set(list).size !== list.length)) ctx.addIssue({ code: 'custom', message: 'Izin/profil duplikat tidak diperbolehkan.' });
  if (value.allowed.some(cap => value.denied.includes(cap))) ctx.addIssue({ code: 'custom', message: 'Izin yang sama tidak boleh sekaligus allow dan deny.' });
});

export type AccessChange = z.infer<typeof accessChangeSchema>;
export interface AccessAccount {
  id: string;
  identityId: string;
  ptvId: string;
  name: string;
  username: string;
  status: 'active' | 'inactive';
  organizationStatus: 'active' | 'inactive' | 'archived';
  position?: string;
  division?: string;
  profiles: string[];
  allowed: string[];
  denied: string[];
  version: string;
}

export interface PositionCapabilityMapping {
  position: string;
  capabilities: string[];
  description?: string;
  updated_at?: string;
}

export interface AccessAuditLogItem {
  id: number;
  event_type: string;
  created_at: string;
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  target_username?: string;
  target_ptv_id?: string;
  target_name?: string;
  target_position?: string;
  source?: string;
  reason?: string;
  changes?: {
    before?: {
      profiles?: string[];
      allowed?: string[];
      denied?: string[];
      status?: string;
    };
    after?: {
      profiles?: string[];
      allowed?: string[];
      denied?: string[];
      status?: string;
    };
  };
  metadata?: any;
}

export interface AccessSnapshot {
  accounts: AccessAccount[];
  profiles: { id: string; name: string }[];
  capabilities: { key: string; description: string; is_sensitive: boolean; is_mutation: boolean }[];
  grants: { profile_id: string; capability_key: string }[];
  positionMappings?: PositionCapabilityMapping[];
  history?: AccessAuditLogItem[];
  canViewHistory?: boolean;
}
