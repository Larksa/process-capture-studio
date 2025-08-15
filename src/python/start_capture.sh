#!/bin/bash

# Process Capture Studio - Python Service Startup Script

echo "🚀 Starting Process Capture Python Service..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if virtual environment exists
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv "$SCRIPT_DIR/venv"
fi

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

# Install/update dependencies
echo "📚 Installing dependencies..."
pip install -q -r "$SCRIPT_DIR/requirements.txt"

# Platform-specific installations
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Installing macOS-specific dependencies..."
    pip install -q pyobjc-core pyobjc-framework-Quartz py-applescript
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "🪟 Installing Windows-specific dependencies..."
    pip install -q pywin32
fi

# Start the capture service
echo "✅ Starting capture service..."
python "$SCRIPT_DIR/capture_service.py"