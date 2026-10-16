# Opens a playtest on one monitor: GM console on the left, test bench (projector + 4 phones)
# on the right. Uses its own Edge profile, so your normal Edge tabs and data are untouched.
# Run: right-click > Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File playtest.ps1
# Add -SnapOnly to just put the two open windows back in place.
param([switch]$SnapOnly)
$here = $PSScriptRoot
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host 'Microsoft Edge not found.'; exit 1 }
$profileDir = Join-Path $env:LOCALAPPDATA 'PracticumAdventureTest'

Add-Type -AssemblyName System.Windows.Forms
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$gmW = [int]($wa.Width * 0.4)

if (-not $SnapOnly) {
# start serve.py unless something is already answering on port 8000
try { Invoke-WebRequest 'http://127.0.0.1:8000/test.html' -UseBasicParsing -TimeoutSec 2 | Out-Null }
catch { Start-Process python -ArgumentList "`"$here\serve.py`"" -WorkingDirectory $here -WindowStyle Minimized; Start-Sleep 2 }

$common = "--user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"

# the GM console goes first: it creates the room code the bench reads
Start-Process $edge "$common --app=http://localhost:8000/index.html --window-position=$($wa.X),$($wa.Y) --window-size=$gmW,$($wa.Height)"
Start-Sleep 4
Start-Process $edge "$common --app=http://localhost:8000/bench.html --window-position=$($wa.X + $gmW),$($wa.Y) --window-size=$($wa.Width - $gmW),$($wa.Height)"
Start-Sleep 3
}

# Edge ignores --window-position when its process is already running, so snap the windows by title
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public class Win {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public static IntPtr Find(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => { var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
      if (IsWindowVisible(h) && sb.ToString() == title) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
}
'@ -ErrorAction SilentlyContinue
function Snap($title, $x, $w) {
  $h = [Win]::Find($title)
  if ($h -eq [IntPtr]::Zero) { Write-Host "Window not found: $title"; return }
  [Win]::ShowWindow($h, 9) | Out-Null   # restore if maximized
  [Win]::MoveWindow($h, $x, $wa.Y, $w, $wa.Height, $true) | Out-Null
  [Win]::SetForegroundWindow($h) | Out-Null
}
Snap 'Practicum Adventure' $wa.X $gmW
Snap ([string]::Concat('Practicum Adventure ', [char]0x00B7, ' Test Bench')) ($wa.X + $gmW) ($wa.Width - $gmW)
