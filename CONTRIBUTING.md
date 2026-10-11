# 开发指南

花笺自用版的本地开发、分支维护与同步上游说明。

## 开发环境配置

### 依赖

- [Node.js](https://nodejs.org/) - 20.19+ 或 22.12+
- [Rust](https://www.rust-lang.org/tools/install) 工具链
- 其他：

  | 平台        | 所需依赖                                                                                                                                                                                                             |
  | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Windows** | [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)、[Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 或高版本 Windows 10 已内置） |

### 克隆与启动

```bash
git clone git@github.com:chengzhirenchaoshuai/floral-notepaper.git
cd floral-notepaper
npm install

# 启动开发版
npm run tauri dev

# 构建正式版（产物输出到 release/）
pwsh -File scripts/build-windows-local.ps1
```

## 分支与提交规范

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范。

### Commit Message 格式

```
<type>: <简短描述>
```

常用 type：

| type       | 说明                       |
| ---------- | -------------------------- |
| `feat`     | 新功能                     |
| `fix`      | 修复 bug                   |
| `docs`     | 文档变更                   |
| `style`    | 格式调整（不影响代码逻辑） |
| `refactor` | 重构（既非新功能也非修复） |
| `perf`     | 性能优化                   |
| `test`     | 添加或修改测试             |
| `chore`    | 构建、CI、依赖等杂项       |
| `ci`       | CI/CD 配置变更             |
| `revert`   | 回滚提交                   |

### 分支命名

分支名应与 commit type 对应：`feat/描述`、`fix/描述`、`refactor/描述` 等。

示例：

- `feat/note-tagging` → 新功能分支
- `fix/startup-crash` → 修复分支

## 代码风格与测试

提交前建议在本地跑一遍以下检查：

```bash
# 后端
cd src-tauri
cargo test -p floral-notepaper --lib        # 单元测试
cargo clippy --all-targets -- -D warnings   # 静态检查
cargo fmt --check                           # 格式检查

# 前端
npm test                                    # 单元测试
npx oxlint                                  # 静态检查
npx oxfmt --check                           # 格式检查
```

> 本机如设置了 `HTTP_PROXY`，`mirror_chyan_request_error_message_does_not_include_sensitive_url` 测试会因代理返回 502 而失败，临时取消代理再运行即可。

## 分支维护

- `self/main`：自用版主线，所有改动最终合入这里
- 较大的改动从 `self/main` 拉出 `feat/描述`、`fix/描述` 分支，完成后合回
- 远程：`fork` 为本仓库（chengzhirenchaoshuai/floral-notepaper），`origin` 为上游（Achilng/floral-notepaper）

## 同步上游

```bash
git fetch origin
git switch self/main
git merge origin/main
```

常见冲突处理：

- 上游修改了自用版已删除的文件（macOS/Linux 配置、MSIX 脚本、原 CI 工作流等）：保持删除，`git rm <文件>`
- `src-tauri/src/updater/check.rs` 中的 `DEFAULT_GITHUB_REPO` 与 `mirror_chyan_enabled`：保留自用版的值
- 版本号：保留自用版的版本号，不要被上游覆盖

合并后跑一遍上面的检查再提交。

## 发布

见 [发布流程](Docs/RELEASE_WORKFLOW.md)。
