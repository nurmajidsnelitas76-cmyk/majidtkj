import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  type EmployeeAttendanceRecord,
  JURUSAN_LIST,
  ROLE_LABELS,
} from '../../types';

interface DashboardData {
  today: string;
  myToday: EmployeeAttendanceRecord | null;
  myMonthStats: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
  };
  totals: {
    students: number;
    employees: number;
  };
  employeeTodaySummary: {
    totalCheckedIn: number;
    hadir: number;
    terlambat: number;
    izinSakit: number;
  };
  studentTodaySummary: {
    recorded: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpa: number;
  };
  jurusanCounts: Record<string, number>;
}

function formatDateID(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentMine, setRecentMine] = useState<EmployeeAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      apiRequest<DashboardData>('/api/dashboard'),
      apiRequest<{ records: EmployeeAttendanceRecord[] }>('/api/attendance/employees?scope=mine'),
    ])
      .then(([dash, emp]) => {
        if (!mounted) return;
        setData(dash);
        setRecentMine(emp.records.slice(0, 6));
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !user) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error || 'Data dashboard tidak tersedia.'}
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium text-neutral-500">
            {formatDateID(data.today)} · Peran: {ROLE_LABELS[user.role]}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">
            Selamat Datang, {user.full_name}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {data.myToday
              ? `Status absensi karyawan Anda hari ini tercatat ${data.myToday.status}${
                  data.myToday.check_in_time ? ` pada ${data.myToday.check_in_time} WIB` : ''
                }.`
              : 'Anda belum melakukan absensi karyawan hari ini. Silakan catat kehadiran Anda.'}
          </p>
        </div>

        <Link
          to="/app/absensi-karyawan"
          className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
        >
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          <span>{data.myToday ? 'Lihat Absensi Saya' : 'Absen Karyawan Sekarang'}</span>
        </Link>
      </section>

      {/* Role-Specific Summary Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">Kehadiran Saya Bulan Ini</span>
            <CalendarDays className="h-4 w-4 text-red-700" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
            {data.myMonthStats.hadir + data.myMonthStats.terlambat} Hari
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Tepat waktu: {data.myMonthStats.hadir} · Terlambat: {data.myMonthStats.terlambat}
          </p>
        </div>

        {(isAdmin || isGuru) && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold">Absensi Siswa Hari Ini</span>
              <ClipboardCheck className="h-4 w-4 text-red-700" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
              {data.studentTodaySummary.recorded} / {data.totals.students}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Hadir: {data.studentTodaySummary.hadir} · Izin/Sakit:{' '}
              {data.studentTodaySummary.izin + data.studentTodaySummary.sakit} · Alpa:{' '}
              {data.studentTodaySummary.alpa}
            </p>
          </div>
        )}

        {(isAdmin || isGuru) && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold">Total Siswa Terdaftar</span>
              <GraduationCap className="h-4 w-4 text-red-700" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
              {data.totals.students} Siswa
            </p>
            <p className="mt-1 text-xs text-neutral-500">Tersebar di 6 jurusan keahlian</p>
          </div>
        )}

        {isAdmin ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold">Karyawan Absen Hari Ini</span>
              <Users className="h-4 w-4 text-red-700" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
              {data.employeeTodaySummary.totalCheckedIn} / {data.totals.employees}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Hadir: {data.employeeTodaySummary.hadir} · Terlambat:{' '}
              {data.employeeTodaySummary.terlambat}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold">Izin & Sakit Bulan Ini</span>
              <BookOpen className="h-4 w-4 text-red-700" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
              {data.myMonthStats.izin + data.myMonthStats.sakit} Hari
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Izin: {data.myMonthStats.izin} · Sakit: {data.myMonthStats.sakit}
            </p>
          </div>
        )}

        {!isAdmin && !isGuru && (
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-semibold">Jam Masuk Hari Ini</span>
              <UserCheck className="h-4 w-4 text-red-700" aria-hidden="true" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
              {data.myToday?.check_in_time || '--:--:--'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Pulang: {data.myToday?.check_out_time || 'Belum tercatat'}
            </p>
          </div>
        )}
      </section>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Personal Attendance History */}
        <section className="rounded-lg border border-neutral-200 bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h3 className="text-base font-bold text-neutral-900">
              Riwayat Absensi Karyawan Terbaru
            </h3>
            <Link
              to="/app/absensi-karyawan"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap"
            >
              <span>Kelola</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentMine.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-neutral-700">Belum ada riwayat absensi pribadi.</p>
              <p className="mt-1 text-xs text-neutral-500">
                Catat kehadiran harian Anda melalui menu Absensi Karyawan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                  <tr>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-4 py-3">Masuk</th>
                    <th className="px-4 py-3">Pulang</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {recentMine.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 font-mono text-xs text-neutral-800 tabular-nums whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                        {row.check_in_time || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                        {row.check_out_time || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <StatusText status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick Actions & Jurusan Breakdown */}
        <section className="space-y-6 lg:col-span-5">
          {(isAdmin || isGuru) && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <h3 className="text-base font-bold text-neutral-900">Sebaran Siswa per Jurusan</h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Data siswa aktif di enam kompetensi keahlian SMK Prima Unggul.
              </p>
              <div className="mt-4 divide-y divide-neutral-100">
                {JURUSAN_LIST.map((j) => (
                  <div key={j.code} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0 pr-3">
                      <span className="font-mono text-xs font-bold text-red-700">{j.code}</span>
                      <span className="mx-2 text-neutral-300">·</span>
                      <span className="text-neutral-700 truncate">{j.name}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-neutral-900 tabular-nums shrink-0">
                      {data.jurusanCounts[j.code] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h3 className="text-base font-bold text-neutral-900">Akses Cepat</h3>
            <div className="mt-4 space-y-2.5">
              <Link
                to="/app/absensi-karyawan"
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-red-300 hover:bg-red-50/40"
              >
                <span>Isi Absensi Karyawan</span>
                <ArrowRight className="h-4 w-4 text-red-700" />
              </Link>
              {(isAdmin || isGuru) && (
                <>
                  <Link
                    to="/app/absensi-siswa"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-red-300 hover:bg-red-50/40"
                  >
                    <span>Catat Absensi Siswa</span>
                    <ArrowRight className="h-4 w-4 text-red-700" />
                  </Link>
                  <Link
                    to="/app/rekap-absensi/siswa"
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-red-300 hover:bg-red-50/40"
                  >
                    <span>Buka Rekap Absensi Siswa</span>
                    <ArrowRight className="h-4 w-4 text-red-700" />
                  </Link>
                </>
              )}
              {isAdmin && (
                <Link
                  to="/app/user-management"
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-red-300 hover:bg-red-50/40"
                >
                  <span>Kelola User & Hak Akses</span>
                  <ArrowRight className="h-4 w-4 text-red-700" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
