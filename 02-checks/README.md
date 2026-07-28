# 02 · checks:响应校验

## 概念

`check()` 用来验证响应内容"对不对"——**但它不会让压测失败退出**,只会把结果统计进 `checks_succeeded` / `checks_failed` 指标里。这一点很重要,容易和下一章的 `thresholds`(真正决定测试通过/失败)搞混:

| | 作用 | 是否影响退出码 |
|---|---|---|
| `check()` | 校验单次响应是否符合预期,记录通过率 | 否 |
| `thresholds`(下一章) | 定义整体指标的通过/失败标准 | 是 |

`check()` 的用法:

```js
check(res, {
  '描述文字': (r) => 布尔表达式,
  // 可以写多条,每条独立统计
});
```

## 目标接口

本章换成 QuickPizza 的登录接口(POST,带 JSON body),这是官方教程里演示鉴权流程的标准写法:

```
POST https://quickpizza.grafana.com/api/users/token/login
Content-Type: application/json

{"username": "default", "password": "12345678"}
```

正常情况下返回 `200`,body 形如 `{"token":"abcdef0123456789"}`(这是官方文档给的演示账号,不是真实凭据)。

## 练习

打开 [`exercise.js`](./exercise.js),补全 `check()`,至少校验:

1. `r.status === 200`
2. 响应体里有 `token` 字段:`JSON.parse(r.body).token !== undefined`
3. 响应时间小于 1000ms:`r.timings.duration < 1000`

## 运行

```powershell
k6 run exercise.js
```

## 预期输出(关键部分,本地实测)

```
    ✓ status is 200
    ✓ response has token
    ✓ response time < 1000ms

    checks_total.......: 42      4.016527/s
    checks_succeeded...: 100.00% 42 out of 42
    checks_failed......: 0.00%   0 out of 42

    HTTP
    http_req_duration..............: avg=226.61ms ... p(95)=232.83ms
    http_req_failed................: 0.00%  0 out of 16
    http_reqs......................: 16     1.525914/s
```

### 怎么读

- 每条 `check()` 描述前面的 `✓`/`✗` 是**这一条**的整体通过情况(只要有一次失败就显示 ✗,并在旁边标出失败次数)。
- `checks_total = 42`,因为 2 VUs × ~7 次迭代 × 3 条 check = 42(次数会因网络波动略有不同)。
- 故意把某一条 check 改错(比如判断 `r.status === 404`),重新运行,观察:
  - 该行会变成 `✗ status is 200` 并显示 `↳  0% — ✓ 0 / ✗ 16`
  - 但整个 k6 进程**依然正常退出**(退出码 0)——这就是 check 和 threshold 的关键区别,留到下一章验证。

## 自查清单

- [ ] 三条 check 全部 ✓
- [ ] 故意写错一条 check,确认它变红但整体测试仍"跑完"而非"失败退出"
- [ ] 能说清楚 `check()` 和 `thresholds` 的区别

对照答案见 [`solution.js`](./solution.js)。

下一步:[`03-stages`](../03-stages/) —— 固定 VU 数不够真实,学习模拟"爬坡"的流量曲线。
