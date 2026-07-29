[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$targets = @(
    (Join-Path $root '.env'),
    (Join-Path $root 'data\cookies.txt')
) | Where-Object { Test-Path -LiteralPath $_ }

foreach ($target in $targets) {
    $resolved = (Resolve-Path -LiteralPath $target).Path
    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to change ACL outside the project: $resolved"
    }
    if ($PSCmdlet.ShouldProcess($resolved, "Restrict access to $currentUser and SYSTEM")) {
        & icacls.exe $resolved /inheritance:r | Out-Null
        & icacls.exe $resolved /grant:r "${currentUser}:(F)" 'SYSTEM:(F)' | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "icacls failed for $resolved"
        }
    }
}

Write-Host "Secret ACLs hardened for $($targets.Count) file(s)."
