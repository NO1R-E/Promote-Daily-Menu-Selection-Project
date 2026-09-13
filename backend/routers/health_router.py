from fastapi import APIRouter
from services.groq_service import get_health_check_client
from services.supabase_service import supabase
import asyncio
import time

router = APIRouter()

_cache = {
    "db": {"timestamp": 0.0, "ok": True},
    "llm": {"timestamp": 0.0, "ok": True},
}
DB_CACHE_SECONDS = 60
LLM_CACHE_SECONDS = 300


def _check_db() -> bool:
    now = time.time()
    if now - _cache["db"]["timestamp"] < DB_CACHE_SECONDS:
        return _cache["db"]["ok"]
    try:
        supabase.table("recipes").select("id").limit(1).execute()
        ok = True
    except Exception:
        ok = False
    _cache["db"] = {"timestamp": now, "ok": ok}
    return ok


def _check_llm() -> bool:
    now = time.time()
    if now - _cache["llm"]["timestamp"] < LLM_CACHE_SECONDS:
        return _cache["llm"]["ok"]
    try:
        get_health_check_client().models.list()
        ok = True
    except Exception:
        ok = False
    _cache["llm"] = {"timestamp": now, "ok": ok}
    return ok


@router.get("/health")
async def health_liveness():
    return {"status": "ok"}


@router.get("/health/db")
async def health_db():
    ok = await asyncio.to_thread(_check_db)
    return {"status": "ok" if ok else "degraded", "db": ok}


@router.get("/health/llm")
async def health_llm():
    ok = await asyncio.to_thread(_check_llm)
    return {"status": "ok" if ok else "degraded", "llm": ok}


@router.get("/health/deep")
async def health_deep():
    db_ok, llm_ok = await asyncio.gather(
        asyncio.to_thread(_check_db),
        asyncio.to_thread(_check_llm),
    )
    checks = {"db": db_ok, "llm": llm_ok}
    return {"status": "ok" if all(checks.values()) else "degraded", "checks": checks}