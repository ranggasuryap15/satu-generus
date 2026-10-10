ALTER TABLE `anggota_keluarga` ADD `tempat_lahir` text;--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `profesi` text;--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `no_telepon` text;--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `status_generus` text;--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `status_pernikahan` text;--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `status_jamaah` text DEFAULT 'Aktif';--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `isrun` text DEFAULT 'Tidak';--> statement-breakpoint
ALTER TABLE `anggota_keluarga` ADD `golongan_darah` text;--> statement-breakpoint
CREATE INDEX `anggota_keluarga_status_generus_idx` ON `anggota_keluarga` (`status_generus`);--> statement-breakpoint
ALTER TABLE `users` ADD `no_telepon` text;--> statement-breakpoint
CREATE INDEX `users_no_telepon_idx` ON `users` (`no_telepon`);