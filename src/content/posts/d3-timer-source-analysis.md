---
title: 深入理解 D3 Timer：从源码看 JavaScript 动画调度器的设计与实现
published: 2026-10-19
description: 通过任务链表、统一时钟、requestAnimationFrame、setTimeout 和时钟补偿，逐步理解 d3-timer 的动画调度设计。
tags:
  - JavaScript
  - D3.js
  - 动画
  - 源码解析
draft: false
toc: true
lang: zh
abbrlink: d3-timer-source-analysis
---

在前端开发中，我们通常用 `requestAnimationFrame` 实现动画循环。但当页面同时运行多个动画，并且这些动画需要在不同时间启动、停止或重启时，应该怎样统一调度？

[D3 Timer](https://d3js.org/d3-timer) 提供了一种值得学习的实现：**通过单向链表保存任务，通过统一时钟计算时间，并使用 `setTimeout` 和 `requestAnimationFrame` 决定下一次唤醒。**

本文基于 d3-timer 核心源码，从整体架构开始，沿着一次真实的任务调度流程逐步拆解。

## 一、整体架构：任务不是定时器

先区分两个概念：

- **任务（Task）**：保存回调函数、计划开始时间与链表指针。
- **唤醒（Wake-up）**：通知调度器检查任务是否到期。

D3 不会为每个任务各自创建一个长期独立的 `setTimeout`。多个任务由同一份链表管理，调度器统一决定何时唤醒。

~~~text
timer(callback, delay)
        │
        ▼
   Timer.restart()
        │
        ▼
    加入任务链表
        │
        ▼
      sleep()
        │
   ┌────┴────┐
   ▼         ▼
setTimeout   requestAnimationFrame
   └────┬────┘
        ▼
      wake()
        │
        ▼
   timerFlush()  ← 执行已到期任务
        │
        ▼
      nap()      ← 清理任务并确定下一次唤醒
        │
        └────────→ sleep()
~~~

## 二、Timer：用单向链表保存任务

每个任务由 `Timer` 实例表示：

~~~javascript
export function Timer() {
  this._call =
  this._time =
  this._next = null;
}
~~~

三个属性分别表示：

| 属性 | 用途 |
| --- | --- |
| `_call` | 回调函数 |
| `_time` | 计划开始执行的绝对调度时间 |
| `_next` | 链表中的下一个节点 |

全局的 `taskHead` 和 `taskTail` 分别指向链表首尾。

~~~text
taskHead                taskTail
   ↓                       ↓
   A ─────→ B ─────→ C ──→ null
~~~

**链表顺序不是执行时间顺序。** 即使 B 排在 A 后面，它也可以有更早的计划开始时间。D3 会遍历所有有效任务来检查到期条件。

### restart() 如何避免重复插入？

~~~javascript
if (!this._next && taskTail !== this) {
  if (taskTail) taskTail._next = this;
  else taskHead = this;
  taskTail = this;
}
~~~

`!this._next` 意味着当前节点没有后继，但这既可能是新节点，也可能是已经位于链表末尾的节点。因此还要检查 `taskTail !== this`，避免把尾节点再次接入链表。

这个判断依赖调度器自己维护的链表不变量。调用 `restart()` 更新已有任务时，不必重新插入节点。

## 三、为什么将延迟转换成绝对时间？

`restart()` 计算任务开始时间：

~~~javascript
time = (time == null ? now() : +time)
     + (delay == null ? 0 : +delay);
~~~

公式就是：

`计划开始时间 = 时间基准 + 延迟`

例如现在的调度时间为 5000ms，新任务延迟 2000ms：

~~~javascript
// 当前 now() = 5000
timer(callback, 2000);

// 对应任务的 _time ≈ 7000
~~~

这意味着任务在调度时钟达到 7000ms 时**开始有资格执行**，不是再等待 7000ms。

将任务统一表示为绝对时间，方便比较不同时间创建的任务，而不必持续更新每个节点的剩余等待时长。

## 四、now()：为什么用 performance.now() 和 clockNow？

源码优先采用高精度单调时钟：

~~~javascript
var clock =
  typeof performance === "object" && performance.now
    ? performance
    : Date;
~~~

`Date.now()` 返回 Unix 时间戳，可能受系统日期调整影响；`performance.now()` 适用于测量经过时间，不会因为普通的系统日期调整而突然跳变。

D3 进一步缓存时间：

~~~javascript
export function now() {
  return clockNow ||
    (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}
~~~

同一轮调度中，A、B、C 三个任务如果分别读取底层时钟，可能获得 1000.123、1000.456、1000.789ms。共享 `clockNow` 则让它们使用一致的时间基准。

缓存必须被清除，否则之后计算出的经过时间不会推进。首次缓存时间时，D3 安排一次动画帧回调执行 `clearNow()`；`wake()` 完成后也会清除它。

## 五、restart() 为什么调用 sleep()？

`restart()` 最后更新任务并通知调度器：

~~~javascript
this._call = callback;
this._time = time;
sleep();
~~~

假设 A 计划在第 2000ms 开始，到了第 200ms 又新增一个延迟 500ms 的任务 C。

- A 仍然计划在第 2000ms 开始。
- C 计划在第 700ms 开始。
- 调度器必须更早唤醒，才不会错过 C。

**重新调度唤醒，不等于修改任务本身的执行时间。**

值得注意的是，这里调用的是没有 `time` 参数的 `sleep()`。它通常先安排一帧检查，之后 `nap()` 再遍历链表算出最近的任务时间。

## 六、sleep()：如何选择 rAF 或 setTimeout？

核心源码：

~~~javascript
function sleep(time) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);

  var delay = time - clockNow;

  if (delay > 24) {
    if (time < Infinity)
      timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval)
      clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}
~~~

### 1. 防止重复安排帧

`if (frame) return` 的作用是：如果已经有待执行的动画帧唤醒，就不需要为后来加入的每个任务重复安排一次 `requestAnimationFrame(wake)`。下一次 `wake()` 会统一检查链表。

### 2. 取消旧唤醒计划

`clearTimeout(timeout)` 只取消之前安排的**唤醒定时器**，不会删除任务链表里的 A、B、C。

### 3. 为什么是 24ms？

如果距离下次任务开始仍有较长时间，使用 `setTimeout` 等待，可以避免每帧反复检查；如果很接近计划时间，就使用 `requestAnimationFrame`，让动画更新尽量与浏览器的绘制节奏配合。

24ms 是经验阈值，不是浏览器一帧的固定长度，也不保证回调一定准时。60Hz 屏幕每帧理论间隔约为 16.67ms，但浏览器可能掉帧或在后台节流。

### 4. 为什么重新读取 clock.now()？

`delay = time - clockNow` 适合决定采用哪种调度机制；但 `clockNow` 可能是较早缓存的时间。

例如计划时间为 2000ms，缓存时间是 1000ms，真正设置定时器时底层时钟已经到 1050ms。此时等待应该约为 950ms，而不是 1000ms。重新读取 `clock.now()` 可以减少额外延迟。

## 七、wake() 和 timerFlush()：谁真正执行回调？

~~~javascript
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
~~~

`wake()` 先更新时间，接着调用 `timerFlush()`，最后无论任务回调是否抛出异常，都会执行 `nap()` 来整理任务并安排后续唤醒。

~~~javascript
export function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0)
      t._call.call(undefined, e);
    t = t._next;
  }
  --frame;
}
~~~

判断条件 `clockNow - t._time >= 0` 表示任务已经到期。传给回调的 `e` 是从计划开始时间到本轮调度时刻的**累计时间（elapsed）**，不是上一帧到这一帧的 `deltaTime`。

~~~javascript
const t = timer((elapsed) => {
  console.log(elapsed);
  if (elapsed >= 1000) t.stop();
});
~~~

**D3 的 `timer()` 不会像 `setTimeout()` 一样执行一次就自动停止。** 只要任务仍然有效，它到期后就会在后续调度周期继续执行，直到主动 `stop()`。

## 八、nap()：遍历、删除、寻找最早任务

~~~javascript
function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}
~~~

三个指针各有职责：

- `t0`：上一个保留下来的有效节点。
- `t1`：当前检查的节点。
- `t2`：删除当前节点时，暂存它的后继节点。

例如：

~~~text
A → B(已停止) → C → D → null
~~~

遍历到 B 时，`t0 = A`、`t1 = B`、`t2 = C`。先让 `B._next = null`，再把 `A._next` 改为 C，于是：

~~~text
A → C → D → null

B → null
~~~

如果删除的是头节点，由于不存在前驱，就直接更新 `taskHead = t2`。

遍历结束后，`taskTail = t0` 恢复尾指针，而变量 `time` 保留所有有效任务中最早的 `_time`。最后调用 `sleep(time)`，形成下一轮调度。

## 九、poke() 和 clockSkew：为什么需要补偿时间？

源码还有一个每隔约 1000ms 执行的检查：

~~~javascript
function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}
~~~

浏览器后台节流、主线程长期阻塞或设备休眠，都会让两个回调之间出现很大的时间间隔。

比如一个方块按 100px/s 移动，页面在运行到第 2 秒时暂停，过了约 60 秒才继续。如果直接把这 60 秒计入动画时间，方块可能突然跳到很远的位置。

D3 用 `clockSkew` 修正调度时间：

~~~javascript
clockNow = clock.now() + clockSkew;
~~~

假设 `clockLast = 2000`、恢复时 `now = 62000`，检测到 `delay = 60000`，那么 `clockSkew` 可能减少 60000，修正后的调度时间仍接近 2000ms。

这是一种**粗略的异常间隔补偿**，并不能准确区分休眠、后台节流和主线程卡顿，也不能保证所有情况下都完全消除动画跳跃。

## 十、一次完整调度：三个动画如何共用一套机制？

~~~javascript
const A = timer(callbackA, 2000);
const B = timer(callbackB, 4000);
const C = timer(callbackC, 6000);
~~~

为了说明原理，假设三个任务都在调度时间 0ms 附近创建，忽略浏览器调度误差：

1. 三个 `Timer` 节点依次加入链表。
2. 调度器安排唤醒；第一次 `nap()` 找到最早计划时间 2000ms。
3. 等待期间主要采用 `setTimeout`，不必每一帧检查。
4. A 到期后，`timerFlush()` 开始调用 A 的回调。
5. 因为普通 `timer()` 不会自动停止，A 持续运行，调度器转为逐帧唤醒。
6. 到 4000ms，B 也开始运行；到 6000ms，C 也开始运行。
7. 调用 `A.stop()`、`B.stop()`、`C.stop()` 后，`nap()` 会将停止的任务清理出链表。

A、B、C 虽然有各自的生命周期，但共享统一的时间基准和唤醒管理。

## 十一、与普通游戏主循环有什么不同？

游戏主循环常见写法：

~~~javascript
function loop(timestamp) {
  update();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
~~~

而 D3 Timer 更像是一个多任务时间调度层：

| 对比 | D3 Timer | 游戏主循环 |
| --- | --- | --- |
| 主要目标 | 多个独立动画任务的启动和持续调度 | 统一推进游戏世界 |
| 时间参数 | 主要使用累计 elapsed | 通常计算帧间 deltaTime |
| 任务组织 | Timer 单向链表 | 统一的 update / render |
| 调度策略 | rAF 与 setTimeout 切换 | 通常以 rAF 为主 |
| 固定时间步长 | 不直接提供 | 可以自行实现累加器 |

因此 D3 Timer 不负责绘制，也没有直接提供固定时间步长或物理模拟。

## 十二、值得借鉴的设计思想

这段源码的价值不只是使用三个浏览器 API，而是把动画系统拆分成可独立理解的职责：

1. **任务与唤醒解耦**：任务保存时间和回调，不关心使用哪一种浏览器定时 API。
2. **统一绝对时间**：便于比较任务的计划开始时间。
3. **单轮共享时钟**：减少多个动画回调读取时间造成的微小差异。
4. **按时间距离切换策略**：长等待时休眠，临近动画时对齐绘制节奏。
5. **延迟删除链表节点**：`stop()` 先标记，`nap()` 统一清理。
6. **处理大幅时间间隔**：通过 `clockSkew` 减少暂停恢复后的视觉跳变。

当然，它也有权衡：查找最早的任务需要 O(n) 遍历，无法提供严格的实时精度。统一调度的优势在于一致性和生命周期管理，并不意味着在所有场景下都比多个独立定时器快。

## 总结

用一句话概括 D3 Timer 的架构：

> **用链表管理任务，用统一时钟判断到期，用 sleep() 决定何时唤醒，用 wake() 执行任务，再由 nap() 清理和继续调度。**

~~~text
新增 / 重启任务
      ↓
   任务链表
      ↓
    sleep()
      ↓
    wake()
      ↓
  timerFlush()
      ↓
     nap()
      └──────→ sleep()
~~~

理解了这个闭环，就理解了这段源码最核心的调度思想。

## 参考资料

- [D3 Timer 官方文档](https://d3js.org/d3-timer)
- [d3-timer GitHub 源码](https://github.com/d3/d3-timer)
- [MDN：requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN：Performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

*本文针对文中展示的 d3-timer 实现进行分析；不同版本的源码细节可能有所变化。*
