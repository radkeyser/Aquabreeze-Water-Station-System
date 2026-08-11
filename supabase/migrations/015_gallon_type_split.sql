-- Track which container type (Slim/Poly) was borrowed, per row.
-- Nullable: dispenser-only borrows, and historical gallon rows created
-- before this change, won't have a known type.
alter table borrowed
  add column if not exists gallon_type text
  check (gallon_type in ('Slim', 'Poly'));

-- Split running gallon totals by type. The old `gallon` column stays as-is
-- (still updated alongside these) until every page that reads it has been
-- migrated to the split columns — nothing existing breaks in the meantime.
alter table customers
  add column if not exists gallon_slim numeric not null default 0,
  add column if not exists gallon_poly numeric not null default 0;