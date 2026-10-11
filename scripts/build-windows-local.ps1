<#
.SYNOPSIS
  在本地构建未签名的 Windows x64 便携版 EXE 与 NSIS 安装包。

.DESCRIPTION
  PowerShell 7 入口脚本，流程：
  - 缺少时安装 x86_64-pc-windows-msvc Rust 目标；
  - 不签名构建 Tauri 可执行文件与 NSIS 安装包；
  - 把产物复制到 OutputDir 并输出 SHA-256。

.PARAMETER Version
  稳定版 MAJOR.MINOR.PATCH 版本号。默认取 package.json，且必须与
  package.json、src-tauri/tauri.conf.json、src-tauri/Cargo.toml 一致。

.PARAMETER OutputDir
  产物目录，相对仓库根目录（也可传绝对路径）。

.PARAMETER SkipNpmInstall
  跳过 npm ci。仅在 node_modules 已与 package-lock.json 一致时使用。

.PARAMETER SkipNsisToolchainPreparation
  跳过 scripts/prepare-nsis-toolchain.ps1，由 Tauri 自行查找或下载 NSIS。

.PARAMETER Clean
  构建前删除 OutputDir。不会删除 Cargo/Tauri 的 target 目录。

.EXAMPLE
  pwsh -File scripts/build-windows-local.ps1

.EXAMPLE
  pwsh -File scripts/build-windows-local.ps1 -SkipNpmInstall -Clean

#>
[CmdletBinding()]
param(
  [string]$Version = '',
  [string]$OutputDir = 'release',
  [switch]$SkipNpmInstall,
  [switch]$SkipNsisToolchainPreparation,
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$rustTarget = 'x86_64-pc-windows-msvc'

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host "`n==> $Description" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

if (-not $IsWindows) {
  throw 'This script must be run on Windows with PowerShell 7.'
}
if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw "PowerShell 7 or newer is required; current version is $($PSVersionTable.PSVersion)."
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packageJsonPath = Join-Path $repoRoot 'package.json'
$tauriConfigPath = Join-Path $repoRoot 'src-tauri/tauri.conf.json'
$cargoTomlPath = Join-Path $repoRoot 'src-tauri/Cargo.toml'

$packageVersion = (Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json).version
$tauriVersion = (Get-Content -LiteralPath $tauriConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json).version
$cargoToml = Get-Content -LiteralPath $cargoTomlPath -Raw -Encoding UTF8
if ($cargoToml -notmatch '(?m)^version = "([^"]+)"') {
  throw 'Unable to read the package version from src-tauri/Cargo.toml.'
}
$cargoVersion = $Matches[1]

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = $packageVersion
}
$Version = $Version.Trim() -replace '^[vV]', ''
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must be stable MAJOR.MINOR.PATCH, got: $Version"
}
foreach ($entry in @(
    @{ File = 'package.json'; Value = $packageVersion },
    @{ File = 'src-tauri/tauri.conf.json'; Value = $tauriVersion },
    @{ File = 'src-tauri/Cargo.toml'; Value = $cargoVersion }
  )) {
  if ($entry.Value -ne $Version) {
    throw "Version mismatch in $($entry.File): expected $Version, got $($entry.Value). Run npm run version:sync first."
  }
}

$outputRoot = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
  [System.IO.Path]::GetFullPath($OutputDir)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDir))
}
if ($Clean -and (Test-Path -LiteralPath $outputRoot)) {
  $normalizedOutput = $outputRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $normalizedRepo = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $volumeRoot = [System.IO.Path]::GetPathRoot($outputRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $outputPrefix = "$normalizedOutput$([System.IO.Path]::DirectorySeparatorChar)"
  $repoPrefix = "$normalizedRepo$([System.IO.Path]::DirectorySeparatorChar)"
  $outputContainsRepository = $repoPrefix.StartsWith(
    $outputPrefix,
    [System.StringComparison]::OrdinalIgnoreCase
  )
  if (
    $normalizedOutput -eq $normalizedRepo -or
    $normalizedOutput -eq $volumeRoot -or
    $outputContainsRepository
  ) {
    throw "Refusing to clean unsafe output directory: $outputRoot"
  }
  Remove-Item -LiteralPath $outputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  $npmCommand = Get-Command npm -ErrorAction Stop
}
$rustupCommand = Get-Command rustup.exe -ErrorAction SilentlyContinue
if (-not $rustupCommand) {
  $rustupCommand = Get-Command rustup -ErrorAction Stop
}

Push-Location $repoRoot
try {
  if (-not $SkipNpmInstall) {
    Invoke-NativeCommand 'Install npm dependencies' {
      & $npmCommand.Source ci
    }
  } elseif (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
    throw 'node_modules does not exist; remove -SkipNpmInstall or run npm ci first.'
  }

  if (-not $SkipNsisToolchainPreparation) {
    Write-Host "`n==> Prepare Tauri NSIS toolchain" -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'prepare-nsis-toolchain.ps1')
  }

  $installedTargets = @(& $rustupCommand.Source target list --installed)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to list installed Rust targets (exit code $LASTEXITCODE)."
  }
  if ($installedTargets -notcontains $rustTarget) {
    Invoke-NativeCommand "Install Rust target $rustTarget" {
      & $rustupCommand.Source target add $rustTarget
    }
  }

  Invoke-NativeCommand 'Build unsigned Tauri EXE and NSIS (x64)' {
    & $npmCommand.Source run tauri -- build `
      --target $rustTarget `
      --bundles nsis `
      --no-sign `
      --ci
  }

  $targetReleaseDir = Join-Path $repoRoot "src-tauri/target/$rustTarget/release"
  $binaryPath = Join-Path $targetReleaseDir 'floral-notepaper.exe'
  if (-not (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
    throw "Built executable was not found: $binaryPath"
  }

  $installer = Get-ChildItem -Path (Join-Path $targetReleaseDir 'bundle/nsis') -File -Recurse -Filter '*.exe' |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if (-not $installer) {
    throw 'No NSIS installer was found.'
  }

  $portableOutput = Join-Path $outputRoot "floral-notepaper_${Version}.exe"
  $installerOutput = Join-Path $outputRoot "floral-notepaper_${Version}_x64-setup.exe"
  Copy-Item -LiteralPath $binaryPath -Destination $portableOutput -Force
  Copy-Item -LiteralPath $installer.FullName -Destination $installerOutput -Force

  Write-Host "`nUnsigned Windows artifacts built successfully:" -ForegroundColor Green
  foreach ($artifactPath in @($portableOutput, $installerOutput)) {
    $file = Get-Item -LiteralPath $artifactPath
    $sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    Write-Host "  $($file.Name)  $($file.Length) bytes  SHA256=$sha256"
  }
  Write-Host "`nOutput directory: $outputRoot" -ForegroundColor Green
} finally {
  Pop-Location
}
