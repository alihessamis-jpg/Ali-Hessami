-- LUS thesis study: fields required by the approved proposal (SUMS RCT,
-- 5 time points day 1/15/30/45/60, BP percentiles as outcome, safety,
-- LUS-IVC agreement, withdrawal/ITT) and by Kaysi et al. (Kidney360 2026)
-- data-collection set (baseline labs, vascular access, antihypertensives,
-- intradialytic BP every 30 min, operator blinding). All columns nullable /
-- defaulted so existing rows stay valid.

alter table public.lus_study_enrollments
    add column if not exists consent_date                date,
    add column if not exists child_assent                boolean,
    add column if not exists randomization_code          text,
    add column if not exists inclusion_criteria          jsonb not null default '[]'::jsonb,
    add column if not exists exclusion_criteria_present  jsonb not null default '[]'::jsonb,
    add column if not exists dialysis_modality           text,      -- 'hd' | 'hdf'
    add column if not exists vascular_access             text,      -- 'avf' | 'avg' | 'tunneled_cvc' | 'non_tunneled_cvc'
    add column if not exists sessions_per_week           smallint,
    add column if not exists comorbidities               jsonb not null default '[]'::jsonb,
    add column if not exists baseline_antihypertensives  text,
    add column if not exists baseline_antihypertensive_count smallint,
    add column if not exists study_status                text not null default 'active', -- 'active' | 'completed' | 'withdrawn'
    add column if not exists withdrawal_date             date,
    add column if not exists withdrawal_reason           text;      -- 'transplant' | 'transfer' | 'death' | 'switch_to_pd' | 'non_cooperation' | 'consent_withdrawn' | 'other'

alter table public.lus_study_sessions
    -- protocol time point & measurement conditions
    add column if not exists study_day                   smallint,  -- 1 | 15 | 30 | 45 | 60 (other = unscheduled)
    add column if not exists mid_week_session            boolean,
    add column if not exists lus_operator                text,
    add column if not exists operator_blinded            boolean,
    add column if not exists lus_image_quality           text,      -- 'adequate' | 'limited' | 'inadequate'
    add column if not exists post_lus_minutes_after_hd   numeric,
    -- vitals / exam
    add column if not exists pre_hd_heart_rate           numeric,
    add column if not exists pre_hd_resp_rate            numeric,
    add column if not exists pre_hd_spo2                 numeric,
    add column if not exists pre_hd_hepatomegaly         boolean,
    add column if not exists post_hd_heart_rate          numeric,
    add column if not exists post_hd_spo2                numeric,
    -- IVC impression (for LUS-IVC agreement objective)
    add column if not exists pre_ivc_impression          text,      -- 'plethoric' | 'normal' | 'collapsed'
    add column if not exists post_ivc_impression         text,
    add column if not exists pre_lus_ivc_agreement       text,      -- computed
    add column if not exists post_lus_ivc_agreement      text,
    -- weight deviation from target (primary outcome) & IDWG %
    add column if not exists pre_weight_deviation_pct    numeric,
    add column if not exists post_weight_deviation_pct   numeric,
    add column if not exists interdialytic_weight_gain_pct numeric,
    -- BP percentile classification (AAP 2017)
    add column if not exists pre_sbp_index               numeric,   -- SBP / 95th percentile
    add column if not exists pre_dbp_index               numeric,
    add column if not exists pre_bp_category             text,
    add column if not exists post_sbp_index              numeric,
    add column if not exists post_dbp_index              numeric,
    add column if not exists post_bp_category            text,
    add column if not exists intradialytic_nadir_sbp     numeric,
    add column if not exists intradialytic_nadir_dbp     numeric,
    add column if not exists interdialytic_home_sbp      numeric,
    add column if not exists interdialytic_home_dbp      numeric,
    add column if not exists antihypertensive_count      smallint,
    add column if not exists antihypertensive_changed    boolean,
    add column if not exists antihypertensive_change_note text,
    -- dialysis prescription
    add column if not exists planned_uf_ml               numeric,
    add column if not exists blood_flow_ml_min           numeric,
    add column if not exists dialysate_sodium            numeric,
    add column if not exists dialysate_temp_c            numeric,
    -- safety
    add column if not exists intradialytic_symptoms      jsonb not null default '[]'::jsonb,
    add column if not exists saline_volume_ml            numeric,
    add column if not exists hospitalization             boolean,
    add column if not exists extra_dialysis_session      boolean,
    add column if not exists adverse_event_note          text,
    -- labs
    add column if not exists lab_urea_pre                numeric,
    add column if not exists lab_urea_post               numeric,
    add column if not exists urr_pct                     numeric,
    add column if not exists sp_kt_v                     numeric,
    add column if not exists lab_hb                      numeric,
    add column if not exists lab_albumin                 numeric,
    add column if not exists lab_sodium                  numeric,
    add column if not exists lab_potassium               numeric,
    add column if not exists lab_nt_probnp               numeric,
    -- intervention fidelity
    add column if not exists new_target_weight_kg        numeric,
    add column if not exists adjustment_step             smallint,
    add column if not exists bp_gate_passed              boolean,
    add column if not exists adjustment_implemented      boolean;
