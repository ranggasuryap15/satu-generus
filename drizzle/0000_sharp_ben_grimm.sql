CREATE TABLE "anggota_keluarga" (
	"id" text PRIMARY KEY NOT NULL,
	"keluarga_id" text NOT NULL,
	"user_id" text,
	"nama_lengkap" text,
	"nik_encrypted" text,
	"status_hubungan" text NOT NULL,
	"tanggal_lahir" text NOT NULL,
	"jenis_kelamin" text NOT NULL,
	"tempat_lahir" text,
	"profesi" text,
	"no_telepon" text,
	"status_generus" text,
	"status_pernikahan" text,
	"status_jamaah" text DEFAULT 'Aktif',
	"isrun" text DEFAULT 'Tidak',
	"golongan_darah" text
);
--> statement-breakpoint
CREATE TABLE "daerah" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"provinsi" text NOT NULL,
	"kota_kabupaten" text NOT NULL,
	"lokasi_nama" text,
	"latitude" text,
	"longitude" text,
	"radius_meter" integer DEFAULT 100,
	"gmaps_url" text
);
--> statement-breakpoint
CREATE TABLE "dapukan" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama_dapukan" text NOT NULL,
	"is_4s" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desa" (
	"id" serial PRIMARY KEY NOT NULL,
	"daerah_id" integer NOT NULL,
	"nama" text NOT NULL,
	"kecamatan" text,
	"lokasi_nama" text,
	"latitude" text,
	"longitude" text,
	"radius_meter" integer DEFAULT 100,
	"gmaps_url" text,
	"lokasi_kelompok_id" integer
);
--> statement-breakpoint
CREATE TABLE "jadwal_pengajian_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"tingkat_scope" text NOT NULL,
	"desa_id" integer,
	"kelompok_id" integer,
	"tipe_pola" text NOT NULL,
	"minggu_ke" integer,
	"hari" integer NOT NULL,
	"jam_mulai" text NOT NULL,
	"jam_selesai" text,
	"nama_kegiatan" text NOT NULL,
	"detail_materi" text,
	"is_libur" boolean DEFAULT false NOT NULL,
	"lokasi_nama" text,
	"latitude" text,
	"longitude" text,
	"radius_meter" integer DEFAULT 100,
	"gmaps_url" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jenis_shodaqoh" (
	"id" text PRIMARY KEY NOT NULL,
	"tingkat_scope" text NOT NULL,
	"daerah_id" integer,
	"desa_id" integer,
	"kelompok_id" integer,
	"nama" text NOT NULL,
	"deskripsi" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kelompok" (
	"id" serial PRIMARY KEY NOT NULL,
	"desa_id" integer NOT NULL,
	"nama" text NOT NULL,
	"kelurahan" text,
	"lokasi_nama" text,
	"latitude" text,
	"longitude" text,
	"radius_meter" integer DEFAULT 100,
	"gmaps_url" text
);
--> statement-breakpoint
CREATE TABLE "keluarga" (
	"id" text PRIMARY KEY NOT NULL,
	"is_kk" boolean DEFAULT true NOT NULL,
	"no_kk_encrypted" text,
	"kepala_keluarga_id" text,
	"alamat_lengkap" text
);
--> statement-breakpoint
CREATE TABLE "pos_anggaran_infaq" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"deskripsi" text,
	"tingkat_scope" text DEFAULT 'Kelompok' NOT NULL,
	"desa_id" integer,
	"kelompok_id" integer,
	"is_wajib" boolean DEFAULT false NOT NULL,
	"tipe_alokasi" text DEFAULT 'nominal' NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presensi_jadwal" (
	"id" serial PRIMARY KEY NOT NULL,
	"tingkat_scope" text DEFAULT 'Kelompok' NOT NULL,
	"desa_id" integer,
	"kelompok_id" integer,
	"template_id" integer,
	"tanggal" text NOT NULL,
	"jam_mulai" text DEFAULT '08:00' NOT NULL,
	"jam_selesai" text,
	"nama_kegiatan" text NOT NULL,
	"detail_materi" text,
	"is_override" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'aktif' NOT NULL,
	"lokasi_nama" text,
	"latitude" text,
	"longitude" text,
	"radius_meter" integer DEFAULT 100,
	"gmaps_url" text
);
--> statement-breakpoint
CREATE TABLE "presensi_kehadiran" (
	"id" text PRIMARY KEY NOT NULL,
	"jadwal_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"metode_kehadiran" text,
	"foto_url" text,
	"latitude" text,
	"longitude" text,
	"alamat_lokasi" text,
	"keterangan_izin" text,
	"status_approval" text DEFAULT 'Disetujui',
	"catatan_admin" text,
	"waktu_scan" bigint
);
--> statement-breakpoint
CREATE TABLE "rekening_wilayah" (
	"id" text PRIMARY KEY NOT NULL,
	"tingkat_scope" text NOT NULL,
	"daerah_id" integer,
	"desa_id" integer,
	"kelompok_id" integer,
	"nama_bank" text NOT NULL,
	"nomor_rekening" text NOT NULL,
	"atas_nama" text NOT NULL,
	"tipe_tujuan" text DEFAULT 'Infaq & Shodaqoh' NOT NULL,
	"qris_image_url" text,
	"keterangan" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_kelompok" (
	"id" serial PRIMARY KEY NOT NULL,
	"kelompok_id" integer NOT NULL,
	"nama" text NOT NULL,
	"keterangan" text
);
--> statement-breakpoint
CREATE TABLE "template_infaq_bundle" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"nama" text NOT NULL,
	"nominal" integer DEFAULT 0 NOT NULL,
	"deskripsi" text,
	"urutan" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_infaq_group" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"nama" text NOT NULL,
	"keterangan" text,
	"urutan" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_infaq_group_pos" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"pos_id" text NOT NULL,
	"nominal_jumlah" integer DEFAULT 0 NOT NULL,
	"nominal_keterangan" integer DEFAULT 0 NOT NULL,
	"keterangan_teks" text,
	"urutan" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_infaq_jamaah" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"anggota_keluarga_id" text NOT NULL,
	"group_id" text,
	"bundle_id" text,
	"nominal_target" integer DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"catatan" text,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_infaq_pos" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"pos_id" text NOT NULL,
	"nominal_target" integer DEFAULT 0,
	"persentase_split" integer DEFAULT 0,
	"urutan" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_infaq_rutin" (
	"id" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"tingkat_scope" text DEFAULT 'Kelompok' NOT NULL,
	"desa_id" integer,
	"kelompok_id" integer,
	"tahun" integer NOT NULL,
	"bulan_mulai" integer DEFAULT 1 NOT NULL,
	"bulan_selesai" integer DEFAULT 12 NOT NULL,
	"nominal_minimum_default" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'aktif' NOT NULL,
	"catatan" text,
	"created_by_user_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaksi_fr" (
	"id" text PRIMARY KEY NOT NULL,
	"anggota_keluarga_id" text NOT NULL,
	"kelompok_id" integer NOT NULL,
	"desa_id" integer,
	"daerah_id" integer,
	"tahun" integer NOT NULL,
	"bulan" integer NOT NULL,
	"nominal" integer DEFAULT 0 NOT NULL,
	"status_bayar" text DEFAULT 'Lunas' NOT NULL,
	"catatan" text,
	"updated_by_user_id" text,
	"template_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaksi_shodaqoh" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"nama_pengirim" text NOT NULL,
	"no_telepon" text,
	"tingkat_scope" text NOT NULL,
	"daerah_id" integer,
	"desa_id" integer,
	"kelompok_id" integer,
	"rekening_wilayah_id" text,
	"jenis_shodaqoh_id" text,
	"nama_jenis_shodaqoh" text NOT NULL,
	"nominal" integer NOT NULL,
	"tanggal_transfer" text NOT NULL,
	"metode_pembayaran" text DEFAULT 'Transfer Bank' NOT NULL,
	"bukti_transfer_url" text,
	"catatan" text,
	"status_approval" text DEFAULT 'Menunggu Persetujuan' NOT NULL,
	"alasan_penolakan" text,
	"approved_by_user_id" text,
	"approved_at" integer,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_dapukan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dapukan_id" integer,
	"nama_dapukan_custom" text,
	"tingkat_scope" text NOT NULL,
	"daerah_id" integer,
	"desa_id" integer,
	"kelompok_id" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"kelompok_id" integer,
	"nama_lengkap" text NOT NULL,
	"email" text,
	"no_telepon" text,
	"password_hash" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "anggota_keluarga" ADD CONSTRAINT "anggota_keluarga_keluarga_id_keluarga_id_fk" FOREIGN KEY ("keluarga_id") REFERENCES "public"."keluarga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anggota_keluarga" ADD CONSTRAINT "anggota_keluarga_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desa" ADD CONSTRAINT "desa_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_pengajian_template" ADD CONSTRAINT "jadwal_pengajian_template_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_pengajian_template" ADD CONSTRAINT "jadwal_pengajian_template_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenis_shodaqoh" ADD CONSTRAINT "jenis_shodaqoh_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenis_shodaqoh" ADD CONSTRAINT "jenis_shodaqoh_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jenis_shodaqoh" ADD CONSTRAINT "jenis_shodaqoh_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kelompok" ADD CONSTRAINT "kelompok_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keluarga" ADD CONSTRAINT "keluarga_kepala_keluarga_id_users_id_fk" FOREIGN KEY ("kepala_keluarga_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_anggaran_infaq" ADD CONSTRAINT "pos_anggaran_infaq_parent_id_pos_anggaran_infaq_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pos_anggaran_infaq"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_anggaran_infaq" ADD CONSTRAINT "pos_anggaran_infaq_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_anggaran_infaq" ADD CONSTRAINT "pos_anggaran_infaq_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presensi_jadwal" ADD CONSTRAINT "presensi_jadwal_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presensi_jadwal" ADD CONSTRAINT "presensi_jadwal_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presensi_jadwal" ADD CONSTRAINT "presensi_jadwal_template_id_jadwal_pengajian_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."jadwal_pengajian_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presensi_kehadiran" ADD CONSTRAINT "presensi_kehadiran_jadwal_id_presensi_jadwal_id_fk" FOREIGN KEY ("jadwal_id") REFERENCES "public"."presensi_jadwal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presensi_kehadiran" ADD CONSTRAINT "presensi_kehadiran_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rekening_wilayah" ADD CONSTRAINT "rekening_wilayah_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rekening_wilayah" ADD CONSTRAINT "rekening_wilayah_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rekening_wilayah" ADD CONSTRAINT "rekening_wilayah_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_kelompok" ADD CONSTRAINT "sub_kelompok_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_bundle" ADD CONSTRAINT "template_infaq_bundle_template_id_template_infaq_rutin_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_infaq_rutin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_group" ADD CONSTRAINT "template_infaq_group_template_id_template_infaq_rutin_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_infaq_rutin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_group_pos" ADD CONSTRAINT "template_infaq_group_pos_group_id_template_infaq_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."template_infaq_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_group_pos" ADD CONSTRAINT "template_infaq_group_pos_pos_id_pos_anggaran_infaq_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."pos_anggaran_infaq"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_jamaah" ADD CONSTRAINT "template_infaq_jamaah_template_id_template_infaq_rutin_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_infaq_rutin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_jamaah" ADD CONSTRAINT "template_infaq_jamaah_anggota_keluarga_id_anggota_keluarga_id_fk" FOREIGN KEY ("anggota_keluarga_id") REFERENCES "public"."anggota_keluarga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_jamaah" ADD CONSTRAINT "template_infaq_jamaah_group_id_template_infaq_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."template_infaq_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_jamaah" ADD CONSTRAINT "template_infaq_jamaah_bundle_id_template_infaq_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."template_infaq_bundle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_pos" ADD CONSTRAINT "template_infaq_pos_template_id_template_infaq_rutin_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_infaq_rutin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_pos" ADD CONSTRAINT "template_infaq_pos_pos_id_pos_anggaran_infaq_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."pos_anggaran_infaq"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_rutin" ADD CONSTRAINT "template_infaq_rutin_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_rutin" ADD CONSTRAINT "template_infaq_rutin_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_infaq_rutin" ADD CONSTRAINT "template_infaq_rutin_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_anggota_keluarga_id_anggota_keluarga_id_fk" FOREIGN KEY ("anggota_keluarga_id") REFERENCES "public"."anggota_keluarga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_fr" ADD CONSTRAINT "transaksi_fr_template_id_template_infaq_rutin_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_infaq_rutin"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_rekening_wilayah_id_rekening_wilayah_id_fk" FOREIGN KEY ("rekening_wilayah_id") REFERENCES "public"."rekening_wilayah"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_jenis_shodaqoh_id_jenis_shodaqoh_id_fk" FOREIGN KEY ("jenis_shodaqoh_id") REFERENCES "public"."jenis_shodaqoh"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi_shodaqoh" ADD CONSTRAINT "transaksi_shodaqoh_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dapukan" ADD CONSTRAINT "user_dapukan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dapukan" ADD CONSTRAINT "user_dapukan_dapukan_id_dapukan_id_fk" FOREIGN KEY ("dapukan_id") REFERENCES "public"."dapukan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dapukan" ADD CONSTRAINT "user_dapukan_daerah_id_daerah_id_fk" FOREIGN KEY ("daerah_id") REFERENCES "public"."daerah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dapukan" ADD CONSTRAINT "user_dapukan_desa_id_desa_id_fk" FOREIGN KEY ("desa_id") REFERENCES "public"."desa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dapukan" ADD CONSTRAINT "user_dapukan_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kelompok_id_kelompok_id_fk" FOREIGN KEY ("kelompok_id") REFERENCES "public"."kelompok"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anggota_keluarga_keluarga_id_idx" ON "anggota_keluarga" USING btree ("keluarga_id");--> statement-breakpoint
CREATE INDEX "anggota_keluarga_user_id_idx" ON "anggota_keluarga" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anggota_keluarga_status_generus_idx" ON "anggota_keluarga" USING btree ("status_generus");--> statement-breakpoint
CREATE INDEX "desa_daerah_id_idx" ON "desa" USING btree ("daerah_id");--> statement-breakpoint
CREATE INDEX "desa_lokasi_kelompok_id_idx" ON "desa" USING btree ("lokasi_kelompok_id");--> statement-breakpoint
CREATE INDEX "jadwal_template_scope_idx" ON "jadwal_pengajian_template" USING btree ("tingkat_scope");--> statement-breakpoint
CREATE INDEX "jadwal_template_desa_idx" ON "jadwal_pengajian_template" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "jadwal_template_kelompok_idx" ON "jadwal_pengajian_template" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "jenis_shodaqoh_scope_idx" ON "jenis_shodaqoh" USING btree ("tingkat_scope");--> statement-breakpoint
CREATE INDEX "jenis_shodaqoh_kelompok_idx" ON "jenis_shodaqoh" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "jenis_shodaqoh_desa_idx" ON "jenis_shodaqoh" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "jenis_shodaqoh_daerah_idx" ON "jenis_shodaqoh" USING btree ("daerah_id");--> statement-breakpoint
CREATE INDEX "kelompok_desa_id_idx" ON "kelompok" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "keluarga_kepala_keluarga_id_idx" ON "keluarga" USING btree ("kepala_keluarga_id");--> statement-breakpoint
CREATE INDEX "keluarga_is_kk_idx" ON "keluarga" USING btree ("is_kk");--> statement-breakpoint
CREATE INDEX "pos_anggaran_parent_idx" ON "pos_anggaran_infaq" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pos_anggaran_scope_idx" ON "pos_anggaran_infaq" USING btree ("tingkat_scope","kelompok_id","desa_id");--> statement-breakpoint
CREATE INDEX "pos_anggaran_urutan_idx" ON "pos_anggaran_infaq" USING btree ("urutan");--> statement-breakpoint
CREATE INDEX "presensi_jadwal_kelompok_id_idx" ON "presensi_jadwal" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "presensi_jadwal_desa_id_idx" ON "presensi_jadwal" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "presensi_jadwal_tanggal_idx" ON "presensi_jadwal" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "presensi_jadwal_scope_idx" ON "presensi_jadwal" USING btree ("tingkat_scope");--> statement-breakpoint
CREATE INDEX "presensi_kehadiran_jadwal_id_idx" ON "presensi_kehadiran" USING btree ("jadwal_id");--> statement-breakpoint
CREATE INDEX "presensi_kehadiran_user_id_idx" ON "presensi_kehadiran" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presensi_kehadiran_status_approval_idx" ON "presensi_kehadiran" USING btree ("status_approval");--> statement-breakpoint
CREATE UNIQUE INDEX "presensi_kehadiran_jadwal_user_uniq" ON "presensi_kehadiran" USING btree ("jadwal_id","user_id");--> statement-breakpoint
CREATE INDEX "rekening_wilayah_scope_idx" ON "rekening_wilayah" USING btree ("tingkat_scope");--> statement-breakpoint
CREATE INDEX "rekening_wilayah_daerah_id_idx" ON "rekening_wilayah" USING btree ("daerah_id");--> statement-breakpoint
CREATE INDEX "rekening_wilayah_desa_id_idx" ON "rekening_wilayah" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "rekening_wilayah_kelompok_id_idx" ON "rekening_wilayah" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "sub_kelompok_kelompok_id_idx" ON "sub_kelompok" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "template_bundle_template_idx" ON "template_infaq_bundle" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_group_template_idx" ON "template_infaq_group" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "group_pos_group_idx" ON "template_infaq_group_pos" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_pos_unik_idx" ON "template_infaq_group_pos" USING btree ("group_id","pos_id");--> statement-breakpoint
CREATE INDEX "template_jamaah_template_idx" ON "template_infaq_jamaah" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_jamaah_group_idx" ON "template_infaq_jamaah" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "template_jamaah_bundle_idx" ON "template_infaq_jamaah" USING btree ("bundle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_jamaah_unik_idx" ON "template_infaq_jamaah" USING btree ("template_id","anggota_keluarga_id");--> statement-breakpoint
CREATE INDEX "template_pos_template_idx" ON "template_infaq_pos" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_pos_unik_idx" ON "template_infaq_pos" USING btree ("template_id","pos_id");--> statement-breakpoint
CREATE INDEX "template_infaq_periode_idx" ON "template_infaq_rutin" USING btree ("tahun","bulan_mulai","bulan_selesai");--> statement-breakpoint
CREATE INDEX "template_infaq_scope_idx" ON "template_infaq_rutin" USING btree ("tingkat_scope","kelompok_id","status");--> statement-breakpoint
CREATE INDEX "transaksi_fr_anggota_idx" ON "transaksi_fr" USING btree ("anggota_keluarga_id");--> statement-breakpoint
CREATE INDEX "transaksi_fr_kelompok_idx" ON "transaksi_fr" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "transaksi_fr_template_idx" ON "transaksi_fr" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "transaksi_fr_periode_idx" ON "transaksi_fr" USING btree ("tahun","bulan");--> statement-breakpoint
CREATE INDEX "transaksi_fr_desa_periode_idx" ON "transaksi_fr" USING btree ("desa_id","tahun","bulan");--> statement-breakpoint
CREATE UNIQUE INDEX "transaksi_fr_unik_periode_idx" ON "transaksi_fr" USING btree ("anggota_keluarga_id","tahun","bulan");--> statement-breakpoint
CREATE INDEX "transaksi_shodaqoh_kelompok_idx" ON "transaksi_shodaqoh" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "transaksi_shodaqoh_desa_idx" ON "transaksi_shodaqoh" USING btree ("desa_id");--> statement-breakpoint
CREATE INDEX "transaksi_shodaqoh_daerah_idx" ON "transaksi_shodaqoh" USING btree ("daerah_id");--> statement-breakpoint
CREATE INDEX "transaksi_shodaqoh_status_idx" ON "transaksi_shodaqoh" USING btree ("status_approval");--> statement-breakpoint
CREATE INDEX "transaksi_shodaqoh_tanggal_idx" ON "transaksi_shodaqoh" USING btree ("tanggal_transfer");--> statement-breakpoint
CREATE INDEX "user_dapukan_user_id_idx" ON "user_dapukan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_dapukan_dapukan_id_idx" ON "user_dapukan" USING btree ("dapukan_id");--> statement-breakpoint
CREATE INDEX "user_dapukan_scope_idx" ON "user_dapukan" USING btree ("tingkat_scope");--> statement-breakpoint
CREATE INDEX "user_dapukan_composite_scope_idx" ON "user_dapukan" USING btree ("tingkat_scope","daerah_id","desa_id","kelompok_id");--> statement-breakpoint
CREATE INDEX "users_kelompok_id_idx" ON "users" USING btree ("kelompok_id");--> statement-breakpoint
CREATE INDEX "users_no_telepon_idx" ON "users" USING btree ("no_telepon");