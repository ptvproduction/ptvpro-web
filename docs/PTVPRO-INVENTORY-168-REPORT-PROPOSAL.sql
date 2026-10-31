-- PTV-DEV-168 REVIEW PACKAGE ONLY. Cloud execution requires separate explicit approval.
-- Staging project: swadgljnyelsjstqqxbm. No grants, policies or rows are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $guard168$
DECLARE target oid := 'ptv_report_private.write_report(text,text,uuid,jsonb,uuid,bigint)'::regprocedure; source text; definition text; digest text;
BEGIN
  IF current_setting('ptv.inventory168.approved_project', true) IS DISTINCT FROM 'swadgljnyelsjstqqxbm' THEN
    RAISE EXCEPTION 'INVENTORY168_EXPLICIT_APPROVAL_REQUIRED';
  END IF;
  SELECT prosrc, pg_get_functiondef(oid), md5(prosrc) INTO source, definition, digest FROM pg_proc WHERE oid=target;
  IF digest = '7f66a228d7369f1572a442aa5d4ef7a1' THEN RETURN; END IF;
  IF digest IS DISTINCT FROM '050ec0fe8d7414999c6654e9e7c41ee9' THEN RAISE EXCEPTION 'INVENTORY168_SOURCE_DRIFT'; END IF;
  IF position($patch168$BEGIN
  IF (auth.uid()$patch168$ IN source) = 0 THEN RAISE EXCEPTION 'INVENTORY168_ANCHOR_MISSING'; END IF;
  EXECUTE replace(definition, $patch168$BEGIN
  IF (auth.uid()$patch168$, $patch168$BEGIN
  IF p_module = 'damage' AND p_account_id IS NULL THEN
    RAISE EXCEPTION 'Portal session required for damage' USING ERRCODE='42501';
  END IF;
  IF (auth.uid()$patch168$);
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '7f66a228d7369f1572a442aa5d4ef7a1' THEN
    RAISE EXCEPTION 'INVENTORY168_POSTFLIGHT_MISMATCH';
  END IF;
END;
$guard168$;
COMMIT;
