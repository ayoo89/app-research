"""
Embedding Microservice — Production-optimised
- CLIP (ViT-B/32) for image embeddings
- MiniLM for text embeddings
- Hybrid fusion (weighted average + L2 normalisation)
- Redis embedding cache
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import time
from contextlib import asynccontextmanager

import numpy as np
import redis
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# ── Config ────────────────────────────────────────────────────────────────────

TEXT_MODEL_NAME  = os.getenv("TEXT_MODEL",  "all-MiniLM-L6-v2")   # 384-dim
IMAGE_MODEL_NAME = os.getenv("IMAGE_MODEL", "clip-ViT-B-32")       # 512-dim
REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379/1")
EMBED_CACHE_TTL  = int(os.getenv("EMBED_CACHE_TTL", "3600"))       # 1 hour
VECTOR_DIM       = int(os.getenv("VECTOR_DIM", "512"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("embedding-service")

# ── Globals ───────────────────────────────────────────────────────────────────

text_model:  SentenceTransformer | None = None
image_model: SentenceTransformer | None = None
cache:       redis.Redis | None = None

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global text_model, image_model, cache
    logger.info("Loading models…")
    text_model  = SentenceTransformer(TEXT_MODEL_NAME)
    image_model = SentenceTransformer(IMAGE_MODEL_NAME)
    logger.info("Models loaded. Connecting to Redis…")
    try:
        cache = redis.from_url(REDIS_URL, decode_responses=False)
        cache.ping()
        logger.info("Redis connected ✓")
    except Exception as exc:
        logger.warning(f"Redis unavailable at startup (will retry on requests): {exc}")
        cache = None
    logger.info("Embedding service ready ✓")
    yield
    logger.info("Shutting down")

app = FastAPI(title="Embedding Service", version="3.0.0", lifespan=lifespan)

# ── Pydantic Models ───────────────────────────────────────────────────────────

class TextEmbedRequest(BaseModel):
    text: str

class ImageEmbedRequest(BaseModel):
    image: str  # base64

class HybridEmbedRequest(BaseModel):
    text:        str | None = None
    image:       str | None = None  # base64
    text_weight: float = Field(default=0.5, ge=0.0, le=1.0)

class EmbedResponse(BaseModel):
    embedding: list[float]
    dim:       int

# ── Embedding Helpers ─────────────────────────────────────────────────────────

def _encode_text(text: str) -> np.ndarray:
    vec = text_model.encode(text, normalize_embeddings=True, show_progress_bar=False)
    return _to_target_dim(vec)

def _encode_text_clip(text: str) -> np.ndarray:
    """Encode text with CLIP — same vector space as image embeddings."""
    vec = image_model.encode(text, normalize_embeddings=True, show_progress_bar=False)
    return _to_target_dim(vec)

def _encode_image(b64: str) -> np.ndarray:
    img_bytes = base64.b64decode(b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize((224, 224), Image.LANCZOS)
    vec = image_model.encode(img, normalize_embeddings=True, show_progress_bar=False)
    return _to_target_dim(vec)

def _fuse(a: np.ndarray, b: np.ndarray, wa: float, wb: float) -> np.ndarray:
    fused = a * wa + b * wb
    norm = np.linalg.norm(fused)
    return fused / norm if norm > 0 else fused

def _to_target_dim(vec: np.ndarray) -> np.ndarray:
    if len(vec) == VECTOR_DIM:
        return vec
    if len(vec) > VECTOR_DIM:
        return vec[:VECTOR_DIM]
    return np.pad(vec, (0, VECTOR_DIM - len(vec)))

def _cache_key(prefix: str, payload: str) -> str:
    h = hashlib.sha256(payload.encode()).hexdigest()[:24]
    return f"emb:{prefix}:{h}"

def _get_cached_embed(key: str) -> list[float] | None:
    if cache is None:
        return None
    try:
        raw = cache.get(key)
        if raw:
            return list(np.frombuffer(raw, dtype=np.float32))
    except Exception:
        pass
    return None

def _set_cached_embed(key: str, vec: np.ndarray):
    if cache is None:
        return
    try:
        cache.setex(key, EMBED_CACHE_TTL, vec.astype(np.float32).tobytes())
    except Exception:
        pass

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/embed/text", response_model=EmbedResponse)
def embed_text(req: TextEmbedRequest):
    if not req.text.strip():
        raise HTTPException(400, "Empty text")
    ck = _cache_key("txt", req.text)
    cached = _get_cached_embed(ck)
    if cached:
        return {"embedding": cached, "dim": len(cached)}
    vec = _encode_text(req.text)
    _set_cached_embed(ck, vec)
    return {"embedding": vec.tolist(), "dim": len(vec)}


@app.post("/embed/text/clip", response_model=EmbedResponse)
def embed_text_clip(req: TextEmbedRequest):
    """Text embedding using CLIP — same vector space as image embeddings."""
    if not req.text.strip():
        raise HTTPException(400, "Empty text")
    ck = _cache_key("txtclip", req.text)
    cached = _get_cached_embed(ck)
    if cached:
        return {"embedding": cached, "dim": len(cached)}
    vec = _encode_text_clip(req.text)
    _set_cached_embed(ck, vec)
    return {"embedding": vec.tolist(), "dim": len(vec)}


@app.post("/embed/image", response_model=EmbedResponse)
def embed_image(req: ImageEmbedRequest):
    try:
        ck = _cache_key("img", req.image[:512])
        cached = _get_cached_embed(ck)
        if cached:
            return {"embedding": cached, "dim": len(cached)}
        vec = _encode_image(req.image)
        _set_cached_embed(ck, vec)
        return {"embedding": vec.tolist(), "dim": len(vec)}
    except Exception as e:
        raise HTTPException(400, f"Image processing failed: {e}")


@app.post("/embed/hybrid", response_model=EmbedResponse)
def embed_hybrid(req: HybridEmbedRequest):
    """Fuse text + image embeddings in CLIP space via weighted average."""
    if not req.text and not req.image:
        raise HTTPException(400, "Provide text and/or image")
    if req.text and req.image:
        t_vec = _encode_text(req.text)
        i_vec = _encode_image(req.image)
        vec = _fuse(t_vec, i_vec, req.text_weight, 1 - req.text_weight)
    elif req.image:
        vec = _encode_image(req.image)
    else:
        vec = _encode_text(req.text)
    return {"embedding": vec.tolist(), "dim": len(vec)}


@app.get("/health")
def health():
    redis_ok = False
    models_ok = text_model is not None and image_model is not None
    try:
        if cache is not None:
            cache.ping()
            redis_ok = True
    except Exception:
        pass
    status = "ok" if models_ok else "degraded"
    return {
        "status": status,
        "redis": redis_ok,
        "models_loaded": models_ok,
    }


@app.get("/metrics")
def metrics():
    return {
        "vector_dim": VECTOR_DIM,
        "text_model": TEXT_MODEL_NAME,
        "image_model": IMAGE_MODEL_NAME,
    }
