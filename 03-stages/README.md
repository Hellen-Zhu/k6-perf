# 03 · stages:爬坡式压测

## 概念

前两章用固定的 `vus` + `duration`,并发数从一开始就拉满,不符合真实流量(真实用户是逐渐涌入的)。`stages` 用一组 `{ duration, target }` 描述一条"虚拟用户数量随时间变化"的曲线:

```js
export const options = {
  stages: [
    { duration: '5s', target: 5 },  // 用 5 秒把并发从当前值(默认 0)爬升到 5
    { duration: '10s', target: 5 }, // 之后 10 秒保持在 5
    { duration: '5s', target: 0 },  // 最后 5 秒降回 0(优雅收尾)
  ],
};
```

k6 底层其实是把 `stages` 翻译成一个叫 `ramping-vus` 的执行器(executor)——这是 `06-scenarios` 章节要展开讲的概念,这里先用简化写法感受效果。

**为什么要爬坡而不是一步到位?** 两个原因:
1. 更接近真实流量模式(早高峰是逐渐涨起来的,不是瞬间从 0 到峰值)
2. 能观察系统在"负载持续增加"过程中的表现拐点,而不是只看一个稳定值

## 练习

打开 [`exercise.js`](./exercise.js),把 `options` 换成上面的三段式 `stages`。

## 运行

```powershell
k6 run exercise.js
```

## 预期输出(关键部分,本地实测)

```
    checks_total.......: 44     1.133074/s
    checks_succeeded...: 97.72% 43 out of 44
    checks_failed......: 2.27%  1 out of 44

    HTTP
    http_req_duration..............: avg=308.81ms ... p(95)=612.16ms
    http_req_failed................: 2.27%  1 out of 44
    http_reqs......................: 44

    EXECUTION
    vus............................: 1      min=1       max=5
    vus_max........................: 5      min=5       max=5

running (38.8s), 0/5 VUs, 44 complete and 0 interrupted iterations
```

### 怎么读

- **`vus_max=5`**——压测过程中出现过的峰值并发,和 `01` 章不同,这里 `vus`(结束时的并发)和 `vus_max` 不一致,因为收尾阶段并发已经降到 0。
- **总耗时 38.8s > 配置的 20s(5+10+5)**——这是因为 k6 有 `gracefulRampDown`(默认最长等 30s),在降并发时不会粗暴掐断正在进行的迭代,而是等它自然完成。**这是一个重要的设计取舍**:优雅收尾能拿到更真实的数据,但也意味着"配置的总时长"不等于"实际运行时长"。
- **本例出现了 1 次 `✗ status is 200` 和个别偏高的响应时间**——`quickpizza.grafana.com` 是**互联网上所有学习者共用的公共演示站**,你运行时也可能偶尔看到 1~2 次失败或响应时间尖刺,这是命中共享公共资源的正常噪声,不代表脚本写错了。这也是为什么真实压测(尤其是需要精确、可复现数据的场景)不该打公共靶场,而应该对着自己能控制的环境——这在 `04-thresholds` 之后会切换到本地 Docker 部署的 QuickPizza。

## 自查清单

- [ ] `vus_max` 达到了你设置的 `target` 峰值
- [ ] 观察到"总运行时长"略长于三段 `duration` 之和,并理解 `gracefulRampDown` 的作用
- [ ] 能解释:如果把中间稳定阶段从 10s 改成 60s,`http_reqs` 大致会怎么变化

对照答案见 [`solution.js`](./solution.js)。

下一步:[`04-thresholds`](../04-thresholds/) —— 给压测定"及格线",让 CI 能自动判断通过/失败。
