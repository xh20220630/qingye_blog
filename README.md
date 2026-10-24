# 青也

基于 [Retypeset](https://github.com/radishzzz/astro-theme-retypeset) 重建的个人博客，使用 Astro、TypeScript 和 UnoCSS。保留主题原生的版式、明暗切换、文章目录、代码高亮、数学公式、RSS / Atom 和 Sitemap。

旧主题、旧文章、三维场景、互动后端和素材已移除，演示文章也已清空。默认使用简体中文，评论、统计与第三方站点验证均未启用。

## 本地运行

需要 Node.js 24.14.0 或更新版本，以及 pnpm 10.33.0。

```bash
npm install --global pnpm@10.33.0
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的地址，默认是 `http://localhost:4321/`。

```bash
pnpm check
pnpm lint
pnpm build
pnpm preview
```

`pnpm build` 包含 Astro 类型检查、静态构建和图片占位处理。开发服务启动及构建时会刷新内容缓存，确保清空目录后已删除的内容不会残留。构建产物在 `dist/`，可以直接部署到静态托管服务或 Nginx。

## 站点配置

编辑 `src/config.ts` 可以修改站点名称、作者、简介、配色、语言和页脚链接。

`site.url` 默认沿用原项目文档中的公开地址 `http://106.53.216.157`。发布前请将其改为实际域名；也可以为构建进程设置 `SITE_URL` 环境变量覆盖。这个地址用于 canonical、分享图片、RSS 和 Sitemap。

站点名称与作者统一为「青也」，副标题留空。关于页包含站点简介与 GitHub 项目展示；需要个人介绍时，在 `src/content/about/` 下新建 `about-zh.md`，在 frontmatter 中填写 `lang: zh` 后编写正文。评论默认关闭；需要时在 `src/config.ts` 填入自己的 Giscus、Twikoo 或 Waline 配置，再启用 `comment.enabled`。

关于页包含 [GitHub 个人主页](https://github.com/xh20220630) 和公开项目列表，页脚的 GitHub 链接也指向个人主页。项目数据保存在 `src/data/github.json`，使用 2026-10-17 获取的公开仓库资料，包含 Fork 标识，并按最近更新时间排序。页面直接渲染本地数据，不依赖访客访问 GitHub API；新增或修改 GitHub 仓库后，需要更新该文件并重新构建。

## 写作

```bash
pnpm new-post my-first-post
```

文章会生成在 `src/content/posts/my-first-post.md`，也可以直接新建 Markdown 或 MDX 文件：

```markdown
---
title: 我的第一篇文章
published: 2026-10-17
description: 一段简短的文章介绍。
tags:
  - 随笔
draft: false
lang: zh
---

从这里开始写正文。
```

文章路径是 `/posts/my-first-post/`。`draft: true` 的文章仅在开发模式可见；`pin` 为 1 到 99 时置顶，数值越大越靠前。修改内容后需要重新构建，文章字段以 `src/content.config.ts` 为准。

## Markdown 支持

文章支持基础 Markdown、GFM、代码复制、图片与画廊、KaTeX、Mermaid、提示块、折叠内容和媒体嵌入。

GitHub 仓库卡片会先显示本站保存的公开项目资料，再尝试更新，避免接口限流时卡片空白。

## Docker 部署

首次部署时复制 `.env.docker.example` 为 `.env.docker`，填写实际的 `SITE_URL`。PowerShell：

```powershell
Copy-Item .env.docker.example .env.docker
```

Linux / macOS：

```bash
cp .env.docker.example .env.docker
```

```bash
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
```

默认通过 `http://localhost:8080/` 访问。直接对外提供访问时，将 `QY_BIND_IP` 改为 `0.0.0.0`；使用 HTTPS 反向代理时可保留本地绑定。修改域名、配置或文章后，重新执行构建启动命令。

容器使用 Nginx 提供静态文件，不再运行旧版 Node API，也不挂载旧数据库卷。升级不会主动删除已有 Docker 数据卷。

### 使用 Caddy 提供公网入口

服务器使用 Caddy 占用 80 / 443 端口时，部署命令需同时加载 `compose.caddy.yaml`。在 `.env.docker` 中将 `SITE_URL` 和 `SITE_ADDRESS` 都设为实际访问地址，例如 `http://106.53.216.157`；使用域名和 HTTPS 时填写 `https://你的域名`。博客的 `QY_BIND_IP` 可继续保留 `127.0.0.1`，Caddy 通过 Docker 网络访问 `blog:4324`。

```bash
docker compose --env-file .env.docker -f compose.yaml -f compose.caddy.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.caddy.yaml up -d --build
```

后续更新和停止服务时也应使用相同的两个 Compose 文件。已有服务器使用 `.env` 时，可以省略 `--env-file .env.docker`，继续读取 `.env`。Caddy 的证书与配置沿用 `caddy-data`、`caddy-config` 命名卷。

从旧版升级时，Caddy 的健康检查必须使用 `/`。旧版的 `/api/health` 在静态博客中返回 404，会让代理将正常博客判为不健康，导致公网出现 503。若看到 `qingye-blog-caddy-1` 的孤立容器提示，需使用上述两个 Compose 文件将其纳入管理；`--remove-orphans` 会移除未纳入当前配置的公网入口容器。

## 主题来源

本项目引入 Retypeset 上游提交 `a636b6d393be714cab52d3fc4baddd3f3905f701`，保留其 MIT 许可证和页脚署名。完整使用说明见 [Retypeset 主题指南](https://retypeset.radishzz.cc/posts/theme-guide/)。后续更新上游时，请检查个人配置、空状态和部署文件的合并结果。
