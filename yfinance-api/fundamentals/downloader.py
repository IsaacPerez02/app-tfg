import yfinance as yf

# ==============================
# FETCH
# ==============================
def fetch_fundamentals(ticker: str) -> dict:
    t = yf.Ticker(ticker)

    return {
        "info": t.info if t.info else {},
        "financials": t.financials.to_dict() if t.financials is not None else {},
        "balance_sheet": t.balance_sheet.to_dict() if t.balance_sheet is not None else {},
        "cashflow": t.cashflow.to_dict() if t.cashflow is not None else {},
    }