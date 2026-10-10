PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_anggota_keluarga` (
	`id` text PRIMARY KEY NOT NULL,
	`keluarga_id` text NOT NULL,
	`user_id` text,
	`nama_lengkap` text,
	`nik_encrypted` text,
	`status_hubungan` text NOT NULL,
	`tanggal_lahir` text NOT NULL,
	`jenis_kelamin` text NOT NULL,
	FOREIGN KEY (`keluarga_id`) REFERENCES `keluarga`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_anggota_keluarga`("id", "keluarga_id", "user_id", "nama_lengkap", "nik_encrypted", "status_hubungan", "tanggal_lahir", "jenis_kelamin") SELECT "id", "keluarga_id", "user_id", "nama_lengkap", "nik_encrypted", "status_hubungan", "tanggal_lahir", "jenis_kelamin" FROM `anggota_keluarga`;--> statement-breakpoint
DROP TABLE `anggota_keluarga`;--> statement-breakpoint
ALTER TABLE `__new_anggota_keluarga` RENAME TO `anggota_keluarga`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `anggota_keluarga_keluarga_id_idx` ON `anggota_keluarga` (`keluarga_id`);--> statement-breakpoint
CREATE INDEX `anggota_keluarga_user_id_idx` ON `anggota_keluarga` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_keluarga` (
	`id` text PRIMARY KEY NOT NULL,
	`is_kk` integer DEFAULT true NOT NULL,
	`no_kk_encrypted` text,
	`kepala_keluarga_id` text,
	`alamat_lengkap` text,
	FOREIGN KEY (`kepala_keluarga_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_keluarga`("id", "is_kk", "no_kk_encrypted", "kepala_keluarga_id", "alamat_lengkap") SELECT "id", "is_kk", "no_kk_encrypted", "kepala_keluarga_id", "alamat_lengkap" FROM `keluarga`;--> statement-breakpoint
DROP TABLE `keluarga`;--> statement-breakpoint
ALTER TABLE `__new_keluarga` RENAME TO `keluarga`;--> statement-breakpoint
CREATE INDEX `keluarga_kepala_keluarga_id_idx` ON `keluarga` (`kepala_keluarga_id`);--> statement-breakpoint
CREATE INDEX `keluarga_is_kk_idx` ON `keluarga` (`is_kk`);