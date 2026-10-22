#!/bin/bash
set -euo pipefail
ROOT_PW="$(cat /run/secrets/mysql_root_password)"
APP_PW="$(cat /run/secrets/mysql_app_password)"
mysql -uroot -p"${ROOT_PW}" <<SQL
CREATE DATABASE IF NOT EXISTS videodb;
CREATE TABLE IF NOT EXISTS videodb.users (
  username VARCHAR(50) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('uploader','viewer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS videodb.videos (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  filename VARCHAR(64) NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE USER 'authapp'@'%'  IDENTIFIED BY '${APP_PW}';
CREATE USER 'videoapp'@'%' IDENTIFIED BY '${APP_PW}';
GRANT SELECT, INSERT ON videodb.users  TO 'authapp'@'%';
GRANT SELECT, INSERT ON videodb.videos TO 'videoapp'@'%';
SQL