# Fork 发布指南 / Fork release guide

本仓库是 [isunky/MDView](https://github.com/isunky/MDView) 的 fork，发布仓库为
[DOTATONG/MDText](https://github.com/DOTATONG/MDText)。

## 版本策略

Fork 使用独立的 `4.x.y` 版本线：

| 变更 | 版本递增 | 示例 |
| --- | --- | --- |
| 新功能 | minor | `4.0.0` → `4.1.0` |
| 修复 | patch | `4.1.0` → `4.1.1` |
| 破坏性变更或重新定义 fork 基线 | major | `4.1.0` → `5.0.0` |

规则：

- 首次 fork 发布使用 `4.0.0`，严格大于上游最后的 `3.6.0`，因此 MSI 可以原地升级并保留设置。
- 不要复用上游的版本号或 tag。上游发布的 `v3.7.0` 与本 fork 的 `v4.x.y` 是两套独立产物。
- 合并上游版本时，上游的 release commit 会修改全部 9 处版本文件，冲突是正常的。解决方式：保留 fork 的版本号，然后在下次发布时用 Release 工作流递增。
- `package.json` 是唯一版本事实源。`npm run version:sync -- <x.y.z>` 会同步所有位置，`npm run version:check` 是 CI 门禁。

## 首次自动发布

前置条件：

1. 在 fork 的 **Actions** 页面启用工作流。
2. 在 **Settings → Actions → General → Workflow permissions** 中选择 **Read and write permissions**。Release 工作流需要用 `GITHUB_TOKEN` 把版本提交推回 `main` 并创建 Release。
3. 如果 `main` 启用了分支保护，允许 `github-actions[bot]` 推送，或在分支规则中放行该工作流。

发布步骤：

1. 打开 **Actions → Release → Run workflow**。
2. 第一次选择 `major`：`3.6.0` → `4.0.0`。
3. 工作流会自动同步版本、提交 `chore: release v4.0.0`、运行测试与构建、创建 tag 和 GitHub Release。

后续发布重复该步骤，按变更类型选择 `patch` / `minor` / `major`。也可以本地同步版本后推送匹配的 `vX.Y.Z` tag，tag 必须与 `package.json` 完全一致。

## 应用内自动更新

`src-tauri/tauri.windows.conf.json` 中的更新端点已指向本 fork：

```text
https://github.com/DOTATONG/MDText/releases/latest/download/latest.json
```

本仓库已生成独立的 Tauri 更新签名密钥，公钥已配置在
`src-tauri/tauri.windows.conf.json` 的 `plugins.updater.pubkey`。私钥保存在仓库之外
（本机为 `%USERPROFILE%\.tauri\mdtext-fork.key`），密码保存在同目录的
`mdtext-fork.key.password.txt`。

在 GitHub 仓库添加以下 Secrets 即可启用自动更新：

- `TAURI_SIGNING_PRIVATE_KEY`：私钥文件内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码

添加后，Release 工作流会为 MSI 生成 `.sig` 和 `latest.json`。如果没有配置这两个
Secret，工作流会跳过更新清单，发布仍然成功，但应用内自动更新不可用。

切勿提交私钥或密码文件。若需要重新生成密钥：

```bash
npm run tauri -- signer generate -w ~/.tauri/mdtext-fork.key
```

重新生成后必须同步更新 `plugins.updater.pubkey`，并在 GitHub Secrets 中更新私钥和密码。

## Windows 代码签名（可选）

上游的 SignPath 配置属于上游组织，fork 无法直接复用。Release 工作流检测不到
`SIGNPATH_API_TOKEN` 和 `SIGNPATH_ORGANIZATION_ID` 时会自动跳过 SignPath，发布未签名安装包。
如需签名，需要自行申请 SignPath 或使用其他代码签名证书，并按
[`CODE_SIGNING_POLICY.md`](../CODE_SIGNING_POLICY.md) 的说明配置。

## macOS

Release 工作流会在 macOS runner 上构建 Universal DMG，并做 ad-hoc 签名。它没有 Apple
Developer ID 签名与公证，用户首次打开可能需要在“隐私与安全性”中允许。
