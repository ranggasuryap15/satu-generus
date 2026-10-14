#!/bin/bash
# @file deploy.sh
# @purpose Skrip deployment produksi Satu Generus (PostgreSQL) di server tanpa Docker: pull, install, migrasi, build, restart service
# @usedBy Operator server saat rilis versi baru
# @dependencies git, npm, Node.js 22+, PostgreSQL lokal, systemd service 'satu-generus'
# @publicFunctions N/A
# @sideEffects Menarik kode terbaru, menjalankan migrasi DB, membangun artifact, dan me-restart service
set -e

echo "=== Menarik Update Terbaru ==="
git pull

echo "=== Memperbarui Dependensi ==="
npm ci

echo "=== Menjalankan Migrasi PostgreSQL ==="
npm run db:migrate

echo "=== Membangun Aplikasi ==="
npm run build

echo "=== Restart Service ==="
# Sesuaikan dengan runner server Anda:
# Jika menggunakan Docker:
# docker compose restart app
# Atau jika menggunakan PM2/Node langsung:
pm2 restart satu-generus
# Atau jika menggunakan systemd:
# sudo systemctl restart satu-generus

echo "=== Deployment Selesai! ==="