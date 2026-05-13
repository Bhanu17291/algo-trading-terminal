"""
scheduler.py
------------
APScheduler setup for all daily jobs.
Add this to your backend/main.py startup.

Usage in main.py:
    from scheduler import start_scheduler
    @app.on_event("startup")
    async def startup():
        start_scheduler()
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz, logging

IST = pytz.timezone("Asia/Kolkata")
logger = logging.getLogger(__name__)


def start_scheduler():
    from src.incremental_learn import run_daily_update
    from src.paper_engine import run_paper_engine

    scheduler = BackgroundScheduler(timezone=IST)

    # Step 1: Incremental model update + signal generation at 3:35 PM IST
    scheduler.add_job(
        run_daily_update,
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=15,
            minute=35,
            timezone=IST,
        ),
        id="daily_incremental_update",
        name="Incremental model update + signal",
        replace_existing=True,
        misfire_grace_time=300,     # allow 5 min late if server was sleeping
    )

    # Step 2: Paper trading engine at 3:40 PM IST (after signal is ready)
    scheduler.add_job(
        run_paper_engine,
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=15,
            minute=40,
            timezone=IST,
        ),
        id="daily_paper_engine",
        name="Paper trading engine",
        replace_existing=True,
        misfire_grace_time=300,
    )

    scheduler.start()
    logger.info("APScheduler started — daily jobs registered at 3:35 PM and 3:40 PM IST")
    return scheduler


if __name__ == "__main__":
    import time
    print("Scheduler test — running jobs now...")
    start_scheduler()
    # For testing, run immediately
    from incremental_learn import run_daily_update
    from paper_engine import run_paper_engine
    run_daily_update()
    run_paper_engine()