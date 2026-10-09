import { CrewMember, CrewFilterParams } from './types';

export interface IKruService {
  getCrewList(filters?: CrewFilterParams): Promise<CrewMember[]>;
  getCrewByPtvId(ptvId: string): Promise<CrewMember | null>;
}

/**
 * Local development repository for Kru module.
 * Mock implementation to protect production database during scaffold.
 */
export class LocalKruService implements IKruService {
  private mockData: CrewMember[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      ptv_id: 'PTV-ROOT',
      full_name: 'PTV Studio Master Root',
      division: 'Master Control',
      position: 'Institutional Root Executive',
      angkatan: 2020,
      status_organisasi: 'active',
      status_akun: 'active',
      assigned_profiles: ['root_executive'],
      allowed_overrides: [],
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      ptv_id: 'PTV-001',
      full_name: 'Ahmad Executive',
      division: 'Leadership',
      position: 'Ketua Umum',
      angkatan: 2022,
      status_organisasi: 'active',
      status_akun: 'active',
      assigned_profiles: ['eksekutif'],
      allowed_overrides: [],
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      ptv_id: 'PTV-010',
      full_name: 'Farid Technical',
      division: 'Technical',
      position: 'Ketua Technical',
      angkatan: 2023,
      status_organisasi: 'active',
      status_akun: 'active',
      assigned_profiles: ['kepolo_kepali'],
      allowed_overrides: [],
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      ptv_id: 'PTV-025',
      full_name: 'Zidna Santri',
      division: 'Technical',
      position: 'Crew Operator',
      angkatan: 2024,
      status_organisasi: 'active',
      status_akun: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      ptv_id: 'PTV-023',
      full_name: 'Farsya Crew Finance',
      division: 'Technical',
      position: 'Crew Operator & Kasir',
      angkatan: 2023,
      status_organisasi: 'active',
      status_akun: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: ['finance.operator'],
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      ptv_id: 'PTV-099',
      full_name: 'Alumni PTV',
      division: 'Editor',
      position: 'Alumni Anggota',
      angkatan: 2021,
      status_organisasi: 'inactive',
      status_akun: 'active',
      assigned_profiles: ['crew'],
      allowed_overrides: [],
    },
  ];

  async getCrewList(filters?: CrewFilterParams): Promise<CrewMember[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));

    let result = [...this.mockData];

    if (filters?.division && filters.division !== 'all') {
      result = result.filter((k) => k.division.toLowerCase() === filters.division?.toLowerCase());
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (k) =>
          k.full_name.toLowerCase().includes(q) ||
          k.ptv_id.toLowerCase().includes(q) ||
          k.position.toLowerCase().includes(q)
      );
    }

    return result;
  }

  async getCrewByPtvId(ptvId: string): Promise<CrewMember | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.mockData.find((k) => k.ptv_id.toLowerCase() === ptvId.toLowerCase()) || null;
  }
}

let kruServiceInstance: IKruService | null = null;

export function getKruService(): IKruService {
  if (!kruServiceInstance) {
    kruServiceInstance = new LocalKruService();
  }
  return kruServiceInstance;
}
