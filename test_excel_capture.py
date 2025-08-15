#!/usr/bin/env python3
"""
Test script to verify Excel capture is working
Run this with Excel open and some data in cells
"""

import time
import sys
sys.path.append('src/python')

from clipboard_monitor import ClipboardMonitor
import queue

def test_excel_capture():
    print("📊 Excel Capture Test")
    print("-" * 40)
    print("1. Open Excel with testingauto.xlsx")
    print("2. Put 'Andrew' in A1 and 'Larkey' in B1")
    print("3. Select both cells and copy (Cmd+C)")
    print("4. Watch the output below")
    print("-" * 40)
    
    # Create event queue and monitor
    event_queue = queue.Queue()
    monitor = ClipboardMonitor(event_queue)
    
    # Start monitoring
    monitor.start()
    print("✅ Monitoring started. Copy from Excel now...")
    
    # Monitor for 30 seconds
    start_time = time.time()
    while time.time() - start_time < 30:
        try:
            # Check for events
            if not event_queue.empty():
                event = event_queue.get()
                print("\n📋 Clipboard Event Captured:")
                print(f"   Content: {event.get('content_preview')}")
                print(f"   From: {event['source'].get('application')}")
                print(f"   Document: {event['source'].get('document')}")
                
                # If Excel cells captured
                if event.get('excel_cells'):
                    cells = event['excel_cells']
                    print(f"   📊 Excel Details:")
                    print(f"      Cells: {cells.get('address')}")
                    print(f"      Sheet: {cells.get('sheet')}")
                    print(f"      Workbook: {cells.get('workbook')}")
                    print(f"      Path: {cells.get('path')}")
                    print("\n   ✅ SUCCESS! Full Excel context captured for repeatability!")
                else:
                    print("   ⚠️  No Excel cell details captured")
                print()
                
            time.sleep(0.5)
        except KeyboardInterrupt:
            break
    
    # Stop monitoring
    monitor.stop()
    print("Monitoring stopped")

if __name__ == "__main__":
    test_excel_capture()