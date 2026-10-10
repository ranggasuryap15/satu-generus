ALTER TABLE `anggota_keluarga` ADD `nama_lengkap` text;--> statement-breakpoint
ALTER TABLE `keluarga` ADD `is_kk` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `keluarga_is_kk_idx` ON `keluarga` (`is_kk`);