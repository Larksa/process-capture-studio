#!/bin/bash

# Start capture service without Excel monitoring
# Use this if Excel capture is causing issues

echo "Starting capture service with Excel monitoring disabled..."
export DISABLE_EXCEL_CAPTURE=true

# Change to the script directory
cd "$(dirname "$0")"

# Start the Python capture service
python3 capture_service.py