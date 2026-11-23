import { ArrowRight, BookOpenCheck, Building2, CheckSquare, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { JURUSAN_LIST } from '../types';

const HERO_IMAGE = '/src/assets/images/hero_campus_smk_clean_1795061383489.jpg';
const TECH_LAB_IMAGE = '/src/assets/images/vocational_tech_lab_1795061370618.jpg';
const BUSINESS_STUDIO_IMAGE = '/src/assets/images/vocational_business_studio_1795061370856.jpg';

function ImageWithFallback({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-neutral-50 to-red-100 p-8 text-center ${className || ''}`}
      >
        <Building2 className="h-10 w-10 text-red-700" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-neutral-800">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Top Navigation — Strict 3-zone contract */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-extrabold tracking-tight text-red-700 whitespace-nowrap shrink-0"
          >
            SMK Prima Unggul
          </Link>

          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600"
          >
            <a
              href="#profil"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Profil Sekolah
            </a>
            <a
              href="#jurusan"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Program Keahlian
            </a>
            <a
              href="#sistem"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sistem Absensi
            </a>
            <a
              href="#kontak"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? '/app' : '/login'}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
            >
              <span>{user ? 'Buka Aplikasi' : 'Masuk Sistem'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section id="profil" className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-red-700">
                    Sekolah Menengah Kejuruan Terpadu · Pendidikan Vokasi Unggulan
                  </p>
                  <h1 className="mt-4 text-[clamp(2.25rem,3.8vw,3.35rem)] font-extrabold leading-[1.1] tracking-tight text-neutral-950 text-balance">
                    Mencetak Generasi Vokasi Disiplin, Terampil, dan Siap Kerja.
                  </h1>
                  <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-neutral-600">
                    SMK Prima Unggul merupakan lembaga pendidikan kejuruan yang memadukan kurikulum
                    industri dengan kedisiplinan harian. Portal ini mengelola kehadiran seluruh
                    karyawan, guru, tenaga kependidikan, serta siswa lintas enam kompetensi keahlian
                    secara terpusat dan akurat.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link
                    to={user ? '/app' : '/login'}
                    className="inline-flex items-center gap-2.5 rounded-lg bg-red-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap shrink-0"
                  >
                    <span>{user ? 'Masuk ke Dashboard' : 'Masuk Portal Absensi'}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <a
                    href="#jurusan"
                    className="text-sm font-semibold text-neutral-800 underline decoration-red-700/40 underline-offset-4 transition-colors hover:text-red-700 whitespace-nowrap shrink-0"
                  >
                    Lihat Daftar Jurusan
                  </a>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="h-72 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 sm:h-88 lg:h-full lg:min-h-[380px]">
                  <ImageWithFallback
                    src={HERO_IMAGE}
                    alt="Gedung kampus SMK Prima Unggul dengan suasana siswa di pagi hari"
                    className="h-full w-full object-cover"
                    fallbackTitle="Kampus SMK Prima Unggul"
                  />
                </div>
              </div>
            </div>

            {/* 4-Column KPI Strip below hero split */}
            <div className="mt-12 grid grid-cols-2 divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-neutral-50/70 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
              <div className="p-6">
                <p className="font-mono text-2xl font-bold text-red-700 tabular-nums">3</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Bidang Keahlian Utama</p>
                <p className="mt-0.5 text-xs text-neutral-500">Teknologi, Kreatif, dan Bisnis</p>
              </div>
              <div className="p-6">
                <p className="font-mono text-2xl font-bold text-red-700 tabular-nums">6</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Kompetensi Keahlian</p>
                <p className="mt-0.5 text-xs text-neutral-500">TKJ · DKV · BC · AK · MPLB · BD</p>
              </div>
              <div className="p-6">
                <p className="font-mono text-2xl font-bold text-red-700 tabular-nums">3 Peran</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Hak Akses Terstruktur</p>
                <p className="mt-0.5 text-xs text-neutral-500">Admin, Guru & Tenaga Kependidikan</p>
              </div>
              <div className="p-6">
                <p className="font-mono text-2xl font-bold text-red-700 tabular-nums">07:30 WIB</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Standar Disiplin Masuk</p>
                <p className="mt-0.5 text-xs text-neutral-500">Pencatatan real-time harian</p>
              </div>
            </div>
          </div>
        </section>

        {/* Program Keahlian Section */}
        <section id="jurusan" className="border-b border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-[1280px] px-6 py-16">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wide text-red-700">
                  Struktur Akademik SMK Prima Unggul
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 text-balance">
                  3 Bidang Keahlian & 6 Kompetensi Keahlian Unggulan
                </h2>
                <p className="mt-3 text-base leading-relaxed text-neutral-600">
                  Kurikulum SMK Prima Unggul terbagi dalam tiga rumpun jurusan utama yang mencakup
                  enam program keahlian spesifik: TKJ, DKV, AK, BC, MPLB, dan BD.
                </p>
              </div>
              <p className="text-xs font-medium text-neutral-500 whitespace-nowrap">
                Kelas X · Kelas XI · Kelas XII
              </p>
            </div>

            {/* Asymmetric Visual Showcase */}
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="h-64 w-full overflow-hidden border-b border-neutral-200">
                  <ImageWithFallback
                    src={TECH_LAB_IMAGE}
                    alt="Praktik siswa jurusan TKJ dan Broadcasting di laboratorium SMK Prima Unggul"
                    className="h-full w-full object-cover"
                    fallbackTitle="Laboratorium Teknik & Penyiaran"
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-neutral-500">
                    Teknologi Jaringan & Media Penyiaran · Laboratorium Terstandar Industri
                  </p>
                  <h3 className="mt-1.5 text-lg font-bold text-neutral-900">
                    Infrastruktur Jaringan, Multimedia & Produksi Siaran
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    Fasilitas praktik langsung dengan perangkat server jaringan, studio kamera
                    broadcast, serta ruang produksi desain visual untuk mengasah kesiapan kerja siswa.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="h-64 w-full overflow-hidden border-b border-neutral-200">
                  <ImageWithFallback
                    src={BUSINESS_STUDIO_IMAGE}
                    alt="Siswa jurusan Desain Komunikasi Visual dan Bisnis Digital bekerja sama di studio"
                    className="h-full w-full object-cover"
                    fallbackTitle="Studio Desain & Bisnis Digital"
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-neutral-500">
                    Ekonomi Kreatif & Manajemen Bisnis · Pembelajaran Berbasis Proyek
                  </p>
                  <h3 className="mt-1.5 text-lg font-bold text-neutral-900">
                    Desain Kreatif, Tata Kelola Bisnis & Akuntansi Modern
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    Pembinaan kompetensi keuangan lembaga, administrasi perkantoran modern, hingga
                    pemasaran bisnis digital yang terhubung langsung dengan mitra dunia usaha.
                  </p>
                </div>
              </div>
            </div>

            {/* 6 Kompetensi Keahlian Grid */}
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {JURUSAN_LIST.map((item, idx) => (
                <article
                  key={item.code}
                  className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-red-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                      <span className="font-mono font-semibold text-red-700 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}. {item.code}
                      </span>
                      <span className="truncate">{item.rumpun}</span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-neutral-900">{item.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Sistem Absensi Flow Section */}
        <section id="sistem" className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-red-700">
                Alur Operasional Portal
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 text-balance">
                Satu Platform Terintegrasi untuk Seluruh Sivitas Sekolah
              </h2>
              <p className="mt-3 text-base leading-relaxed text-neutral-600">
                Setiap peran memiliki antarmuka kerja yang terarah sesuai tanggung jawab hariannya di
                lingkungan SMK Prima Unggul.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-neutral-900">Administrator</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Mengelola akun pengguna dan sinkronisasi autentikasi, mengelola data induk siswa
                  (NIS, nama, kelas, jurusan), serta memantau rekap absensi karyawan maupun siswa.
                </p>
                <p className="mt-4 text-xs text-neutral-500">
                  Dashboard · Absensi Karyawan · Absensi Siswa · Rekap · Data Siswa · User Management
                </p>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                  <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-neutral-900">Guru</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Melakukan absensi kehadiran pribadi sebagai karyawan, mencatat kehadiran siswa per
                  kelas secara massal, dan meninjau laporan rekap absensi siswa.
                </p>
                <p className="mt-4 text-xs text-neutral-500">
                  Dashboard · Absensi Karyawan · Absensi Siswa · Rekap Absensi Siswa
                </p>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-neutral-900">Tenaga Kependidikan</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Mencatat jam masuk dan jam pulang kerja secara mandiri, mengajukan keterangan izin
                  atau sakit, serta memantau ringkasan riwayat kehadiran bulanan pribadi.
                </p>
                <p className="mt-4 text-xs text-neutral-500">
                  Dashboard · Absensi Karyawan Mandiri
                </p>
              </div>
            </div>

            {/* Bottom Callout Band */}
            <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-lg bg-red-700 p-8 text-white sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  Siap Menggunakan Portal Absensi SMK Prima Unggul?
                </h3>
                <p className="mt-1.5 text-sm text-red-100">
                  Masuk menggunakan akun staf yang terdaftar atau daftarkan akun Administrator pertama.
                </p>
              </div>
              <Link
                to={user ? '/app' : '/login'}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                <span>{user ? 'Ke Dashboard' : 'Masuk ke Portal'}</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer id="kontak" className="bg-neutral-950 text-neutral-300">
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <p className="text-base font-bold text-white">SMK Prima Unggul</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Jl. Pendidikan Vokasi No. 45, Kota Administrasi, Indonesia. Jam operasional sekolah:
                Senin–Jumat, 06.30–16.00 WIB.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Program Keahlian</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Teknik Komputer & Jaringan (TKJ) · Desain Komunikasi Visual (DKV) · Broadcasting (BC)
                · Akuntansi (AK) · MPLB · Bisnis Digital (BD)
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Akses Sistem</p>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  <Link to="/login" className="text-neutral-300 hover:text-white transition-colors">
                    Halaman Login Portal
                  </Link>
                </li>
                <li>
                  <Link to="/app" className="text-neutral-300 hover:text-white transition-colors">
                    Aplikasi Absensi
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-neutral-800 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center">
            <p>© 2026 SMK Prima Unggul. Seluruh hak cipta dilindungi.</p>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
              <span>Sistem Absensi Digital Siswa & Karyawan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
