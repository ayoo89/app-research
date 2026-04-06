#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Build a signed release APK.
# Usage:
#   ./scripts/build-release.sh
#   API_BASE_URL=https://api.yourdomain.com/api/v1 ./scripts/build-release.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$MOBILE_DIR/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/release"

# ── Validate prerequisites ────────────────────────────────────────────────────
command -v node   >/dev/null 2>&1 || { echo "❌ node not found"; exit 1; }
command -v java   >/dev/null 2>&1 || { echo "❌ java not found (need JDK 17)"; exit 1; }

if [ ! -f "$ANDROID_DIR/app/release.keystore" ] && [ -z "${MYAPP_UPLOAD_STORE_PASSWORD:-}" ]; then
  echo "❌ No keystore found. Run: ./scripts/generate-keystore.sh"
  exit 1
fi

# ── Set API URL ───────────────────────────────────────────────────────────────
API_BASE_URL="${API_BASE_URL:-https://api.yourdomain.com/api/v1}"
echo "📡 API_BASE_URL = $API_BASE_URL"

# ── Install JS dependencies ───────────────────────────────────────────────────
echo "📦 Installing dependencies..."
cd "$MOBILE_DIR"
npm ci --prefer-offline

# ── Clean previous build ──────────────────────────────────────────────────────
echo "🧹 Cleaning previous build..."
cd "$ANDROID_DIR"
./gradlew clean --quiet

# ── Build release APK ─────────────────────────────────────────────────────────
echo "🔨 Building release APK..."
./gradlew assembleRelease \
  -PAPI_BASE_URL="$API_BASE_URL" \
  --no-daemon \
  --stacktrace

# ── Output ────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Build complete!"
echo ""
echo "APK files:"
find "$APK_OUT" -name "*.apk" | while read -r apk; do
  size=$(du -sh "$apk" | cut -f1)
  echo "  📱 $apk  ($size)"
done
echo ""
echo "Install on connected device:"
echo "  adb install $APK_OUT/app-release.apk"
echo ""
echo "Or copy the universal APK:"
echo "  $APK_OUT/app-universal-release.apk"
