-- @file scripts/reset-sequences.sql
-- @purpose Menyelaraskan sequence PostgreSQL dengan nilai id maksimum setelah transfer data eksplisit dari SQLite (mencegah error duplicate key)
-- @usedBy Operator setelah import data: psql "$DATABASE_URL" -f scripts/reset-sequences.sql
-- @dependencies PostgreSQL 10+ (pg_get_serial_sequence)
-- @sideEffects Menjalankan setval pada sequence tabel ber-primary-key serial
SELECT setval(pg_get_serial_sequence('daerah', 'id'), COALESCE((SELECT MAX(id) FROM daerah), 1));
SELECT setval(pg_get_serial_sequence('desa', 'id'), COALESCE((SELECT MAX(id) FROM desa), 1));
SELECT setval(pg_get_serial_sequence('kelompok', 'id'), COALESCE((SELECT MAX(id) FROM kelompok), 1));
SELECT setval(pg_get_serial_sequence('sub_kelompok', 'id'), COALESCE((SELECT MAX(id) FROM sub_kelompok), 1));
SELECT setval(pg_get_serial_sequence('dapukan', 'id'), COALESCE((SELECT MAX(id) FROM dapukan), 1));
SELECT setval(pg_get_serial_sequence('jadwal_pengajian_template', 'id'), COALESCE((SELECT MAX(id) FROM jadwal_pengajian_template), 1));
SELECT setval(pg_get_serial_sequence('presensi_jadwal', 'id'), COALESCE((SELECT MAX(id) FROM presensi_jadwal), 1));
