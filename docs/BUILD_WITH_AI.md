# 用 AI 帮你编译 / Build with AI

无需先熟悉编译命令，让能操作本地终端的 AI 编程工具协助完成构建。Mac 版本需在 Mac 上编译，Windows 版本需在 Windows 上编译。

No build expertise required — let an AI coding tool with local terminal access handle it. Build on the target platform: macOS on a Mac, Windows on Windows.

## 步骤 / Steps

1. 从 [Releases](https://github.com/DOTATONG/MDText/releases/latest) 下载 **Source code (zip)** 并解压。
2. 用 AI 编程工具打开解压后的项目文件夹。
3. 发送下方对应的提示词，按提示完成必要的环境安装，等待 AI 给出安装包位置。

Download a release's **Source code (zip)** and extract it, open the folder in an AI coding tool, then send the matching prompt below. Initial setup requires internet access.

## 提示词 / Prompts

**Mac**

```text
请帮我将当前文件夹中的 MDText 源码编译为这台 Mac 可安装的版本。

先阅读项目构建说明，检查本机环境，说明缺失的依赖并协助安装。
使用项目现有构建配置生成适合这台 Mac 的 DMG 安装包。
遇到错误请定位原因、做必要修复并重试，保留我的已有修改。
沿用本地签名配置，不关闭系统安全机制，不上传或发布产物。
完成后确认安装包已生成，告诉我完整路径和安装方法；如未成功，请说明具体阻塞原因。
```

```text
Build the MDText source in this folder into an installable app for this Mac.

Read the project's build instructions, check the environment, and help install missing prerequisites.
Use the existing build configuration to create a DMG for this Mac's architecture.
Diagnose failures, make necessary fixes, and retry while preserving my existing changes.
Keep local signing settings and system security protections. Do not upload or publish artifacts.
Verify the DMG exists, then provide its full path and installation steps.
If the build cannot finish, explain the specific blocker.
```

**Windows**

```text
请帮我将当前文件夹中的 MDText 源码编译为 Windows 安装版和绿色版。

先阅读项目构建说明，检查本机环境，说明缺失的依赖并协助安装。
优先使用项目现有的一键打包入口，生成 MSI、Portable ZIP 和校验文件。
遇到错误请定位原因、做必要修复并重试，保留我的已有修改。
使用本地打包配置，不要求发布签名密钥，不上传或发布产物。
完成后确认文件已生成，告诉我完整路径和使用方法，并检查运行所需的 WebView2 是否可用。
如未成功，请说明具体阻塞原因。
```

```text
Build the MDText source in this folder into Windows installer and portable packages.

Read the project's build instructions, check the environment, and help install missing prerequisites.
Use the existing one-step packaging entry point to create an MSI, Portable ZIP, and checksums.
Diagnose failures, make necessary fixes, and retry while preserving my existing changes.
Use local build settings without release signing keys. Do not upload or publish artifacts.
Verify the files exist, provide their full paths and usage steps, and check WebView2 availability.
If the build cannot finish, explain the specific blocker.
```

## macOS 手动编译 / Manual macOS build

准备 [Node.js 24](https://nodejs.org/en/download)、[Rust/Cargo stable](https://rustup.rs/) 和 Xcode Command Line Tools；详见 [Tauri 环境要求](https://v2.tauri.app/start/prerequisites/)。

Install Node.js 24, stable Rust/Cargo, and Xcode Command Line Tools. See the Tauri prerequisites.

```bash
# 仅在缺少 Apple 编译工具时执行 / Only if Apple's build tools are missing
xcode-select --install

# 在解压后的源码目录执行 / Run from the extracted source directory
npm ci
npm run desktop:build -- --bundles dmg
```

默认构建当前 Mac 架构，产物位于 `src-tauri/target/release/bundle/dmg/`。打开 DMG 后将 MDText 拖入“应用程序”。本地构建使用 ad-hoc 签名，不等于 Apple 公证，也不保证消除所有安全提示。签名机制参见 [Tauri macOS 签名说明](https://v2.tauri.app/distribute/sign/macos/)。

The default build targets your Mac's architecture; the DMG is written to `src-tauri/target/release/bundle/dmg/`. Local builds use ad-hoc signing, are not Apple-notarized, and may still show security prompts.
