# 发布流程（自用版）

自用版只发布 Windows x64，产物不做代码签名，发布到本仓库的 GitHub Release，应用内更新从这里检查新版本。

## 一、本地打包

```powershell
pwsh -File scripts/build-windows-local.ps1
```

常用参数：

| 参数                            | 作用                                            |
| ------------------------------- | ----------------------------------------------- |
| `-SkipNpmInstall`               | 跳过 `npm ci`，`node_modules` 已是最新时使用    |
| `-Clean`                        | 构建前清空输出目录                              |
| `-OutputDir <目录>`             | 修改输出目录，默认是仓库根目录的 `release/`     |
| `-SkipNsisToolchainPreparation` | 跳过 NSIS 工具链预下载，由 Tauri 自行查找或下载 |

产物：

| 文件                                       | 说明                |
| ------------------------------------------ | ------------------- |
| `floral-notepaper_<版本>_x64-setup.exe`    | NSIS 安装包（推荐） |
| `floral-notepaper_<版本>_x64-portable.exe` | 便携版，直接运行    |

> 便携版文件名必须包含 `x64`，应用内更新器靠文件名识别架构和安装类型；名字里带 `setup` 的会被识别为安装包。

本地环境需要 PowerShell 7、Node.js、rustup、Visual Studio 2022 C++ Build Tools（x64 MSVC 工具链）。

## 二、发布新版本

1. 确定版本号。版本号使用 `MAJOR.MINOR.PATCH`，必须比当前已发布的版本大，**不要**加 `-self` 之类的后缀（语义化版本中带后缀的预发布版比正式版小，更新器会判断为旧版本）。
2. 同步版本号到 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`：

   ```powershell
   npm run version:sync -- 1.2.1
   ```

3. （可选）编写发布说明 `Docs/release-note/<版本>.md`。有这个文件就作为 Release 正文，否则由 GitHub 自动生成。
4. 提交版本号改动：

   ```powershell
   git commit -am "chore: 发布 v1.2.1"
   ```

5. 本地打包并发布：

   ```powershell
   pwsh -File scripts/publish-release-local.ps1
   ```

   脚本会检查工作区干净、gh 已登录、该版本 Release 尚不存在，然后本地构建，打 Tag，推送分支和 Tag 到 `fork`，最后创建 Release 并上传安装包与便携版。

   常用参数：

   | 参数              | 作用                                                         |
   | ----------------- | ------------------------------------------------------------ |
   | `-SkipBuild`      | 不重新构建，直接发布 `release/` 下已有产物（例如已自测过的） |
   | `-SkipNpmInstall` | 构建时跳过 `npm ci`                                          |
   | `-DryRun`         | 只检查和构建，不打 Tag、不推送、不发布                       |

## 三、远程打包（应急备用）

`.github/workflows/release.yml` 已不再随推送 Tag 自动运行，日常发布一律用本地打包。只有本机无法打包时，才在 GitHub 仓库的 Actions 页面手动运行 `Release`，填入一个已推送的 Tag：

- 校验：Tag 必须是 `vMAJOR.MINOR.PATCH`，且与 `package.json` 版本一致。
- 构建：在 `windows-latest` 上调用 `scripts/build-windows-local.ps1`。
- 发布：用 `gh release create` 上传安装包和便携版；Release 已存在时改为覆盖上传（会覆盖本地上传的同名文件）。
