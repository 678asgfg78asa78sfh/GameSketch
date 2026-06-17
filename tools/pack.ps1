# Packs the shareable install ZIP (forward-slash entries via .NET so any extractor is happy).
# Run from build-share-zip.bat, or:  powershell -ExecutionPolicy Bypass -File tools\pack.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$repo = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $repo 'web\dist\index.html'))) {
  throw "web\dist is not built. Run 'npm run build' first (build-share-zip.bat does this for you)."
}

$base  = Join-Path ([System.IO.Path]::GetTempPath()) ("gs-pack-" + [guid]::NewGuid().ToString('N'))
$stage = Join-Path $base 'GameSketch'
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$topFiles = 'package.json','package-lock.json','vite.config.js','README.md','HOWTO.md','LIESMICH.txt','START.bat'
foreach ($f in $topFiles) {
  $src = Join-Path $repo $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $stage $f) }
}
Copy-Item (Join-Path $repo 'server') (Join-Path $stage 'server') -Recurse
Copy-Item (Join-Path $repo 'web')    (Join-Path $stage 'web')    -Recurse

# safety: never ship dependencies, git history, private data, or stray scratch files
$bad = Get-ChildItem $stage -Recurse -Force | Where-Object {
  $_.FullName -match '\\(node_modules|\.git|data)\\' -or $_.Name -match '^_.*\.mjs$'
}
if ($bad) { $bad.FullName | Select-Object -First 5; throw 'refusing to pack: unexpected files staged' }

$zip = Join-Path $repo 'GameSketch-install.zip'
if (Test-Path $zip) { [System.IO.File]::Delete($zip) }
$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$arch = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($base.Length + 1) -replace '\\','/'
    $e = $arch.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $in = [System.IO.File]::OpenRead($_.FullName); $out = $e.Open()
    try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose() }
  }
} finally { $arch.Dispose(); $fs.Dispose() }

$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 1)
$files  = (Get-ChildItem $stage -Recurse -File).Count
Write-Host ""
Write-Host ("  OK  -> {0}" -f $zip) -ForegroundColor Green
Write-Host ("      {0} MB, {1} Dateien" -f $sizeMB, $files)
