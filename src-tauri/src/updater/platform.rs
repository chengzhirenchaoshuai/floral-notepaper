use super::{
    errors,
    types::{InstallKind, UpdateStateDto},
    version, APP_ID,
};
use crate::services::notes::AppError;
use serde::{Deserialize, Serialize};
use std::{
    env,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use std::os::windows::process::CommandExt;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Os {
    Windows,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Arch {
    X86_64,
    Aarch64,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: Os,
    pub arch: Arch,
    pub app_version: String,
    pub app_id: String,
    pub install_kind: InstallKind,
    pub current_exe: Option<String>,
}

impl PlatformInfo {
    pub fn supports_update_assets(&self) -> bool {
        self.os != Os::Unsupported
            && self.arch != Arch::Unsupported
            && self.install_kind != InstallKind::Unknown
    }

    /// 下载、安装前的平台检查：在检查更新的基础上，便携版还要求 exe 所在目录可写，
    /// 否则无法在原位置替换 exe，只能手动下载新版。
    pub fn ensure_in_app_updates_supported(&self) -> Result<(), AppError> {
        self.ensure_update_check_supported()?;
        if self.install_kind == InstallKind::WindowsPortable {
            let writable = self
                .current_exe
                .as_deref()
                .map(Path::new)
                .and_then(Path::parent)
                .is_some_and(dir_is_writable);
            if !writable {
                return Err(errors::portable_dir_not_writable());
            }
        }
        Ok(())
    }

    /// 检查更新前的平台检查：安装版与便携版都允许检查新版本。
    pub fn ensure_update_check_supported(&self) -> Result<(), AppError> {
        if self.os == Os::Unsupported || self.arch == Arch::Unsupported {
            return Err(errors::unsupported_platform());
        }

        // When running via `npm run tauri dev` the binary sits inside
        // target/debug/ (or target/debug/deps/) rather than inside an app
        // bundle, so `detect_install_kind` returns `Unknown`.  Allow the
        // check-update flow to proceed in this case so the feature can be
        // tested during development.
        if self.install_kind == InstallKind::Unknown {
            if let Some(path) = &self.current_exe {
                let lower = path.to_lowercase();
                if lower.contains("target/debug") || lower.contains("target\\debug") {
                    return Ok(());
                }
            }
        }

        match self.install_kind {
            InstallKind::WindowsNsis | InstallKind::WindowsPortable => Ok(()),
            InstallKind::Unknown => Err(errors::unsupported_platform()),
        }
    }
}

/// 通过新建并删除一个探测文件判断目录是否可写（只读 U 盘、受保护目录等返回 false）。
fn dir_is_writable(dir: &Path) -> bool {
    let probe = dir.join(format!(
        ".floral-notepaper-write-probe-{}",
        std::process::id()
    ));
    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
    {
        Ok(file) => {
            drop(file);
            let _ = std::fs::remove_file(&probe);
            true
        }
        // 上次异常退出残留的同名探测文件：能删掉也说明目录可写
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            std::fs::remove_file(&probe).is_ok()
        }
        Err(_) => false,
    }
}

/// 进程内稳定的平台信息缓存。
///
/// `PlatformInfo` 的全部计算依赖（`env::current_exe`、
/// `env::consts::OS/ARCH`、包身份、注册表、`SystemRoot`）在进程生命周期内
/// 均不会变化，因此只需计算一次。Windows 下 `detect_install_kind`
/// 会 spawn 最多 4 个 `cmd /c reg query` 子进程，缓存可避免每次调用重复
/// 付出该代价。
static PLATFORM_CACHE: OnceLock<PlatformInfo> = OnceLock::new();

pub fn current_platform() -> PlatformInfo {
    current_platform_with_version(version::CURRENT_APP_VERSION.to_string())
}

pub fn current_platform_with_version(app_version: impl Into<String>) -> PlatformInfo {
    let mut platform = PLATFORM_CACHE.get_or_init(compute_platform_info).clone();
    platform.app_version = app_version.into();
    platform
}

fn compute_platform_info() -> PlatformInfo {
    let current_exe = env::current_exe().ok();
    let os = current_os();
    PlatformInfo {
        os: os.clone(),
        arch: current_arch(),
        app_version: version::CURRENT_APP_VERSION.to_string(),
        app_id: APP_ID.into(),
        install_kind: detect_install_kind(os, current_exe.as_deref()),
        current_exe: current_exe
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
    }
}

/// 在事件出口把 install_kind 注入状态（作用于 clone，绝不写回磁盘）。
pub(crate) fn inject_install_kind(mut state: UpdateStateDto, kind: InstallKind) -> UpdateStateDto {
    state.install_kind = Some(kind);
    state
}

/// 当前进程的安装形态；仅在事件出口需要注入时调用。
pub(crate) fn current_install_kind() -> InstallKind {
    current_platform().install_kind
}

fn current_os() -> Os {
    match env::consts::OS {
        "windows" => Os::Windows,
        _ => Os::Unsupported,
    }
}

fn current_arch() -> Arch {
    match env::consts::ARCH {
        "x86_64" => Arch::X86_64,
        "aarch64" => Arch::Aarch64,
        _ => Arch::Unsupported,
    }
}

fn detect_install_kind(os: Os, current_exe: Option<&Path>) -> InstallKind {
    match os {
        Os::Windows => {
            let Some(path) = current_exe else {
                return InstallKind::Unknown;
            };
            if registry_reports_windows_nsis(path) {
                return InstallKind::WindowsNsis;
            }
            let normalized = path.to_string_lossy().to_lowercase();
            if normalized.contains("\\program files\\")
                || normalized.contains("\\program files (x86)\\")
                || normalized.contains("\\appdata\\local\\programs\\")
            {
                InstallKind::WindowsNsis
            } else {
                InstallKind::WindowsPortable
            }
        }
        Os::Unsupported => InstallKind::Unknown,
    }
}

fn registry_reports_windows_nsis(current_exe: &Path) -> bool {
    const ROOTS: [&str; 4] = [
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKCU\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];

    let exe_name = current_exe
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    let current_exe_normalized = normalize_windows_path(&current_exe.to_string_lossy());
    let install_dir_normalized = current_exe
        .parent()
        .map(|path| normalize_windows_path(&path.to_string_lossy()))
        .unwrap_or_default();

    ROOTS.iter().any(|root| {
        // Use raw_arg to prevent Rust from escaping inner double quotes —
        // cmd.exe does not understand backslash-escaped quotes.
        let raw = format!(
            r#"/c chcp 65001 >nul & "{}" query {} /s /f "{}""#,
            reg_exe_path().display(),
            root,
            exe_name
        );
        Command::new("cmd")
            .raw_arg(&raw)
            .creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW)
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .is_some_and(|output| {
                registry_output_matches_installation(
                    &output,
                    &current_exe_normalized,
                    &install_dir_normalized,
                )
            })
    })
}

fn reg_exe_path() -> PathBuf {
    env::var_os("SystemRoot")
        .map(PathBuf::from)
        .map(|root| root.join("System32").join("reg.exe"))
        .filter(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows\System32\reg.exe"))
}

fn registry_output_matches_installation(
    output: &str,
    current_exe_normalized: &str,
    install_dir_normalized: &str,
) -> bool {
    output.lines().any(|line| {
        let normalized = normalize_windows_path(line);
        normalized.contains(current_exe_normalized)
            || (!install_dir_normalized.is_empty()
                && normalized.contains(install_dir_normalized)
                && (normalized.contains("displayicon")
                    || normalized.contains("installdir")
                    || normalized.contains("installlocation")
                    || normalized.contains("uninstallstring")))
    })
}

pub(crate) fn normalize_windows_path(value: &str) -> String {
    value.replace('/', "\\").to_ascii_lowercase()
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct InferredAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
    pub os: Os,
    pub arch: Arch,
    pub kind: InstallKind,
}

pub(crate) fn infer_asset_from_filename(name: &str, url: &str, size: u64) -> Option<InferredAsset> {
    let lower = name.to_lowercase();

    let arch = if lower.contains("aarch64") || lower.contains("arm64") {
        Arch::Aarch64
    } else if lower.contains("x64") || lower.contains("x86_64") {
        Arch::X86_64
    } else {
        return None;
    };

    let (os, kind) =
        if lower.ends_with(".msi") || lower.ends_with("-setup.exe") || lower.contains("setup") {
            (Os::Windows, InstallKind::WindowsNsis)
        } else if lower.ends_with(".exe") {
            (Os::Windows, InstallKind::WindowsPortable)
        } else {
            return None;
        };

    Some(InferredAsset {
        name: name.to_string(),
        url: url.to_string(),
        size,
        os,
        arch,
        kind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_windows_nsis_installation() {
        let install_kind = detect_install_kind(
            Os::Windows,
            Some(Path::new(
                r"C:\Program Files\Floral Notepaper\floral-notepaper.exe",
            )),
        );

        assert_eq!(install_kind, InstallKind::WindowsNsis);
    }

    #[test]
    fn detects_windows_portable_installation() {
        let install_kind = detect_install_kind(
            Os::Windows,
            Some(Path::new(r"D:\Apps\Floral\floral-notepaper.exe")),
        );

        assert_eq!(install_kind, InstallKind::WindowsPortable);
    }

    #[test]
    fn infers_windows_x64_msi() {
        let asset = infer_asset_from_filename(
            "floral-notepaper_1.0.5_x64_en-US.msi",
            "https://github.com/example/releases/download/v1.0.5/app.msi",
            8000,
        );
        let asset = asset.expect("should match msi");
        assert_eq!(asset.os, Os::Windows);
        assert_eq!(asset.arch, Arch::X86_64);
        assert_eq!(asset.kind, InstallKind::WindowsNsis);
    }

    #[test]
    fn infers_windows_x64_setup_exe() {
        let asset = infer_asset_from_filename(
            "floral-notepaper_1.0.5_x64-setup.exe",
            "https://github.com/example/releases/download/v1.0.5/setup.exe",
            9000,
        );
        let asset = asset.expect("should match setup exe");
        assert_eq!(asset.os, Os::Windows);
        assert_eq!(asset.arch, Arch::X86_64);
        assert_eq!(asset.kind, InstallKind::WindowsNsis);
    }

    #[test]
    fn rejects_unknown_filename() {
        assert!(
            infer_asset_from_filename("README.md", "https://example.com/readme", 100).is_none()
        );
        assert!(
            infer_asset_from_filename("app_1.0.5.deb", "https://example.com/app.deb", 100)
                .is_none()
        );
    }

    #[test]
    fn rejects_unknown_install_kind_for_in_app_updates() {
        let platform = PlatformInfo {
            os: Os::Windows,
            arch: Arch::Aarch64,
            app_version: "1.0.3".into(),
            app_id: APP_ID.into(),
            install_kind: InstallKind::Unknown,
            current_exe: None,
        };

        let error = platform
            .ensure_in_app_updates_supported()
            .expect_err("unknown installs should not support in-app updates");

        assert_eq!(error.code, "updatePlatformUnsupported");
    }

    fn portable_platform(current_exe: Option<String>) -> PlatformInfo {
        PlatformInfo {
            os: Os::Windows,
            arch: Arch::X86_64,
            app_version: "1.0.3".into(),
            app_id: APP_ID.into(),
            install_kind: InstallKind::WindowsPortable,
            current_exe,
        }
    }

    #[test]
    fn allows_windows_portable_to_check_updates() {
        // 便携版即使 exe 路径未知（无法判断目录是否可写），也允许检查新版本
        portable_platform(None)
            .ensure_update_check_supported()
            .expect("portable installs should be able to check updates");
    }

    #[test]
    fn allows_windows_portable_in_app_updates_when_dir_is_writable() {
        let dir = std::env::temp_dir()
            .join("floral-notepaper-updater-tests")
            .join("platform-portable-writable");
        std::fs::create_dir_all(&dir).expect("create portable dir");
        let exe = dir.join("floral-notepaper.exe");

        portable_platform(Some(exe.to_string_lossy().to_string()))
            .ensure_in_app_updates_supported()
            .expect("writable portable dir should allow in-app updates");

        // 探测文件不能残留
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .expect("read portable dir")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("write-probe"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn rejects_windows_portable_in_app_updates_when_dir_is_not_writable() {
        // 目录不存在等同于不可写
        let exe = std::env::temp_dir()
            .join("floral-notepaper-updater-tests")
            .join("platform-portable-missing-dir")
            .join("nested")
            .join("floral-notepaper.exe");

        let error = portable_platform(Some(exe.to_string_lossy().to_string()))
            .ensure_in_app_updates_supported()
            .expect_err("unwritable portable dir should fall back to manual update");

        assert_eq!(error.code, "updatePortableDirNotWritable");

        let error = portable_platform(None)
            .ensure_in_app_updates_supported()
            .expect_err("unknown exe path should fall back to manual update");
        assert_eq!(error.code, "updatePortableDirNotWritable");
    }

    #[test]
    fn inject_install_kind_injects_kind_without_touching_other_fields() {
        let mut expected = UpdateStateDto::idle();
        expected.install_kind = Some(InstallKind::WindowsNsis);

        let injected = inject_install_kind(UpdateStateDto::idle(), InstallKind::WindowsNsis);

        assert_eq!(injected.install_kind, Some(InstallKind::WindowsNsis));
        assert_eq!(injected, expected);
    }

    #[test]
    fn caches_platform_info_between_calls() {
        // 连续调用：app_version 随参数变化，其余平台属性（os、install_kind、
        // current_exe）必须命中缓存保持一致。
        let with_version = current_platform_with_version("1.0.4");
        let current = current_platform();

        assert_eq!(with_version.app_version, "1.0.4");
        assert_eq!(current.app_version, version::CURRENT_APP_VERSION);
        assert_eq!(with_version.os, current.os);
        assert_eq!(with_version.install_kind, current.install_kind);
        assert_eq!(with_version.current_exe, current.current_exe);
    }
}
