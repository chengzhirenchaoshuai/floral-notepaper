<#
.SYNOPSIS
  本地打包并发布自用版到 GitHub Release。

.DESCRIPTION
  PowerShell 7 入口脚本，流程：
  - 检查工作区干净、gh 已登录、该版本的 Release 尚不存在；
  - 调用 scripts/build-windows-local.ps1 构建安装包与便携版；
  - 打 Tag（已存在则校验指向当前提交），推送分支与 Tag 到远端；
  - 用 gh release create 创建 Release 并上传两个产物。
  版本号取 package.json，发布前请先运行 npm run version:sync -- <版本> 并提交。

.PARAMETER Repo
  发布目标仓库，默认是自用版 fork。显式指定，避免 gh 误选上游仓库。

.PARAMETER Remote
  推送分支与 Tag 的 git 远端名，默认 fork。

.PARAMETER SkipBuild
  跳过构建，直接发布 release/ 下已有的产物（例如已经本地自测过的那一份）。

.PARAMETER SkipNpmInstall
  构建时跳过 npm ci。

.PARAMETER DryRun
  只做检查和构建，不打 Tag、不推送、不创建 Release。

.EXAMPLE
  pwsh -File scripts/publish-release-local.ps1

.EXAMPLE
  pwsh -File scripts/publish-release-local.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
  [string]$Repo = 'chengzhirenchaoshuai/floral-notepaper',
  [string]$Remote = 'fork',
  [switch]$SkipBuild,
  [switch]$SkipNpmInstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host "`n==> $Description" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description 失败，退出码 $LASTEXITCODE。"
  }
}

if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw "需要 PowerShell 7 及以上，当前为 $($PSVersionTable.PSVersion)。"
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $repoRoot
try {
  # ---- 发布前检查 ----
  $version = (Get-Content -LiteralPath 'package.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
  if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "package.json 版本必须是 MAJOR.MINOR.PATCH，实际为：$version"
  }
  $tag = "v$version"
  Write-Host "准备发布 $tag 到 $Repo" -ForegroundColor Green

  $dirty = git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw '无法读取 git 状态。' }
  if ($dirty) {
    throw "工作区有未提交的改动，请先提交或暂存：`n$($dirty -join "`n")"
  }

  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -eq 'HEAD') { throw '当前处于分离 HEAD 状态，请切换到要发布的分支。' }
  $head = (git rev-parse HEAD).Trim()

  gh auth status --hostname github.com *> $null
  if ($LASTEXITCODE -ne 0) { throw 'gh 未登录，请先运行 gh auth login。' }

  gh release view $tag --repo $Repo *> $null
  if ($LASTEXITCODE -eq 0) {
    throw "Release $tag 已存在于 $Repo。如需重新发布，请先递增版本号。"
  }

  git rev-parse -q --verify "refs/tags/$tag" *> $null
  $tagExists = $LASTEXITCODE -eq 0
  if ($tagExists) {
    $tagCommit = (git rev-parse "$tag^{commit}").Trim()
    if ($tagCommit -ne $head) {
      throw "本地 Tag $tag 指向 $tagCommit，与当前提交 $head 不一致。"
    }
  }

  # ---- 构建 ----
  if ($SkipBuild) {
    Write-Host "`n==> 跳过构建，使用 release/ 下已有产物" -ForegroundColor Yellow
  } else {
    $buildArgs = @{ Clean = $true }
    if ($SkipNpmInstall) { $buildArgs.SkipNpmInstall = $true }
    Write-Host "`n==> 本地构建" -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'build-windows-local.ps1') @buildArgs
  }

  $assets = @(
    (Join-Path $repoRoot "release/floral-notepaper_${version}_x64-setup.exe"),
    (Join-Path $repoRoot "release/floral-notepaper_${version}_x64-portable.exe")
  )
  foreach ($asset in $assets) {
    if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
      throw "找不到产物：$asset"
    }
  }

  # 构建过程不应改动受版本控制的文件（例如 Cargo.lock），否则产物与提交对不上
  $dirtyAfterBuild = git status --porcelain
  if ($dirtyAfterBuild) {
    throw "构建后工作区出现改动，请检查后提交再发布：`n$($dirtyAfterBuild -join "`n")"
  }

  if ($DryRun) {
    Write-Host "`nDryRun：检查与构建完成，未打 Tag、未推送、未发布。" -ForegroundColor Yellow
    return
  }

  # ---- 打 Tag 并推送 ----
  if (-not $tagExists) {
    Invoke-Native "创建 Tag $tag" { git tag $tag }
  }
  Invoke-Native "推送分支 $branch 到 $Remote" { git push $Remote $branch }
  Invoke-Native "推送 Tag $tag 到 $Remote" { git push $Remote $tag }

  # ---- 创建 Release ----
  # 有对应版本的发布说明就使用，否则让 GitHub 自动生成
  $notesFile = Join-Path $repoRoot "Docs/release-note/$version.md"
  $notesArgs = if (Test-Path -LiteralPath $notesFile) {
    @('--notes-file', $notesFile)
  } else {
    @('--generate-notes')
  }
  Invoke-Native "创建 Release $tag" {
    gh release create $tag @assets --repo $Repo --title $tag --verify-tag @notesArgs
  }

  Write-Host "`n发布完成：https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
  foreach ($asset in $assets) {
    $file = Get-Item -LiteralPath $asset
    $sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    Write-Host "  $($file.Name)  $($file.Length) bytes  SHA256=$sha256"
  }
} finally {
  Pop-Location
}
