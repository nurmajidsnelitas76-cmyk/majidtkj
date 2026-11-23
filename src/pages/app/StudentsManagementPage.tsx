import { GraduationCap, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { JURUSAN_LIST, type JurusanCode, type Student } from '../../types';

export default function StudentsManagementPage() {
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [jurusanFilter, setJurusanFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [nis, setNis] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [jurusan, setJurusan] = useState<JurusanCode>('TKJ');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadStudents = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ students: Student[] }>('/api/students');
      setStudents(res.students);
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat data siswa.',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (jurusanFilter !== 'ALL' && s.jurusan !== jurusanFilter) return false;
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
  }, [students, jurusanFilter, search]);

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  function openAddModal() {
    setEditingStudent(null);
    setNis('');
    setNama('');
    setKelas('');
    setJurusan('TKJ');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(student: Student) {
    setEditingStudent(student);
    setNis(student.nis);
    setNama(student.nama);
    setKelas(student.kelas);
    setJurusan(student.jurusan);
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingStudent) {
        await apiRequest(`/api/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nis, nama, kelas, jurusan }),
        });
        setFeedback({ type: 'ok', text: `Data siswa ${nama} berhasil diperbarui.` });
      } else {
        await apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify({ nis, nama, kelas, jurusan }),
        });
        setFeedback({ type: 'ok', text: `Siswa baru ${nama} berhasil ditambahkan.` });
      }
      setModalOpen(false);
      await loadStudents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data siswa.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/students/${deleteTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Data siswa ${deleteTarget.nama} telah dihapus.` });
      setDeleteTarget(null);
      await loadStudents();
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus siswa.',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">Data Induk Siswa</h2>
            <p className="text-xs text-neutral-500">
              Kelola NIS, nama, kelas, dan jurusan siswa agar siap diabsen oleh Guru.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah Siswa</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="stu-jurusan" className="block text-xs font-semibold text-neutral-700">
              Filter Jurusan
            </label>
            <select
              id="stu-jurusan"
              value={jurusanFilter}
              onChange={(e) => setJurusanFilter(e.target.value)}
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
            <label htmlFor="stu-search" className="block text-xs font-semibold text-neutral-700">
              Cari NIS, Nama, atau Kelas
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="stu-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik kata kunci pencarian..."
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>
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

      <section className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <GraduationCap className="h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">
              Belum ada data siswa yang cocok
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Tambahkan data siswa baru menggunakan tombol Tambah Siswa di atas.
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
                  <th className="px-4 py-3">Jurusan</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-neutral-800 tabular-nums whitespace-nowrap">
                      {s.nis}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-900 whitespace-nowrap">
                      {s.nama}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                      {s.kelas}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-red-700 whitespace-nowrap">
                      {s.jurusan}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-700 hover:text-white transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Student Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-modal-title"
        >
          <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 id="student-modal-title" className="text-base font-bold text-neutral-950">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="stu-nis" className="block text-xs font-semibold text-neutral-700">
                  NIS (Nomor Induk Siswa)
                </label>
                <input
                  id="stu-nis"
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Contoh: 202601015"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 font-mono text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="stu-nama" className="block text-xs font-semibold text-neutral-700">
                  Nama Lengkap Siswa
                </label>
                <input
                  id="stu-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Nadia Putri Maharani"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stu-jur" className="block text-xs font-semibold text-neutral-700">
                    Jurusan
                  </label>
                  <select
                    id="stu-jur"
                    value={jurusan}
                    onChange={(e) => setJurusan(e.target.value as JurusanCode)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  >
                    {JURUSAN_LIST.map((j) => (
                      <option key={j.code} value={j.code}>
                        {j.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="stu-kls" className="block text-xs font-semibold text-neutral-700">
                    Kelas
                  </label>
                  <input
                    id="stu-kls"
                    type="text"
                    required
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    placeholder="Contoh: X TKJ 1"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Data Siswa?"
        description={`Data siswa "${deleteTarget?.nama}" (NIS ${deleteTarget?.nis}) beserta riwayat absensinya akan dihapus secara permanen.`}
        confirmLabel="Hapus Siswa"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
