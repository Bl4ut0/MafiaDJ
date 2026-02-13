$ErrorActionPreference = "Stop"

Write-Host "🚧 Starting Windows Build Process..." -ForegroundColor Cyan

# 1. Clean previous release
if (Test-Path "release") {
    Write-Host "🗑️ Cleaning previous release..."
    Remove-Item "release" -Recurse -Force
}
New-Item -ItemType Directory -Force -Path "release" | Out-Null
New-Item -ItemType Directory -Force -Path "release/bin" | Out-Null

# 2. Build TypeScript
Write-Host "🔨 Compiling TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript compilation failed!"
    exit 1
}

# 3. Package with pkg
Write-Host "📦 Packaging executable..."
# Use npx pkg to package the dist/index.js (from package.json bin entry)
# Targets node20-win-x64
npx pkg . --targets node20-win-x64 --output release/mafiadj.exe --compress GZip

if (-not (Test-Path "release/mafiadj.exe")) {
    Write-Error "Packaging failed! release/mafiadj.exe not found."
    exit 1
}

# 4. Copy Config Files
Write-Host "📄 Copying configuration files..."
Copy-Item ".env.example" -Destination "release/.env"
Copy-Item "config.json" -Destination "release/config.json"

# 5. Check/Copy Dependencies (FFmpeg, Librespot)
# We assume these might be in a local 'bin' folder or available in path.
# If they are not found, we warn the user.

$binaries = @("ffmpeg.exe", "librespot.exe", "yt-dlp.exe")
foreach ($bin in $binaries) {
    # Check if exists in project root/bin
    if (Test-Path "bin/$bin") {
        Copy-Item "bin/$bin" -Destination "release/bin/$bin"
        Write-Host "✅ Bundled $bin from ./bin/" -ForegroundColor Green
    } elseif (Get-Command $bin -ErrorAction SilentlyContinue) {
        # Try to find in system PATH
        $path = (Get-Command $bin).Source
        Copy-Item $path -Destination "release/bin/$bin"
        Write-Host "✅ Bundled $bin from System PATH" -ForegroundColor Green
    } else {
        Write-Warning "⚠️  Could not find $bin! You must manually place it in the release/bin/ folder."
    }
}

# 6. Create Run Script (optional, helper)
$runScript = @"
@echo off
echo Starting MafiaDJ...
set PATH=%CD%\bin;%PATH%
mafiadj.exe
pause
"@
Set-Content "release/start_bot.bat" $runScript

Write-Host "`n✨ Build Complete!" -ForegroundColor Green
Write-Host "   Output: ./release/"
Write-Host "   - mafiadj.exe"
Write-Host "   - .env (Configure this!)"
Write-Host "   - config.json"
Write-Host "   - bin/ (Dependencies)"
