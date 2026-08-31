import os
from dotenv import load_dotenv

load_dotenv("../.env")

GROQ_API_KEYS = [
    key.strip() 
    for key in os.getenv("GROQ_API_KEYS", "").split(",") 
    if key.strip()
]
GROQ_SMALL_MODEL = "openai/gpt-oss-20b"
GROQ_LARGE_MODEL = "openai/gpt-oss-120b"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")