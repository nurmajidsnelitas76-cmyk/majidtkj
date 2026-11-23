import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import {
  type DbUser,
  type EmployeeAttendanceRow,
  type EmployeeStatus,
  getSqliteDb,
  type JurusanCode,
  type StudentAttendanceRow,
  type StudentRow,
  type StudentStatus,
  type UserRole,
} from './server/db.ts';

interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  nip: string;
  role: UserRole;
  jabatan: string;
  created_at: string;
}

interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'smk-prima-unggul-default-session-key';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function classifySupabaseKey(k: string): string {
  if (!k) return 'empty';
  if (k.startsWith('MY_') || k.includes('your-')) return 'placeholder';
  if (k.startsWith('sb_secret_')) return 'sb_secret';
  if (k.startsWith('sb_publishable_')) return 'sb_publishable';
  if (k.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf-8'));
      return `jwt_${payload.role || 'unknown'}`;
    } catch {
      return 'jwt_malformed';
    }
  }
  return 'other';
}

const serviceRoleKeyType = classifySupabaseKey(SUPABASE_SERVICE_ROLE_KEY);
const isValidServiceRoleKey =
  serviceRoleKeyType === 'sb_secret' || serviceRoleKeyType === 'jwt_service_role';

const isSupabaseEnabled = Boolean(
  SUPABASE_URL &&
    !SUPABASE_URL.includes('your-project-id') &&
    !SUPABASE_URL.startsWith('MY_') &&
    isValidServiceRoleKey
);

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;

const anonKeyType = classifySupabaseKey(SUPABASE_ANON_KEY);
const effectiveAnonKey =
  anonKeyType !== 'empty' && anonKeyType !== 'placeholder'
    ? SUPABASE_ANON_KEY
    : SUPABASE_SERVICE_ROLE_KEY;

if (isSupabaseEnabled) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  supabaseAnon = createClient(SUPABASE_URL, effectiveAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} else if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && serviceRoleKeyType !== 'placeholder') {
  console.warn(
    `[Database] SUPABASE_SERVICE_ROLE_KEY bertipe '${serviceRoleKeyType}', bukan 'sb_secret' atau 'service_role' JWT. Menggunakan database SQLite lokal sampai secret key Supabase diperbarui.`
  );
}

// WIB (Asia/Jakarta) helpers
function getTodayWIB(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function getNowTimeWIB(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date());
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signToken(payload: { sub: string; email: string; role: UserRole; exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(
  token: string
): { sub: string; email: string; role: UserRole; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as {
      sub: string;
      email: string;
      role: UserRole;
      exp: number;
    };
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeUser(u: DbUser): AuthenticatedUser {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    nip: u.nip,
    role: u.role,
    jabatan: u.jabatan,
    created_at: u.created_at,
  };
}

function extractBearer(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function resolveSupabaseUser(token: string): Promise<AuthenticatedUser | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const authUser = data.user;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      nip: profile.nip || '',
      role: profile.role as UserRole,
      jabatan: profile.jabatan || '',
      created_at: profile.created_at,
    };
  }

  // Fallback sync if auth user existed before profiles table trigger
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const role: UserRole =
    count === 0
      ? 'admin'
      : ((authUser.user_metadata?.role as UserRole) || 'tenaga_kependidikan');

  const newProfile: AuthenticatedUser = {
    id: authUser.id,
    email: (authUser.email || '').toLowerCase(),
    full_name:
      (authUser.user_metadata?.full_name as string) ||
      (authUser.email ? authUser.email.split('@')[0] : 'Pengguna'),
    nip: (authUser.user_metadata?.nip as string) || '',
    role,
    jabatan: (authUser.user_metadata?.jabatan as string) || '',
    created_at: authUser.created_at,
  };

  await supabaseAdmin.from('profiles').upsert(newProfile, { onConflict: 'id' });
  return newProfile;
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
      return;
    }

    if (isSupabaseEnabled) {
      const user = await resolveSupabaseUser(token);
      if (!user) {
        res.status(401).json({ error: 'Token tidak valid atau sesi telah berakhir.' });
        return;
      }
      req.user = user;
      next();
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Sesi telah berakhir. Silakan login kembali.' });
      return;
    }
    const db = getSqliteDb();
    const found = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(decoded.sub) as DbUser | undefined;
    if (!found) {
      res.status(401).json({ error: 'Akun tidak ditemukan.' });
      return;
    }
    req.user = sanitizeUser(found);
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan verifikasi sesi.' });
  }
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin akses untuk fitur ini.' });
      return;
    }
    next();
  };
}

async function startServer() {
  // Initialize local SQLite database immediately on startup when not using Supabase
  if (!isSupabaseEnabled) {
    getSqliteDb();
  }

  const app = express();
  app.use(express.json());

  // --------------------------------------------------------------------------
  // DATABASE HEALTH DIAGNOSTIC
  // --------------------------------------------------------------------------
  app.get('/api/health/db', async (_req, res) => {
    try {
      if (isSupabaseEnabled && supabaseAdmin) {
        const [authRes, profRes, stuRes, empAttRes, stuAttRes] = await Promise.all([
          supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
          supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
          supabaseAdmin.from('students').select('id', { count: 'exact', head: true }),
          supabaseAdmin.from('employee_attendance').select('id', { count: 'exact', head: true }),
          supabaseAdmin.from('student_attendance').select('id', { count: 'exact', head: true }),
        ]);

        res.json({
          ok:
            !authRes.error &&
            !profRes.error &&
            !stuRes.error &&
            !empAttRes.error &&
            !stuAttRes.error,
          backend: 'supabase',
          checks: {
            authAdmin: authRes.error ? authRes.error.message : `ok (${authRes.data.users.length})`,
            profiles: profRes.error
              ? `${profRes.error.code}: ${profRes.error.message}`
              : `ok (${profRes.count})`,
            students: stuRes.error
              ? `${stuRes.error.code}: ${stuRes.error.message}`
              : `ok (${stuRes.count})`,
            employee_attendance: empAttRes.error
              ? `${empAttRes.error.code}: ${empAttRes.error.message}`
              : `ok (${empAttRes.count})`,
            student_attendance: stuAttRes.error
              ? `${stuAttRes.error.code}: ${stuAttRes.error.message}`
              : `ok (${stuAttRes.count})`,
          },
        });
        return;
      }

      const db = getSqliteDb();
      const counts = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM employee_attendance) AS employee_attendance,
            (SELECT COUNT(*) FROM student_attendance) AS student_attendance`
        )
        .get() as Record<string, number>;
      res.json({
        ok: true,
        backend: 'sqlite',
        counts,
        ...(serviceRoleKeyType !== 'empty' && serviceRoleKeyType !== 'placeholder'
          ? {
              supabaseNotice: `SUPABASE_SERVICE_ROLE_KEY bertipe '${serviceRoleKeyType}', harap gunakan Secret key (sb_secret_...) atau legacy service_role JWT.`,
            }
          : {}),
      });
    } catch (err) {
      console.error('DB health check failed:', err);
      res.status(500).json({ ok: false, error: 'Database tidak dapat diakses.' });
    }
  });

  // --------------------------------------------------------------------------
  // AUTH ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/auth/bootstrap-status', async (_req, res) => {
    try {
      if (isSupabaseEnabled && supabaseAdmin) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) throw error;
        const total = data.users.length;
        res.json({ hasUsers: total > 0, totalUsers: total, backend: 'supabase' });
        return;
      }
      const db = getSqliteDb();
      const row = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
      res.json({ hasUsers: row.cnt > 0, totalUsers: row.cnt, backend: 'sqlite' });
    } catch (err) {
      console.error('Bootstrap status error:', err);
      res.status(500).json({ error: 'Gagal memeriksa status sistem.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, full_name, nip = '', jabatan = '' } = req.body || {};
      if (!email || !password || !full_name) {
        res.status(400).json({ error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      if (isSupabaseEnabled && supabaseAdmin && supabaseAnon) {
        const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        const isFirstUser = !existingList?.users || existingList.users.length === 0;
        const assignedRole: UserRole = isFirstUser ? 'admin' : 'tenaga_kependidikan';

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: {
            full_name: String(full_name).trim(),
            nip: String(nip).trim(),
            jabatan:
              String(jabatan).trim() || (isFirstUser ? 'Administrator Sistem' : 'Staf Sekolah'),
            role: assignedRole,
          },
        });

        if (createError || !created.user) {
          res.status(400).json({ error: createError?.message || 'Gagal mendaftarkan akun.' });
          return;
        }

        const profileRow: AuthenticatedUser = {
          id: created.user.id,
          email: normalizedEmail,
          full_name: String(full_name).trim(),
          nip: String(nip).trim(),
          role: assignedRole,
          jabatan:
            String(jabatan).trim() || (isFirstUser ? 'Administrator Sistem' : 'Staf Sekolah'),
          created_at: created.user.created_at,
        };

        const { error: upsertErr } = await supabaseAdmin
          .from('profiles')
          .upsert(profileRow, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;

        const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
          email: normalizedEmail,
          password: String(password),
        });

        if (signInErr || !signInData.session) {
          res.status(201).json({ user: profileRow, token: null });
          return;
        }

        res.status(201).json({
          token: signInData.session.access_token,
          user: profileRow,
        });
        return;
      }

      // Local SQLite transaction
      const db = getSqliteDb();
      const existing = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .get(normalizedEmail);
      if (existing) {
        res.status(409).json({ error: 'Email sudah terdaftar.' });
        return;
      }

      const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
      const isFirstUser = countRow.cnt === 0;
      const role: UserRole = isFirstUser ? 'admin' : 'tenaga_kependidikan';
      const now = new Date().toISOString();
      const newUser: DbUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        password_hash: hashPassword(String(password)),
        full_name: String(full_name).trim(),
        nip: String(nip).trim(),
        role,
        jabatan: String(jabatan).trim() || (isFirstUser ? 'Administrator Sistem' : 'Staf Sekolah'),
        created_at: now,
        updated_at: now,
      };

      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, nip, role, jabatan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newUser.id,
        newUser.email,
        newUser.password_hash,
        newUser.full_name,
        newUser.nip,
        newUser.role,
        newUser.jabatan,
        newUser.created_at,
        newUser.updated_at
      );

      const token = signToken({
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({ token, user: sanitizeUser(newUser) });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mendaftarkan akun.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
        return;
      }
      const normalizedEmail = String(email).trim().toLowerCase();

      if (isSupabaseEnabled && supabaseAnon) {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
          email: normalizedEmail,
          password: String(password),
        });
        if (error || !data.session) {
          const msg = error?.message || '';
          if (msg.toLowerCase().includes('email not confirmed')) {
            res.status(401).json({
              error:
                'Email akun belum dikonfirmasi di Supabase Authentication. Aktifkan konfirmasi email atau Auto Confirm di Supabase Dashboard.',
            });
            return;
          }
          if (msg.toLowerCase().includes('invalid api key')) {
            res.status(500).json({
              error:
                'Konfigurasi SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY tidak valid. Periksa Project Settings → API Keys di Supabase.',
            });
            return;
          }
          res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
          return;
        }
        const user = await resolveSupabaseUser(data.session.access_token);
        if (!user) {
          res.status(401).json({ error: 'Profil pengguna tidak ditemukan.' });
          return;
        }
        res.json({ token: data.session.access_token, user });
        return;
      }

      const db = getSqliteDb();
      const found = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
        .get(normalizedEmail) as DbUser | undefined;
      if (!found || !verifyPassword(String(password), found.password_hash)) {
        res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
        return;
      }

      const token = signToken({
        sub: found.id,
        email: found.email,
        role: found.role,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ token, user: sanitizeUser(found) });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Gagal masuk ke sistem.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  // --------------------------------------------------------------------------
  // USER MANAGEMENT (ADMIN ONLY — FULL SYNC & HARD DELETE TO SUPABASE AUTH)
  // --------------------------------------------------------------------------
  app.get('/api/admin/users', requireAuth, requireRole(['admin']), async (_req, res) => {
    try {
      if (isSupabaseEnabled && supabaseAdmin) {
        const [{ data: authList, error: authErr }, { data: profiles, error: profErr }] =
          await Promise.all([
            supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
            supabaseAdmin.from('profiles').select('*'),
          ]);

        if (authErr) throw authErr;
        if (profErr) throw profErr;

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        const merged: AuthenticatedUser[] = (authList?.users || []).map((u) => {
          const prof = profileMap.get(u.id);
          return {
            id: u.id,
            email: prof?.email || u.email || '',
            full_name:
              prof?.full_name ||
              (u.user_metadata?.full_name as string) ||
              (u.email ? u.email.split('@')[0] : 'Pengguna'),
            nip: prof?.nip || (u.user_metadata?.nip as string) || '',
            role: (prof?.role || u.user_metadata?.role || 'tenaga_kependidikan') as UserRole,
            jabatan: prof?.jabatan || (u.user_metadata?.jabatan as string) || '',
            created_at: prof?.created_at || u.created_at,
          };
        });

        merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
        res.json({ users: merged });
        return;
      }

      const db = getSqliteDb();
      const rows = db
        .prepare('SELECT * FROM users ORDER BY created_at ASC')
        .all() as unknown as DbUser[];
      res.json({ users: rows.map(sanitizeUser) });
    } catch (err) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Gagal memuat daftar pengguna.' });
    }
  });

  app.post('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { email, password, full_name, role, nip = '', jabatan = '' } = req.body || {};
      if (!email || !password || !full_name || !role) {
        res.status(400).json({ error: 'Nama, email, password, dan role wajib diisi.' });
        return;
      }
      if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
        res.status(400).json({ error: 'Role tidak valid.' });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      if (isSupabaseEnabled && supabaseAdmin) {
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: {
            full_name: String(full_name).trim(),
            role,
            nip: String(nip).trim(),
            jabatan: String(jabatan).trim(),
          },
        });
        if (createError || !created.user) {
          res
            .status(400)
            .json({ error: createError?.message || 'Gagal menambah user di Supabase Auth.' });
          return;
        }

        const profileRow: AuthenticatedUser = {
          id: created.user.id,
          email: normalizedEmail,
          full_name: String(full_name).trim(),
          nip: String(nip).trim(),
          role: role as UserRole,
          jabatan: String(jabatan).trim(),
          created_at: created.user.created_at,
        };
        const { error: upsertErr } = await supabaseAdmin
          .from('profiles')
          .upsert(profileRow, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;

        res.status(201).json({ user: profileRow });
        return;
      }

      const db = getSqliteDb();
      const existing = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .get(normalizedEmail);
      if (existing) {
        res.status(409).json({ error: 'Email sudah terdaftar.' });
        return;
      }

      const now = new Date().toISOString();
      const newUser: DbUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        password_hash: hashPassword(String(password)),
        full_name: String(full_name).trim(),
        nip: String(nip).trim(),
        role: role as UserRole,
        jabatan: String(jabatan).trim(),
        created_at: now,
        updated_at: now,
      };
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, nip, role, jabatan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newUser.id,
        newUser.email,
        newUser.password_hash,
        newUser.full_name,
        newUser.nip,
        newUser.role,
        newUser.jabatan,
        newUser.created_at,
        newUser.updated_at
      );

      res.status(201).json({ user: sanitizeUser(newUser) });
    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ error: 'Gagal menambahkan pengguna.' });
    }
  });

  app.patch(
    '/api/admin/users/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthedRequest, res) => {
      try {
        const { id } = req.params;
        const { email, password, full_name, role, nip, jabatan } = req.body || {};

        if (role && !['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
          res.status(400).json({ error: 'Role tidak valid.' });
          return;
        }
        if (password && String(password).length < 6) {
          res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
          return;
        }

        if (isSupabaseEnabled && supabaseAdmin) {
          const { data: existingAuth, error: fetchErr } =
            await supabaseAdmin.auth.admin.getUserById(id);
          if (fetchErr || !existingAuth.user) {
            res.status(404).json({ error: 'Pengguna tidak ditemukan di Supabase Auth.' });
            return;
          }

          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          const nextEmail = email
            ? String(email).trim().toLowerCase()
            : existingAuth.user.email || '';
          const nextFullName =
            full_name !== undefined
              ? String(full_name).trim()
              : existingProfile?.full_name ||
                (existingAuth.user.user_metadata?.full_name as string) ||
                '';
          const nextRole: UserRole = (role ||
            existingProfile?.role ||
            'tenaga_kependidikan') as UserRole;
          const nextNip = nip !== undefined ? String(nip).trim() : existingProfile?.nip || '';
          const nextJabatan =
            jabatan !== undefined ? String(jabatan).trim() : existingProfile?.jabatan || '';

          const updateAuthPayload: {
            email?: string;
            password?: string;
            user_metadata: Record<string, string>;
          } = {
            email: nextEmail,
            user_metadata: {
              full_name: nextFullName,
              role: nextRole,
              nip: nextNip,
              jabatan: nextJabatan,
            },
          };
          if (password) {
            updateAuthPayload.password = String(password);
          }

          const { error: authUpdErr } = await supabaseAdmin.auth.admin.updateUserById(
            id,
            updateAuthPayload
          );
          if (authUpdErr) {
            res.status(400).json({ error: authUpdErr.message });
            return;
          }

          const updatedProfile: AuthenticatedUser = {
            id,
            email: nextEmail,
            full_name: nextFullName,
            nip: nextNip,
            role: nextRole,
            jabatan: nextJabatan,
            created_at: existingProfile?.created_at || existingAuth.user.created_at,
          };

          const { error: profUpdErr } = await supabaseAdmin
            .from('profiles')
            .upsert(updatedProfile, { onConflict: 'id' });
          if (profUpdErr) throw profUpdErr;

          res.json({ user: updatedProfile });
          return;
        }

        const db = getSqliteDb();
        const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
        if (!target) {
          res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
          return;
        }

        const nextEmail = email ? String(email).trim().toLowerCase() : target.email;
        if (nextEmail !== target.email) {
          const conflict = db
            .prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?')
            .get(nextEmail, id);
          if (conflict) {
            res.status(409).json({ error: 'Email sudah digunakan oleh akun lain.' });
            return;
          }
        }

        const nextFullName = full_name !== undefined ? String(full_name).trim() : target.full_name;
        const nextRole: UserRole = (role || target.role) as UserRole;
        const nextNip = nip !== undefined ? String(nip).trim() : target.nip;
        const nextJabatan = jabatan !== undefined ? String(jabatan).trim() : target.jabatan;
        const nextHash = password ? hashPassword(String(password)) : target.password_hash;
        const now = new Date().toISOString();

        db.prepare(
          `UPDATE users
           SET email = ?, password_hash = ?, full_name = ?, nip = ?, role = ?, jabatan = ?, updated_at = ?
           WHERE id = ?`
        ).run(nextEmail, nextHash, nextFullName, nextNip, nextRole, nextJabatan, now, id);

        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as DbUser;
        res.json({ user: sanitizeUser(updated) });
      } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Gagal memperbarui data pengguna.' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthedRequest, res) => {
      try {
        const { id } = req.params;
        if (req.user?.id === id) {
          res
            .status(400)
            .json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
          return;
        }

        if (isSupabaseEnabled && supabaseAdmin) {
          // Bersihkan relasi terlebih dahulu agar auth.admin.deleteUser bebas error FK
          await supabaseAdmin
            .from('student_attendance')
            .update({ recorded_by: null })
            .eq('recorded_by', id);
          await supabaseAdmin.from('employee_attendance').delete().eq('user_id', id);
          await supabaseAdmin.from('profiles').delete().eq('id', id);

          // Hard delete user dari Supabase Authentication (shouldSoftDelete = false)
          const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(id, false);
          if (delAuthErr) {
            res.status(400).json({ error: delAuthErr.message });
            return;
          }
          res.json({ deleted: true, id });
          return;
        }

        const db = getSqliteDb();
        const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
        if (!existing) {
          res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
          return;
        }
        // Foreign keys ON DELETE CASCADE & ON DELETE SET NULL clean related rows automatically
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ deleted: true, id });
      } catch (err) {
        console.error('Hard delete user error:', err);
        res.status(500).json({ error: 'Gagal menghapus pengguna secara permanen.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // STUDENTS CRUD (ADMIN MANAGES, GURU READS FOR ATTENDANCE)
  // --------------------------------------------------------------------------
  app.get('/api/students', requireAuth, requireRole(['admin', 'guru']), async (req, res) => {
    try {
      const jurusan = req.query.jurusan ? String(req.query.jurusan) : '';
      const kelas = req.query.kelas ? String(req.query.kelas) : '';
      const search = req.query.search ? String(req.query.search).toLowerCase() : '';

      if (isSupabaseEnabled && supabaseAdmin) {
        let query = supabaseAdmin.from('students').select('*').order('kelas').order('nama');
        if (jurusan && jurusan !== 'ALL') query = query.eq('jurusan', jurusan);
        if (kelas && kelas !== 'ALL') query = query.eq('kelas', kelas);
        const { data, error } = await query;
        if (error) throw error;
        let list = (data || []) as StudentRow[];
        if (search) {
          list = list.filter(
            (s) =>
              s.nama.toLowerCase().includes(search) ||
              s.nis.toLowerCase().includes(search) ||
              s.kelas.toLowerCase().includes(search)
          );
        }
        res.json({ students: list });
        return;
      }

      const db = getSqliteDb();
      let list = db
        .prepare('SELECT * FROM students ORDER BY kelas ASC, nama ASC')
        .all() as unknown as StudentRow[];
      if (jurusan && jurusan !== 'ALL') {
        list = list.filter((s) => s.jurusan === jurusan);
      }
      if (kelas && kelas !== 'ALL') {
        list = list.filter((s) => s.kelas === kelas);
      }
      if (search) {
        list = list.filter(
          (s) =>
            s.nama.toLowerCase().includes(search) ||
            s.nis.toLowerCase().includes(search) ||
            s.kelas.toLowerCase().includes(search)
        );
      }
      res.json({ students: list });
    } catch (err) {
      console.error('List students error:', err);
      res.status(500).json({ error: 'Gagal memuat data siswa.' });
    }
  });

  app.post('/api/students', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { nis, nama, kelas, jurusan } = req.body || {};
      if (!nis || !nama || !kelas || !jurusan) {
        res.status(400).json({ error: 'NIS, nama siswa, kelas, dan jurusan wajib diisi.' });
        return;
      }
      if (!['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'].includes(jurusan)) {
        res.status(400).json({ error: 'Jurusan tidak valid.' });
        return;
      }

      const cleanNis = String(nis).trim();
      const cleanNama = String(nama).trim();
      const cleanKelas = String(kelas).trim();

      if (isSupabaseEnabled && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('students')
          .insert({
            nis: cleanNis,
            nama: cleanNama,
            kelas: cleanKelas,
            jurusan,
          })
          .select()
          .single();
        if (error) {
          const msg =
            error.code === '23505' ? `NIS ${cleanNis} sudah terdaftar.` : error.message;
          res.status(error.code === '23505' ? 409 : 400).json({ error: msg });
          return;
        }
        res.status(201).json({ student: data });
        return;
      }

      const db = getSqliteDb();
      const dup = db.prepare('SELECT id FROM students WHERE nis = ?').get(cleanNis);
      if (dup) {
        res.status(409).json({ error: `NIS ${cleanNis} sudah terdaftar.` });
        return;
      }

      const now = new Date().toISOString();
      const row: StudentRow = {
        id: crypto.randomUUID(),
        nis: cleanNis,
        nama: cleanNama,
        kelas: cleanKelas,
        jurusan: jurusan as JurusanCode,
        created_at: now,
        updated_at: now,
      };
      db.prepare(
        `INSERT INTO students (id, nis, nama, kelas, jurusan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(row.id, row.nis, row.nama, row.kelas, row.jurusan, row.created_at, row.updated_at!);

      res.status(201).json({ student: row });
    } catch (err) {
      console.error('Create student error:', err);
      res.status(500).json({ error: 'Gagal menambahkan data siswa.' });
    }
  });

  app.patch('/api/students/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { nis, nama, kelas, jurusan } = req.body || {};
      if (jurusan && !['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'].includes(jurusan)) {
        res.status(400).json({ error: 'Jurusan tidak valid.' });
        return;
      }

      if (isSupabaseEnabled && supabaseAdmin) {
        const updates: Partial<StudentRow> = {};
        if (nis !== undefined) updates.nis = String(nis).trim();
        if (nama !== undefined) updates.nama = String(nama).trim();
        if (kelas !== undefined) updates.kelas = String(kelas).trim();
        if (jurusan !== undefined) updates.jurusan = jurusan as JurusanCode;

        const { data, error } = await supabaseAdmin
          .from('students')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) {
          const msg =
            error.code === '23505' ? 'NIS sudah digunakan siswa lain.' : error.message;
          res.status(error.code === '23505' ? 409 : 400).json({ error: msg });
          return;
        }
        res.json({ student: data });
        return;
      }

      const db = getSqliteDb();
      const target = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as
        | StudentRow
        | undefined;
      if (!target) {
        res.status(404).json({ error: 'Siswa tidak ditemukan.' });
        return;
      }

      const nextNis = nis !== undefined ? String(nis).trim() : target.nis;
      if (nextNis !== target.nis) {
        const dup = db.prepare('SELECT id FROM students WHERE nis = ? AND id != ?').get(nextNis, id);
        if (dup) {
          res.status(409).json({ error: `NIS ${nextNis} sudah digunakan siswa lain.` });
          return;
        }
      }

      const nextNama = nama !== undefined ? String(nama).trim() : target.nama;
      const nextKelas = kelas !== undefined ? String(kelas).trim() : target.kelas;
      const nextJurusan = (jurusan || target.jurusan) as JurusanCode;
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE students SET nis = ?, nama = ?, kelas = ?, jurusan = ?, updated_at = ? WHERE id = ?`
      ).run(nextNis, nextNama, nextKelas, nextJurusan, now, id);

      const updated = db
        .prepare('SELECT * FROM students WHERE id = ?')
        .get(id) as unknown as StudentRow;
      res.json({ student: updated });
    } catch (err) {
      console.error('Update student error:', err);
      res.status(500).json({ error: 'Gagal memperbarui data siswa.' });
    }
  });

  app.delete('/api/students/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      if (isSupabaseEnabled && supabaseAdmin) {
        const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
        if (error) throw error;
        res.json({ deleted: true, id });
        return;
      }

      const db = getSqliteDb();
      const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Siswa tidak ditemukan.' });
        return;
      }
      db.prepare('DELETE FROM students WHERE id = ?').run(id);
      res.json({ deleted: true, id });
    } catch (err) {
      console.error('Delete student error:', err);
      res.status(500).json({ error: 'Gagal menghapus data siswa.' });
    }
  });

  // --------------------------------------------------------------------------
  // EMPLOYEE SELF-ATTENDANCE & RECAP
  // --------------------------------------------------------------------------
  app.get('/api/attendance/employees/today', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const today = getTodayWIB();
      const userId = req.user!.id;

      if (isSupabaseEnabled && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('employee_attendance')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();
        if (error) throw error;
        res.json({ today, record: data || null });
        return;
      }

      const db = getSqliteDb();
      const record =
        (db
          .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND date = ?')
          .get(userId, today) as EmployeeAttendanceRow | undefined) || null;
      res.json({ today, record });
    } catch (err) {
      console.error('Employee today error:', err);
      res.status(500).json({ error: 'Gagal memuat status absensi hari ini.' });
    }
  });

  app.post('/api/attendance/employees/check-in', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const today = getTodayWIB();
      const nowTime = getNowTimeWIB();
      const requestedStatus = req.body?.status as EmployeeStatus | undefined;
      const notes = String(req.body?.notes || '').trim();

      let finalStatus: EmployeeStatus = 'Hadir';
      if (requestedStatus === 'Izin' || requestedStatus === 'Sakit') {
        finalStatus = requestedStatus;
      } else {
        finalStatus = nowTime > '07:30:00' ? 'Terlambat' : 'Hadir';
      }

      const checkInTime =
        finalStatus === 'Izin' || finalStatus === 'Sakit' ? null : nowTime;

      if (isSupabaseEnabled && supabaseAdmin) {
        const { data: existing } = await supabaseAdmin
          .from('employee_attendance')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();

        if (existing) {
          res.status(409).json({ error: 'Anda sudah mengisi absensi hari ini.' });
          return;
        }

        const { data, error } = await supabaseAdmin
          .from('employee_attendance')
          .insert({
            user_id: userId,
            date: today,
            check_in_time: checkInTime,
            check_out_time: null,
            status: finalStatus,
            notes,
          })
          .select()
          .single();

        if (error) throw error;
        res.status(201).json({ record: data });
        return;
      }

      const db = getSqliteDb();
      const existing = db
        .prepare('SELECT id FROM employee_attendance WHERE user_id = ? AND date = ?')
        .get(userId, today);
      if (existing) {
        res.status(409).json({ error: 'Anda sudah mengisi absensi hari ini.' });
        return;
      }

      const now = new Date().toISOString();
      const row: EmployeeAttendanceRow = {
        id: crypto.randomUUID(),
        user_id: userId,
        date: today,
        check_in_time: checkInTime,
        check_out_time: null,
        status: finalStatus,
        notes,
        created_at: now,
        updated_at: now,
      };
      db.prepare(
        `INSERT INTO employee_attendance (id, user_id, date, check_in_time, check_out_time, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.user_id,
        row.date,
        row.check_in_time,
        row.check_out_time,
        row.status,
        row.notes,
        row.created_at,
        row.updated_at!
      );

      res.status(201).json({ record: row });
    } catch (err) {
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Gagal mencatat absen masuk.' });
    }
  });

  app.post('/api/attendance/employees/check-out', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const today = getTodayWIB();
      const nowTime = getNowTimeWIB();

      if (isSupabaseEnabled && supabaseAdmin) {
        const { data: existing, error: findErr } = await supabaseAdmin
          .from('employee_attendance')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) {
          res.status(404).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
          return;
        }
        if (existing.status === 'Izin' || existing.status === 'Sakit') {
          res.status(400).json({ error: 'Status Izin/Sakit tidak memerlukan absen pulang.' });
          return;
        }
        if (existing.check_out_time) {
          res.status(409).json({ error: 'Anda sudah melakukan absen pulang hari ini.' });
          return;
        }

        const { data, error } = await supabaseAdmin
          .from('employee_attendance')
          .update({ check_out_time: nowTime })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        res.json({ record: data });
        return;
      }

      const db = getSqliteDb();
      const existing = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND date = ?')
        .get(userId, today) as EmployeeAttendanceRow | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }
      if (existing.status === 'Izin' || existing.status === 'Sakit') {
        res.status(400).json({ error: 'Status Izin/Sakit tidak memerlukan absen pulang.' });
        return;
      }
      if (existing.check_out_time) {
        res.status(409).json({ error: 'Anda sudah melakukan absen pulang hari ini.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE employee_attendance SET check_out_time = ?, updated_at = ? WHERE id = ?'
      ).run(nowTime, now, existing.id);

      const updated = db
        .prepare('SELECT * FROM employee_attendance WHERE id = ?')
        .get(existing.id) as unknown as EmployeeAttendanceRow;
      res.json({ record: updated });
    } catch (err) {
      console.error('Check-out error:', err);
      res.status(500).json({ error: 'Gagal mencatat absen pulang.' });
    }
  });

  app.get('/api/attendance/employees', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const scope = String(req.query.scope || 'mine');
      const startDate = req.query.startDate ? String(req.query.startDate) : '';
      const endDate = req.query.endDate ? String(req.query.endDate) : '';
      const status = req.query.status ? String(req.query.status) : '';
      const roleFilter = req.query.role ? String(req.query.role) : '';
      const search = req.query.search ? String(req.query.search).toLowerCase() : '';

      const canViewAll = req.user!.role === 'admin' && scope === 'all';

      if (isSupabaseEnabled && supabaseAdmin) {
        let query = supabaseAdmin
          .from('employee_attendance')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (!canViewAll) query = query.eq('user_id', req.user!.id);
        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);
        if (status && status !== 'ALL') query = query.eq('status', status);

        const [{ data: attData, error: attErr }, { data: profilesData, error: profErr }] =
          await Promise.all([query, supabaseAdmin.from('profiles').select('*')]);

        if (attErr) throw attErr;
        if (profErr) throw profErr;

        const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));
        let records = (attData || []).map((row) => {
          const prof = profileMap.get(row.user_id);
          return {
            id: row.id,
            user_id: row.user_id,
            date: row.date,
            check_in_time: row.check_in_time,
            check_out_time: row.check_out_time,
            status: row.status,
            notes: row.notes || '',
            created_at: row.created_at,
            employee_name: prof?.full_name || '-',
            employee_role: (prof?.role || 'tenaga_kependidikan') as UserRole,
            employee_nip: prof?.nip || '',
            employee_jabatan: prof?.jabatan || '',
          };
        });

        if (roleFilter && roleFilter !== 'ALL') {
          records = records.filter((r) => r.employee_role === roleFilter);
        }
        if (search) {
          records = records.filter(
            (r) =>
              r.employee_name.toLowerCase().includes(search) ||
              r.employee_nip.toLowerCase().includes(search)
          );
        }
        res.json({ records });
        return;
      }

      const db = getSqliteDb();
      const rows = db
        .prepare(
          `SELECT ea.*, u.full_name AS employee_name, u.role AS employee_role, u.nip AS employee_nip, u.jabatan AS employee_jabatan
           FROM employee_attendance ea
           LEFT JOIN users u ON u.id = ea.user_id
           ${canViewAll ? '' : 'WHERE ea.user_id = ?'}
           ORDER BY ea.date DESC, ea.created_at DESC`
        )
        .all(...(canViewAll ? [] : [req.user!.id])) as unknown as Array<
        EmployeeAttendanceRow & {
          employee_name: string | null;
          employee_role: UserRole | null;
          employee_nip: string | null;
          employee_jabatan: string | null;
        }
      >;

      let records = rows.map((r) => ({
        ...r,
        employee_name: r.employee_name || '-',
        employee_role: (r.employee_role || 'tenaga_kependidikan') as UserRole,
        employee_nip: r.employee_nip || '',
        employee_jabatan: r.employee_jabatan || '',
      }));

      if (startDate) records = records.filter((r) => r.date >= startDate);
      if (endDate) records = records.filter((r) => r.date <= endDate);
      if (status && status !== 'ALL') records = records.filter((r) => r.status === status);
      if (roleFilter && roleFilter !== 'ALL') {
        records = records.filter((r) => r.employee_role === roleFilter);
      }
      if (search) {
        records = records.filter(
          (r) =>
            r.employee_name.toLowerCase().includes(search) ||
            r.employee_nip.toLowerCase().includes(search)
        );
      }
      res.json({ records });
    } catch (err) {
      console.error('List employee attendance error:', err);
      res.status(500).json({ error: 'Gagal memuat riwayat absensi karyawan.' });
    }
  });

  // --------------------------------------------------------------------------
  // STUDENT ATTENDANCE (ADMIN & GURU)
  // --------------------------------------------------------------------------
  app.get(
    '/api/attendance/students',
    requireAuth,
    requireRole(['admin', 'guru']),
    async (req, res) => {
      try {
        const date = req.query.date ? String(req.query.date) : '';
        const startDate = req.query.startDate ? String(req.query.startDate) : '';
        const endDate = req.query.endDate ? String(req.query.endDate) : '';
        const jurusan = req.query.jurusan ? String(req.query.jurusan) : '';
        const kelas = req.query.kelas ? String(req.query.kelas) : '';
        const status = req.query.status ? String(req.query.status) : '';
        const search = req.query.search ? String(req.query.search).toLowerCase() : '';

        if (isSupabaseEnabled && supabaseAdmin) {
          let query = supabaseAdmin
            .from('student_attendance')
            .select('*')
            .order('date', { ascending: false });

          if (date) query = query.eq('date', date);
          if (startDate) query = query.gte('date', startDate);
          if (endDate) query = query.lte('date', endDate);
          if (status && status !== 'ALL') query = query.eq('status', status);

          const [
            { data: attData, error: attErr },
            { data: stuData, error: stuErr },
            { data: profData, error: profErr },
          ] = await Promise.all([
            query,
            supabaseAdmin.from('students').select('*'),
            supabaseAdmin.from('profiles').select('id, full_name'),
          ]);

          if (attErr) throw attErr;
          if (stuErr) throw stuErr;
          if (profErr) throw profErr;

          const studentMap = new Map((stuData || []).map((s) => [s.id, s]));
          const profMap = new Map((profData || []).map((p) => [p.id, p]));

          let records = (attData || []).map((row) => {
            const st = studentMap.get(row.student_id);
            const rec = row.recorded_by ? profMap.get(row.recorded_by) : null;
            return {
              id: row.id,
              student_id: row.student_id,
              recorded_by: row.recorded_by,
              date: row.date,
              status: row.status,
              notes: row.notes || '',
              created_at: row.created_at,
              student_nis: st?.nis || '-',
              student_name: st?.nama || '-',
              student_kelas: st?.kelas || '-',
              student_jurusan: (st?.jurusan || 'TKJ') as JurusanCode,
              recorder_name: rec?.full_name || 'Sistem',
            };
          });

          if (jurusan && jurusan !== 'ALL') {
            records = records.filter((r) => r.student_jurusan === jurusan);
          }
          if (kelas && kelas !== 'ALL') {
            records = records.filter((r) => r.student_kelas === kelas);
          }
          if (search) {
            records = records.filter(
              (r) =>
                r.student_name.toLowerCase().includes(search) ||
                r.student_nis.toLowerCase().includes(search)
            );
          }
          records.sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              a.student_kelas.localeCompare(b.student_kelas) ||
              a.student_name.localeCompare(b.student_name)
          );
          res.json({ records });
          return;
        }

        const db = getSqliteDb();
        const rows = db
          .prepare(
            `SELECT sa.*, s.nis AS student_nis, s.nama AS student_name, s.kelas AS student_kelas, s.jurusan AS student_jurusan, u.full_name AS recorder_name
             FROM student_attendance sa
             LEFT JOIN students s ON s.id = sa.student_id
             LEFT JOIN users u ON u.id = sa.recorded_by
             ORDER BY sa.date DESC, s.kelas ASC, s.nama ASC`
          )
          .all() as unknown as Array<
          StudentAttendanceRow & {
            student_nis: string | null;
            student_name: string | null;
            student_kelas: string | null;
            student_jurusan: JurusanCode | null;
            recorder_name: string | null;
          }
        >;

        let records = rows.map((r) => ({
          ...r,
          student_nis: r.student_nis || '-',
          student_name: r.student_name || '-',
          student_kelas: r.student_kelas || '-',
          student_jurusan: (r.student_jurusan || 'TKJ') as JurusanCode,
          recorder_name: r.recorder_name || 'Sistem',
        }));

        if (date) records = records.filter((r) => r.date === date);
        if (startDate) records = records.filter((r) => r.date >= startDate);
        if (endDate) records = records.filter((r) => r.date <= endDate);
        if (status && status !== 'ALL') records = records.filter((r) => r.status === status);
        if (jurusan && jurusan !== 'ALL') {
          records = records.filter((r) => r.student_jurusan === jurusan);
        }
        if (kelas && kelas !== 'ALL') {
          records = records.filter((r) => r.student_kelas === kelas);
        }
        if (search) {
          records = records.filter(
            (r) =>
              r.student_name.toLowerCase().includes(search) ||
              r.student_nis.toLowerCase().includes(search)
          );
        }

        res.json({ records });
      } catch (err) {
        console.error('List student attendance error:', err);
        res.status(500).json({ error: 'Gagal memuat rekap absensi siswa.' });
      }
    }
  );

  app.post(
    '/api/attendance/students/batch',
    requireAuth,
    requireRole(['admin', 'guru']),
    async (req: AuthedRequest, res) => {
      try {
        const { date, records } = req.body || {};
        const targetDate = String(date || getTodayWIB());
        if (!Array.isArray(records) || records.length === 0) {
          res.status(400).json({ error: 'Daftar absensi siswa tidak boleh kosong.' });
          return;
        }

        for (const item of records) {
          if (!item.student_id || !['Hadir', 'Izin', 'Sakit', 'Alpa'].includes(item.status)) {
            res.status(400).json({ error: 'Format status absensi siswa tidak valid.' });
            return;
          }
        }

        if (isSupabaseEnabled && supabaseAdmin) {
          const payload = records.map(
            (r: { student_id: string; status: StudentStatus; notes?: string }) => ({
              student_id: r.student_id,
              recorded_by: req.user!.id,
              date: targetDate,
              status: r.status,
              notes: String(r.notes || '').trim(),
            })
          );

          const { data, error } = await supabaseAdmin
            .from('student_attendance')
            .upsert(payload, { onConflict: 'student_id,date' })
            .select();

          if (error) throw error;
          res.json({ saved: data?.length || payload.length });
          return;
        }

        const db = getSqliteDb();
        const now = new Date().toISOString();
        const upsertStmt = db.prepare(
          `INSERT INTO student_attendance (id, student_id, recorded_by, date, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(student_id, date) DO UPDATE SET
             status = excluded.status,
             notes = excluded.notes,
             recorded_by = excluded.recorded_by,
             updated_at = excluded.updated_at`
        );

        db.exec('BEGIN');
        try {
          for (const item of records as {
            student_id: string;
            status: StudentStatus;
            notes?: string;
          }[]) {
            upsertStmt.run(
              crypto.randomUUID(),
              item.student_id,
              req.user!.id,
              targetDate,
              item.status,
              String(item.notes || '').trim(),
              now,
              now
            );
          }
          db.exec('COMMIT');
        } catch (txErr) {
          db.exec('ROLLBACK');
          throw txErr;
        }

        res.json({ saved: records.length });
      } catch (err) {
        console.error('Batch student attendance error:', err);
        res.status(500).json({ error: 'Gagal menyimpan absensi siswa.' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // DASHBOARD STATS
  // --------------------------------------------------------------------------
  app.get('/api/dashboard', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const today = getTodayWIB();
      const currentMonth = today.slice(0, 7);
      const user = req.user!;

      if (isSupabaseEnabled && supabaseAdmin) {
        const [
          { data: myToday },
          { data: myMonth },
          { count: totalStudents },
          { count: totalUsers },
          { data: studentsAll },
          { data: empTodayAll },
          { data: stuTodayAll },
        ] = await Promise.all([
          supabaseAdmin
            .from('employee_attendance')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle(),
          supabaseAdmin
            .from('employee_attendance')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', `${currentMonth}-01`),
          supabaseAdmin.from('students').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('students').select('jurusan'),
          user.role === 'admin'
            ? supabaseAdmin.from('employee_attendance').select('*').eq('date', today)
            : Promise.resolve({ data: [] }),
          user.role === 'admin' || user.role === 'guru'
            ? supabaseAdmin.from('student_attendance').select('status').eq('date', today)
            : Promise.resolve({ data: [] }),
        ]);

        const jurusanCounts: Record<string, number> = {
          TKJ: 0,
          DKV: 0,
          AK: 0,
          BC: 0,
          MPLB: 0,
          BD: 0,
        };
        for (const s of studentsAll || []) {
          if (s.jurusan in jurusanCounts) jurusanCounts[s.jurusan] += 1;
        }

        const empList = empTodayAll || [];
        const stuList = stuTodayAll || [];

        res.json({
          today,
          myToday: myToday || null,
          myMonthStats: {
            hadir: (myMonth || []).filter((r) => r.status === 'Hadir').length,
            terlambat: (myMonth || []).filter((r) => r.status === 'Terlambat').length,
            izin: (myMonth || []).filter((r) => r.status === 'Izin').length,
            sakit: (myMonth || []).filter((r) => r.status === 'Sakit').length,
          },
          totals: {
            students: totalStudents || 0,
            employees: totalUsers || 0,
          },
          employeeTodaySummary: {
            totalCheckedIn: empList.length,
            hadir: empList.filter((r) => r.status === 'Hadir').length,
            terlambat: empList.filter((r) => r.status === 'Terlambat').length,
            izinSakit: empList.filter((r) => r.status === 'Izin' || r.status === 'Sakit').length,
          },
          studentTodaySummary: {
            recorded: stuList.length,
            hadir: stuList.filter((r) => r.status === 'Hadir').length,
            izin: stuList.filter((r) => r.status === 'Izin').length,
            sakit: stuList.filter((r) => r.status === 'Sakit').length,
            alpa: stuList.filter((r) => r.status === 'Alpa').length,
          },
          jurusanCounts,
        });
        return;
      }

      const db = getSqliteDb();
      const myToday =
        (db
          .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND date = ?')
          .get(user.id, today) as EmployeeAttendanceRow | undefined) || null;
      const myMonth = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND date LIKE ?')
        .all(user.id, `${currentMonth}%`) as unknown as EmployeeAttendanceRow[];
      const empToday = db
        .prepare('SELECT * FROM employee_attendance WHERE date = ?')
        .all(today) as unknown as EmployeeAttendanceRow[];
      const stuToday = db
        .prepare('SELECT * FROM student_attendance WHERE date = ?')
        .all(today) as unknown as StudentAttendanceRow[];
      const studentsAll = db.prepare('SELECT jurusan FROM students').all() as Array<{
        jurusan: string;
      }>;
      const empTotalRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };

      const jurusanCounts: Record<string, number> = {
        TKJ: 0,
        DKV: 0,
        AK: 0,
        BC: 0,
        MPLB: 0,
        BD: 0,
      };
      for (const s of studentsAll) {
        if (s.jurusan in jurusanCounts) jurusanCounts[s.jurusan] += 1;
      }

      res.json({
        today,
        myToday,
        myMonthStats: {
          hadir: myMonth.filter((r) => r.status === 'Hadir').length,
          terlambat: myMonth.filter((r) => r.status === 'Terlambat').length,
          izin: myMonth.filter((r) => r.status === 'Izin').length,
          sakit: myMonth.filter((r) => r.status === 'Sakit').length,
        },
        totals: {
          students: studentsAll.length,
          employees: empTotalRow.cnt,
        },
        employeeTodaySummary: {
          totalCheckedIn: empToday.length,
          hadir: empToday.filter((r) => r.status === 'Hadir').length,
          terlambat: empToday.filter((r) => r.status === 'Terlambat').length,
          izinSakit: empToday.filter((r) => r.status === 'Izin' || r.status === 'Sakit').length,
        },
        studentTodaySummary: {
          recorded: stuToday.length,
          hadir: stuToday.filter((r) => r.status === 'Hadir').length,
          izin: stuToday.filter((r) => r.status === 'Izin').length,
          sakit: stuToday.filter((r) => r.status === 'Sakit').length,
          alpa: stuToday.filter((r) => r.status === 'Alpa').length,
        },
        jurusanCounts,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Gagal memuat ringkasan dashboard.' });
    }
  });

  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `SMK Prima Unggul server running on http://0.0.0.0:${PORT} (DB: ${
        isSupabaseEnabled ? 'Supabase PostgreSQL' : 'SQLite (.data/smk_prima_unggul.db)'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
