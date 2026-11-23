export type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';

export type JurusanCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';

export type EmployeeAttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
export type StudentAttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  nip: string;
  role: UserRole;
  jabatan: string;
  created_at: string;
}

export interface Student {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jurusan: JurusanCode;
  created_at: string;
}

export interface EmployeeAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: EmployeeAttendanceStatus;
  notes: string;
  created_at: string;
  employee_name?: string;
  employee_role?: UserRole;
  employee_nip?: string;
  employee_jabatan?: string;
}

export interface StudentAttendanceRecord {
  id: string;
  student_id: string;
  recorded_by: string | null;
  date: string;
  status: StudentAttendanceStatus;
  notes: string;
  created_at: string;
  student_nis?: string;
  student_name?: string;
  student_kelas?: string;
  student_jurusan?: JurusanCode;
  recorder_name?: string;
}

export const JURUSAN_LIST: {
  code: JurusanCode;
  name: string;
  rumpun: string;
  summary: string;
}[] = [
  {
    code: 'TKJ',
    name: 'Teknik Komputer dan Jaringan',
    rumpun: 'Teknologi Informasi & Komunikasi',
    summary: 'Rekayasa jaringan enterprise, administrasi server Linux/Windows, keamanan siber, dan infrastruktur cloud.',
  },
  {
    code: 'DKV',
    name: 'Desain Komunikasi Visual',
    rumpun: 'Seni, Media & Ekonomi Kreatif',
    summary: 'Identitas merek, ilustrasi digital, fotografi komersial, UI/UX produk, dan produksi konten visual.',
  },
  {
    code: 'BC',
    name: 'Broadcasting dan Perfilman',
    rumpun: 'Seni, Media & Ekonomi Kreatif',
    summary: 'Produksi siaran studio, tata kamera dan pencahayaan, penyuntingan video, serta penulisan naskah dokumenter.',
  },
  {
    code: 'AK',
    name: 'Akuntansi dan Keuangan Lembaga',
    rumpun: 'Bisnis, Manajemen & Keuangan',
    summary: 'Siklus akuntansi perusahaan jasa/dagang, perpajakan terapan, audit dasar, dan sistem keuangan digital.',
  },
  {
    code: 'MPLB',
    name: 'Manajemen Perkantoran dan Layanan Bisnis',
    rumpun: 'Bisnis, Manajemen & Keuangan',
    summary: 'Tata kelola administrasi eksekutif, kearsipan digital, korespondensi korporat, dan layanan pelanggan profesional.',
  },
  {
    code: 'BD',
    name: 'Bisnis Digital',
    rumpun: 'Bisnis, Manajemen & Keuangan',
    summary: 'Pemasaran digital berbasis analitik, manajemen e-commerce, pengembangan produk daring, dan strategi konten.',
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  guru: 'Guru',
  tenaga_kependidikan: 'Tenaga Kependidikan',
};
