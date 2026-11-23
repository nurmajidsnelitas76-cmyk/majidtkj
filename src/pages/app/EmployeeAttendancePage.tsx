import { CheckCircle2, Clock, FileText, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { StatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { type EmployeeAttendanceRecord, ROLE_LABELS } from '../../types';

function useLiveClockWIB() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return { time, date };
}

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const { time, date } = useLiveClockWIB();

  const [todayRecord, setTodayRecord] = useState<EmployeeAttendanceRecord | null>(null);
  const [history, setHistory] = useState<EmployeeAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [absenceMode, setAbsenceMode] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, listRes] = await Promise.all([
        apiRequest<{ record: EmployeeAttendanceRecord | null }>('/api/attendance/employees/today'),
        apiRequest<{ records: EmployeeAttendanceRecord[] }>('/api/attendance/employees?scope=mine'),
      ]);
      setTodayRecord(todayRes.record);
      setHistory(listRes.records);
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat data absensi.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCheckIn() {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ record: EmployeeAttendanceRecord }>(
        '/api/attendance/employees/check-in',
        {
          method: 'POST',
          body: JSON.stringify({ status: absenceMode, notes }),
        }
      );
      setTodayRecord(res.record);
      setNotes('');
      setFeedback({
        type: 'ok',
        text:
          absenceMode === 'Hadir'
            ? `Absen masuk tercatat dengan status ${res.record.status} pukul ${res.record.check_in_time} WIB.`
            : `Pengajuan ${absenceMode} hari ini berhasil dicatat.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mencatat absensi.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut() {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ record: EmployeeAttendanceRecord }>(
        '/api/attendance/employees/check-out',
        { method: 'POST' }
      );
      setTodayRecord(res.record);
      setFeedback({
        type: 'ok',
        text: `Absen pulang tercatat pukul ${res.record.check_out_time} WIB.`,
      });
      await loadData();
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mencatat absen pulang.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredHistory =
    statusFilter === 'ALL' ? history : history.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Self Attendance Action Card */}
      <section className="grid grid-cols-1 gap-6 rounded-lg border border-neutral-200 bg-white p-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between border-b border-neutral-200 pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <div>
            <p className="text-xs font-semibold text-red-700">Waktu Layanan Sekolah (WIB)</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-tight text-neutral-950 tabular-nums">
              {time}
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-600">{date}</p>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
            <p className="font-semibold text-neutral-800">{user?.full_name}</p>
            <p className="mt-0.5">
              {user ? ROLE_LABELS[user.role] : ''}
              {user?.nip ? ` · NIP ${user.nip}` : ''}
            </p>
            <p className="mt-2">
              Batas masuk tepat waktu: <span className="font-mono font-semibold">07:30:00 WIB</span>
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          {feedback && (
            <div
              role="status"
              className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
                feedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {loading ? (
            <div className="h-36 animate-pulse rounded-lg bg-neutral-100" />
          ) : !todayRecord ? (
            <div>
              <h2 className="text-lg font-bold text-neutral-950">Absensi Mandiri Hari Ini</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Pilih status kehadiran Anda untuk hari ini lalu tekan tombol simpan.
              </p>

              {/* Segmented status control */}
              <div className="mt-4 inline-flex rounded-lg bg-neutral-100 p-1">
                {(['Hadir', 'Izin', 'Sakit'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAbsenceMode(mode)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                      absenceMode === mode
                        ? 'bg-white text-red-700 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label htmlFor="emp-notes" className="block text-xs font-semibold text-neutral-700">
                  Catatan / Keterangan {absenceMode !== 'Hadir' ? '(Disarankan)' : '(Opsional)'}
                </label>
                <input
                  id="emp-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    absenceMode === 'Hadir'
                      ? 'Contoh: Piket gerbang pagi'
                      : `Tuliskan alasan ${absenceMode.toLowerCase()} Anda...`
                  }
                  className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {absenceMode === 'Hadir' ? (
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {submitting
                      ? 'Menyimpan...'
                      : absenceMode === 'Hadir'
                        ? 'Absen Masuk Sekarang'
                        : `Kirim Keterangan ${absenceMode}`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold text-neutral-950">Status Absensi Hari Ini</h2>
                  <StatusText status={todayRecord.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Jam Masuk</p>
                    <p className="mt-1 font-mono text-lg font-bold text-neutral-900 tabular-nums">
                      {todayRecord.check_in_time || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Jam Pulang</p>
                    <p className="mt-1 font-mono text-lg font-bold text-neutral-900 tabular-nums">
                      {todayRecord.check_out_time || '-'}
                    </p>
                  </div>
                </div>

                {todayRecord.notes && (
                  <p className="mt-3 text-sm text-neutral-600">
                    Keterangan: <span className="font-medium text-neutral-900">{todayRecord.notes}</span>
                  </p>
                )}
              </div>

              <div className="mt-5">
                {todayRecord.status !== 'Izin' &&
                todayRecord.status !== 'Sakit' &&
                !todayRecord.check_out_time ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap"
                  >
                    <LogOutIcon className="h-4 w-4" aria-hidden="true" />
                    <span>{submitting ? 'Memproses...' : 'Absen Pulang Sekarang'}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Absensi hari ini telah selesai tercatat.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Personal Attendance History Table */}
      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-neutral-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Riwayat Absensi Pribadi</h3>
            <p className="text-xs text-neutral-500">
              Catatan kehadiran mandiri seluruh hari kerja Anda.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-1">
            {['ALL', 'Hadir', 'Terlambat', 'Izin', 'Sakit'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Clock className="h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">
              Belum ada catatan absensi ditemukan
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Riwayat akan muncul secara otomatis setelah Anda mengisi absensi harian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jam Masuk</th>
                  <th className="px-4 py-3">Jam Pulang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-900 tabular-nums whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {row.check_in_time || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                      {row.check_out_time || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusText status={row.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-600">
                      {row.notes || '-'}
                    </td>
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
