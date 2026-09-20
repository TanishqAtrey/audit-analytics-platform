# data_infra/scripts/seed_demo_data.py
"""Database seed script. Populates PostgreSQL tables with baseline curated
public company financial statements and synthetic ledger transactions for testing."""

import sys
import os
from datetime import datetime, date, timezone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from data_infra.db.connection import SessionLocal
from data_infra.db import models


def seed_data():
    db = SessionLocal()
    try:
        # 1. Curated Financial Statements (FY 2021 - 2023)
        # Includes clean companies (AAPL, MSFT) and fraudulent AAER cases (ENRN, WCOM)
        print("Seeding curated financial statements...")
        
        # Apple (Clean)
        aapl_data = [
            models.FinancialStatement(
                ticker="AAPL", company="Apple Inc.", fiscal_year=2021,
                revenue=365817.0, cogs=212981.0, receivables=26278.0, current_assets=134836.0,
                ppe=39440.0, total_assets=351002.0, depreciation=11285.0, sga_expense=21973.0,
                current_liabilities=125481.0, long_term_debt=109106.0, net_income=94680.0,
                cash_flow_ops=104038.0, retained_earnings=5562.0, market_value_equity=2400000.0,
                total_liabilities=287912.0, is_aaer_fraud_case=False
            ),
            models.FinancialStatement(
                ticker="AAPL", company="Apple Inc.", fiscal_year=2022,
                revenue=394328.0, cogs=223546.0, receivables=28184.0, current_assets=135405.0,
                ppe=42117.0, total_assets=352755.0, depreciation=11104.0, sga_expense=25094.0,
                current_liabilities=153982.0, long_term_debt=98959.0, net_income=99803.0,
                cash_flow_ops=122151.0, retained_earnings=-3068.0, market_value_equity=2200000.0,
                total_liabilities=302083.0, is_aaer_fraud_case=False
            ),
            models.FinancialStatement(
                ticker="AAPL", company="Apple Inc.", fiscal_year=2023,
                revenue=383285.0, cogs=214137.0, receivables=29508.0, current_assets=143566.0,
                ppe=43715.0, total_assets=352583.0, depreciation=11519.0, sga_expense=24936.0,
                current_liabilities=145308.0, long_term_debt=95280.0, net_income=96995.0,
                cash_flow_ops=110543.0, retained_earnings=-2141.0, market_value_equity=2900000.0,
                total_liabilities=290437.0, is_aaer_fraud_case=False
            )
        ]
        
        # Enron (Fraud/AAER case) - with manipulated ratios
        enron_data = [
            models.FinancialStatement(
                ticker="ENRN", company="Enron Corporation", fiscal_year=2021,
                revenue=100789.0, cogs=85240.0, receivables=9500.0, current_assets=15400.0,
                ppe=24000.0, total_assets=65500.0, depreciation=1800.0, sga_expense=8900.0,
                current_liabilities=14200.0, long_term_debt=18500.0, net_income=979.0,
                cash_flow_ops=-120.0, retained_earnings=3200.0, market_value_equity=60000.0,
                total_liabilities=32700.0, is_aaer_fraud_case=True
            ),
            models.FinancialStatement(
                ticker="ENRN", company="Enron Corporation", fiscal_year=2022,
                revenue=100789.0, cogs=91240.0, receivables=18500.0, current_assets=12400.0,
                ppe=21000.0, total_assets=65500.0, depreciation=1500.0, sga_expense=9100.0,
                current_liabilities=22200.0, long_term_debt=24500.0, net_income=1200.0,
                cash_flow_ops=-2400.0, retained_earnings=4400.0, market_value_equity=40000.0,
                total_liabilities=46700.0, is_aaer_fraud_case=True
            ),
            models.FinancialStatement(
                ticker="ENRN", company="Enron Corporation", fiscal_year=2023,
                revenue=100789.0, cogs=99240.0, receivables=31500.0, current_assets=8400.0,
                ppe=18000.0, total_assets=65500.0, depreciation=1100.0, sga_expense=9800.0,
                current_liabilities=38200.0, long_term_debt=34500.0, net_income=1500.0,
                cash_flow_ops=-4500.0, retained_earnings=5900.0, market_value_equity=1200.0,
                total_liabilities=72700.0, is_aaer_fraud_case=True
            )
        ]

        # WorldCom (Fraud/AAER case)
        wcom_data = [
            models.FinancialStatement(
                ticker="WCOM", company="WorldCom Inc.", fiscal_year=2021,
                revenue=35000.0, cogs=22000.0, receivables=4500.0, current_assets=8000.0,
                ppe=35000.0, total_assets=45000.0, depreciation=2000.0, sga_expense=7000.0,
                current_liabilities=6000.0, long_term_debt=18000.0, net_income=1500.0,
                cash_flow_ops=3200.0, retained_earnings=2000.0, market_value_equity=40000.0,
                total_liabilities=24000.0, is_aaer_fraud_case=True
            ),
            models.FinancialStatement(
                ticker="WCOM", company="WorldCom Inc.", fiscal_year=2022,
                revenue=39000.0, cogs=24000.0, receivables=8500.0, current_assets=12000.0,
                ppe=39000.0, total_assets=53000.0, depreciation=800.0, sga_expense=6500.0,
                current_liabilities=9500.0, long_term_debt=22000.0, net_income=2100.0,
                cash_flow_ops=500.0, retained_earnings=4100.0, market_value_equity=18000.0,
                total_liabilities=31500.0, is_aaer_fraud_case=True
            )
        ]
        
        db.add_all(aapl_data)
        db.add_all(enron_data)
        db.add_all(wcom_data)

        # 2. Seed Transaction Data
        print("Seeding synthetic ledger transactions...")
        ledger_dataset_id = "ledger_q4_2023.csv"
        
        vendors = [
            "Apex Solutions Ltd", "BrightPath Consulting", "CoreTech Systems",
            "Delta Finance Group", "Eagle Eye Analytics", "FrontLine Services"
        ]
        
        # Populate transactions
        transactions = []
        for i in range(1, 101):
            amount = float((i * 1234.56) % 150000.0)
            transactions.append(
                models.Transaction(
                    vendor=vendors[i % len(vendors)],
                    amount=amount,
                    invoice_number=f"INV-2023-{1000 + i}",
                    invoice_date=date(2023, 10, 1 + (i % 28)),
                    po_reference=f"PO-{5000 + i}",
                    gr_reference=f"GR-{6000 + i}",
                    po_amount=amount,
                    po_quantity=1.0,
                    gr_quantity=1.0,
                    source_dataset=ledger_dataset_id
                )
            )
            
        # Add duplicates for duplicate test triggers
        transactions.append(
            models.Transaction(
                vendor="Apex Solutions Ltd", amount=12500.0, invoice_number="INV-2023-9999",
                invoice_date=date(2023, 11, 15), po_reference="PO-9999", gr_reference="GR-9999",
                po_amount=12500.0, po_quantity=10.0, gr_quantity=10.0, source_dataset=ledger_dataset_id
            )
        )
        transactions.append(
            models.Transaction(
                vendor="Apex Solutions Ltd", amount=12500.0, invoice_number="INV-2023-9999a",
                invoice_date=date(2023, 11, 16), po_reference="PO-9999", gr_reference="GR-9999",
                po_amount=12500.0, po_quantity=10.0, gr_quantity=10.0, source_dataset=ledger_dataset_id
            )
        )
        
        db.add_all(transactions)

        # 3. Seed Benchmark Results
        print("Seeding baseline benchmark results...")
        benchmark = models.BenchmarkResult(
            domain="ledger",
            baseline_precision=[0.41, 0.47, 0.52, 0.57, 0.63, 0.70, 0.78],
            baseline_recall=[0.91, 0.85, 0.78, 0.70, 0.61, 0.50, 0.38],
            baseline_f1=[0.565, 0.606, 0.624, 0.628, 0.620, 0.583, 0.511],
            ensemble_precision=[0.58, 0.65, 0.73, 0.80, 0.86, 0.91, 0.95],
            ensemble_recall=[0.93, 0.88, 0.84, 0.78, 0.71, 0.62, 0.50],
            ensemble_f1=[0.714, 0.748, 0.781, 0.790, 0.777, 0.737, 0.655]
        )
        db.add(benchmark)

        # 4. Seed Audit Logs
        print("Seeding initial audit logs...")
        logs = [
            models.AuditLog(
                run_timestamp=datetime(2024, 1, 10, 10, 15, 00, tzinfo=timezone.utc),
                dataset_used="ledger_q4_2023.csv",
                modules_run=["Benford Ensemble", "Duplicate Detection", "3-Way Match"],
                parameters={"threshold": 0.55},
                run_by="analyst_1"
            ),
            models.AuditLog(
                run_timestamp=datetime(2024, 1, 15, 14, 30, 00, tzinfo=timezone.utc),
                dataset_used="sec_edgar_curated.parquet",
                modules_run=["Beneish M-Score", "Altman Z-Score", "Ratio Anomaly"],
                parameters={"threshold": 0.60},
                run_by="analyst_2"
            )
        ]
        db.add_all(logs)
        
        db.commit()
        print("Database seeded with sample demo data successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
