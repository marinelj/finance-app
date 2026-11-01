-- Finance app: PostgreSQL schema (PostgreSQL 13+).
--
-- Mirrors the on-device SQLite schema in src/db/schema.ts, with three changes for a shared
-- server database:
--   * Every user-owned table has a user_id, so one database can hold more than one person's
--     data and the API can scope every query to the signed-in user.
--   * Money and quantities are NUMERIC (exact), dates are DATE, timestamps are TIMESTAMPTZ.
--   * Enum columns carry CHECK constraints with the same values as src/domain/*.ts.
--
-- Card data: the only card number data stored is card_last4. Never store a full card number,
-- CVV or PIN here.
--
-- Run as the app user (the owner of the database), e.g. via server/db/setup.sh.
-- Safe to re-run: every object is created IF NOT EXISTS.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() on PostgreSQL < 13

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- People who sign in through the API. Passwords are stored only as a hash (argon2/bcrypt),
-- computed by the API, never in plain text.
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  display_name   text,
  password_hash  text NOT NULL,
  locale         text NOT NULL DEFAULT 'zh-CN' CHECK (locale IN ('zh-CN', 'en')),
  base_currency  char(3) NOT NULL DEFAULT 'CNY',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

-- App preferences as JSON values, e.g. key "preferences".
CREATE TABLE IF NOT EXISTS settings (
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key      text NOT NULL,
  value    jsonb NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Units of each currency per 1 USD, edited by the user.
CREATE TABLE IF NOT EXISTS fx_rates (
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  currency       char(3) NOT NULL
                 CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  units_per_usd  numeric NOT NULL CHECK (units_per_usd > 0),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency)
);

-- User-defined product types such as "分期乐", mapped onto one of the built-in kinds.
CREATE TABLE IF NOT EXISTS custom_product_types (
  id                text PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name              text NOT NULL,
  kind              text NOT NULL
                    CHECK (kind IN ('credit_card','revolving_bnpl','installment_loan','other')),
  has_grace_period  boolean NOT NULL,
  emoji             text NOT NULL,
  color             text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_product_types_user_idx ON custom_product_types (user_id);

-- Credit cards, Huabei/Baitiao, Jiebei/Wangshangdai/Weilidai and other loans.
CREATE TABLE IF NOT EXISTS credit_products (
  id                        text PRIMARY KEY,
  user_id                   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name                      text NOT NULL,
  issuer                    text NOT NULL DEFAULT '',
  kind                      text NOT NULL
                            CHECK (kind IN ('credit_card','revolving_bnpl','installment_loan','other')),
  preset                    text
                            CHECK (preset IN ('credit_card','huabei','baitiao','jiebei',
                                              'wangshangdai','weilidai','other')),
  custom_type_id            text REFERENCES custom_product_types (id) ON DELETE SET NULL,
  currency                  char(3) NOT NULL
                            CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  color                     text NOT NULL,
  emoji                     text NOT NULL,
  -- Last four digits only, to tell cards apart. Never a full card number.
  card_last4                char(4) CHECK (card_last4 ~ '^[0-9]{4}$'),

  credit_limit              numeric(18,2) NOT NULL DEFAULT 0,
  balance                   numeric(18,2) NOT NULL DEFAULT 0,
  statement_balance         numeric(18,2),
  minimum_payment           numeric(18,2),

  statement_day             smallint CHECK (statement_day BETWEEN 1 AND 31),
  due_rule                  text CHECK (due_rule IN ('fixed_day','days_after_statement')),
  due_day                   smallint CHECK (due_day BETWEEN 1 AND 31),
  due_days_after_statement  smallint CHECK (due_days_after_statement BETWEEN 0 AND 90),
  has_grace_period          boolean NOT NULL DEFAULT false,
  grace_note                text,

  interest_rate             numeric(10,6),           -- percent: 18 = 18% APR, 0.03 = 0.03%/day
  interest_rate_unit        text CHECK (interest_rate_unit IN ('apr','daily')),
  annual_fee                numeric(18,2),
  fee_waiver                text,

  repayment_day             smallint CHECK (repayment_day BETWEEN 1 AND 31),
  loan_principal            numeric(18,2),
  loan_start_date           date,
  loan_term_months          smallint CHECK (loan_term_months > 0),
  repayment_method          text
                            CHECK (repayment_method IN ('equal_installment','equal_principal',
                                                        'interest_first')),

  paid_through              date,
  notes                     text,
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_products_user_active_idx ON credit_products (user_id, is_active);

CREATE TABLE IF NOT EXISTS installments (
  id          text PRIMARY KEY,
  product_id  text NOT NULL REFERENCES credit_products (id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  due_date    date NOT NULL,
  principal   numeric(18,2) NOT NULL,
  interest    numeric(18,2) NOT NULL,
  amount      numeric(18,2) NOT NULL,
  paid_at     date
);
CREATE INDEX IF NOT EXISTS installments_product_idx ON installments (product_id, due_date);

CREATE TABLE IF NOT EXISTS payments (
  id                          text PRIMARY KEY,
  product_id                  text NOT NULL REFERENCES credit_products (id) ON DELETE CASCADE,
  date                        date NOT NULL,
  amount                      numeric(18,2) NOT NULL,
  for_due_date                date,                    -- due date this payment settled, if any
  installment_id              text REFERENCES installments (id) ON DELETE SET NULL,
  note                        text,
  -- What the payment changed, so the latest one can be undone exactly.
  balance_reduction           numeric(18,2) NOT NULL DEFAULT 0,
  previous_paid_through       date,
  previous_statement_balance  numeric(18,2),
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_product_idx ON payments (product_id, date);

/* Portfolio inputs. Column names match the field keys in src/domain/wealthForms.ts. */

CREATE TABLE IF NOT EXISTS incomes (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        text NOT NULL,
  kind        text NOT NULL
              CHECK (kind IN ('salary','bonus','side','rental','pension','other')),
  amount      numeric(18,2) NOT NULL,
  period      text NOT NULL CHECK (period IN ('monthly','annual')),
  currency    char(3) NOT NULL
              CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incomes_user_idx ON incomes (user_id);

CREATE TABLE IF NOT EXISTS housing (
  id                text PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name              text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('mortgage','rent','owned')),
  currency          char(3) NOT NULL
                    CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  monthly_rent      numeric(18,2),
  balance           numeric(18,2),                     -- mortgage still owed
  rate_percent      numeric(10,6),
  remaining_months  integer,
  monthly_payment   numeric(18,2),
  property_value    numeric(18,2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS housing_user_idx ON housing (user_id);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL
                  CHECK (type IN ('health','life','critical_illness','property','accident','other')),
  insurer         text,
  premium         numeric(18,2) NOT NULL,
  premium_period  text NOT NULL
                  CHECK (premium_period IN ('monthly','quarterly','semiannual','annual')),
  coverage        numeric(18,2),                       -- sum insured
  currency        char(3) NOT NULL
                  CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  renewal_date    date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insurance_policies_user_idx ON insurance_policies (user_id);

CREATE TABLE IF NOT EXISTS expenses (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category    text NOT NULL
              CHECK (category IN ('food','transport','utilities','phone_internet','education',
                                  'healthcare','childcare','family','entertainment','shopping',
                                  'travel','subscriptions','other')),
  label       text,
  amount      numeric(18,2) NOT NULL,                  -- per month
  currency    char(3) NOT NULL
              CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  essential   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_user_idx ON expenses (user_id);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id                 text PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name               text NOT NULL,
  kind               text NOT NULL
                     CHECK (kind IN ('checking','savings','money_market','time_deposit','other')),
  balance            numeric(18,2) NOT NULL,
  currency           char(3) NOT NULL
                     CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  rate_percent       numeric(10,6),
  is_emergency_fund  boolean NOT NULL DEFAULT false,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_accounts_user_idx ON cash_accounts (user_id);

CREATE TABLE IF NOT EXISTS bond_holdings (
  id                text PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  issuer            text NOT NULL,
  name              text,
  identifier        text,                              -- CUSIP or ISIN
  face_value        numeric(18,2) NOT NULL,
  coupon_rate       numeric(10,6) NOT NULL,
  coupon_frequency  smallint NOT NULL,
  maturity_date     date NOT NULL,
  purchase_date     date,
  purchase_price    numeric(12,6),                     -- percent of face value
  current_price     numeric(12,6),
  currency          char(3) NOT NULL
                    CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bond_holdings_user_idx ON bond_holdings (user_id);

CREATE TABLE IF NOT EXISTS stock_holdings (
  id                  text PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ticker              text NOT NULL,
  name                text,
  asset_class         text NOT NULL
                      CHECK (asset_class IN ('domestic_equity','international_equity','bonds',
                                             'cash','other')),
  shares              numeric(20,6) NOT NULL,
  price               numeric(18,6) NOT NULL,          -- per share, entered by hand
  cost_basis          numeric(18,2),                   -- total paid for the position
  dividend_per_share  numeric(18,6),                   -- per share, per payment
  dividend_frequency  smallint NOT NULL,
  first_pay_month     smallint CHECK (first_pay_month BETWEEN 1 AND 12),
  currency            char(3) NOT NULL
                      CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_holdings_user_idx ON stock_holdings (user_id);

-- One row per user per calendar month (YYYY-MM): the latest net worth seen that month.
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  month        char(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  assets       numeric(18,2) NOT NULL,
  liabilities  numeric(18,2) NOT NULL,
  net_worth    numeric(18,2) NOT NULL,
  currency     char(3) NOT NULL
               CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

-- Keep updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','fx_rates','credit_products','incomes','housing',
                           'insurance_policies','expenses','cash_accounts','bond_holdings',
                           'stock_holdings','net_worth_snapshots']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I '
                   'FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('0001_init') ON CONFLICT DO NOTHING;

COMMIT;
