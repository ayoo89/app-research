"""
Embedding Microservice — Production-optimised
- CLIP (ViT-B/32) for image embeddings
- MiniLM for text embeddings
- Hybrid fusion (weighted average + L2 normalisation)
- Elasticsearch 8 KNN with cosine similarity
- Redis embedding cache
- Prometheus metrics
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import redis
from elasticsearch import Elasticsearch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# ── Config ────────────────────────────────────────────────────────────────────

TEXT_MODEL_NAME  = os.getenv("TEXT_MODEL",  "all-MiniLM-L6-v2")   # 384-dim
IMAGE_MODEL_NAME = os.getenv("IMAGE_MODEL", "clip-ViT-B-32")       # 512-dim
ES_URL           = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
ES_INDEX         = os.getenv("ES_INDEX", "products")
REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379/1")
EMBED_CACHE_TTL  = int(os.getenv("EMBED_CACHE_TTL", "3600"))       # 1 hour
VECTOR_DIM       = int(os.getenv("VECTOR_DIM", "512"))
MIN_SCORE        = float(os.getenv("MIN_SCORE", "0.50"))
KNN_NUM_CANDS    = int(os.getenv("KNN_NUM_CANDIDATES", "150"))      # ES over-fetch factor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("embedding-service")

# ── Globals ───────────────────────────────────────────────────────────────────

text_model:  SentenceTransformer | None = None
image_model: SentenceTransformer | None = None
es:          Elasticsearch | None = None
cache:       redis.Redis | None = None

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global text_model, image_model, es, cache
    logger.info("Loading models…")
    text_model  = SentenceTransformer(TEXT_MODEL_NAME)
    image_model = SentenceTransformer(IMAGE_MODEL_NAME)
    logger.info("Models loaded. Connecting to Elasticsearch and Redis…")
    es    = Elasticsearch(ES_URL, request_timeout=10)
    try:
        cache = redis.from_url(REDIS_URL, decode_responses=False)
        cache.ping()
        logger.info("Redis connected ✓")
    except Exception as exc:
        logger.warning(f"Redis unavailable at startup (will retry on requests): {exc}")
        cache = None
    try:
        _ensure_index()
        logger.info("Elasticsearch index ready ✓")
    except Exception as exc:
        logger.warning(f"Elasticsearch unavailable at startup (will retry on requests): {exc}")
    logger.info("Embedding service ready ✓")
    yield
    logger.info("Shutting down")

app = FastAPI(title="Embedding Service", version="2.0.0", lifespan=lifespan)

# ── ES Index Setup ────────────────────────────────────────────────────────────

def _ensure_index():
    if es.indices.exists(index=ES_INDEX):
        return
    # ES 7.x: dense_vector does not support index/similarity/index_options
    # Vector search uses script_score with cosineSimilarity()
    es.indices.create(index=ES_INDEX, body={
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "refresh_interval": "5s",
        },
        "mappings": {
            "properties": {
                "embedding": {
                    "type": "dense_vector",
                    "dims": VECTOR_DIM,
                },
                "name":     {"type": "text",    "analyzer": "english"},
                "brand":    {"type": "keyword"},
                "category": {"type": "keyword"},
                "barcode":  {"type": "keyword"},
            }
        },
    })
    logger.info(f"Created ES index '{ES_INDEX}' (dim={VECTOR_DIM}, script_score cosine)")

# ── Pydantic Models ───────────────────────────────────────────────────────────

class TextEmbedRequest(BaseModel):
    text: str

class ImageEmbedRequest(BaseModel):
    image: str  # base64

class HybridEmbedRequest(BaseModel):
    text:        str | None = None
    image:       str | None = None  # base64
    text_weight: float = Field(default=0.5, ge=0.0, le=1.0)

class IndexRequest(BaseModel):
    id:        str
    embedding: list[float]
    metadata:  dict[str, Any] = {}

class VectorSearchRequest(BaseModel):
    embedding:  list[float]
    limit:      int   = Field(default=20, ge=1, le=100)
    min_score:  float = Field(default=MIN_SCORE, ge=0.0, le=1.0)

class EmbedResponse(BaseModel):
    embedding: list[float]
    dim:       int

class SearchHit(BaseModel):
    id:    str
    score: float

class SearchResponse(BaseModel):
    results:    list[SearchHit]
    total:      int
    latency_ms: float

# ── Embedding Helpers ─────────────────────────────────────────────────────────

def _encode_text(text: str) -> np.ndarray:
    vec = text_model.encode(text, normalize_embeddings=True, show_progress_bar=False)
    return _to_target_dim(vec)

def _encode_image(b64: str) -> np.ndarray:
    img_bytes = base64.b64decode(b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    # Resize to 224×224 (CLIP native) before encoding
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


@app.post("/embed/image", response_model=EmbedResponse)
def embed_image(req: ImageEmbedRequest):
    try:
        ck = _cache_key("img", req.image[:512])  # hash prefix of b64
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


@app.post("/index")
def index_product(req: IndexRequest):
    doc = {"embedding": req.embedding, **req.metadata}
    es.index(index=ES_INDEX, id=req.id, body=doc, refresh=False)
    return {"indexed": req.id}


@app.post("/index/bulk")
def bulk_index(items: list[IndexRequest]):
    """Bulk index for import jobs — much faster than individual calls."""
    from elasticsearch.helpers import bulk
    actions = [
        {"_index": ES_INDEX, "_id": item.id, "_source": {"embedding": item.embedding, **item.metadata}}
        for item in items
    ]
    success, errors = bulk(es, actions, refresh=False)
    return {"indexed": success, "errors": len(errors)}


@app.post("/search/vector", response_model=SearchResponse)
def vector_search(req: VectorSearchRequest):
    t0 = time.perf_counter()

    # ES 7.x: use script_score with cosineSimilarity (returns [-1,1] + 1.0 offset → [0,2])
    response = es.search(
        index=ES_INDEX,
        body={
            "query": {
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": req.embedding},
                    },
                }
            },
            "min_score": req.min_score + 1.0,  # offset by 1.0 to match script_score range
            "_source": False,
            "size": req.limit,
        },
    )

    results = [
        SearchHit(id=hit["_id"], score=round(float(hit["_score"]) - 1.0, 6))
        for hit in response["hits"]["hits"]
    ]

    latency_ms = (time.perf_counter() - t0) * 1000
    logger.info(f"Vector search → {len(results)} hits in {latency_ms:.1f}ms (min_score={req.min_score})")

    return SearchResponse(results=results, total=len(results), latency_ms=round(latency_ms, 2))


@app.delete("/index/{product_id}")
def delete_from_index(product_id: str):
    es.delete(index=ES_INDEX, id=product_id, ignore_status=[404])
    return {"deleted": product_id}


@app.get("/health")
def health():
    es_ok = False
    redis_ok = False
    models_ok = text_model is not None and image_model is not None

    try:
        es_ok = es.ping()
    except Exception:
        pass

    try:
        cache.ping()
        redis_ok = True
    except Exception:
        pass

    status = "ok" if (es_ok and redis_ok and models_ok) else "degraded"
    return {
        "status": status,
        "elasticsearch": es_ok,
        "redis": redis_ok,
        "models_loaded": models_ok,
    }


@app.get("/metrics")
def metrics():
    """Basic operational metrics."""
    try:
        es_stats = es.indices.stats(index=ES_INDEX)
        doc_count = es_stats["_all"]["primaries"]["docs"]["count"]
        index_size_mb = round(es_stats["_all"]["primaries"]["store"]["size_in_bytes"] / 1e6, 2)
    except Exception:
        doc_count = -1
        index_size_mb = -1
    return {
        "index": ES_INDEX,
        "vector_dim": VECTOR_DIM,
        "indexed_products": doc_count,
        "index_size_mb": index_size_mb,
        "text_model": TEXT_MODEL_NAME,
        "image_model": IMAGE_MODEL_NAME,
    }
