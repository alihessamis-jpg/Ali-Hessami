-- Nephron Assistant · Phase 2 — conversations, messages, patient-case model setting
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode        text not null default 'general' check (mode in ('study', 'patient', 'general')),
  patient_id  uuid references public.patients(id) on delete set null,
  chapter_id  uuid references public.library_chapters(id) on delete set null,
  title       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_owner_idx on public.ai_conversations (owner_id, updated_at desc);
create index if not exists ai_conversations_patient_idx on public.ai_conversations (patient_id);
create index if not exists ai_conversations_chapter_idx on public.ai_conversations (chapter_id);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,           -- what the user sees
  sources         jsonb not null default '{}'::jsonb,  -- cited source registry {S1: {...}}
  meta            jsonb not null default '{}'::jsonb,  -- sent (de-identified turn), steps, usage, model
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conversations_owner_access on public.ai_conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy ai_messages_owner_access on public.ai_messages
  for all using (exists (select 1 from public.ai_conversations c where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()));

alter table public.user_settings
  add column if not exists assistant_patient_model text not null default 'claude-sonnet-5-5'
  check (assistant_patient_model in ('claude-sonnet-5-5', 'claude-opus-5-5'));
