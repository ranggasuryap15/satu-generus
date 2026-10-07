CREATE TABLE `anggota_keluarga` (
	`id` text PRIMARY KEY NOT NULL,
	`keluarga_id` text NOT NULL,
	`user_id` text,
	`nik_encrypted` text NOT NULL,
	`status_hubungan` text NOT NULL,
	`tanggal_lahir` text NOT NULL,
	`jenis_kelamin` text NOT NULL,
	FOREIGN KEY (`keluarga_id`) REFERENCES `keluarga`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `anggota_keluarga_keluarga_id_idx` ON `anggota_keluarga` (`keluarga_id`);--> statement-breakpoint
CREATE INDEX `anggota_keluarga_user_id_idx` ON `anggota_keluarga` (`user_id`);--> statement-breakpoint
CREATE TABLE `daerah` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`provinsi` text NOT NULL,
	`kota_kabupaten` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dapukan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama_dapukan` text NOT NULL,
	`is_4s` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `desa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`daerah_id` integer NOT NULL,
	`nama` text NOT NULL,
	`kecamatan` text,
	FOREIGN KEY (`daerah_id`) REFERENCES `daerah`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `desa_daerah_id_idx` ON `desa` (`daerah_id`);--> statement-breakpoint
CREATE TABLE `kelompok` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`desa_id` integer NOT NULL,
	`nama` text NOT NULL,
	`kelurahan` text,
	FOREIGN KEY (`desa_id`) REFERENCES `desa`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kelompok_desa_id_idx` ON `kelompok` (`desa_id`);--> statement-breakpoint
CREATE TABLE `keluarga` (
	`id` text PRIMARY KEY NOT NULL,
	`no_kk_encrypted` text NOT NULL,
	`kepala_keluarga_id` text,
	`alamat_lengkap` text,
	FOREIGN KEY (`kepala_keluarga_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `keluarga_kepala_keluarga_id_idx` ON `keluarga` (`kepala_keluarga_id`);--> statement-breakpoint
CREATE TABLE `presensi_jadwal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kelompok_id` integer NOT NULL,
	`tanggal` text NOT NULL,
	`nama_kegiatan` text NOT NULL,
	FOREIGN KEY (`kelompok_id`) REFERENCES `kelompok`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `presensi_jadwal_kelompok_id_idx` ON `presensi_jadwal` (`kelompok_id`);--> statement-breakpoint
CREATE INDEX `presensi_jadwal_tanggal_idx` ON `presensi_jadwal` (`tanggal`);--> statement-breakpoint
CREATE TABLE `presensi_kehadiran` (
	`id` text PRIMARY KEY NOT NULL,
	`jadwal_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`waktu_scan` integer,
	FOREIGN KEY (`jadwal_id`) REFERENCES `presensi_jadwal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `presensi_kehadiran_jadwal_id_idx` ON `presensi_kehadiran` (`jadwal_id`);--> statement-breakpoint
CREATE INDEX `presensi_kehadiran_user_id_idx` ON `presensi_kehadiran` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `presensi_kehadiran_jadwal_user_uniq` ON `presensi_kehadiran` (`jadwal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `user_dapukan` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`dapukan_id` integer,
	`nama_dapukan_custom` text,
	`tingkat_scope` text NOT NULL,
	`daerah_id` integer,
	`desa_id` integer,
	`kelompok_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dapukan_id`) REFERENCES `dapukan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`daerah_id`) REFERENCES `daerah`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`desa_id`) REFERENCES `desa`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kelompok_id`) REFERENCES `kelompok`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_dapukan_user_id_idx` ON `user_dapukan` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_dapukan_dapukan_id_idx` ON `user_dapukan` (`dapukan_id`);--> statement-breakpoint
CREATE INDEX `user_dapukan_scope_idx` ON `user_dapukan` (`tingkat_scope`);--> statement-breakpoint
CREATE INDEX `user_dapukan_composite_scope_idx` ON `user_dapukan` (`tingkat_scope`,`daerah_id`,`desa_id`,`kelompok_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`kelompok_id` integer,
	`nama_lengkap` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	FOREIGN KEY (`kelompok_id`) REFERENCES `kelompok`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_kelompok_id_idx` ON `users` (`kelompok_id`);