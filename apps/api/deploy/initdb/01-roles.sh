#!/bin/sh
# Runs once, the first time the PostgreSQL data directory is created (docker-entrypoint-initdb.d).
#   coachcal_owner  owns the objects and runs the migrations
#   coachcal_api    what the API connects as: no table privileges, EXECUTE on the SQL functions only
# The migration grants EXECUTE to coachcal_api, so both roles must exist before it runs.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_password="$COACHCAL_OWNER_PASSWORD" -v api_password="$COACHCAL_API_PASSWORD" <<'SQL'
CREATE ROLE coachcal_owner LOGIN PASSWORD :'owner_password';
CREATE ROLE coachcal_api LOGIN PASSWORD :'api_password';
CREATE DATABASE coachcal OWNER coachcal_owner;
SQL
