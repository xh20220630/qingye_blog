# 运行与内容更新

容器部署见 [Docker 部署说明](docker.md)，包含 Compose 启动、持久化、域名、备份与更新方式。下文适用于直接运行 Node 服务。

## 本机运行

需要 Node.js 24.14 或更新版本。

```sh
npm install
npm run build
npm start
```

打开 `http://127.0.0.1:4324/`。没有管理员初始化步骤；读者可直接在 `/account/` 注册。默认私有数据目录为 `~/.qingye-blog/<项目绝对路径哈希>/`，启动日志会打印地址。账号、评论、收藏与统计存放在 `blog.sqlite`，已有媒体保存在 `media/`。

开发时分别运行 `npm run dev:api` 和 `npm run dev -- --port 4322`。Astro 将 `/api`、`/media` 代理到 4324。纯静态预览可阅读、搜索和使用本机袖囊；云端账号与互动需要 Node 服务。

## 写作与发布

1. 在 `src/content/blog/` 新建或修改 Markdown，配图放在 `public/images/`。
2. 在 `src/site-settings.json` 编辑站点信息与友链。
3. 运行 `npm run build`，构建成功后重启 Node 服务。

Markdown 是文章的唯一来源。Node 启动时读取公开文章清单，不会用旧数据库草稿覆盖磁盘文件。`draft: true` 和将来日期的文章不公开；到达发布日期后需重新构建并重启，没有自动发布任务。文章版本使用 Git 管理。

## 环境配置

将 `.env.example` 复制为 `.env` 并填写实际值。

| 变量 | 用途 |
| --- | --- |
| `HOST` / `PORT` | 默认 `127.0.0.1:4324` |
| `QY_DATA_DIR` | 私有持久数据目录，放在网站公开目录之外 |
| `QY_STATIC_DIR` | 静态构建目录，默认项目 `dist`；不再读取旧发布任务的目录指针 |
| `SITE_URL` | 公网 origin，用于同源检查和构建链接 |
| `QY_TRUST_PROXY` | 反向代理覆盖 `X-Forwarded-Proto` 时才开启 |

独立构建时，在终端设置 `SITE_URL`，或修改 `src/site-settings.json` 的域名；环境变量优先。公网部署用反向代理提供 HTTPS，设置 `NODE_ENV=production`，保持站点与 API 同源。当前使用单个 Node 服务和本机 SQLite。

需要独立构建目录时，先在与项目相同的磁盘上构建完整版本，再设置 `QY_STATIC_DIR` 并重启服务；Windows 下 Astro 预渲染会使用同盘文件移动。失败时继续使用旧目录即可。`/api/health` 用于检查服务与数据库。

## 留言审核

新留言默认待审，不会因旧账号的角色直接公开。审核使用服务器本地命令：

```sh
node --env-file-if-exists=.env server/comments.mjs pending
node --env-file-if-exists=.env server/comments.mjs approve 12 13
node --env-file-if-exists=.env server/comments.mjs hide 12
node --env-file-if-exists=.env server/comments.mjs spam 14
```

这些命令不提供任何网络管理入口。

## 备份与密码恢复

`npm run backup` 使用 SQLite backup API，保存数据库一致性快照、已有媒体、Markdown 和站点设置，位置为私有目录 `backups/<时间>/`。其他公开素材和源代码由 Git 或文件备份保存。

恢复时先停止服务，将数据库与媒体恢复到新的私有目录，恢复 Markdown 和设置到项目，设置 `QY_DATA_DIR`，构建后启动。不要混入旧数据库的 `-wal`、`-shm` 文件。备份含账号数据，应私下保管。

已登录读者可在账号页修改密码。需要协助找回时，将新密码写入仓库外的私有文件，再执行：

```sh
node --env-file-if-exists=.env server/accounts.mjs reset 用户名 私有密码文件路径
```

该操作撤销账号的所有旧会话。旧版后台私有数据没有删除，但管理页面、接口、初始化和发布队列已退出运行；旧管理员账号可作为普通读者使用。
