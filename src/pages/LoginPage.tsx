import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, Lock, Mail, User } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

export default function LoginPage() {
  const { user, loading: authLoading, login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    apiRequest<{ hasUsers: boolean }>('/api/auth/bootstrap-status')
      .then((res) => {
        if (!mounted) return;
        setHasUsers(res.hasUsers);
        if (!res.hasUsers) {
          setMode('register');
        }
      })
      .catch(() => {
        if (mounted) setHasUsers(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!authLoading && user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          full_name: fullName,
          nip,
          jabatan,
        });
      }
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Autentikasi gagal. Periksa kembali data Anda.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left Crimson Brand Panel */}
      <aside className="flex flex-col justify-between bg-red-800 px-8 py-10 text-white lg:col-span-5 lg:px-12 lg:py-14">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-red-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke Beranda</span>
          </Link>

          <div className="mt-10">
            <p className="text-xs font-semibold tracking-wide text-red-200">
              Portal Resmi Kehadiran Sekolah
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white lg:text-4xl text-balance">
              SMK Prima Unggul
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-red-100">
              Sistem absensi siswa dan karyawan berbasis peran untuk Admin, Guru, dan Tenaga
              Kependidikan di enam kompetensi keahlian: TKJ, DKV, AK, BC, MPLB, dan BD.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-red-700/80 pt-6">
          <p className="text-xs font-semibold text-red-200">Ketentuan Akses Pertama</p>
          <p className="mt-1.5 text-sm leading-relaxed text-red-100">
            Pengguna pertama yang didaftarkan pada sistem otomatis ditetapkan sebagai{' '}
            <strong className="font-semibold text-white">Administrator</strong> yang berwenang
            menambahkan akun Guru dan Tenaga Kependidikan lainnya.
          </p>
        </div>
      </aside>

      {/* Right Authentication Form Panel */}
      <main className="flex items-center justify-center px-6 py-12 lg:col-span-7 lg:px-16">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {hasUsers === false ? 'Buat Akun Admin' : 'Daftar Akun'}
            </button>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              {mode === 'login'
                ? 'Masuk ke Portal Absensi'
                : hasUsers === false
                  ? 'Inisialisasi Akun Administrator'
                  : 'Pendaftaran Akun Karyawan'}
            </h2>
            <p className="mt-1.5 text-sm text-neutral-600">
              {mode === 'login'
                ? 'Gunakan email dan kata sandi akun sekolah Anda.'
                : hasUsers === false
                  ? 'Belum ada pengguna terdaftar. Akun pertama ini akan mendapatkan peran Admin.'
                  : 'Akun baru yang mendaftar mandiri akan berstatus Tenaga Kependidikan.'}
            </p>
          </div>

          {hasUsers === false && mode === 'register' && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <p>
                Sistem mendeteksi ini adalah akun pertama. Peran <strong className="font-semibold">Admin</strong>{' '}
                akan diberikan secara otomatis setelah pendaftaran berhasil.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-neutral-800">
                    Nama Lengkap
                  </label>
                  <div className="relative mt-1.5">
                    <User
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      aria-hidden="true"
                    />
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Drs. Ahmad Suryadi"
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nip" className="block text-sm font-semibold text-neutral-800">
                      NIP / NIK (Opsional)
                    </label>
                    <input
                      id="nip"
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="19850101..."
                      className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="jabatan" className="block text-sm font-semibold text-neutral-800">
                      Jabatan (Opsional)
                    </label>
                    <input
                      id="jabatan"
                      type="text"
                      value={jabatan}
                      onChange={(e) => setJabatan(e.target.value)}
                      placeholder={hasUsers === false ? 'Administrator' : 'Staf Tata Usaha'}
                      className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-neutral-800">
                Alamat Email
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@smkprimaunggul.sch.id"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-neutral-800">
                Kata Sandi
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-neutral-800"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              <span>
                {submitting
                  ? 'Memproses...'
                  : mode === 'login'
                    ? 'Masuk ke Aplikasi'
                    : hasUsers === false
                      ? 'Daftarkan Admin & Masuk'
                      : 'Daftar & Masuk'}
              </span>
              {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
