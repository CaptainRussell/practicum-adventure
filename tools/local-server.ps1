# Practicum Adventure: local test server (no installs needed, uses Windows PowerShell)
# Serves this folder on http://localhost:<port>/ and opens the GM console in your browser.
# Close this window (or press Ctrl+C) to stop it.
param([int]$Port = 8765, [switch]$NoBrowser)
$root = Split-Path -Parent $PSScriptRoot

# find a free port starting at $Port
$l = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $Port = $p; break }
  catch { $l = $null }
}
if (-not $l) { Write-Host "Could not open a port between $Port and $($Port + 19)." -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

$base = "http://localhost:$Port/"
Write-Host ''
Write-Host '  PRACTICUM ADVENTURE - local test build' -ForegroundColor Yellow
Write-Host "  GM console:   $base"
Write-Host "  Test phones:  ${base}test.html   (several cadets side by side, each its own player)"
Write-Host "  Field guide:  ${base}guide.html"
Write-Host ''
Write-Host '  Leave this window open while you play. Close it to stop the server.' -ForegroundColor DarkGray
Write-Host ''
if (-not $NoBrowser) { Start-Process $base }

$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon';
  '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.md' = 'text/plain; charset=utf-8' }
$rootFull = [IO.Path]::GetFullPath($root)
while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $rel) { $rel = 'index.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    # only serve files inside the game folder
    if ($f.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      $ext = [IO.Path]::GetExtension($f).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')   # edits show up on a normal refresh
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  $ctx.Response.Close()
}
