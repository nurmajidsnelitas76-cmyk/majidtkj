import { Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { ROLE_LABELS, type UserProfile, type UserRole } from '../../types';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('guru');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ users: UserProfile[] }>('/api/admin/users');
      setUsers(res.users);
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (
        q &&
        !u.full_name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q) &&
        !u.nip.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, search]);

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  function openAddModal() {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('guru');
    setNip('');
    setJabatan('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(u: UserProfile) {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setNip(u.nip);
    setJabatan(u.jabatan);
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, string> = {
          full_name: fullName,
          email,
          role,
          nip,
          jabatan,
        };
        if (password.trim()) body.password = password.trim();
        await apiRequest(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setFeedback({
          type: 'ok',
          text: `Data pengguna ${fullName} berhasil diperbarui dan disinkronkan dengan autentikasi.`,
        });
      } else {
        await apiRequest('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
            nip,
            jabatan,
          }),
        });
        setFeedback({
          type: 'ok',
          text: `Pengguna baru ${fullName} (${ROLE_LABELS[role]}) berhasil ditambahkan ke sistem autentikasi.`,
        });
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmHardDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      setFeedback({
        type: 'ok',
        text: `Pengguna ${deleteTarget.full_name} berhasil dihapus permanen (hard delete) hingga ke Supabase Authentication.`,
      });
      setDeleteTarget(null);
      await loadUsers();
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus pengguna.',
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
            <h2 className="text-lg font-bold text-neutral-950">User Management</h2>
            <p className="text-xs text-neutral-500">
              Kelola seluruh akun Admin, Guru, dan Tenaga Kependidikan tersinkronisasi penuh dengan
              Supabase Authentication.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah User Baru</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="usr-role-filter" className="block text-xs font-semibold text-neutral-700">
              Filter Peran
            </label>
            <select
              id="usr-role-filter"
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

          <div>
            <label htmlFor="usr-search" className="block text-xs font-semibold text-neutral-700">
              Cari Nama, Email, atau NIP
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="usr-search"
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">
              Tidak ada pengguna ditemukan
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                <tr>
                  <th className="px-5 py-3">Nama & Email</th>
                  <th className="px-4 py-3">NIP / NIK</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3">Jabatan</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filtered.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-neutral-900">
                          {u.full_name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-medium text-red-700">(Anda)</span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-700 tabular-nums whitespace-nowrap">
                        {u.nip || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-neutral-800 whitespace-nowrap">
                        {ROLE_LABELS[u.role]}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600 whitespace-nowrap">
                        {u.jabatan || '-'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(u)}
                            title={
                              isSelf
                                ? 'Tidak dapat menghapus akun yang sedang digunakan'
                                : 'Hapus permanen sampai ke Supabase Auth'
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 id="user-modal-title" className="text-base font-bold text-neutral-950">
                {editingUser ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
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
                <label htmlFor="u-name" className="block text-xs font-semibold text-neutral-700">
                  Nama Lengkap
                </label>
                <input
                  id="u-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Siti Aminah, S.Pd."
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-email" className="block text-xs font-semibold text-neutral-700">
                    Email Login
                  </label>
                  <input
                    id="u-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="siti@smkprimaunggul.sch.id"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="u-role" className="block text-xs font-semibold text-neutral-700">
                    Peran (Role)
                  </label>
                  <select
                    id="u-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="guru">Guru</option>
                    <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-nip" className="block text-xs font-semibold text-neutral-700">
                    NIP / NIK (Opsional)
                  </label>
                  <input
                    id="u-nip"
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="19900412..."
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 font-mono text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="u-jabatan" className="block text-xs font-semibold text-neutral-700">
                    Jabatan / Mapel (Opsional)
                  </label>
                  <input
                    id="u-jabatan"
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    placeholder="Guru Produktif TKJ"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="u-pass" className="block text-xs font-semibold text-neutral-700">
                  {editingUser ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)' : 'Kata Sandi Awal'}
                </label>
                <input
                  id="u-pass"
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-red-600 focus:outline-none"
                />
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
                  {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat Akun User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Pengguna Permanen?"
        description={`Akun "${deleteTarget?.full_name}" (${deleteTarget?.email}) akan dihapus permanen (hard delete) dari database aplikasi dan Supabase Authentication. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hard Delete"
        loading={deleting}
        onConfirm={confirmHardDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
