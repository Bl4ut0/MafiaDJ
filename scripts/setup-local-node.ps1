$ErrorActionPreference = "Stop"

$nodeVersion = "v18.20.4"
$nodeDist = "node-$nodeVersion-win-x64"
$zipName = "$nodeDist.zip"
$downloadUrl = "https://nodejs.org/dist/$nodeVersion/$zipName"
$localNodeDir = Join-Path $PSScriptRoot "..\.local-node"
$zipPath = Join-Path (Join-Path $PSScriptRoot "..") $zipName

Write-Host "Setting up local Node.js ($nodeVersion)..."

if (Test-Path $localNodeDir) {
    Write-Host "Local node directory already exists at $localNodeDir"
    # Basic check to see if node executable is there
    if (Test-Path "$localNodeDir\node.exe") {
        Write-Host "Node executable found. Skipping download."
        exit 0
    }
}

Write-Host "Downloading $downloadUrl..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

Write-Host "Extracting to $localNodeDir..."
Expand-Archive -Path $zipPath -DestinationPath (Join-Path $PSScriptRoot "..") -Force

# Rename the extracted folder to .local-node
$extractedDir = Join-Path $PSScriptRoot "..\$nodeDist"
if (Test-Path $localNodeDir) {
    Remove-Item -Path $localNodeDir -Recurse -Force
}
Rename-Item -Path $extractedDir -NewName ".local-node"

# Cleanup
Remove-Item -Path $zipPath -Force

Write-Host "Local Node.js setup complete."
Write-Host "Run '.\local-env.ps1' in the project root to activate it."
