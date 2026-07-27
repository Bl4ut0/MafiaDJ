$ErrorActionPreference = "Stop"

Write-Host "Checking for external dependencies..."

if (-not (Test-Path "bin")) {
    New-Item -ItemType Directory -Force -Path "bin" | Out-Null
}

# 1. yt-dlp
if (Test-Path "bin/yt-dlp.exe") {
    Write-Host "yt-dlp.exe found."
} else {
    Write-Host "Downloading yt-dlp.exe..."
    Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "bin/yt-dlp.exe"
    Write-Host "yt-dlp.exe downloaded."
}

# 2. ffmpeg
if (Test-Path "bin/ffmpeg.exe") {
    Write-Host "ffmpeg.exe found."
} else {
    Write-Host "Downloading ffmpeg..."
    $ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $zipPath = "bin/ffmpeg.zip"
    $extractPath = "bin/ffmpeg_extract"

    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipPath
    
    Write-Host "Extracting ffmpeg..."
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    $ffmpegExe = Get-ChildItem -Path $extractPath -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    
    if ($ffmpegExe) {
        Copy-Item $ffmpegExe.FullName -Destination "bin/ffmpeg.exe"
        Write-Host "ffmpeg.exe installed."
    } else {
        Write-Error "Could not find ffmpeg.exe in the downloaded zip!"
    }
    
    # Cleanup
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
}
