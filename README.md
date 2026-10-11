<!-- markdownlint-disable -->

<div align="center">

<img src="./src-tauri/icons/icon.png" width="120" alt="花笺图标">

# 花笺 · 自用版

轻量、优雅、现代化的本地便签工具（仅 Windows x64）<br>
基于 [Achilng/floral-notepaper](https://github.com/Achilng/floral-notepaper) 修改，Tauri 2 + React 构建

[下载](https://github.com/chengzhirenchaoshuai/floral-notepaper/releases/latest) · [从源码构建](#从源码构建) · [发布流程](Docs/RELEASE_WORKFLOW.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

<!-- markdownlint-restore -->

---

> [!NOTE]
> 这是非官方的自用修改版，与原作者无关，问题请勿反馈到原项目。官方版请前往 [Achilng/floral-notepaper](https://github.com/Achilng/floral-notepaper)。

## 与官方版的区别

- 只提供 Windows x64 版本（NSIS 安装包与便携版），不再提供 macOS、Linux、ARM64、MSIX 与 Microsoft Store 版本
- 安装包与便携版未做代码签名，首次运行时 Windows SmartScreen 可能提示风险，选择“仍要运行”即可
- 应用内更新只检查本仓库的 GitHub Release，不使用 Mirror酱
- 与官方版使用相同的应用标识和数据目录，安装后会直接覆盖官方版，原有笔记与配置保留

## 功能特点

- **Markdown 编辑与预览** — 支持 GitHub Flavored Markdown 语法，实时切换编辑和预览模式

  ![主窗口截图](Docs/images/主窗口截图.png)

- **快捷便签** — 通过托盘或全局快捷键（默认 `Ctrl+Space`）随时唤出便签窗口

  ![小窗多开示例](Docs/images/小窗多开示例.gif)

- **磁贴模式** — 将笔记固定在桌面某处，以便快速查阅和复制

  ![磁贴示例](Docs/images/AI绘画截图.png)

- **导入导出** — 支持 `.md` 文件的导入和导出

## 下载安装

前往 [Release 页](https://github.com/chengzhirenchaoshuai/floral-notepaper/releases/latest) 下载：

| 类型             | 文件名                                     |
| ---------------- | ------------------------------------------ |
| 安装程序（推荐） | floral-notepaper\_版本号\_x64-setup.exe    |
| 便携版           | floral-notepaper\_版本号\_x64-portable.exe |

> [!WARNING]
> 不要再安装官方安装包，否则会覆盖自用版，且官方版的自动更新会指回官方仓库。

## 从源码构建

需要 PowerShell 7、Node.js、rustup 和 Visual Studio 2022 C++ Build Tools（x64 MSVC 工具链）。

```powershell
pwsh -File scripts/build-windows-local.ps1
```

产物输出到仓库根目录的 `release/`。开发调试请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致谢

感谢原作者 [Achilng](https://github.com/Achilng) 及 [所有贡献者](https://github.com/Achilng/floral-notepaper/graphs/contributors)。

## 许可证

[MIT](LICENSE)，原版权声明保留。
