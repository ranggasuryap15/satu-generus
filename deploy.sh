#!/bin/bash
# @file deploy.sh
# @purpose Skrip deployment produksi Satu Generus (PostgreSQL) di server tanpa Docker: pull, install, migrasi, build, restart service
# @usedBy Operator server saat rilis versi baru
# @dependencies git, npm, Node.js 22+, PostgreSQL lokal, systemd/PM2 service 'satu-generus'
# @publicFunctions N/A
# @sideEffects Menarik kode terbaru, menjalankan migrasi DB, membangun artifact, dan me-restart service
set -e

# CATATAN PENTING: jalankan skrip ini di SERVER PRODUKSI, bukan di dalam
# direktori project yang sama dengan dev server lokal. Perintah `npm run build`
# menghapus & menulis ulang folder `.svelte-kit/generated` (dari `dev/` menjadi
# `build/`). Bila dijalankan di folder yang sedang dipakai `npm run dev`
# (mis. dev server di dalam Docker dengan bind mount), dev server akan error:
#   Failed to load url /.svelte-kit/generated/dev/server.js

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