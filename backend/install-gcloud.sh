#!/bin/bash
echo "Installing Google Cloud SDK..."

# Check if brew is available
if command -v brew &> /dev/null; then
    echo "✅ Homebrew found. Installing gcloud..."
    brew install --cask google-cloud-sdk
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your terminal or run: source ~/.zshrc"
    echo "  2. Run: gcloud init"
    echo "  3. Run: gcloud auth application-default login"
else
    echo "❌ Homebrew not found."
    echo ""
    echo "Option 1: Install Homebrew first"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "Option 2: Install gcloud manually"
    echo "  Visit: https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "Option 3: Use service account key file (no gcloud needed)"
    echo "  See SETUP_VISION_AUTH_STEPS.md for instructions"
fi
