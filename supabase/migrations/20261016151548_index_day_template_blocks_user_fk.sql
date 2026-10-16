-- day_template_blocks_user_id_fkey (user_id -> auth.users) had no index whose
-- leading column is user_id (unindexed_foreign_keys lint 0001): the composite
-- (template_id, user_id) index doesn't cover it, so deleting a user scanned
-- the table.
create index day_template_blocks_user_idx on public.day_template_blocks (user_id);
