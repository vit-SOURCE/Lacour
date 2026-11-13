CREATE DATABASE IF NOT EXISTS lacour CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lacour;
CREATE TABLE IF NOT EXISTS app_docs (
  collection VARCHAR(80) NOT NULL,
  doc_id VARCHAR(200) NOT NULL,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, doc_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS app_codes (
  code_type ENUM('admin','staff') NOT NULL PRIMARY KEY,
  code_value VARCHAR(64) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS app_limits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bucket VARCHAR(80) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_limit (bucket,ip,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_recovery (
  profile_id VARCHAR(200) NOT NULL PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  tries INT NOT NULL DEFAULT 0,
  sent_at BIGINT NOT NULL
) ENGINE=InnoDB;

-- Codes fixes LaCour : administrateur et employés.
INSERT INTO app_codes (code_type, code_value) VALUES
  ('admin', 'admin123'),
  ('staff', 'employ123')
ON DUPLICATE KEY UPDATE code_value = VALUES(code_value);
