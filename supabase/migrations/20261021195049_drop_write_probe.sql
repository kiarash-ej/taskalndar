-- public._write_probe was created by hand on the live project (no migration
-- made it): an empty one-column table with no primary key and RLS on but no
-- policies, flagged by the rls_enabled_no_policy and no_primary_key lints.
-- Nothing references it. "if exists" because a database built from these
-- migrations alone (the PGlite tests) never had it.
drop table if exists public._write_probe;
