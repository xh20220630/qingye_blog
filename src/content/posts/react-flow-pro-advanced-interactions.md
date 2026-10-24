---
title: React Flow Pro 高级交互实现
published: 2026-10-23
description: 基于 Next.js、React 和 TypeScript，将 React Flow 的 15 个高级交互示例整合进同一个工作台，覆盖自动布局、连线编辑、多人协作与白板交互。
tags:
  - 前端
  - React.js
  - React Flow
draft: false
toc: true
lang: zh
abbrlink: react-flow-pro-advanced-interactions
---

## 把 React Flow Pro 的高级交互跑起来：15 个实战示例，覆盖布局、连线与多人协作

本次项目只做学习使用，学习如何还原 react flow pro 的高级示例，不做任何的商业用途，也欢迎大家给我更多实用的流程图，画布编辑器方向 的功能建议

**React Flow Pro Examples**：一个基于 **Next.js 16、React 19、TypeScript 和官方 `@xyflow/react`** 的独立项目，把 15 个高级交互示例放进同一个工作台。可以本地运行、逐项体验，也可以沿着源码研究布局、几何计算和状态管理的实现。

项目地址：[xh20220630/react-flow-pro-example-](https://github.com/xh20220630/react-flow-pro-example-)

项目地址：[在线体验](http://106.53.216.157:5555/)

### 15 个官方的示例

| 方向 | 已包含的示例 | 值得关注的问题 |
| --- | --- | --- |
| 节点 | 节点位置动画、流程图形状 | 布局切换如何过渡，图形如何编辑和缩放 |
| 连线 | WASM 避障路由、可编辑连线 | 路径如何避障，控制点如何参与编辑 |
| 编辑交互 | 辅助线与吸附、复制剪切粘贴、撤销重做 | 如何保持对齐、图结构和操作历史 |
| 多人协作 | 图、表单、光标与连接草稿同步 | 共享文档与临时在线状态如何组织 |
| 分组 | 选择分组、父子节点关系 | 绝对坐标与组内相对坐标如何转换 |
| 布局 | 展开折叠、自动布局、力导向布局、动态树布局 | 图结构变化后如何计算和更新位置 |
| 白板 | 自由绘制 | 笔迹如何变成可选择、移动和缩放的对象 |

每个示例都有独立的文件，可以围绕一个具体问题观察、操作和阅读实现。把它们用于业务项目时，还需要按业务的数据模型与交互规则组合能力。

### 动态树布局

点击节点，可以追加子节点；点击末端的虚线占位节点，可以将其转成普通节点并继续延伸；点击连线上的加号，可以在已有的两个步骤之间插入新节点。

![dynamic-layouting.jpg](/images/react-flow-pro-advanced-interactions/dynamic-layouting.webp)

这组交互背后，包含两层处理。

第一层维护图结构。比如在 A → B 之间插入 C，需要把原来的边替换为 A → C 和 C → B；激活末端占位节点时，则需要同时更新节点类型、连接类型，并补上新的末端占位节点。

第二层处理布局与过渡。示例通过入边确定父节点，用 D3 的 `stratify` 和 `tree` 计算目标位置，再用 D3 timer 在当前坐标和目标坐标之间插值，完成约 300ms 的位置过渡。快速连续操作时，旧动画会在清理阶段停止，避免继续覆盖新的布局。

### 自动布局

项目同时接入了 **Dagre、D3 Hierarchy 和 ELK**，可以切换四个布局方向，并通过参数面板调整间距、追加节点或新增根节点。

![auto-layout.jpg](/images/react-flow-pro-advanced-interactions/auto-layout.webp)

布局需要等待节点尺寸测量完成；Dagre 返回的中心坐标，需要减去半个节点宽高，转换成节点左上角坐标；D3 的树布局通过虚拟根组织多棵树；ELK 的异步计算结果，则需要按节点 ID 合并回原有数据。

切换方向时，除了调整坐标轴，还要更新连线的入口和出口方位。把这些步骤放在一起看，更容易理解为什么“调用一次布局函数”距离完整的自动布局交互还有一段距离。

项目还提供力导向布局：将画布节点映射成模拟粒子，叠加排斥力、连线力和居中力。拖动节点时，通过 `fx`、`fy` 固定对应粒子，结束后释放并重新激活模拟。

### 连线进阶

在复杂画布里，连线的路径会直接影响可读性。项目分别提供了自动避障和控制点编辑两个示例。

避障路由使用 **`libavoid-js` 的 WASM 能力**。实现中会把节点矩形同步为障碍物，把 Handle 映射为带方向信息的连接引脚，再维护连接对象、执行路由事务，将计算得到的中间折点写回连线数据。

节点移动后，障碍物的位置随之更新，路径也会重新计算。WASM 文件来自项目安装的依赖。

这里还有一个容易忽略的状态问题：路由结果写回边数据，本身也会触发状态更新。

可编辑连线示例则：可以调整控制点，通过不同路径算法生成直线、曲线或正交路径，并支持控制点的插入和删除。连接过程中，还可以用空格采样途经点。

### 多人协作：同步图数据，也处理在线状态

在 Collaborative 示例中创建 Flow，通过 Share 复制链接，再从另一个浏览器或能访问该服务的设备打开，就能进入同一房间。节点的增删与拖动、连接、文本输入和复选框状态参与同步；远端光标与尚未完成的连接草稿也可以显示在画布上。

实现使用 **Yjs + y-websocket**，将状态分为三个层次：

| 状态 | 所在位置 | 例子 |
| --- | --- | --- |
| 共享图数据 | Y.Doc 中的 Maps | 节点、连线及节点内表单数据 |
| 临时在线状态 | Yjs Awareness | 用户身份、光标、连接草稿 |
| 本地视图状态 | 本地投影缓存 | 节点选择状态、测量尺寸 |

这样的组织方式，让图数据能够共享，也让每个用户保留自己的选择状态。光标等临时信息由 Awareness 管理，退出或断线后清理在线状态。

项目自带协作后端，连接当前站点下的协作路径。房间初始节点由服务端创建，客户端收到首次同步回复后才显示画布。

还包含 Playwright 协作回归用例，覆盖独立浏览器会话、表单与图同步、房间隔离、首次初始化和断线重连等场景，方便后续维护时检查这些行为。

### 其他

除了布局和协作，几个体量较小的示例同样适合拿来研究。

**复制粘贴功能** 复制选中的节点时，还要收集两端都位于选区内的连线；粘贴时更新节点和连线 ID、重映射端点，并整体平移节点位置，才能保留复制后子图的内部关系。

**分组** 创建组时，先计算所选节点的外接边界，再把子节点位置转换为组内相对坐标；解组时，则转换回画布绝对坐标。拖入父容器、随父节点移动和脱离容器，都建立在这些转换之上。

**自由绘制** 示例采集指针坐标和压力，提交时转换到画布坐标系，再把笔迹保存为节点局部点集，由 `perfect-freehand` 生成轮廓。落笔之后，笔迹仍然可以选择、移动和缩放。

辅助线与吸附、快照式撤销重做、展开折叠等示例

### 项目组织结构

~~~text
src/app/                         Next.js 页面与布局
src/components/                  搜索、分类导航与工作台入口
src/server/                      HTTP 与协作 WebSocket 服务
packages/react-flow-pro/
  src/examples/                  15 个示例实现
  src/collaboration/             协作连接与会话清理
  src/controls/                  布局参数面板
  src/styles/                    主题与示例样式
  docs/                          架构、原理与源码阅读指南
~~~

功能包通过 `@react-flow-pro-example/core` 暴露统一入口和各个示例组件，应用与功能包共享官方 `@xyflow/react`。每个示例拥有自己的 Provider、图状态和可变缓存；示例按需加载，样式通过作用域隔离。

在已经配置好该 workspace 依赖的 Next.js 应用中，可以这样从 Client Component 加载自动布局示例：

~~~tsx
'use client'

import dynamic from 'next/dynamic'
import '@react-flow-pro-example/core/style.css'

const AutoLayoutExample = dynamic(
  () => import('@react-flow-pro-example/core').then((module) => module.AutoLayoutExample),
  { ssr: false },
)

export default function Page() {
  return (
    <div style={{ width: '100%', height: '100dvh' }}>
      <AutoLayoutExample />
    </div>
  )
}
~~~

调用方提供容器尺寸，组件在浏览器中加载。功能包也提供单独构建和打包命令，接入其他宿主时，可以继续参考包内说明。

### 本地运行

项目使用 **Node 24.13.0** 和 **pnpm 10.20.0**：

~~~sh
git clone https://github.com/xh20220630/react-flow-pro-example-.git
cd react-flow-pro-example-
nvm use
corepack enable
pnpm install
pnpm dev
~~~

启动后打开 [http://localhost:3000](http://localhost:3000)

欢迎到 [GitHub 仓库](https://github.com/xh20220630/react-flow-pro-example-)查看源码、体验示例。

---

本文同步发布于 [掘金](https://juejin.cn/post/7699740355599712306)。
