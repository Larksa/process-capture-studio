#!/usr/bin/env python3
"""
Universal Clipboard Monitor
Captures clipboard content with source context for data flow tracking
"""

import time
import threading
import platform
from typing import Optional, Dict, Any
from datetime import datetime

# Cross-platform clipboard library
try:
    import pyperclip
except ImportError:
    pyperclip = None
    print("Warning: pyperclip not installed. Install with: pip install pyperclip")

# Platform-specific imports for enhanced context
if platform.system() == "Darwin":  # macOS
    try:
        import applescript
        import Quartz
    except ImportError:
        applescript = None
        Quartz = None
elif platform.system() == "Windows":
    try:
        import win32clipboard
        import win32gui
        import win32process
        import psutil
    except ImportError:
        win32clipboard = None
        psutil = None


class ClipboardMonitor:
    """Monitors clipboard changes and captures content with context"""
    
    def __init__(self, event_queue):
        self.event_queue = event_queue
        self.last_clipboard = ""
        self.monitoring = False
        self.monitor_thread = None
        self.clipboard_history = []
        self.max_history = 50
        
    def start(self):
        """Start monitoring clipboard changes"""
        if not pyperclip:
            print("❌ Clipboard monitoring disabled - pyperclip not installed")
            return False
            
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        print("📋 Clipboard monitoring started")
        return True
    
    def stop(self):
        """Stop monitoring clipboard"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1)
        print("📋 Clipboard monitoring stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring:
            try:
                current_clipboard = pyperclip.paste()
                
                # Check if clipboard changed
                if current_clipboard and current_clipboard != self.last_clipboard:
                    self._handle_clipboard_change(current_clipboard)
                    self.last_clipboard = current_clipboard
                    
            except Exception as e:
                print(f"Clipboard monitor error: {e}")
                
            time.sleep(0.5)  # Check twice per second
    
    def _handle_clipboard_change(self, content):
        """Process clipboard change"""
        # Get source application context
        source_context = self._get_source_context()
        
        # Detect data type
        data_type = self._detect_data_type(content)
        
        # Create clipboard event
        event = {
            'type': 'clipboard_copy',
            'timestamp': datetime.now().isoformat(),
            'content': content[:1000],  # Limit size for large copies
            'content_preview': self._get_preview(content),
            'data_type': data_type,
            'source': source_context,
            'length': len(content),
            'lines': content.count('\n') + 1 if '\n' in content else 1
        }
        
        # Add Excel selection details if available
        if source_context.get('excel_selection'):
            event['excel_cells'] = source_context['excel_selection']
            print(f"📊 Excel cells: {source_context['excel_selection']['address']} from {source_context['excel_selection']['workbook']}")
        
        # Add to history
        self.clipboard_history.append(event)
        if len(self.clipboard_history) > self.max_history:
            self.clipboard_history.pop(0)
        
        # Send to event queue
        self.event_queue.put(event)
        
        print(f"📋 Clipboard captured: {event['content_preview']} from {source_context.get('application', 'Unknown')}")
    
    def _get_source_context(self) -> Dict[str, Any]:
        """Get context about the source application"""
        context = {
            'application': 'Unknown',
            'window_title': 'Unknown',
            'document': None
        }
        
        if platform.system() == "Darwin":  # macOS
            context = self._get_macos_context()
        elif platform.system() == "Windows":
            context = self._get_windows_context()
        elif platform.system() == "Linux":
            context = self._get_linux_context()
            
        return context
    
    def _get_macos_context(self) -> Dict[str, Any]:
        """Get macOS application context"""
        context = {
            'application': 'Unknown',
            'window_title': 'Unknown',
            'document': None,
            'excel_selection': None
        }
        
        if applescript:
            try:
                # Get frontmost application
                script = '''
                tell application "System Events"
                    set frontApp to name of first application process whose frontmost is true
                    set windowTitle to "Unknown"
                    try
                        tell process frontApp
                            set windowTitle to name of front window
                        end tell
                    end try
                    return {frontApp, windowTitle}
                end tell
                '''
                as_script = applescript.AppleScript(script)
                result = as_script.run()
                if result:
                    # AppleScript returns a list
                    if isinstance(result, list) and len(result) >= 2:
                        context['application'] = result[0]
                        context['window_title'] = result[1]
                    elif isinstance(result, str):
                        parts = result.split(', ')
                        if len(parts) >= 2:
                            context['application'] = parts[0]
                            context['window_title'] = parts[1]
                    
                    # Extract document name from window title
                    context['document'] = self._extract_document_name(
                        context['window_title'], 
                        context['application']
                    )
                    
                    # If Excel, get selection details
                    if 'Excel' in context['application']:
                        context['excel_selection'] = self._get_excel_selection()
                        
            except Exception as e:
                print(f"Error getting macOS context: {e}")
                
        return context
    
    def _get_excel_selection(self) -> Optional[Dict[str, Any]]:
        """Get current Excel selection details"""
        try:
            script = '''
            tell application "Microsoft Excel"
                try
                    set sel to selection
                    set addr to get address of sel
                    set sheetName to name of active sheet
                    set wbName to name of active workbook
                    set wbPath to full name of active workbook
                    return {addr, sheetName, wbName, wbPath}
                on error
                    return missing value
                end try
            end tell
            '''
            as_script = applescript.AppleScript(script)
            result = as_script.run()
            
            if result and result != 'missing value':
                if isinstance(result, list) and len(result) >= 3:
                    return {
                        'address': result[0],
                        'sheet': result[1],
                        'workbook': result[2],
                        'path': result[3] if len(result) > 3 else None
                    }
        except Exception as e:
            print(f"Could not get Excel selection: {e}")
        return None
    
    def _get_windows_context(self) -> Dict[str, Any]:
        """Get Windows application context"""
        context = {
            'application': 'Unknown',
            'window_title': 'Unknown',
            'document': None
        }
        
        if win32gui and psutil:
            try:
                # Get active window
                hwnd = win32gui.GetForegroundWindow()
                window_title = win32gui.GetWindowText(hwnd)
                
                # Get process info
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                process = psutil.Process(pid)
                app_name = process.name()
                
                context['application'] = app_name
                context['window_title'] = window_title
                context['document'] = self._extract_document_name(window_title, app_name)
                
            except Exception as e:
                print(f"Error getting Windows context: {e}")
                
        return context
    
    def _get_linux_context(self) -> Dict[str, Any]:
        """Get Linux application context - basic implementation"""
        # This would need xdotool or similar
        return {
            'application': 'Unknown',
            'window_title': 'Unknown',
            'document': None
        }
    
    def _extract_document_name(self, window_title: str, app_name: str) -> Optional[str]:
        """Extract document name from window title"""
        if not window_title:
            return None
            
        # Common patterns for document names
        # Excel: "Book1.xlsx - Excel"
        # Word: "Document1.docx - Word"
        # Chrome: "Page Title - Google Chrome"
        
        # Remove app name from end
        for suffix in [' - Excel', ' - Word', ' - PowerPoint', ' - Google Chrome', 
                      ' - Mozilla Firefox', ' - Safari', ' — ', ' – ']:
            if suffix in window_title:
                return window_title.split(suffix)[0]
                
        # For code editors
        if any(editor in app_name.lower() for editor in ['code', 'sublime', 'atom']):
            # Often format: "filename.ext — folder"
            if ' — ' in window_title:
                return window_title.split(' — ')[0]
                
        return window_title
    
    def _detect_data_type(self, content: str) -> str:
        """Detect the type of data in clipboard"""
        content_lower = content.lower().strip()
        
        # Email detection
        if '@' in content and '.' in content.split('@')[-1]:
            return 'email'
            
        # Phone number detection
        if any(char.isdigit() for char in content):
            digits = ''.join(char for char in content if char.isdigit())
            if 7 <= len(digits) <= 15:
                return 'phone'
                
        # URL detection
        if content_lower.startswith(('http://', 'https://', 'www.')):
            return 'url'
            
        # Number detection
        try:
            float(content.replace(',', '').replace('$', '').strip())
            return 'number'
        except:
            pass
            
        # Date detection (basic)
        if any(sep in content for sep in ['/', '-']) and len(content) < 20:
            parts = content.replace('/', '-').split('-')
            if len(parts) == 3 and all(p.strip().isdigit() for p in parts):
                return 'date'
                
        # Multi-line detection
        if '\n' in content or '\t' in content:
            if '\t' in content:
                return 'tabular'  # Likely from Excel
            return 'multiline'
            
        # Default
        return 'text'
    
    def _get_preview(self, content: str, max_length: int = 50) -> str:
        """Get a preview of clipboard content"""
        if len(content) <= max_length:
            return content
            
        # For multiline content, show first line
        if '\n' in content:
            first_line = content.split('\n')[0]
            if len(first_line) <= max_length:
                return first_line + '...'
            return first_line[:max_length] + '...'
            
        return content[:max_length] + '...'
    
    def get_last_clipboard(self) -> Optional[Dict[str, Any]]:
        """Get the last clipboard entry"""
        if self.clipboard_history:
            return self.clipboard_history[-1]
        return None
    
    def find_paste_destination(self, paste_time: datetime) -> Optional[Dict[str, Any]]:
        """Find where clipboard content was pasted based on timing"""
        # This would be called when a paste event is detected
        # to link clipboard content with destination
        if self.clipboard_history:
            # Find the most recent clipboard entry before paste
            for entry in reversed(self.clipboard_history):
                entry_time = datetime.fromisoformat(entry['timestamp'])
                if entry_time <= paste_time:
                    return entry
        return None