#!/bin/bash

# Process Capture Studio - Quick Setup Script
# This script helps colleagues get started quickly

echo "🎯 Process Capture Studio - Setup Script"
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js 16+ from https://nodejs.org"
    exit 1
else
    NODE_VERSION=$(node -v)
    echo "✅ Node.js installed: $NODE_VERSION"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo "✅ npm installed: $NPM_VERSION"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python 3 is not installed (optional but recommended)"
    echo "   Install from https://python.org for full features"
else
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python installed: $PYTHON_VERSION"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Rebuilding native modules..."
npm run rebuild

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start Process Capture Studio:"
echo "  npm start           # Classic UI"
echo "  npm start:modern    # Modern UI (experimental)"
echo ""
echo "For Python capture features (optional):"
echo "  cd src/python && ./start_capture.sh"
echo ""
echo "📖 See README.md for full documentation"