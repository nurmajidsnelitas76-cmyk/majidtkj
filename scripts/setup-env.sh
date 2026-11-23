#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "  Setup Environment Variable — SMK Prima Unggul Absensi"
echo "============================================================"
echo ""
echo "Ambil kredensial dari Supabase Dashboard -> Project Settings -> API Keys."
echo ""

read -r -p "1. Masukkan Supabase Project URL (https://xxxx.supabase.co): " INPUT_URL
read -r -p "2. Masukkan Publishable / Anon Key (sb_publishable_... atau eyJ...): " INPUT_ANON
read -r -s -p "3. Masukkan Secret / Service Role Key (sb_secret_... atau eyJ...): " INPUT_SERVICE
echo ""
read -r -p "4. Masukkan APP_URL [default: http://localhost:3000]: " INPUT_APP_URL
INPUT_APP_URL="${INPUT_APP_URL:-http://localhost:3000}"

if command -v openssl >/dev/null 2>&1; then
  GEN_SECRET="$(openssl rand -hex 32)"
else
  GEN_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
fi

cat > .env <<EOF
APP_URL="${INPUT_APP_URL}"

VITE_SUPABASE_URL="${INPUT_URL}"
SUPABASE_URL="${INPUT_URL}"

VITE_SUPABASE_ANON_KEY="${INPUT_ANON}"
SUPABASE_ANON_KEY="${INPUT_ANON}"

SUPABASE_SERVICE_ROLE_KEY="${INPUT_SERVICE}"

SESSION_SECRET="${GEN_SECRET}"
EOF

chmod 600 .env
echo ""
echo "Berhasil! File .env telah dibuat dengan SESSION_SECRET acak."
echo "Jalankan ulang server aplikasi agar konfigurasi baru aktif."
