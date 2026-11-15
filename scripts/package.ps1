param([string]$OutputPath)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $OutputPath) { $OutputPath = Join-Path (Split-Path $projectRoot -Parent) 'yiqian-vps-v2.zip' }
$archivePath = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $archivePath) { throw "Archive already exists: $archivePath. Choose a new output name." }
$directories = @('frontend','backend','scripts','tests','docs','deploy','dist')
$files = @('package.json','pnpm-lock.yaml','Dockerfile','compose.yaml','.env.example','.gitignore','.dockerignore','README.md','start-local.cmd')
Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::CreateNew)
$zip = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($directory in $directories) {
        $folder = Join-Path $projectRoot $directory
        foreach ($item in Get-ChildItem -LiteralPath $folder -File -Recurse -Force) {
            $relative = [System.IO.Path]::GetRelativePath($projectRoot,$item.FullName).Replace('\','/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$item.FullName,$relative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    foreach ($file in $files) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $projectRoot $file),$file,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose(); $stream.Dispose() }
Write-Output $archivePath
