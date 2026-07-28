# 04 · thresholds:通过 / 失败标准

## 概念

`thresholds` 定义在**任意内置或自定义指标**上,一旦被突破,k6 会:

1. 在输出里打印 `level=error msg="thresholds on metrics '...' have been crossed"`
2. 整个进程以**非 0 退出码**结束

这是 `thresholds` 和上一章 `check()` 最本质的区别:**thresholds 才是能接入 CI/CD 的"及格线"**——比如在 GitHub Actions / Jenkins 里跑一次压测,靠退出码判断这次构建要不要卡住发布。

写法(在 `options` 里加一个 `thresholds` 字段,key 是指标名,value 是一组表达式字符串):

```js
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95 分位响应时间 < 800ms
    http_req_failed: ['rate<0.01'],   // 失败率 < 1%
    checks: ['rate>0.99'],            // check 通过率 > 99%
  },
};
```

## 练习

打开 [`exercise.js`](./exercise.js),按上面的例子加上 `thresholds`。

## 运行

```powershell
k6 run exercise.js
$LASTEXITCODE   # PowerShell 里查看上一条命令的退出码
```

## 预期输出 —— 两种真实结果都可能遇到

`quickpizza.grafana.com` 是公共演示站,延迟会随全球访问量波动,`p(95)<800` 这条阈值在实测中**有时通过、有时不通过**。两种结果都截取如下,重点是理解**输出形态的差异**,不用纠结具体数字:

**✅ 通过时(退出码 0)**——不会打印 `level=error`,最后一行正常显示 `default ✓`。

**❌ 不通过时(本地实测,退出码 99)**:

```
    http_req_failed................: 5.00%  2 out of 40
    http_reqs......................: 40     0.888885/s
    ...
running (45.0s), 0/5 VUs, 40 complete and 1 interrupted iterations
default ✓ [ 100% ] 5 VUs  15s
time="2026-07-28T14:48:22+08:00" level=error msg="thresholds on metrics 'checks, http_req_duration, http_req_failed' have been crossed"
```

```powershell
PS> $LASTEXITCODE
99
```

### 关键知识点

- **退出码 99 是 k6 的专属信号**——特指"因为 thresholds 被突破而失败"(区别于脚本本身报错的其他退出码)。CI 流水线里通常就是靠"退出码非 0"来判定这一步失败。
- 注意 `running (45.0s)` 比配置的 `15s` 长很多,还出现了 `1 interrupted iterations`——这是因为部分请求变慢/超时,k6 在等待收尾时把还没跑完的迭代标记为"被中断"而非"正常完成"。这也是延迟升高的一个信号。
- 如果你这边跑出来是"通过"的,可以故意把阈值改苛刻一点,比如 `p(95)<100`,一定能复现"失败"的输出形态,自己对照上面这段。

## 从这里开始:切换到本地 QuickPizza

接下来几章需要更大的并发和更精确、可复现的数据,继续打公共演示站既不礼貌(它是所有学习者共用的),也会因为网络抖动让你的测量结果没法对比。**从下一章起,建议在本地用 Docker 跑一份 QuickPizza:**

```powershell
docker run --rm -it -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest
```

跑起来后,浏览器打开 `http://localhost:3333` 应该能看到页面。后面的脚本都通过环境变量 `BASE_URL` 指定目标地址,默认仍指向公共演示站,你可以这样切换到本地:

```powershell
k6 run -e BASE_URL=http://localhost:3333 exercise.js
```

`★ 这是一条通用的压测伦理原则`——**永远只对你有权限、能控制的系统发起有一定强度的压测**。公共演示环境适合"点到为止"地验证脚本语法,真正加压测量必须在自己搭建或获得授权的环境里进行。

## 自查清单

- [ ] 能说出 `check()` 和 `thresholds` 的核心区别(是否影响退出码)
- [ ] 亲眼见过一次 thresholds 失败的输出,记住退出码是 `99`
- [ ] 本地用 Docker 跑起来了 QuickPizza,`http://localhost:3333` 能访问

对照答案见 [`solution.js`](./solution.js)。

下一步:[`05-metrics-and-data`](../05-metrics-and-data/) —— 自定义业务指标 + 用外部数据参数化请求。
