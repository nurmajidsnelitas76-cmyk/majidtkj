import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';
export type JurusanCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';
export type EmployeeStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
export type StudentStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  nip: string;
  role: UserRole;
  jabatan: string;
  created_at: string;
  updated_at: string;
}

export interface StudentRow {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jurusan: JurusanCode;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeAttendanceRow {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: EmployeeStatus;
  notes: string;
  created_at: string;
  updated_at?: string;
}

export interface StudentAttendanceRow {
  id: string;
  student_id: string;
  recorded_by: string | null;
  date: string;
  status: StudentStatus;
  notes: string;
  created_at: string;
  updated_at?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const SQLITE_FILE = path.join(DATA_DIR, 'smk_prima_unggul.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'smk_prima_unggul.json');

const SEED_STUDENTS: Omit<StudentRow, 'id' | 'created_at' | 'updated_at'>[] = [
  { nis: '202601001', nama: 'Aditya Pratama', kelas: 'X TKJ 1', jurusan: 'TKJ' },
  { nis: '202601002', nama: 'Aulia Rahmawati', kelas: 'X TKJ 1', jurusan: 'TKJ' },
  { nis: '202601003', nama: 'Bagas Kurniawan', kelas: 'XI TKJ 1', jurusan: 'TKJ' },
  { nis: '202601004', nama: 'Citra Dewi Lestari', kelas: 'X DKV 1', jurusan: 'DKV' },
  { nis: '202601005', nama: 'Dimas Saputra', kelas: 'XI DKV 1', jurusan: 'DKV' },
  { nis: '202601006', nama: 'Elsa Nurlita', kelas: 'XII DKV 1', jurusan: 'DKV' },
  { nis: '202601007', nama: 'Fajar Hidayat', kelas: 'X AK 1', jurusan: 'AK' },
  { nis: '202601008', nama: 'Gita Permatasari', kelas: 'XI AK 1', jurusan: 'AK' },
  { nis: '202601009', nama: 'Hendra Wijaya', kelas: 'X BC 1', jurusan: 'BC' },
  { nis: '202601010', nama: 'Intan Kusuma', kelas: 'XI BC 1', jurusan: 'BC' },
  { nis: '202601011', nama: 'Joko Susilo', kelas: 'X MPLB 1', jurusan: 'MPLB' },
  { nis: '202601012', nama: 'Kartika Sari', kelas: 'XI MPLB 1', jurusan: 'MPLB' },
  { nis: '202601013', nama: 'Lutfi Hakim', kelas: 'X BD 1', jurusan: 'BD' },
  { nis: '202601014', nama: 'Maya Anggraini', kelas: 'XII BD 1', jurusan: 'BD' },
];

let dbInstance: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(SQLITE_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      nip TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'tenaga_kependidikan')),
      jabatan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      nis TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      kelas TEXT NOT NULL,
      jurusan TEXT NOT NULL CHECK (jurusan IN ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS student_attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (student_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_students_jurusan_kelas ON students(jurusan, kelas);
    CREATE INDEX IF NOT EXISTS idx_emp_att_date ON employee_attendance(date);
    CREATE INDEX IF NOT EXISTS idx_stu_att_date ON student_attendance(date);
  `);

  migrateFromLegacyJsonIfNeeded(db);
  seedInitialStudentsIfEmpty(db);

  dbInstance = db;
  return db;
}

function migrateFromLegacyJsonIfNeeded(db: DatabaseSync): void {
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  const userCountRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  const stuCountRow = db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number };
  if (userCountRow.cnt > 0 || stuCountRow.cnt > 0) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as {
      users?: Array<{
        id: string;
        email: string;
        passwordHash: string;
        full_name: string;
        nip?: string;
        role: UserRole;
        jabatan?: string;
        created_at: string;
      }>;
      students?: StudentRow[];
      employee_attendance?: EmployeeAttendanceRow[];
      student_attendance?: StudentAttendanceRow[];
    };

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const insUser = db.prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, full_name, nip, role, jabatan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const u of parsed.users || []) {
        insUser.run(
          u.id,
          u.email.toLowerCase(),
          u.passwordHash,
          u.full_name,
          u.nip || '',
          u.role,
          u.jabatan || '',
          u.created_at || now,
          now
        );
      }

      const insStu = db.prepare(
        `INSERT OR IGNORE INTO students (id, nis, nama, kelas, jurusan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of parsed.students || []) {
        insStu.run(s.id, s.nis, s.nama, s.kelas, s.jurusan, s.created_at || now, now);
      }

      const insEmpAtt = db.prepare(
        `INSERT OR IGNORE INTO employee_attendance (id, user_id, date, check_in_time, check_out_time, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const a of parsed.employee_attendance || []) {
        insEmpAtt.run(
          a.id,
          a.user_id,
          a.date,
          a.check_in_time || null,
          a.check_out_time || null,
          a.status,
          a.notes || '',
          a.created_at || now,
          now
        );
      }

      const insStuAtt = db.prepare(
        `INSERT OR IGNORE INTO student_attendance (id, student_id, recorded_by, date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const a of parsed.student_attendance || []) {
        insStuAtt.run(
          a.id,
          a.student_id,
          a.recorded_by || null,
          a.date,
          a.status,
          a.notes || '',
          a.created_at || now,
          now
        );
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Gagal migrasi data JSON lama ke SQLite:', err);
  }
}

function seedInitialStudentsIfEmpty(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number };
  if (row.cnt > 0) return;

  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO students (id, nis, nama, kelas, jurusan, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  db.exec('BEGIN');
  try {
    for (const s of SEED_STUDENTS) {
      stmt.run(crypto.randomUUID(), s.nis, s.nama, s.kelas, s.jurusan, now, now);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
