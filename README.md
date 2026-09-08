# 青野山房 · qingye_blog

> 云深不知处，码上见真章。

「青野山房」是一个以修仙意境写技术博客的个人站点 —— 用国风水墨的视觉语言，记录一个「青野散人」的炼丹（写代码）、布阵（架构设计）与云游（随笔）日常。

基于 **Astro 5** 构建，静态输出、秒开首屏；全站白昼云海主题，水墨底图 + 宣纸卷轴质感。

## 页面截图

| 首页 · 云海水墨 Hero | 文章页 · 宣纸卷轴正文 |
| :---: | :---: |
| ![首页截图](docs/screenshot-home.jpg) | ![文章页截图](docs/screenshot-post.jpg) |

## 功能一览

- **内容体系**：Markdown 文章（Content Collections 校验 frontmatter），支持标签、分类、连载系列三种组织方式
- **归档 / 标签 / 分类 / 系列** 独立索引页，自动生成
- **全文检索**：fuse.js 客户端模糊搜索，构建时生成搜索索引
- **友链 & 留言板**：友链在 `src/config.ts` 一处配置；留言板预留 giscus 接口
- **RSS & Sitemap**：`@astrojs/rss` + `@astrojs/sitemap` 开箱即用
- **动效**：GSAP 滚动动效 + Three.js 漂浮仙山粒子，支持降级
- **全站配置化**：站点名、公告条、友链、备案号均在 `src/config.ts` 集中管理

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 本地开发 http://localhost:4321
npm run build      # 构建静态产物到 dist/
npm run preview    # 预览构建产物
```

## 写作

在 `src/content/blog/` 下新建 `.md` 文件即可：

```markdown
---
title: 我的新篇
description: 一句话摘要
pubDate: 2026-09-08
tags: ['阵法推演']
category: 功法秘籍
series: 护山大阵        # 可选：连载系列名
---
正文……
```

## 目录结构

```
src/
├── components/    # 页头、页脚、公告条、卷轴组件等
├── content/blog/  # Markdown 文章（14 篇示例）
├── layouts/       # BaseLayout 全站骨架
├── lib/           # 格式化、统计等工具函数
├── pages/         # 路由：首页/文章/归档/标签/检索/关于/友链/留言板/RSS…
└── config.ts      # 站点配置（公告、友链、giscus、备案号）
docs/              # README 引用的页面截图
originals/         # 未压缩的水墨原图
tools/             # 图片处理与素材生成脚本（Python）
```

## 技术栈

Astro 5 · TypeScript · fuse.js · GSAP · Three.js · @astrojs/rss · @astrojs/sitemap

---

*山中无历日，寒尽不知年 —— 但 git log 记得。*
