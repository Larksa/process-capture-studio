#!/usr/bin/env python3
"""
Process Capture Studio - Python Capture Service
Captures file system operations, desktop interactions, and bridges with Electron
"""

import os
import sys
import json
import time
import platform
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import threading
import queue

# File system monitoring
from watchdog import observers
from watchdog.events import FileSystemEventHandler

# IPC with Electron
import socket
import asyncio
import websockets

# Clipboard monitoring
from clipboard_monitor import ClipboardMonitor

# Platform-specific imports
if platform.system() == "Windows":
    import win32com.client
    import win32gui
    import win32process
elif platform.system() == "Darwin":  # macOS
    import applescript
    import Quartz

class FileSystemCapture(FileSystemEventHandler):
    """Captures file system operations - moves, copies, deletes, renames"""
    
    def __init__(self, event_queue: queue.Queue):
        self.event_queue = event_queue
        self.ignored_paths = [
            '.git', '__pycache__', 'node_modules', '.DS_Store',
            'Thumbs.db', '.pytest_cache', '.vscode', '.idea'
        ]
    
    def should_ignore(self, path: str) -> bool:
        """Check if path should be ignored"""
        path_str = str(path)
        return any(ignored in path_str for ignored in self.ignored_paths)
    
    def on_moved(self, event):
        """File or directory moved/renamed"""
        if not event.is_directory and not self.should_ignore(event.src_path):
            self.event_queue.put({
                'type': 'file_moved',
                'timestamp': datetime.now().isoformat(),
                'source_path': event.src_path,
                'dest_path': event.dest_path,
                'filename': Path(event.dest_path).name,
                'extension': Path(event.dest_path).suffix,
                'context': self._get_context(event.dest_path)
            })
    
    def on_created(self, event):
        """File or directory created"""
        if not event.is_directory and not self.should_ignore(event.src_path):
            self.event_queue.put({
                'type': 'file_created',
                'timestamp': datetime.now().isoformat(),
                'path': event.src_path,
                'filename': Path(event.src_path).name,
                'extension': Path(event.src_path).suffix,
                'context': self._get_context(event.src_path)
            })
    
    def on_deleted(self, event):
        """File or directory deleted"""
        if not event.is_directory and not self.should_ignore(event.src_path):
            self.event_queue.put({
                'type': 'file_deleted',
                'timestamp': datetime.now().isoformat(),
                'path': event.src_path,
                'filename': Path(event.src_path).name,
                'extension': Path(event.src_path).suffix
            })
    
    def on_modified(self, event):
        """File modified - filter for relevant changes"""
        if not event.is_directory and not self.should_ignore(event.src_path):
            # Only capture modifications to office docs, PDFs, images
            relevant_extensions = ['.xlsx', '.docx', '.pdf', '.csv', '.txt', '.json', '.xml']
            if Path(event.src_path).suffix.lower() in relevant_extensions:
                self.event_queue.put({
                    'type': 'file_modified',
                    'timestamp': datetime.now().isoformat(),
                    'path': event.src_path,
                    'filename': Path(event.src_path).name,
                    'extension': Path(event.src_path).suffix,
                    'size': self._get_file_size(event.src_path)
                })
    
    def _get_context(self, path: str) -> Dict[str, Any]:
        """Get context about where the file came from/is going"""
        path_obj = Path(path)
        context = {
            'is_download': 'Downloads' in str(path),
            'is_desktop': 'Desktop' in str(path),
            'is_documents': 'Documents' in str(path),
            'is_cloud': any(cloud in str(path) for cloud in ['Dropbox', 'OneDrive', 'Google Drive', 'iCloud']),
            'parent_folder': path_obj.parent.name
        }
        return context
    
    def _get_file_size(self, path: str) -> Optional[int]:
        """Get file size in bytes"""
        try:
            return os.path.getsize(path)
        except:
            return None


class ExcelCapture:
    """Captures Excel operations - cell edits, formula changes, sheet navigation"""
    
    def __init__(self, event_queue: queue.Queue):
        self.event_queue = event_queue
        self.excel = None
        self.active_workbook = None
        self.last_selection = None
        self.monitoring = False
    
    def connect(self) -> bool:
        """Connect to Excel instance"""
        try:
            if platform.system() == "Windows":
                import win32com.client
                try:
                    # Try to get existing Excel instance
                    self.excel = win32com.client.GetObject(Class="Excel.Application")
                    return True
                except:
                    # No Excel running
                    return False
            elif platform.system() == "Darwin":
                # macOS - use AppleScript
                try:
                    script = applescript.AppleScript('tell application "Microsoft Excel" to get name')
                    result = script.run()
                    if result:
                        self.excel = True  # Flag for macOS
                        return True
                except:
                    pass
            return False
        except:
            return False
    
    def capture_selection(self):
        """Capture current Excel selection with values"""
        try:
            if platform.system() == "Windows" and self.excel:
                self._capture_windows_excel()
            elif platform.system() == "Darwin" and self.excel:
                self._capture_macos_excel()
        except Exception as e:
            print(f"Excel capture error: {e}")
    
    def _capture_windows_excel(self):
        """Capture Excel data on Windows"""
        try:
            selection = self.excel.Selection
            sheet = self.excel.ActiveSheet
            workbook = self.excel.ActiveWorkbook
            
            # Get selection details
            address = selection.Address
            
            # Skip if same selection
            if address == self.last_selection:
                return
            self.last_selection = address
            
            # Get values (handle single cell vs range)
            value = None
            formula = None
            cell_data = []
            
            try:
                if selection.Count == 1:
                    # Single cell
                    value = selection.Value
                    formula = selection.Formula if selection.HasFormula else None
                    cell_data = [{
                        'address': address,
                        'value': value,
                        'formula': formula
                    }]
                else:
                    # Multiple cells
                    values = selection.Value
                    if values:
                        # Convert to list of cell data
                        for i, row in enumerate(values):
                            if isinstance(row, (list, tuple)):
                                for j, val in enumerate(row):
                                    cell = selection.Cells(i+1, j+1)
                                    cell_data.append({
                                        'address': cell.Address,
                                        'value': val,
                                        'formula': cell.Formula if cell.HasFormula else None
                                    })
                            else:
                                # Single column/row
                                cell = selection.Cells(i+1, 1)
                                cell_data.append({
                                    'address': cell.Address,
                                    'value': row,
                                    'formula': cell.Formula if cell.HasFormula else None
                                })
            except:
                pass
            
            # Create event
            event = {
                'type': 'excel_selection',
                'timestamp': datetime.now().isoformat(),
                'address': address,
                'sheet': sheet.Name,
                'workbook': workbook.Name,
                'workbook_path': workbook.FullName,
                'value': value,  # Primary value for single cells
                'formula': formula,
                'cells': cell_data[:10],  # Limit to first 10 cells
                'cell_count': selection.Count,
                'context': {
                    'has_formula': any(c.get('formula') for c in cell_data),
                    'data_type': self._detect_excel_data_type(value or cell_data)
                }
            }
            
            self.event_queue.put(event)
            print(f"📊 Excel: Selected {address} in {sheet.Name} - {self._preview_value(value)}")
            
        except Exception as e:
            print(f"Windows Excel capture error: {e}")
    
    def _capture_macos_excel(self):
        """Capture Excel data on macOS using AppleScript"""
        try:
            # Get current selection info
            script = '''
            tell application "Microsoft Excel"
                set sel to selection
                set addr to get address of sel
                set sheetName to name of active sheet
                set wbName to name of active workbook
                set val to value of sel
                return {addr, sheetName, wbName, val}
            end tell
            '''
            as_script = applescript.AppleScript(script)
            result = as_script.run()
            
            if result:
                # Parse result - it could be a list or string
                if isinstance(result, list) and len(result) >= 4:
                    parts = result
                elif isinstance(result, str):
                    parts = result.split(', ')
                else:
                    return
                    
                if len(parts) >= 4:
                    address = parts[0]
                    
                    # Skip if same selection
                    if address == self.last_selection:
                        return
                    self.last_selection = address
                    
                    event = {
                        'type': 'excel_selection',
                        'timestamp': datetime.now().isoformat(),
                        'address': address,
                        'sheet': parts[1],
                        'workbook': parts[2],
                        'value': parts[3] if len(parts) > 3 else None,
                        'context': {
                            'platform': 'macOS'
                        }
                    }
                    
                    self.event_queue.put(event)
                    print(f"📊 Excel: Selected {address} in {parts[1]}")
                    
        except Exception as e:
            print(f"macOS Excel capture error: {e}")
    
    def _detect_excel_data_type(self, value):
        """Detect the type of data in Excel cell"""
        if value is None:
            return 'empty'
        
        if isinstance(value, (list, tuple)):
            # Range of cells
            return 'range'
        
        value_str = str(value)
        
        # Check for number
        try:
            float(value_str)
            return 'number'
        except:
            pass
        
        # Check for date (basic)
        if '/' in value_str or '-' in value_str:
            parts = value_str.replace('/', '-').split('-')
            if len(parts) == 3 and all(p.strip().isdigit() for p in parts):
                return 'date'
        
        # Check for formula
        if value_str.startswith('='):
            return 'formula'
        
        # Check for email
        if '@' in value_str and '.' in value_str:
            return 'email'
        
        return 'text'
    
    def _preview_value(self, value, max_length=30):
        """Get a preview of the cell value"""
        if value is None:
            return 'Empty'
        
        value_str = str(value)
        if len(value_str) <= max_length:
            return value_str
        
        return value_str[:max_length] + '...'


class DesktopCapture:
    """Captures desktop application interactions"""
    
    def __init__(self, event_queue: queue.Queue):
        self.event_queue = event_queue
        self.active_window = None
    
    def get_active_window(self) -> Dict[str, Any]:
        """Get information about the active window"""
        window_info = {}
        
        if platform.system() == "Windows":
            try:
                import win32gui
                hwnd = win32gui.GetForegroundWindow()
                window_info = {
                    'title': win32gui.GetWindowText(hwnd),
                    'handle': hwnd,
                    'platform': 'Windows'
                }
            except:
                pass
        elif platform.system() == "Darwin":
            try:
                # Use Quartz for macOS
                from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID
                window_list = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)
                for window in window_list:
                    if window.get('kCGWindowLayer', 0) == 0:
                        window_info = {
                            'title': window.get('kCGWindowName', 'Unknown'),
                            'owner': window.get('kCGWindowOwnerName', 'Unknown'),
                            'platform': 'macOS'
                        }
                        break
            except:
                pass
        
        return window_info


class ProcessCaptureService:
    """Main service coordinating all capture types"""
    
    def __init__(self):
        self.event_queue = queue.Queue()
        self.observers = []
        self.running = False
        
        # Initialize capture components
        self.file_capture = FileSystemCapture(self.event_queue)
        self.excel_capture = ExcelCapture(self.event_queue)
        self.desktop_capture = DesktopCapture(self.event_queue)
        self.clipboard_monitor = ClipboardMonitor(self.event_queue)
        
        # WebSocket connection to Electron
        self.websocket = None
        self.electron_connected = False
    
    def start_file_monitoring(self, paths: List[str]):
        """Start monitoring specified paths"""
        for path in paths:
            if os.path.exists(path):
                observer = observers.Observer()
                observer.schedule(self.file_capture, path, recursive=True)
                observer.start()
                self.observers.append(observer)
                print(f"📁 Monitoring: {path}")
    
    def stop_file_monitoring(self):
        """Stop all file system observers"""
        for observer in self.observers:
            observer.stop()
            observer.join()
        self.observers.clear()
    
    async def connect_to_electron(self, port: int = 9876):
        """Establish WebSocket connection to Electron app"""
        try:
            uri = f"ws://localhost:{port}"
            self.websocket = await websockets.connect(uri)
            self.electron_connected = True
            print(f"🔌 Connected to Electron on port {port}")
            
            # Send initial handshake
            await self.websocket.send(json.dumps({
                'type': 'python_service_connected',
                'platform': platform.system(),
                'capabilities': ['file_system', 'excel', 'desktop']
            }))
            
            # Start listening for commands from Electron
            asyncio.create_task(self.listen_for_commands())
        except Exception as e:
            print(f"❌ Failed to connect to Electron: {e}")
            self.electron_connected = False
    
    async def send_to_electron(self, event: Dict[str, Any]):
        """Send captured event to Electron"""
        if self.websocket and self.electron_connected:
            try:
                await self.websocket.send(json.dumps(event))
            except:
                self.electron_connected = False
    
    async def listen_for_commands(self):
        """Listen for commands from Electron"""
        if not self.websocket:
            return
            
        try:
            async for message in self.websocket:
                try:
                    command = json.loads(message)
                    await self.handle_command(command)
                except json.JSONDecodeError:
                    print(f"Invalid command received: {message}")
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
            self.electron_connected = False
    
    async def handle_command(self, command: Dict[str, Any]):
        """Handle commands from Electron"""
        cmd_type = command.get('type')
        
        if cmd_type == 'capture_paste_destination':
            print("📋 Received request to capture paste destination")
            await self.capture_paste_destination(command.get('timestamp'))
    
    async def capture_paste_destination(self, paste_timestamp):
        """Capture Excel destination context when paste happens"""
        # Get current Excel selection as destination
        if self.excel_capture.excel:
            # Force immediate capture of current selection
            self.excel_capture.capture_selection()
            
            # Get last clipboard entry for source context
            last_clipboard = self.clipboard_monitor.get_last_clipboard() if self.clipboard_monitor else None
            
            # Create enriched paste event
            paste_event = {
                'type': 'excel_paste',
                'timestamp': datetime.now().isoformat(),
                'paste_timestamp': paste_timestamp,
                'source': None,
                'destination': None
            }
            
            # Add source context from clipboard
            if last_clipboard and last_clipboard.get('source', {}).get('excel_selection'):
                paste_event['source'] = {
                    'workbook': last_clipboard['source']['excel_selection'].get('workbook'),
                    'sheet': last_clipboard['source']['excel_selection'].get('sheet'),
                    'address': last_clipboard['source']['excel_selection'].get('address'),
                    'path': last_clipboard['source']['excel_selection'].get('path'),
                    'content': last_clipboard.get('content_preview')
                }
            
            # Get destination from current Excel state
            try:
                if platform.system() == "Windows" and self.excel_capture.excel:
                    sheet = self.excel_capture.excel.ActiveSheet
                    workbook = self.excel_capture.excel.ActiveWorkbook
                    selection = self.excel_capture.excel.Selection
                    
                    paste_event['destination'] = {
                        'workbook': workbook.Name,
                        'sheet': sheet.Name,
                        'address': selection.Address,
                        'path': workbook.FullName
                    }
                elif platform.system() == "Darwin":
                    # macOS - use AppleScript
                    script = '''
                    tell application "Microsoft Excel"
                        set sel to selection
                        set addr to get address of sel
                        set sheetName to name of active sheet
                        set wbName to name of active workbook
                        set wbPath to full name of active workbook
                        return {addr, sheetName, wbName, wbPath}
                    end tell
                    '''
                    as_script = applescript.AppleScript(script)
                    result = as_script.run()
                    
                    if result and isinstance(result, list) and len(result) >= 4:
                        paste_event['destination'] = {
                            'address': result[0],
                            'sheet': result[1],
                            'workbook': result[2],
                            'path': result[3]
                        }
            except Exception as e:
                print(f"Error capturing paste destination: {e}")
            
            # Send enriched paste event
            if paste_event['source'] and paste_event['destination']:
                paste_event['description'] = f"Pasted from {paste_event['source']['workbook']} to {paste_event['destination']['workbook']}"
                print(f"📊 Excel paste: {paste_event['source']['address']} ({paste_event['source']['workbook']}) → {paste_event['destination']['address']} ({paste_event['destination']['workbook']})")
            else:
                paste_event['description'] = "Paste operation (incomplete context)"
            
            await self.send_to_electron(paste_event)
    
    def process_events(self):
        """Process queued events and send to Electron"""
        while self.running:
            try:
                # Get event with timeout to allow checking running flag
                event = self.event_queue.get(timeout=1)
                
                # Log locally
                print(f"📸 Captured: {event['type']} - {event.get('path', event.get('filename', ''))}")
                
                # Send to Electron if connected
                if self.electron_connected:
                    asyncio.run(self.send_to_electron(event))
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error processing event: {e}")
    
    def run(self):
        """Main service loop"""
        print("🚀 Process Capture Python Service Starting...")
        print(f"📍 Platform: {platform.system()}")
        
        # Default paths to monitor
        home = str(Path.home())
        default_paths = [
            os.path.join(home, 'Downloads'),
            os.path.join(home, 'Desktop'),
            os.path.join(home, 'Documents')
        ]
        
        # Start file monitoring
        self.start_file_monitoring(default_paths)
        
        # Start clipboard monitoring
        if self.clipboard_monitor.start():
            print("📋 Clipboard monitoring active")
        
        # Try to connect to Excel
        if self.excel_capture.connect():
            print("📊 Connected to Excel")
        
        # Try to connect to Electron
        asyncio.run(self.connect_to_electron())
        
        # Start processing events
        self.running = True
        event_thread = threading.Thread(target=self.process_events)
        event_thread.start()
        
        print("✅ Service running. Press Ctrl+C to stop.")
        
        try:
            while self.running:
                time.sleep(1)
                # Periodically check Excel
                if self.excel_capture.excel:
                    self.excel_capture.capture_selection()
        except KeyboardInterrupt:
            print("\n🛑 Stopping service...")
            self.running = False
            self.stop_file_monitoring()
            self.clipboard_monitor.stop()
            event_thread.join()
            print("👋 Service stopped")


if __name__ == "__main__":
    service = ProcessCaptureService()
    service.run()