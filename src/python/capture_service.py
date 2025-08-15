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
            app_name = command.get('application', 'Unknown')
            window = command.get('window', '')
            print(f"📋 Received request to capture paste destination in {app_name}")
            await self.capture_paste_destination(command.get('timestamp'), app_name, window)
    
    async def capture_paste_destination(self, paste_timestamp, app_name, window_title):
        """Capture paste destination context based on application type"""
        # Application-specific handlers
        handlers = {
            'Excel': self._capture_excel_destination,
            'Word': self._capture_word_destination,
            'PowerPoint': self._capture_powerpoint_destination,
            'Chrome': self._capture_browser_destination,
            'Safari': self._capture_browser_destination,
            'Firefox': self._capture_browser_destination,
            'Edge': self._capture_browser_destination,
        }
        
        # Find appropriate handler
        handler = None
        for app_key in handlers:
            if app_key.lower() in app_name.lower():
                handler = handlers[app_key]
                break
        
        # Use generic handler if no specific one found
        if not handler:
            handler = self._capture_generic_destination
        
        # Call the handler
        destination_context = await handler(app_name, window_title)
        
        # Create unified paste event
        await self._create_unified_paste_event(paste_timestamp, destination_context)
    
    async def _capture_excel_destination(self, app_name, window_title):
        """Capture Excel-specific destination context"""
        destination = {
            'application': app_name,
            'window': window_title,
            'type': 'spreadsheet'
        }
        
        # Get current Excel selection as destination
        if self.excel_capture.excel:
            # Force immediate capture of current selection
            self.excel_capture.capture_selection()
            
            try:
                if platform.system() == "Windows" and self.excel_capture.excel:
                    sheet = self.excel_capture.excel.ActiveSheet
                    workbook = self.excel_capture.excel.ActiveWorkbook
                    selection = self.excel_capture.excel.Selection
                    
                    destination.update({
                        'document': workbook.Name,
                        'location': {
                            'sheet': sheet.Name,
                            'address': selection.Address,
                            'type': 'cell_range'
                        },
                        'path': workbook.FullName
                    })
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
                        destination.update({
                            'document': result[2],
                            'location': {
                                'sheet': result[1],
                                'address': result[0],
                                'type': 'cell_range'
                            },
                            'path': result[3]
                        })
            except Exception as e:
                print(f"Error capturing Excel destination: {e}")
        
        return destination
    
    async def _capture_word_destination(self, app_name, window_title):
        """Capture Word-specific destination context"""
        destination = {
            'application': app_name,
            'window': window_title,
            'type': 'document',
            'document': self._extract_document_name(window_title, 'Word')
        }
            
        try:
            if platform.system() == "Darwin":
                # macOS - use AppleScript for Word
                script = '''
                tell application "Microsoft Word"
                    try
                        set docName to name of active document
                        set docPath to path of active document
                        set cursorPos to selection start of selection
                        set pageNum to page number of cursorPos
                        set paraNum to paragraph number of cursorPos
                        return {docName, docPath, pageNum, paraNum}
                    on error
                        return missing value
                    end try
                end tell
                '''
                as_script = applescript.AppleScript(script)
                result = as_script.run()
                
                if result and result != 'missing value' and isinstance(result, list):
                    destination.update({
                        'document': result[0] if len(result) > 0 else window_title,
                        'location': {
                            'page': result[2] if len(result) > 2 else 'Unknown',
                            'paragraph': result[3] if len(result) > 3 else 'Unknown',
                            'type': 'text_position'
                        },
                        'path': result[1] if len(result) > 1 else None
                    })
            elif platform.system() == "Windows":
                # Windows COM automation for Word
                try:
                    import win32com.client
                    word = win32com.client.GetObject(Class="Word.Application")
                    if word and word.ActiveDocument:
                        doc = word.ActiveDocument
                        sel = word.Selection
                        destination.update({
                            'document': doc.Name,
                            'location': {
                                'page': sel.Information(3),  # wdActiveEndPageNumber
                                'line': sel.Information(10),  # wdFirstCharacterLineNumber
                                'type': 'text_position'
                            },
                            'path': doc.FullName
                        })
                except:
                    pass
        except Exception as e:
            print(f"Error capturing Word destination: {e}")
        
        return destination
    
    async def _capture_powerpoint_destination(self, app_name, window_title):
        """Capture PowerPoint-specific destination context"""
        destination = {
            'application': app_name,
            'window': window_title,
            'type': 'presentation',
            'document': self._extract_document_name(window_title, 'PowerPoint')
        }
            
        try:
            if platform.system() == "Darwin":
                # macOS - use AppleScript for PowerPoint
                script = '''
                tell application "Microsoft PowerPoint"
                    try
                        set presName to name of active presentation
                        set slideNum to slide index of slide of view of active window
                        return {presName, slideNum}
                    on error
                        return missing value
                    end try
                end tell
                '''
                as_script = applescript.AppleScript(script)
                result = as_script.run()
                
                if result and result != 'missing value' and isinstance(result, list):
                    destination.update({
                        'document': result[0] if len(result) > 0 else window_title,
                        'location': {
                            'slide': result[1] if len(result) > 1 else 'Unknown',
                            'type': 'slide'
                        }
                    })
            elif platform.system() == "Windows":
                # Windows COM automation for PowerPoint
                try:
                    import win32com.client
                    ppt = win32com.client.GetObject(Class="PowerPoint.Application")
                    if ppt and ppt.ActivePresentation:
                        pres = ppt.ActivePresentation
                        window = ppt.ActiveWindow
                        destination.update({
                            'document': pres.Name,
                            'location': {
                                'slide': window.Selection.SlideRange.SlideNumber if window.Selection.Type == 2 else 'Unknown',
                                'type': 'slide'
                            },
                            'path': pres.FullName
                        })
                except:
                    pass
        except Exception as e:
            print(f"Error capturing PowerPoint destination: {e}")
        
        return destination
    
    async def _capture_browser_destination(self, app_name, window_title):
        """Capture browser/web app destination context"""
        destination = {
            'application': app_name,
            'window': window_title,
            'type': 'web_application'
        }
        
        # Extract URL and page title from window title
        # Common patterns: "Page Title - Domain - Browser"
        parts = window_title.split(' - ') if window_title else []
        
        if len(parts) >= 2:
            destination['page_title'] = parts[0]
            destination['domain'] = parts[-2] if len(parts) > 2 else parts[1]
            
            # Detect specific web applications
            web_apps = {
                'salesforce': 'Salesforce',
                'activecampaign': 'ActiveCampaign',
                'wordpress': 'WordPress',
                'gmail': 'Gmail',
                'docs.google': 'Google Docs',
                'sheets.google': 'Google Sheets',
                'notion': 'Notion',
                'airtable': 'Airtable',
                'hubspot': 'HubSpot',
                'slack': 'Slack',
                'trello': 'Trello',
                'jira': 'Jira'
            }
            
            for key, app in web_apps.items():
                if key in window_title.lower():
                    destination['web_app'] = app
                    destination['type'] = 'web_application'
                    break
        
        # For now, we can't get the exact form field without browser extension
        # But we can infer from the page title
        destination['location'] = {
            'page': destination.get('page_title', 'Unknown'),
            'type': 'web_form'
        }
        
        return destination
    
    async def _capture_generic_destination(self, app_name, window_title):
        """Generic fallback for unknown applications"""
        return {
            'application': app_name,
            'window': window_title,
            'type': 'unknown',
            'document': self._extract_document_name(window_title, app_name),
            'location': {
                'type': 'unknown',
                'timestamp': datetime.now().isoformat()
            }
        }
    
    def _extract_document_name(self, window_title, app_name):
        """Extract document name from window title"""
        if not window_title:
            return 'Untitled'
        
        # Common patterns to remove
        suffixes = [f' - {app_name}', f' — {app_name}', f' – {app_name}', 
                   ' - Microsoft', ' - Google', ' - Adobe']
        
        for suffix in suffixes:
            if suffix in window_title:
                return window_title.split(suffix)[0]
        
        return window_title
    
    async def _create_unified_paste_event(self, paste_timestamp, destination_context):
        """Create a unified paste event with source and destination"""
        # Get last clipboard entry for source context
        last_clipboard = self.clipboard_monitor.get_last_clipboard() if self.clipboard_monitor else None
        
        # Create unified paste event
        paste_event = {
            'type': 'cross_app_paste',
            'timestamp': datetime.now().isoformat(),
            'paste_timestamp': paste_timestamp,
            'source': None,
            'destination': destination_context,
            'data_flow': {}
        }
        
        # Add source context from clipboard
        if last_clipboard:
            source = {
                'application': last_clipboard.get('source', {}).get('application', 'Unknown'),
                'window': last_clipboard.get('source', {}).get('window_title', ''),
                'content': last_clipboard.get('content_preview', ''),
                'data_type': last_clipboard.get('data_type', 'text')
            }
            
            # Add Excel-specific source info if available
            if last_clipboard.get('source', {}).get('excel_selection'):
                excel_info = last_clipboard['source']['excel_selection']
                source['document'] = excel_info.get('workbook')
                source['location'] = {
                    'sheet': excel_info.get('sheet'),
                    'address': excel_info.get('address'),
                    'type': 'cell_range'
                }
                source['path'] = excel_info.get('path')
                source['type'] = 'spreadsheet'
            else:
                # Generic source
                source['document'] = last_clipboard.get('source', {}).get('document', 'Unknown')
                source['type'] = self._infer_app_type(source['application'])
            
            paste_event['source'] = source
        
        # Create data flow description
        if paste_event['source'] and paste_event['destination']:
            src_desc = self._format_location(paste_event['source'])
            dst_desc = self._format_location(paste_event['destination'])
            
            paste_event['data_flow'] = {
                'from': src_desc,
                'to': dst_desc,
                'transformation': self._detect_transformation(
                    paste_event['source']['type'],
                    paste_event['destination']['type']
                )
            }
            
            paste_event['description'] = f"Pasted from {src_desc} to {dst_desc}"
            print(f"📋 Cross-app paste: {src_desc} → {dst_desc}")
        else:
            paste_event['description'] = "Paste operation (incomplete context)"
        
        # Send unified paste event
        await self.send_to_electron(paste_event)
    
    def _infer_app_type(self, app_name):
        """Infer application type from name"""
        app_lower = app_name.lower() if app_name else ''
        
        if 'excel' in app_lower or 'sheets' in app_lower:
            return 'spreadsheet'
        elif 'word' in app_lower or 'docs' in app_lower:
            return 'document'
        elif 'powerpoint' in app_lower or 'slides' in app_lower:
            return 'presentation'
        elif any(browser in app_lower for browser in ['chrome', 'safari', 'firefox', 'edge']):
            return 'web_application'
        elif 'code' in app_lower or 'sublime' in app_lower or 'atom' in app_lower:
            return 'code_editor'
        else:
            return 'unknown'
    
    def _format_location(self, context):
        """Format location for display"""
        if not context:
            return 'Unknown'
        
        app = context.get('application', 'Unknown')
        doc = context.get('document', '')
        
        # Format based on type
        if context.get('type') == 'spreadsheet' and context.get('location'):
            loc = context['location']
            return f"{doc or app}!{loc.get('sheet', '')}!{loc.get('address', '')}"
        elif context.get('type') == 'document' and context.get('location'):
            loc = context['location']
            return f"{doc or app} (Page {loc.get('page', '?')}, Para {loc.get('paragraph', '?')})"
        elif context.get('type') == 'presentation' and context.get('location'):
            loc = context['location']
            return f"{doc or app} (Slide {loc.get('slide', '?')})"
        elif context.get('type') == 'web_application':
            web_app = context.get('web_app', context.get('domain', app))
            return f"{web_app}: {context.get('page_title', 'Unknown page')}"
        else:
            return doc or app
    
    def _detect_transformation(self, source_type, dest_type):
        """Detect data transformation between applications"""
        transformations = {
            ('spreadsheet', 'document'): 'table_to_text',
            ('spreadsheet', 'presentation'): 'data_to_slide',
            ('spreadsheet', 'web_application'): 'data_to_form',
            ('document', 'spreadsheet'): 'text_to_cells',
            ('document', 'presentation'): 'text_to_slide',
            ('document', 'web_application'): 'text_to_form',
            ('web_application', 'spreadsheet'): 'web_to_data',
            ('web_application', 'document'): 'web_to_text'
        }
        
        return transformations.get((source_type, dest_type), 'direct_paste')
    
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