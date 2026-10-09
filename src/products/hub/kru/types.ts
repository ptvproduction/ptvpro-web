import { OrganizationStatus, AccountStatus, AccessProfile, AppCapability } from '@core/policy';

export interface CrewMember {
  id: string;
  ptv_id: string;
  full_name: string;
  division: string;
  position: string;
  angkatan: number;
  status_organisasi: OrganizationStatus;
  status_akun: AccountStatus;
  assigned_profiles: readonly AccessProfile[];
  allowed_overrides: readonly AppCapability[];
  phone?: string;
}

export interface CrewFilterParams {
  division?: string;
  search?: string;
}
