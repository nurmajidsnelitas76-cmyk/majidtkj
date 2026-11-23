import { CheckCheck, Save, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  JURUSAN_LIST,
  type Student,
  type StudentAttendanceRecord,
  type StudentAttendanceStatus,
} from '../../types';

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(getTodayWIB);
  const [jurusan, setJurusan] = useState('ALL');
  const [kelas, setKelas] = useState('ALL');
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [draftMap, setDraftMap] = useState<
    Record<string, { status: StudentAttendanceStatus; notes: string }>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canAccess = user?.role === 'admin' || user?.role === 'guru';

  const loadSheet = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const [stuRes, attRes] = await Promise.all([
        apiRequest<{ students: Student[] }>('/api/students'),
        apiRequest<{ records: StudentAttendanceRecord[] }>(
          `/api/attendance/students?date=${encodeURIComponent(date)}`
        ),
      ]);

      setStudents(stuRes.students);

      const attByStudent = new Map(attRes.records.map((r) => [r.student_id, r]));
      const nextDraft: Record<string, { status: StudentAttendanceStatus; notes: string }> = {};
      for (const s of stuRes.students) {
        const existing = attByStudent.get(s.id);
        nextDraft[s.id] = {
          status: existing ? existing.status : 'Hadir',
          notes: existing ? existing.notes : '',
        };
      }
      setDraftMap(nextDraft);
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar siswa.',
      });
    } finally {
      setLoading(false);
    }
  }, [canAccess, date]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const kelasOptions = useMemo(() => {
    const filtered =
      jurusan === 'ALL' ? students : students.filter((s) => s.jurusan === jurusan);
    return Array.from(new Set(filtered.map((s) => s.kelas))).sort();
  }, [students, jurusan]);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (jurusan !== 'ALL' && s.jurusan !== jurusan) return false;
      if (kelas !== 'ALL' && s.kelas !== kelas) return false;
      if (
        q &&
        !s.nama.toLowerCase().includes(q) &&
        !s.nis.toLowerCase().includes(q) &&
        !s.kelas.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [students, jurusan, kelas, search]);

  if (!canAccess) {
    return <Navigate to="/app/dashboard" replace />;
  }

  function updateRow(studentId: string, status: StudentAttendanceStatus) {
    setDraftMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || '',
      },
    }));
  }

  function updateNotes(studentId: string, notes: string) {
    setDraftMap((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'Hadir',
        notes,
      },
    }));
  }

  function markAllPresent() {
    setDraftMap((prev) => {
      const copy = { ...prev };
      for (const s of visibleStudents) {
        copy[s.id] = {
          status: 'Hadir',
          notes: copy[s.id]?.notes || '',
        };
      }
      return copy;
    });
  }

  async function handleSave() {
    if (visibleStudents.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = visibleStudents.map((s) => ({
        student_id: s.id,
        status: draftMap[s.id]?.status || 'Hadir',
        notes: draftMap[s.id]?.notes || '',
      }));
      const res = await apiRequest<{ saved: number }>('/api/attendance/students/batch', {
        method: 'POST',
        body: JSON.stringify({ date, records: payload }),
      });
      setFeedback({
        type: 'ok',
        text: `Berhasil menyimpan absensi untuk ${res.saved} siswa pada tanggal ${date}.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.',
      });
    } finally {
      setSaving(false);
    }
  }

  const statusCounts = useMemo(() => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    for (const s of visibleStudents) {
      const st = draftMap[s.id]?.status || 'Hadir';
      counts[st] += 1;
    }
    return counts;
  }, [visibleStudents, draftMap]);

  return (
    <div className="space-y-6">
      {/* Control & Filter Bar */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">Lembar Absensi Siswa</h2>
            <p className="text-xs text-neutral-500">
              Pilih tanggal dan kelas untuk mencatat atau memperbarui kehadiran siswa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={markAllPresent}
              disabled={visibleStudents.length === 0 || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 whitespace-nowrap"
            >
              <CheckCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Tandai Semua Hadir</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={visibleStudents.length === 0 || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Absensi'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="att-date" className="block text-xs font-semibold text-neutral-700">
              Tanggal Absensi
            </label>
            <input
              id="att-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="att-jurusan" className="block text-xs font-semibold text-neutral-700">
              Jurusan
            </label>
            <select
              id="att-jurusan"
              value={jurusan}
              onChange={(e) => {
                setJurusan(e.target.value);
                setKelas('ALL');
              }}
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

          <div>
            <label htmlFor="att-kelas" className="block text-xs font-semibold text-neutral-700">
              Kelas
            </label>
            <select
              id="att-kelas"
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="att-search" className="block text-xs font-semibold text-neutral-700">
              Cari Siswa
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="att-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama atau NIS..."
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
          <span>
            Menampilkan <strong className="font-mono text-neutral-900">{visibleStudents.length}</strong>{' '}
            siswa
          </span>
          <span>
            Hadir: <strong className="font-mono text-emerald-700">{statusCounts.Hadir}</strong>
          </span>
          <span>
            Izin: <strong className="font-mono text-sky-700">{statusCounts.Izin}</strong>
          </span>
          <span>
            Sakit: <strong className="font-mono text-orange-700">{statusCounts.Sakit}</strong>
          </span>
          <span>
            Alpa: <strong className="font-mono text-red-700">{statusCounts.Alpa}</strong>
          </span>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Attendance Table */}
      <section className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-neutral-800">
              Tidak ada data siswa yang cocok dengan filter.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Admin dapat menambahkan siswa baru di menu Data Siswa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                <tr>
                  <th className="px-5 py-3">NIS</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Status Kehadiran</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {visibleStudents.map((s) => {
                  const row = draftMap[s.id] || { status: 'Hadir', notes: '' };
                  return (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-neutral-700 tabular-nums whitespace-nowrap">
                        {s.nis}
                      </td>
                      <td className="px-4 py-3 font-semibold text-neutral-900 whitespace-nowrap">
                        {s.nama}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                        {s.kelas} · {s.jurusan}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex rounded-lg bg-neutral-100 p-1">
                          {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map((st) => {
                            const active = row.status === st;
                            const activeColor =
                              st === 'Hadir'
                                ? 'bg-emerald-600 text-white'
                                : st === 'Izin'
                                  ? 'bg-sky-600 text-white'
                                  : st === 'Sakit'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-red-700 text-white';

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => updateRow(s.id, st)}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                                  active
                                    ? activeColor
                                    : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateNotes(s.id, e.target.value)}
                          placeholder="Keterangan opsional..."
                          className="w-full min-w-[160px] rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:border-red-600 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
