# Docker 部署

使用 Linux 容器：Linux 服务器安装 Docker Engine 与 Compose 插件；Windows 使用 Docker Desktop 的 Linux 容器模式。

## 启动

在项目根目录复制配置。PowerShell：

```powershell
Copy-Item .env.docker.example .env.docker
```

Linux / macOS 使用 `cp .env.docker.example .env.docker`。复制只需一次，已有配置不要覆盖。

按实际环境修改 `.env.docker`，然后运行：

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

默认访问 **http://localhost:8080/**。容器内部监听 4324，主机端口默认是 8080，避免与本机 Node 服务冲突。没有管理员后台或初始化步骤。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `SITE_URL` | `http://localhost:8080` | 站点实际 origin；公网部署改成 HTTPS 域名 |
| `QY_HTTP_PORT` | `8080` | 主机映射端口；更改后也要调整本地访问用的 `SITE_URL` |
| `QY_BIND_IP` | `127.0.0.1` | 默认只供本机与本机反向代理访问；需要直接远程访问时改为 `0.0.0.0` |
| `QY_IMAGE_TAG` | `local` | 构建镜像的标签 |
| `QY_TRUST_PROXY` | `false` | 可信 HTTPS 反向代理覆盖转发协议头时才开启 |

Compose 每次都使用 `--env-file .env.docker`，与原来的本机 `.env` 配置分开。`SITE_URL` 同时传入镜像构建和容器运行环境；修改域名必须重新构建，否则文章链接、RSS 和 Sitemap 仍使用旧域名。Compose 的变量替换规则见 [官方说明](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)。

## 镜像与数据

Dockerfile 使用固定版本与摘要的 Node 24 Debian slim 镜像。通过 [多阶段构建](https://docs.docker.com/build/building/multi-stage/)，最终镜像只保留：

- Astro 构建出的静态页面与 Three.js 素材。
- Node 服务及 `gray-matter` 的生产依赖。
- 与静态页面对应的 Markdown 和站点设置，供阅读接口与备份读取。

构建工具、开发依赖、Blender 原稿、本机数据库和环境文件不进入运行镜像。`.dockerignore` 只允许构建所需的文件进入上下文。

容器使用 `node` 用户（UID / GID 1000），根文件系统只读。数据库、媒体与备份写入 `/data`，挂载默认命名卷 `qingye-blog_blog-data`；容器替换后该卷继续保留。Docker 卷的生命周期独立于容器，见 [官方卷文档](https://docs.docker.com/engine/storage/volumes/)。

本机原有 `~/.qingye-blog/` 数据不会自动导入 Docker。迁移时先用 `npm run backup` 生成一致性快照；在服务停止时，将快照中的 `blog.sqlite` 与 `media/` 恢复到新的空数据卷，文件属主设为 UID / GID 1000，再启动容器。不要混用旧数据库的 WAL / SHM 文件，也不要同时让两个服务写同一个 SQLite 数据目录。

每个数据卷只运行一个博客实例。更改 Compose 项目名会使用另一组卷；日常更新保持同一个项目名。

## 更新文章与应用

编辑源代码中的 Markdown、配图或站点设置后：

```sh
docker compose --env-file .env.docker up -d --build
```

文章随镜像构建发布，不直接修改容器内文件。更新不会清空读者数据；构建失败时不会用未完成的镜像替换现有容器。

```sh
docker compose --env-file .env.docker logs --tail=100 -f blog
docker compose --env-file .env.docker restart blog
docker compose --env-file .env.docker stop
docker compose --env-file .env.docker down
```

`down` 保留数据卷；不要给日常停止命令添加 `--volumes`，它会删除持久数据。服务配置了进程退出后重启与日志轮转。健康检查验证首页文件和 `/api/health` 的数据库响应；健康状态为 unhealthy 本身不会触发 Compose 重启。

## 备份与留言

```sh
docker compose --env-file .env.docker exec blog node server/backup.mjs
docker compose --env-file .env.docker cp blog:/data/backups ../qingye-backups
docker compose --env-file .env.docker exec blog node server/comments.mjs pending
docker compose --env-file .env.docker exec blog node server/comments.mjs approve 12
```

备份包含账号数据，应保存在网站公开目录之外，并另存到容器所在机器之外。恢复 Markdown 和设置后重新构建镜像；数据库与媒体恢复到私有数据卷。密码恢复等本地工具仍可通过 `docker compose exec` 使用，详见 [运行说明](deployment.md)。

## HTTPS 反向代理

若 HTTPS 由同一台主机上的反向代理提供，保留 `QY_BIND_IP=127.0.0.1`，设置真实 `SITE_URL=https://你的域名` 和 `QY_TRUST_PROXY=true`，重新构建启动。

已有 Nginx HTTPS 站点可将全部请求转发到本机 8080：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

此片段放入已经配置域名与证书的 HTTPS server 块。前台与 API 使用同一域名。若反向代理也在容器里，应让它加入同一 Docker 网络，通过 `blog:4324` 访问服务，而非代理容器自己的 localhost。
