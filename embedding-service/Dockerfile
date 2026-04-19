FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake ML models into the image so startup is instant (no download at runtime)
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
print('Downloading text model...'); \
SentenceTransformer('all-MiniLM-L6-v2'); \
print('Downloading CLIP model...'); \
SentenceTransformer('clip-ViT-B-32'); \
print('Done.')"

COPY . .

EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
