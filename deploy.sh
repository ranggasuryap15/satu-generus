#!/bin/bash
set -e

echo "=== Menarik Update Terbaru ==="
git pull origin main

echo "=== Memperbarui Dependensi ==="
npm install

echo "=== Membangun Aplikasi ==="
npm run build

echo "=== Restart Service ==="
# Sesuaikan dengan runner server Anda:
# Jika menggunakan Docker:
docker compose restart app
# Atau jika menggunakan PM2/Node langsung:
# pm2 restart satu-generus

echo "=== Deployment Selesai! ==="