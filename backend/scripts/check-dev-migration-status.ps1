$backendDirectory = Split-Path -Parent $PSScriptRoot
$exitCode = 1

Push-Location $backendDirectory
try {
    & npm run db:status
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

exit $exitCode
