-- Monetisation & affiliate engine: enums
DO $$ BEGIN
  CREATE TYPE public.partner_kind AS ENUM ('affiliate_network','direct_merchant','venue','sponsor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_status AS ENUM ('unconfigured','configured','active','paused','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_model AS ENUM ('CPA','CPL','CPS','REVENUE_SHARE','BOOKING_FEE','FIXED_SPONSORSHIP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversion_status AS ENUM ('pending','approved','rejected','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','active','paused','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
