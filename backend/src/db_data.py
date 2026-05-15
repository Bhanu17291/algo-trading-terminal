def ensure_ohlcv_table():
    with engine.connect() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {OHLCV_TABLE} (
                date             DATE PRIMARY KEY,
                open             FLOAT,
                high             FLOAT,
                low              FLOAT,
                close            FLOAT,
                volume           FLOAT,
                returns          FLOAT,
                log_returns      FLOAT,
                momentum_3       FLOAT,
                momentum_5       FLOAT,
                momentum_10      FLOAT,
                momentum_20      FLOAT,
                sma20            FLOAT,
                sma50            FLOAT,
                ema12            FLOAT,
                ema26            FLOAT,
                price_vs_sma20   FLOAT,
                price_vs_sma50   FLOAT,
                atr              FLOAT,
                volatility_10    FLOAT,
                volatility_20    FLOAT,
                bb_upper         FLOAT,
                bb_lower         FLOAT,
                bb_width         FLOAT,
                bb_pct           FLOAT,
                rsi              FLOAT,
                macd             FLOAT,
                macd_signal      FLOAT,
                macd_hist        FLOAT,
                stoch_k          FLOAT,
                stoch_d          FLOAT,
                obv              FLOAT,
                volume_ratio     FLOAT,
                body_size        FLOAT,
                upper_wick       FLOAT,
                lower_wick       FLOAT,
                regime           INTEGER,
                label            VARCHAR(10),
                created_at       TIMESTAMP DEFAULT NOW(),
                updated_at       TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.commit()
    logger.info(f"[db_data] Table '{OHLCV_TABLE}' ready.")