import { Download, FileSpreadsheet, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { StatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  type EmployeeAttendanceRecord,
  JURUSAN_LIST,
  ROLE_LABELS,
  type StudentAttendanceRecord,
} from '../../types';

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join(
    '\n'
  );
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceRecapPage() {
  const { kategori } = useParams<{ kategori: string }>();
  const { user } = useAuth();

  const isKaryawan = kategori === 'karyawan';
  const isSiswa = kategori === 'siswa';

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('ALL');
  const [jurusan, setJurusan] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [empRecords, setEmpRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [stuRecords, setStuRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const allowed =
    (isKaryawan && user?.role === 'admin') ||
    (isSiswa && (user?.role === 'admin' || user?.role === 'guru'));

  const loadRecap = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (status !== 'ALL') params.set('status', status);
      if (search.trim()) params.set('search', search.trim());

      if (isKaryawan) {
        params.set('scope', 'all');
        if (roleFilter !== 'ALL') params.set('role', roleFilter);
        const res = await apiRequest<{ records: EmployeeAttendanceRecord[] }>(
          `/api/attendance/employees?${params.toString()}`
        );
        setEmpRecords(res.records);
      } else if (isSiswa) {
        if (jurusan !== 'ALL') params.set('jurusan', jurusan);
        const res = await apiRequest<{ records: StudentAttendanceRecord[] }>(
          `/api/attendance/students?${params.toString()}`
        );
        setStuRecords(res.records);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data rekap absensi.');
    } finally {
      setLoading(false);
    }
  }, [allowed, isKaryawan, isSiswa, startDate, endDate, status, jurusan, roleFilter, search]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  if (!isKaryawan && !isSiswa) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (!allowed) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const activeList = isKaryawan ? empRecords : stuRecords;
  const hadirCount = activeList.filter((r) => r.status === 'Hadir').length;
  const izinSakitCount = activeList.filter(
    (r) => r.status === 'Izin' || r.status === 'Sakit'
  ).length;
  const thirdMetricCount = isKaryawan
    ? empRecords.filter((r) => r.status === 'Terlambat').length
    : stuRecords.filter((r) => r.status === 'Alpa').length;

  function handleExportCsv() {
    if (isKaryawan) {
      downloadCsv(
        `rekap-absensi-karyawan.csv`,
        ['Tanggal', 'Nama Karyawan', 'NIP', 'Peran', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'],
        empRecords.map((r) => [
          r.date,
          r.employee_name || '-',
          r.employee_nip || '-',
          r.employee_role ? ROLE_LABELS[r.employee_role] : '-',
          r.check_in_time || '-',
          r.check_out_time || '-',
          r.status,
          r.notes || '-',
        ])
      );
    } else {
      downloadCsv(
        `rekap-absensi-siswa.csv`,
        ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Jurusan', 'Status', 'Dicatat Oleh', 'Catatan'],
        stuRecords.map((r) => [
          r.date,
          r.student_nis || '-',
          r.student_name || '-',
          r.student_kelas || '-',
          r.student_jurusan || '-',
          r.status,
          r.recorder_name || '-',
          r.notes || '-',
        ])
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Panel */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">
              {isKaryawan ? 'Rekap Absensi Karyawan' : 'Rekap Absensi Siswa'}
            </h2>
            <p className="text-xs text-neutral-500">
              {isKaryawan
                ? 'Laporan kehadiran seluruh karyawan (Admin, Guru, dan Tenaga Kependidikan).'
                : 'Laporan kehadiran siswa lintas jurusan dan kelas SMK Prima Unggul.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={activeList.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Unduh CSV</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="recap-start" className="block text-xs font-semibold text-neutral-700">
              Dari Tanggal
            </label>
            <input
              id="recap-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="recap-end" className="block text-xs font-semibold text-neutral-700">
              Sampai Tanggal
            </label>
            <input
              id="recap-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="recap-status" className="block text-xs font-semibold text-neutral-700">
              Status
            </label>
            <select
              id="recap-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="Hadir">Hadir</option>
              {isKaryawan && <option value="Terlambat">Terlambat</option>}
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              {isSiswa && <option value="Alpa">Alpa</option>}
            </select>
          </div>

          {isKaryawan ? (
            <div>
              <label htmlFor="recap-role" className="block text-xs font-semibold text-neutral-700">
                Peran Karyawan
              </label>
              <select
                id="recap-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
              >
                <option value="ALL">Semua Peran</option>
                <option value="admin">Admin</option>
                <option value="guru">Guru</option>
                <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="recap-jurusan" className="block text-xs font-semibold text-neutral-700">
                Jurusan
              </label>
              <select
                id="recap-jurusan"
                value={jurusan}
                onChange={(e) => setJurusan(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
              >
                <option value="ALL">Semua Jurusan</option>
                {JURUSAN_LIST.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.code} — {j.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="recap-search" className="block text-xs font-semibold text-neutral-700">
              Cari Nama / ID
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="recap-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isKaryawan ? 'Nama atau NIP...' : 'Nama atau NIS...'}
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">Total Catatan</p>
          <p className="mt-1 font-mono text-2xl font-bold text-neutral-950 tabular-nums">
            {activeList.length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">Hadir</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {hadirCount}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">
            {isKaryawan ? 'Terlambat' : 'Alpa'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {thirdMetricCount}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium text-neutral-500">Izin & Sakit</p>
          <p className="mt-1 font-mono text-2xl font-bold text-sky-700 tabular-nums">
            {izinSakitCount}
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Data Table */}
      <section className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileSpreadsheet className="h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">
              Belum ada data rekap yang sesuai
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Sesuaikan filter tanggal atau lakukan pencatatan absensi terlebih dahulu.
            </p>
          </div>
        ) : isKaryawan ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3">Jam Masuk</th>
                  <th className="px-4 py-3">Jam Pulang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {empRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-900 tabular-nums whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900">{r.employee_name}</p>
                      {r.employee_nip && (
                        <p className="font-mono text-xs text-neutral-500 tabular-nums">
                          NIP {r.employee_nip}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                      {r.employee_role ? ROLE_LABELS[r.employee_role] : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {r.check_in_time || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {r.check_out_time || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-600">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">NIS</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pencatat</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {stuRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-900 tabular-nums whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {r.student_nis}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-900 whitespace-nowrap">
                      {r.student_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                      {r.student_kelas} · {r.student_jurusan}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                      {r.recorder_name || '-'}
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-600">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
