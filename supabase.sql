-- Supabase Dashboard > SQL Editor mein poora paste karke Run karo

create table public.candidates (
  id              uuid primary key,
  token           text unique not null,            -- user ke status page ke liye (guess nahi hota)
  ref             text unique not null,            -- user ko dikhne wala reference, e.g. ASC-1A2B3C4D
  name            text not null,
  education       text,
  exp             text,
  location        text,
  notice          text,
  domain          text,
  phone           text not null,
  email           text not null,
  linkedin        text,
  source          text,
  utr             text not null,
  resume_path     text not null,
  screenshot_path text not null,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','APPROVED','REJECTED')),
  reject_reason   text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

-- Duplicate UTR block: ek UTR sirf ek active (PENDING/APPROVED) entry mein.
-- REJECTED wali ka UTR dobara use ho sakta hai (galat screenshot wale genuine user ke liye).
create unique index candidates_active_utr
  on public.candidates (utr) where status <> 'REJECTED';

create index candidates_status_created
  on public.candidates (status, created_at desc);

-- Public access band: backend service-role key se hi data padhta/likhta hai
alter table public.candidates enable row level security;

-- Private bucket: resume + screenshot
insert into storage.buckets (id, name, public)
values ('candidate-files', 'candidate-files', false)
on conflict (id) do nothing;
