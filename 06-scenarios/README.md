# 06 · scenarios:组合多种压测模式

## 概念

前面几章的 `vus`/`duration`/`stages` 其实都是 `scenarios` 的简化写法——k6 会把它们自动包装成一个叫 `default` 的场景。真正的 `scenarios` 能让你在**同一个脚本**里定义多个独立的场景,每个场景可以:

- 用不同的**执行器(executor)**
- 指向不同的入口函数(`exec` 字段)
- 有自己的 `startTime`(错开执行,或并行执行)

```js
export const options = {
  scenarios: {
    smoke: { executor: 'shared-iterations', vus: 1, iterations: 1, exec: 'smokeTest' },
    load: { executor: 'constant-arrival-rate', rate: 3, timeUnit: '1s', duration: '15s',
             preAllocatedVUs: 5, maxVUs: 10, exec: 'loadTest', startTime: '3s' },
  },
};

export function smokeTest() { /* ... */ }
export function loadTest(data) { /* ... */ }
```

## 两种执行器思路:closed model vs open model

这是本章最重要的概念,决定了压测结果的"真实性":

| | closed model(封闭模型) | open model(开放模型) |
|---|---|---|
| 代表执行器 | `shared-iterations`、`per-vu-iterations`、`ramping-vus`(即 `03-stages` 用的) | `constant-arrival-rate`、`ramping-arrival-rate` |
| 行为 | 固定 VU 数,一个 VU 必须等上一次迭代完成才能开始下一次 | 固定"每秒发起多少次迭代"这个**目标速率**,不管服务器响应快慢 |
| 问题 | 如果服务器变慢,单个 VU 的吞吐量会自动跟着下降,**实际请求速率会悄悄降低而不报错**——容易掩盖性能问题 | 更接近真实用户行为:新用户不会因为服务器慢就停止涌入。如果服务器跟不上速率,k6 会诚实地报告"跟不上"(见下面 `dropped_iterations`) |

`constant-arrival-rate` 需要两个额外参数:
- `preAllocatedVUs`——预先分配的 VU 池大小,避免压测过程中临时创建 VU 影响测量准确性
- `maxVUs`——如果 `preAllocatedVUs` 不够用,最多再借到这个数;如果连这个数都不够撑住目标速率,多出来的迭代就会被丢弃

## 练习

打开 [`exercise.js`](./exercise.js),把 `scenarios: {}` 补全成上面例子里的 `smoke` + `load` 两个场景。

## 运行

```powershell
k6 run exercise.js
```

## 预期输出(关键部分,本地实测)

运行过程中能看到两个场景各自的实时进度条:

```
smoke ✓ [ 100% ] 1 VUs      00m00.7s/10m0s  1/1 shared iters
load  ↓ [ 100% ] 04/07 VUs  15s             3.00 iters/s
```

结束后:

```
    checks_total.......: 44     1.954137/s
    checks_succeeded...: 93.18% 41 out of 44
    checks_failed......: 6.81%  3 out of 44

    ✓ smoke: status is 200
    ✗ load: status is 200
      ↳  93% — ✓ 40 / ✗ 3

    HTTP
    http_req_failed................: 6.66% 3 out of 45
    http_reqs......................: 45    1.998549/s

    EXECUTION
    dropped_iterations.............: 2     0.088824/s
    iterations.....................: 44    1.954137/s
    vus............................: 1     min=0       max=7
    vus_max........................: 8     min=6       max=8

running (00m22.5s), 00/08 VUs, 44 complete and 0 interrupted iterations
```

### 怎么读

- **进度条里的 `↓` 符号**——出现在 `load` 场景旁边,意思是"当前分配的 VU 数量跟不上目标速率了",这正是 open model 的诚实之处:它不会默默把速率降下来凑合,而是明确告诉你"差多少"。
- **`dropped_iterations: 2`**——因为公共演示站响应偶尔变慢,个别 VU 还在忙着等上一个请求返回,导致来不及在 `preAllocatedVUs=5` 的范围内凑够 3 iters/s 的速率,k6 借用到 `maxVUs` 上限后仍不够,只能丢弃 2 次迭代。**这是判断"服务端撑不撑得住某个目标 QPS"的直接信号**——如果你的真实压测目标是"验证能不能扛住 100 QPS",看到 `dropped_iterations > 0` 就说明扛不住,该去查瓶颈了,而不是简单地把这次测试当作"跑完了就算过"。
- **每条 check 分别按场景命名**(`smoke: status is 200` / `load: status is 200`)——这是有意为之的命名习惯,场景一多,报告里不加前缀会分不清这条 check 是哪个场景的。
- **两个 check 各自的失败**同样是打公共演示站带来的正常噪声(前面几章已经反复出现),验证脚本逻辑本身没问题就够了。

## 自查清单

- [ ] 两个场景都能在进度条里看到独立的一行
- [ ] 理解 `↓` 符号和 `dropped_iterations` 的含义,以及它们为什么是"诚实报告瓶颈"而不是 bug
- [ ] 能说清楚 closed model 和 open model 的核心区别,以及各自适合什么场景(比如:验证一个后台批处理任务的吞吐上限该用哪种?)

对照答案见 [`solution.js`](./solution.js)。

下一步:[`07-real-api`](../07-real-api/) —— 把这一整套方法论套到你自己的接口上。
