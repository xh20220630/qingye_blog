# Docker 一键部署

项目已内置 Caddy 反向代理。应用、HTTPS、证书续期和持久化均由 Compose 管理，不需要另外安装或配置 Nginx。

## 直接启动

服务器需要安装 Docker Engine 与 Compose 插件，并开放 TCP 80、TCP 443 和 UDP 443 端口。在项目根目录运行：

```sh
docker compose up -d --build
```

只有公网 IP 时，在项目根目录创建 `.env`，把示例地址换成服务器的实际公网 IP：

```env
SITE_URL=http://203.0.113.10
```

然后执行上面的启动命令，通过 `http://公网IP/` 访问。这样文章链接、RSS、Sitemap 和 canonical 地址也会使用公网 IP。公网 HTTP 不会加密账号密码和会话，只适合临时访问或不启用读者账号的站点。

查看运行状态和日志：

```sh
docker compose ps
docker compose logs --tail=100
```

`blog` 容器健康后，Caddy 才开始转发请求。应用端口 4324 仅在 Compose 内部网络开放，服务器不再暴露 8080。

## 域名与自动 HTTPS

先将域名的 A/AAAA 记录解析到服务器，并确保公网可以访问 80 和 443 端口。然后在项目根目录创建 `.env`：

```env
SITE_URL=https://blog.example.com
```

把域名换成实际地址，再运行：

```sh
docker compose up -d --build
```

Caddy 会自动申请证书、将 HTTP 跳转至 HTTPS，并在到期前续期。证书保存在 `qingye-blog_caddy-data` 卷中。`SITE_URL` 同时用于 Caddy、应用同源检查、文章链接、RSS 和 Sitemap，因此修改域名后必须重新构建。

若主机的 80 或 443 端口已被其他服务占用，需要先停止冲突服务。也可以在 `.env` 中设置 `HTTP_PORT` 和 `HTTPS_PORT`，但使用非标准端口时无法获得常规的免配置公网 HTTPS 体验。

## 更新

拉取代码或编辑 Markdown、配图、站点设置后执行：

```sh
git pull --ff-only
docker compose up -d --build
```

文章随镜像构建发布。构建失败不会替换现有容器，读者数据和证书也不会被清空。

常用命令：

```sh
docker compose logs --tail=100 -f
docker compose restart blog
docker compose stop
docker compose down
```

`down` 会保留数据卷。不要在日常操作中添加 `--volumes`，否则会删除数据库、媒体、备份和 HTTPS 证书。

## 数据与备份

账号、评论、收藏、统计、媒体和备份位于 `qingye-blog_blog-data` 卷。Caddy 的证书与运行数据分别位于 `qingye-blog_caddy-data` 和 `qingye-blog_caddy-config`。

备份博客数据：

```sh
docker compose exec blog node server/backup.mjs
docker compose cp blog:/data/backups ../qingye-backups
```

备份包含账号数据，应保存到网站公开目录之外，并另存到容器所在服务器之外。

本机原有 `~/.qingye-blog/` 数据不会自动导入容器。迁移时先生成一致性备份；停止服务后，将快照中的 `blog.sqlite` 和 `media/` 恢复到新的空数据卷，并将文件属主设为 UID/GID 1000。不要复制旧数据库的 WAL/SHM 文件，也不要让两个服务同时写同一个 SQLite 数据目录。

## 留言审核与密码恢复

```sh
docker compose exec blog node server/comments.mjs pending
docker compose exec blog node server/comments.mjs approve 12
docker compose exec blog node server/comments.mjs hide 12
docker compose exec blog node server/comments.mjs spam 12
```

密码恢复等本地工具也可以通过 `docker compose exec` 使用，详见 [运行说明](deployment.md)。
