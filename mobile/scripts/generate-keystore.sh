#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Generate a release keystore for signing the Android APK.
# Run ONCE and store the output securely (password manager / CI secrets).
# NEVER commit release.keystore or keystore.properties to git.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

KEYSTORE_DIR="$(dirname "$0")/../android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/release.keystore"
PROPS_FILE="$(dirname "$0")/../android/keystore.properties"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "✓ Keystore already exists at $KEYSTORE_FILE"
  echo "  Delete it first if you want to regenerate."
  exit 0
fi

echo "Generating release keystore..."
echo ""
echo "You will be prompted for:"
echo "  - Keystore password (save this!)"
echo "  - Key password (can be same as keystore password)"
echo "  - Your name / organisation details"
echo ""

keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_FILE" \
  -alias product-search-key \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

echo ""
echo "✓ Keystore generated: $KEYSTORE_FILE"
echo ""
echo "Now create $PROPS_FILE with:"
echo "─────────────────────────────────────────"
echo "MYAPP_UPLOAD_STORE_FILE=release.keystore"
echo "MYAPP_UPLOAD_KEY_ALIAS=product-search-key"
echo "MYAPP_UPLOAD_STORE_PASSWORD=<your_store_password>"
echo "MYAPP_UPLOAD_KEY_PASSWORD=<your_key_password>"
echo "─────────────────────────────────────────"
echo ""
echo "⚠  Add keystore.properties and release.keystore to .gitignore"
