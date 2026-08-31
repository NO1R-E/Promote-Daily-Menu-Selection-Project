from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat_router
from contextlib import asynccontextmanager
from services.supabase_service import fetch_recipes_cache

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Fetch_recipes_cache called!")
    await fetch_recipes_cache()
    yield

app = FastAPI(
    title="Nutrition Assistant API", 
    lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)