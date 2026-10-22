$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path secrets | Out-Null
foreach ($n in "mysql_root_password","mysql_app_password","jwt_secret","internal_api_key","admin_password") {
  $p = Join-Path (Get-Location) "secrets/$n"
  if (-not (Test-Path $p)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $s = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]',''
    [System.IO.File]::WriteAllText($p, $s)    # no BOM, no trailing newline
  }
}
Write-Host "Done. Admin password is in secrets/admin_password"