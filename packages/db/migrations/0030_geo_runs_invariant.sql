-- =============================================================================
-- 0030_geo_runs_invariant
--
-- geo_runs has carried was_mentioned/position since 0006 with nothing tying
-- them together. The same class of bug map_scan_points_rank_ck (0025) and
-- visibility_pillar_scores' measured/score check (0022) both exist to
-- prevent: a position implies a mention, so a row claiming a position while
-- was_mentioned is false would be self-contradictory data, not a real
-- outcome. Application code (analyseAnswer in ai-visibility-engine) already
-- never produces that shape; this closes the gap at the layer that outlives
-- any particular caller.
-- =============================================================================

alter table geo_runs
  add constraint geo_runs_position_ck
  check (was_mentioned or position is null);
