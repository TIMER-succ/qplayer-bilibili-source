# Bilibili · QPlayer source

<p><a href="README.md">简体中文</a> · <b>English</b></p>

A QPlayer music-source plugin for Bilibili. Search videos and uploaders, open rankings and favorites, and play a video's audio track. The plugin id is `bilibili`, and every media id is qualified with that prefix after install.

QPlayer itself does not ship this source. The plugin runs in an isolated Rhino realm. Only permissions declared in `plugin.json` and confirmed at install time take effect. The login cookie is stored only through `credentials.*`. It is never written into source or logs.

## Features

- Search videos, search the same videos as albums, search uploaders, and hot search
- Home: music ranking, weekly picks, editor's picks, and category charts
- Video details and pages (as an album), plus an uploader's recent videos (about 90)
- Stream URL, and subtitles converted to LRC (login required)
- Cookie login, account profile, and your own favorite folders (at most 1000 items each)
- Share links

A song's native id is `BVxxx`. A page is `BVxxx#cid`.

The only login method is pasting a cookie. Sign in at bilibili in a browser, then copy the full `Cookie` request header. It must contain `SESSDATA`. Search and rankings work without login. AI subtitles and your favorite folders do not.

## Host version

`minHostVersion` is `1.8.1`. The stream is Bilibili DASH audio, AAC in an `.m4s` container. Older desktop builds decode only MP3, OGG, FLAC, and WAV, so they cannot play it. QPlayer adds that support in 1.8.1.

## Build and import

```bash
chmod +x scripts/package.sh
./scripts/package.sh
python3 scripts/verify-package.py dist/*.qplug
```

In QPlayer, choose **Settings → Source plugins → Import plugin package** and select `dist/bilibili-<version>.qplug`. Unsigned packages can only be imported manually, and QPlayer shows a code-execution warning every time.

Hosts used for network access are listed in `networkDomains`. Covers and stream URLs outside that grant are cleared or rejected. Update the manifest when a Bilibili CDN changes.

Capabilities, data shapes, and login are documented in the [plugin ABI 1.0](docs/ABI.en.md).

## Signing and releasing

Public distribution uses a P-256 private key that stays out of the repository:

```bash
QPLAYER_PLUGIN_SIGNING_KEY=/secure/path/publisher-private.pem ./scripts/package.sh
```

`scripts/package.sh` records every file under `plugin.json`, `src/`, and an optional `assets/` in `META-INF/qplayer-files.json`, adds `META-INF/qplayer.sig` when a key is supplied, and writes `dist/<id>-<version>.qplug`.

Generate the publisher key once, before the first release:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out publisher-private.pem
gh secret set QPLAYER_PLUGIN_SIGNING_KEY < publisher-private.pem
openssl ec -in publisher-private.pem -pubout -outform DER \
  | openssl base64 -A > publisher-key.pub
```

After the private key is stored in the Actions secret, move it to offline backup. Commit `publisher-key.pub`. The publisher public key is compiled into QPlayer and cannot be rotated; changing it prevents every already-released QPlayer from installing this plugin until QPlayer itself ships a new version.

Pushing a tag that matches `plugin.json` signs the package and creates a Release. Branches and pull requests only build unsigned development packages.

```bash
git tag v0.1.0
git push origin v0.1.0
```

QPlayer reads the repository's latest release. The tag must be `v<version from plugin.json>`, the release must attach exactly one `.qplug`, and it must not be a draft or pre-release.

This repository is MIT licensed. Use of Bilibili content and services is subject to their terms and local law.
