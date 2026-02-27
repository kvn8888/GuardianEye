"""GuardianEye — Multimodal Scam Detection Agent"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from routes.scan import router as scan_router
from routes.graph import router as graph_router
from routes.scout import router as scout_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    required = ["OPENAI_API_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        print(f"⚠  Missing required: {', '.join(missing)}")

    services = {
        "Reka Vision": bool(os.getenv("REKA_API_KEY")),
        "Modulate": bool(os.getenv("MODULATE_API_KEY")),
        "Fastino/GLiNER": bool(os.getenv("FASTINO_API_KEY")),
        "Yutori": bool(os.getenv("YUTORI_API_KEY")),
        "Tavily": bool(os.getenv("TAVILY_API_KEY")),
        "Neo4j": bool(os.getenv("NEO4J_URI")),
    }
    active = [k for k, v in services.items() if v]
    print(f"✓ Active services: {', '.join(active) or 'none'}")
    yield
    from services.neo4j_service import close_driver
    close_driver()


app = FastAPI(title="GuardianEye", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(scan_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(scout_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "guardianeye"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
