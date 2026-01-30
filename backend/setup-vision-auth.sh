#!/bin/bash
# Quick setup script for Vision API authentication

echo "🔧 Setting up Google Cloud Vision API Authentication"
echo ""

# Check if gcloud is installed
if command -v gcloud &> /dev/null; then
    echo "✅ gcloud CLI found"
    echo ""
    echo "Setting up Application Default Credentials..."
    gcloud auth application-default login
    gcloud config set project cookthispage
    echo ""
    echo "✅ Authentication setup complete!"
    echo ""
    echo "Test it with:"
    echo "  gcloud auth application-default print-access-token"
else
    echo "❌ gcloud CLI not found"
    echo ""
    echo "Option 1: Install gcloud CLI"
    echo "  brew install google-cloud-sdk"
    echo ""
    echo "Option 2: Use service account key file"
    echo "  1. Create service account in Google Cloud Console"
    echo "  2. Download JSON key"
    echo "  3. Set: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
    echo ""
    echo "See SETUP_VISION_AUTH_STEPS.md for detailed instructions"
fi
