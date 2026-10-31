-- Staging only. Separate explicit rollback approval required; never restore/delete valuation rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $rollback$
DECLARE
  target regclass := to_regclass('public.ptv_nilai_inventaris');
  owned_index regclass := to_regclass('public.ptv_nilai_inventaris_asset_unique_167');
  key_number smallint;
BEGIN
  IF owned_index IS NULL THEN RETURN; END IF;
  IF target IS NULL THEN RAISE EXCEPTION 'VALUATION167_ROLLBACK_TARGET_MISSING'; END IF;
  LOCK TABLE public.ptv_nilai_inventaris IN SHARE ROW EXCLUSIVE MODE;
  SELECT attnum INTO key_number FROM pg_attribute WHERE attrelid=target AND attname='inventaris_id' AND NOT attisdropped;
  IF NOT EXISTS(SELECT FROM pg_index x WHERE x.indexrelid=owned_index AND x.indrelid=target
    AND x.indisunique AND x.indisvalid AND x.indisready AND x.indimmediate
    AND x.indnkeyatts=1 AND x.indkey[0]=key_number AND x.indpred IS NULL AND x.indexprs IS NULL
    AND obj_description(x.indexrelid,'pg_class')='PTVPRO-167: valuation asset unique; non-destructive; approved Staging only')
  THEN RAISE EXCEPTION 'VALUATION167_ROLLBACK_NOT_OWNED'; END IF;
  DROP INDEX public.ptv_nilai_inventaris_asset_unique_167 RESTRICT;
END
$rollback$;
COMMIT;
