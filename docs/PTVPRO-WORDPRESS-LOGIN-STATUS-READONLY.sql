-- MySQL/MariaDB WordPress only, NOT Supabase/PostgreSQL.
-- OPTIONAL evidence collection for future login activation; NOT required for inactive-only provisioning.
-- Run in phpMyAdmin for the actual progresiftv.id WordPress database.
-- Replace wp_ with its existing table prefix if different. Do not create tables or change options.
-- Export this SELECT result as CSV into the operator's existing private directory outside Git.
START TRANSACTION READ ONLY;
SELECT 'option' AS source_kind, NULL AS post_id, NULL AS post_status,
       option_name AS evidence_key, option_value AS evidence_value
FROM wp_options
WHERE option_name='ptv_kru_account_status_map'
UNION ALL
SELECT 'cpt' AS source_kind, p.ID AS post_id, p.post_status,
       pm.meta_key AS evidence_key, pm.meta_value AS evidence_value
FROM wp_posts p JOIN wp_postmeta pm ON pm.post_id=p.ID
WHERE p.post_type='kru_ptv'
  AND pm.meta_key IN ('ptv_kru_sb_id','ptv_kru_crew_id','ptv_kru_username','ptv_kru_status_akun');
ROLLBACK;
