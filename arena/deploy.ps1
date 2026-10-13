$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$deploymentRoot = Join-Path $projectRoot '.deployment'

function Invoke-Git {
    param([string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: $($GitArgs -join ' ')" }
}

Push-Location $projectRoot
try {
    Invoke-Git -GitArgs @('fetch', 'origin', 'main')
    if (!(Test-Path -LiteralPath $deploymentRoot)) {
        Invoke-Git -GitArgs @('worktree', 'add', '--detach', $deploymentRoot, 'origin/main')
    } else {
        $pending = & git -C $deploymentRoot status --porcelain
        if ($LASTEXITCODE -ne 0 -or $pending) { throw 'Deployment checkout has uncommitted changes; inspect it before continuing.' }
        Invoke-Git -GitArgs @('-C', $deploymentRoot, 'merge', '--ff-only', 'origin/main')
    }

    # Publish only committed files, preserving all existing remote files.
    $sourceFiles = & git ls-files
    if ($LASTEXITCODE -ne 0) { throw 'Could not list committed source files.' }
    $publishedFiles = & git -C $deploymentRoot ls-files -- arena/
    if ($LASTEXITCODE -ne 0) { throw 'Could not list published arena files.' }
    $obsoleteFiles = @($publishedFiles | Where-Object {
        $_.StartsWith('arena/') -and ($_.Substring(6) -notin $sourceFiles)
    })
    if ($obsoleteFiles.Count -gt 0) {
        Invoke-Git -GitArgs (@('-C', $deploymentRoot, 'rm', '--') + $obsoleteFiles)
    }
    $archivePath = Join-Path ([System.IO.Path]::GetTempPath()) ('arena-' + [guid]::NewGuid().ToString() + '.zip')
    try {
        Invoke-Git -GitArgs @('archive', '--format=zip', '--prefix=arena/', "--output=$archivePath", 'HEAD')
        Expand-Archive -LiteralPath $archivePath -DestinationPath $deploymentRoot -Force
    } finally {
        if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
    }
    Invoke-Git -GitArgs @('-C', $deploymentRoot, 'add', '--', 'arena')
    & git -C $deploymentRoot diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        $sourceCommit = & git rev-parse --short HEAD
        Invoke-Git -GitArgs @('-C', $deploymentRoot, 'commit', '-m', "Deploy Wax Ball Arena ($sourceCommit) to /arena/")
    } elseif ($LASTEXITCODE -ne 0) { throw 'Could not inspect deployment changes.' }
    Invoke-Git -GitArgs @('-C', $deploymentRoot, 'push', 'origin', 'HEAD:main')
    Write-Host 'Pushed arena/. Verify https://gamjadough.github.io/Wax-Ball/arena/ before reporting deployment success.'
} finally {
    Pop-Location
}
