# 哔哩哔哩 · QPlayer 音源

<p><b>简体中文</b> · <a href="README.en.md">English</a></p>

QPlayer 的哔哩哔哩音源插件。在 QPlayer 里搜索视频和 UP 主、查看排行与收藏夹，并用视频音轨播放。


## 功能

- 搜索视频、把视频当作专辑搜索、搜索 UP 主，以及热搜
- 首页：音乐区排行、每周必看、入站必刷和分区榜
- 视频详情与分 P（专辑），UP 主稿件（最多约 90 条）
- 播放地址、字幕转 LRC（需登录）
- Cookie 登录、账号信息、自己的收藏夹（单个收藏夹最多加载 1000 条）
- 分享链接

歌曲的原生 ID 是 `BVxxx`，分 P 为 `BVxxx#cid`。

登录方式目前只有粘贴 Cookie：浏览器登录 bilibili 后，从开发者工具复制请求头里的整段 Cookie，其中必须包含 `SESSDATA`。未登录时搜索和排行仍可用；AI 字幕和自己的收藏夹需要登录。

## 宿主版本

`minHostVersion` 为 `1.8.1`。播放地址是 B 站 DASH 音轨，容器为 AAC `.m4s`。更早的桌面端只解码 MP3、OGG、FLAC、WAV，无法播放这种音轨。1.8.1 起由 QPlayer 补上。

所以需要 QPlayer 1.8.0 以上(不含 1.8.0)版本才能适配此音源。

## 构建与导入

```bash
chmod +x scripts/package.sh
./scripts/package.sh
python3 scripts/verify-package.py dist/*.qplug
```

在 QPlayer 中「设置 → 音源插件 → 导入插件包」，选择 `dist/bilibili-<version>.qplug`。未签名包只能手动导入，每次都会提示代码执行警告。

需要联网的域名写在 `plugin.json` 的 `networkDomains` 里。封面和播放地址如果落到未授权域名，会被宿主清空或拒绝。B 站更换 CDN 时要同步改清单。

能力、数据结构和登录约定见 [插件 ABI 1.0](docs/ABI.md)。

## 签名与发布

公开分发使用不进入仓库的 P-256 私钥：

```bash
QPLAYER_PLUGIN_SIGNING_KEY=/secure/path/publisher-private.pem ./scripts/package.sh
```

`scripts/package.sh` 为 `plugin.json`、`src/` 和可选的 `assets/` 写入 `META-INF/qplayer-files.json`，有私钥时再写入 `META-INF/qplayer.sig`，产物为 `dist/<id>-<version>.qplug`。

首次发布前生成密钥：

```bash
openssl ecparam -name prime256v1 -genkey -noout -out publisher-private.pem
gh secret set QPLAYER_PLUGIN_SIGNING_KEY < publisher-private.pem
openssl ec -in publisher-private.pem -pubout -outform DER \
  | openssl base64 -A > publisher-key.pub
```

私钥放入 Actions Secret 后离线备份，不要留在工作目录。`publisher-key.pub` 需要提交。发布者公钥会编译进 QPlayer，不能更换，否则已发布的 QPlayer 将无法安装本插件，直到 QPlayer 发新版本。

推送与 `plugin.json` 版本一致的 tag 才会签名并创建 Release。分支和 Pull Request 只打未签名的开发包。

```bash
git tag v0.1.0
git push origin v0.1.0
```

QPlayer 读取仓库的 latest release。tag 必须是 `v<plugin.json 的 version>`，Release 里只能有一个 `.qplug`，且不能是草稿或预发布。

本仓库使用 MIT 许可证。使用哔哩哔哩的内容和服务须自行遵守其条款与当地法律。
