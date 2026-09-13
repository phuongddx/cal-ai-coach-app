-- ---------------------------------------------------------------------------
-- food_cache negative rows: an all-tiers miss is cached for 24 h under a
-- dedicated source marker — it is cache metadata, not provider attribution.
-- ---------------------------------------------------------------------------

alter table public.food_cache drop constraint food_cache_source_check;

alter table public.food_cache add constraint food_cache_source_check
  check (source in ('fdc', 'off', 'fatsecret', 'negative'));
