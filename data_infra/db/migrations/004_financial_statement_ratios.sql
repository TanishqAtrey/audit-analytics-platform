-- 004_financial_statement_ratios.sql
-- Adds ebit, Altman Z-Score 5 ratios, and Beneish M-Score 8 indices to financial_statements table.

ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS ebit NUMERIC(18, 2);

-- Altman Z-Score 5 Ratios & Outputs
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_x1_wc_ta NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_x2_re_ta NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_x3_ebit_ta NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_x4_mve_tl NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_x5_sales_ta NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_z_score NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS altman_zone VARCHAR(20);

-- Beneish M-Score 8 Indices & Outputs
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_dsri NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_gmi NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_aqi NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_sgi NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_depi NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_sgai NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_lvgi NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_tata NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_m_score NUMERIC(10, 4);
ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS beneish_manipulator BOOLEAN;
