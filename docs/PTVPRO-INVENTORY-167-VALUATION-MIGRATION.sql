-- Staging swadgljnyelsjstqqxbm only. Execute only after explicit approval of these exact bytes.
-- Adds one current-valuation-per-asset invariant; does not modify rows, grants or policies.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $migration$
DECLARE
  target regclass := to_regclass('public.ptv_nilai_inventaris');
  reserved regclass := to_regclass('public.ptv_nilai_inventaris_asset_unique_167');
  key_number smallint;
  marker constant text := 'PTVPRO-167: valuation asset unique; non-destructive; approved Staging only';
BEGIN
  IF target IS NULL OR to_regclass('public.ptv_inventaris') IS NULL THEN
    RAISE EXCEPTION 'VALUATION167_REQUIRED_TABLE_MISSING';
  END IF;
  LOCK TABLE public.ptv_nilai_inventaris IN SHARE ROW EXCLUSIVE MODE;
  SELECT attnum INTO key_number FROM pg_attribute
    WHERE attrelid=target AND attname='inventaris_id' AND NOT attisdropped;
  IF key_number IS NULL THEN RAISE EXCEPTION 'VALUATION167_KEY_MISSING'; END IF;
  IF EXISTS(SELECT FROM public.ptv_nilai_inventaris WHERE inventaris_id IS NULL) THEN
    RAISE EXCEPTION 'VALUATION167_NULL_KEY';
  END IF;
  IF EXISTS(SELECT FROM public.ptv_nilai_inventaris GROUP BY inventaris_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'VALUATION167_DUPLICATE_KEY';
  END IF;
  IF EXISTS(SELECT FROM public.ptv_nilai_inventaris v LEFT JOIN public.ptv_inventaris i ON i.id=v.inventaris_id WHERE i.id IS NULL) THEN
    RAISE EXCEPTION 'VALUATION167_ORPHAN_ASSET';
  END IF;
  IF reserved IS NOT NULL AND NOT EXISTS(
    SELECT FROM pg_index x WHERE x.indexrelid=reserved AND x.indrelid=target
      AND x.indisunique AND x.indisvalid AND x.indisready AND x.indimmediate
      AND x.indnkeyatts=1 AND x.indkey[0]=key_number AND x.indpred IS NULL AND x.indexprs IS NULL
      AND obj_description(x.indexrelid,'pg_class')=marker
  ) THEN RAISE EXCEPTION 'VALUATION167_RESERVED_NAME_COLLISION'; END IF;
  IF EXISTS(
    SELECT FROM pg_index x WHERE x.indrelid=target AND x.indisunique AND x.indisvalid
      AND x.indisready AND x.indimmediate AND x.indnkeyatts=1 AND x.indkey[0]=key_number
      AND x.indpred IS NULL AND x.indexprs IS NULL
  ) THEN RETURN; END IF;
  CREATE UNIQUE INDEX ptv_nilai_inventaris_asset_unique_167 ON public.ptv_nilai_inventaris(inventaris_id);
  COMMENT ON INDEX public.ptv_nilai_inventaris_asset_unique_167
    IS 'PTVPRO-167: valuation asset unique; non-destructive; approved Staging only';
END
$migration$;
COMMIT;
