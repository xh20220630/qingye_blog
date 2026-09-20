# 青野山房 · Qingye Blog

> 云深不知处，码上见真章。

一座可以漫游的云上藏书阁，也是一个认真写作、安静阅读的个人博客。

青野山房将文章、连载、标签与归档放进六座浮岛：你可以在云海间环顾、寻山、近观楼阁，也可以直接打开文章，在书卷中阅读技术笔记、读书心得与山间见闻。三维世界是内容的入口，Markdown 是文章的来源。

**[在线访问](http://106.53.216.157/)** · [功能说明](docs/blog-features.md) · [运行与部署](docs/deployment.md) · [Docker 部署](docs/docker.md)

## 界面预览

以下位置预留给当前在线版本的真实截图，暂未添加图片。旧版截图保留在 `docs/` 中作为历史素材，不用于展示当前界面。

### 云海洞天

> **首页截图占位**
>
> 展示三维浮岛、云海、地点导航与天色切换。
>
> 待补充：`docs/screenshots/home.jpg`

<!-- 获取当前网站真实截图后，用下面的图片引用替换上方占位：
![青野山房首页：云海与六座浮岛](docs/screenshots/home.jpg)
-->

### 书卷阅读

> **文章页截图占位**
>
> 展示文章正文、目录、阅读工具与系列导航。
>
> 待补充：`docs/screenshots/article.jpg`

<!-- 获取当前网站真实截图后，用下面的图片引用替换上方占位：
![青野山房文章页：书卷阅读与文章目录](docs/screenshots/article.jpg)
-->

### 内容检索

> **搜索页截图占位**
>
> 展示搜索结果、分类 / 标签 / 系列 / 年份筛选与命中高亮。
>
> 待补充：`docs/screenshots/search.jpg`

<!-- 获取当前网站真实截图后，用下面的图片引用替换上方占位：
![青野山房搜索页：全文检索与组合筛选](docs/screenshots/search.jpg)
-->

## 项目特色

### 在洞天里探索

- **六处地点，六种内容入口**：点击浮岛或导航抵达对应地点，展开书卷后阅读，收卷后回到原处；内容也有可直接访问的独立页面。
- **会流动的云海**：Three.js 与 GLSL 实现体积云、分层流动、透射与自阴影，配合楼阁、仙鹤、松树与流瀑构成场景。
- **可调整的观景体验**：支持「辰光 / 霞照 / 月华」天色、「随境 / 精致 / 流畅」画质、三档风速、镜头缩放与建筑近观。
- **阅读与性能兼顾**：展开书卷或页面隐藏时暂停世界渲染，支持减少动态效果、手动暂停，以及 WebGL 不可用时的静态背景与内容入口。

| 洞天地点 | 对应内容 | 页面路径 |
| --- | --- | --- |
| 藏经阁 | 全部文章 | `/blog/` |
| 修行台 | 连载系列 | `/series/` |
| 星罗台 | 标签索引 | `/tags/` |
| 岁月碑 | 时间归档 | `/archive/` |
| 问道亭 | 关于作者 | `/about/` |
| 飞鹤渡 | 留言板 | `/guestbook/` |

### 把阅读做完整

- **文章组织**：Markdown 写作，支持分类、标签、系列、精选标记、草稿与发布日期过滤。
- **阅读工具**：文章目录、代码复制、图片放大、阅读进度、断点续读、专注模式、卷面宽度调整、打印与系列导航。
- **全文检索**：索引正文与代码，支持分类、标签、系列、年份组合筛选，以及排序、分页、命中高亮和可分享的检索地址。
- **袖囊收藏**：访客在本机保存收藏与阅读记录；登录后支持账号同步、主动导入访客记录和 JSON 导出。
- **读者互动**：注册与登录、昵称和密码修改、文章点赞、阅读统计、评论回复与留言板；新留言审核后公开。
- **订阅与发现**：全站及主题 RSS、JSON Feed、Sitemap、robots、canonical、Open Graph 和 JSON-LD。

### 内容与数据各有所属

文章保存在 `src/content/blog/`，站点信息保存在 `src/site-settings.json`，均通过 Git 管理。Node.js 服务使用 SQLite 保存账号、评论、收藏与统计，并提供本地审核、密码恢复和备份工具。

当前版本的内容发布方式是 **编辑文件 → 构建 → 重启服务**。不包含在线写作后台、邮件群发或自动定时发布服务。

## 技术组成

| 层次 | 技术 | 用途 |
| --- | --- | --- |
| 页面与内容 | Astro、TypeScript、Markdown Content Collections | 静态页面、内容校验、路由与订阅生成 |
| 三维场景 | Three.js、GLSL、WebGL2 | 浮岛、镜头漫游、体积云与光影 |
| 搜索 | Fuse.js | 浏览器端全文检索与筛选 |
| 互动服务 | Node.js、内置 `node:sqlite`、gray-matter | 读者 API、数据持久化与文章元数据读取 |
| 三维素材 | Blender、GLB、Draco | 楼阁与仙鹤模型制作、压缩和加载 |
| 部署 | Docker、Docker Compose | 构建静态页面、运行 Node 服务、持久化数据 |

Astro 构建结果位于 `dist/`。完整运行时由同一个 Node 服务提供静态页面与 `/api` 接口，无需额外安装数据库服务。

## 快速开始

### 方式一：Docker Compose

需要 Docker 与 Compose 插件；Windows 使用 Docker Desktop 的 Linux 容器模式。

```bash
git clone https://github.com/xh20220630/qingye_blog.git
cd qingye_blog
```

首次启动前复制配置文件。Linux / macOS：

```bash
cp .env.docker.example .env.docker
```

PowerShell：

```powershell
Copy-Item .env.docker.example .env.docker
```

本机体验可保留默认值；部署到服务器时，先将 `.env.docker` 中的 `SITE_URL` 改为实际访问地址，再启动：

```bash
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

打开 **[http://localhost:8080/](http://localhost:8080/)**。

- 默认仅绑定主机 `127.0.0.1:8080`；需要直接远程访问时，调整 `QY_BIND_IP` 与 `QY_HTTP_PORT`，并使 `SITE_URL` 与实际地址一致。
- 数据保存到 `blog-data` 命名卷，容器内路径为 `/data`；重新构建不会清空该卷。
- 修改文章、配图、站点设置或域名后，重新执行 `up -d --build`。
- 日常停止使用 `docker compose --env-file .env.docker down`；不要添加 `--volumes`，否则会删除持久数据卷。

域名、HTTPS 反向代理、数据迁移和备份操作见 [Docker 部署说明](docs/docker.md)。

### 方式二：本机 Node.js

需要 **Node.js 24.14.0 或更新版本**，版本要求来自项目的 `package.json`。

```bash
git clone https://github.com/xh20220630/qingye_blog.git
cd qingye_blog
npm ci
```

在 `src/site-settings.json` 中修改站点名称、介绍与 `url`。本机体验可将 `url` 设置为 `http://127.0.0.1:4324`；公开部署时填写实际站点地址，避免订阅和搜索引擎链接使用仓库中的示例域名。

```bash
npm run build
npm start
```

打开 **[http://127.0.0.1:4324/](http://127.0.0.1:4324/)**。读者可在 `/account/` 注册，无需管理员初始化。

默认数据目录为 `~/.qingye-blog/<项目绝对路径哈希>/`，启动日志会显示实际位置。更换项目路径前，可通过 `QY_DATA_DIR` 指定固定数据目录。

### 本地开发

在项目根目录打开两个终端，分别启动互动服务与 Astro：

```bash
# 终端一：互动 API，默认端口 4324
npm run dev:api
```

```bash
# 终端二：前端开发，使用项目已配置的开发端口
npm run dev -- --port 4322
```

访问 **[http://localhost:4322/](http://localhost:4322/)**。Astro 将 `/api` 和 `/media` 代理到 `127.0.0.1:4324`。仅运行 `npm run preview` 时可预览静态内容，但不提供账号、评论和云端同步接口。

## 写作与发布

在 `src/content/blog/` 下新建 Markdown 文件，例如 `my-first-post.md`；配图放在 `public/images/`。

```markdown
---
title: 我的第一篇山房笔记
description: 记录一次技术探索，以及沿途的思考。
pubDate: 2026-09-01
tags: ['Astro', '开发笔记']
category: 技术笔记
author: 青野散人
series: 从零搭建个人博客
featured: false
draft: false
commentsEnabled: true
---

## 从一个问题开始

在这里写下正文。
```

`title`、`description`、`pubDate` 为必填项。其他字段及默认值由 [内容 Schema](src/content.config.ts) 定义；可选字段还包括 `updatedDate`、`cover` 与 `realm`，不需要时可以省略。

- 文件名用作文章 slug，例如 `my-first-post.md` 对应 `/blog/my-first-post/`；建议使用英文小写、数字与短横线，保持与互动 API 的路径规则一致。
- `draft: true` 或发布日期晚于当前时间的文章不会公开。
- 到达发布日期后仍需重新构建并重启服务；项目没有自动发布任务。
- Node 部署执行 `npm run build`，成功后重启服务；Docker 部署执行 `docker compose --env-file .env.docker up -d --build`。

文章源文件及公开素材随 Git 保存，SQLite 不作为文章编辑或发布来源。

## 配置与日常维护

### 站点设置

编辑 [src/site-settings.json](src/site-settings.json) 可修改站点名称、副标题、作者、介绍、站点 URL、备案号与友链。修改后重新构建。

本机 Node 服务可将 `.env.example` 复制为 `.env`；常用运行配置如下：

| 变量 | 作用 |
| --- | --- |
| `HOST` / `PORT` | Node 监听地址与端口，默认 `127.0.0.1:4324` |
| `SITE_URL` | 实际站点 origin，用于运行时来源校验；构建进程中的同名变量优先于站点设置 |
| `QY_DATA_DIR` | SQLite、媒体和备份的私有持久化目录 |
| `QY_STATIC_DIR` | 静态构建产物目录，默认项目根目录下的 `dist/` |
| `QY_TRUST_PROXY` | 是否信任代理转发的协议头，仅在可信反向代理正确覆盖该头时开启 |

`npm start` 与 `npm run dev:api` 自动读取 `.env`。单独构建时，应在终端为构建进程设置 `SITE_URL`，或直接修改 `src/site-settings.json` 的 `url`；不要只修改运行时地址而继续使用旧的订阅与页面链接。Docker Compose 会将 `SITE_URL` 同时传入构建和运行环境。

### 备份与留言审核

以下命令适用于本机 Node 部署：

```bash
# 备份数据库、已有媒体、Markdown 与站点设置
npm run backup

# 查看待审核留言
node --env-file-if-exists=.env server/comments.mjs pending

# 审核通过指定留言，示例 ID 为 12
node --env-file-if-exists=.env server/comments.mjs approve 12
```

备份位于私有数据目录的 `backups/<时间>/`。公开图片、三维模型与其他源代码仍需通过 Git 或文件备份保存；账号数据和备份不应放入网站公开目录或提交到仓库。

Docker 容器内备份、恢复数据、隐藏留言与密码恢复见 [运行说明](docs/deployment.md) 和 [Docker 部署说明](docs/docker.md)。

## 源码导航

| 路径 | 内容 |
| --- | --- |
| `src/pages/` | 首页、文章、索引页、搜索、订阅与其他页面路由 |
| `src/content/blog/` | Markdown 文章 |
| `src/content.config.ts` | 文章元数据校验与默认值 |
| `src/components/`、`src/layouts/`、`src/styles/` | 组件、页面骨架与样式 |
| `src/world/` | 地点定义、模型、体积云、镜头与洞天交互 |
| `src/community/` | 搜索、读者账号、收藏、阅读与评论交互 |
| `src/lib/` | 发布过滤、客户端请求、格式化等共用逻辑 |
| `server/` | HTTP 服务、SQLite、本地审核、账号恢复与备份 |
| `public/` | 可直接访问的图片、模型与解码器资源 |
| `originals/`、`tools/` | 图片及 Blender 原稿、模型生成脚本 |
| `docs/` | 功能、部署文档与截图素材 |
| `Dockerfile`、`compose.yaml`、`docker/` | 容器构建、编排与健康检查 |

## 素材与进一步阅读

- [博客功能说明](docs/blog-features.md)：阅读、检索、互动与发布能力。
- [运行与内容更新](docs/deployment.md)：Node 部署、环境配置、审核与数据恢复。
- [Docker 部署](docs/docker.md)：容器启动、域名配置、持久化与更新。
- [三维模型说明](public/models/realm/README.md)：Blender 工程、模型生成与加载方式。
- [仙境插画说明](public/images/xianxia/CREDITS.md)：图片来源、生成提示词与用途。
- [水墨素材说明](public/images/CREDITS.md)：历史水墨素材的来源与署名信息。
- [Draco 解码器许可](public/models/draco/LICENSE)：随仓库分发的第三方解码器许可。

---

山中无历日，落笔自有时。
