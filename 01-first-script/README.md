# 01 · 第一个脚本:VU 与 Iteration

## 概念

k6 脚本的骨架固定不变:

```js
import http from 'k6/http';
import { sleep } from 'k6';

export default function () {
  http.get('https://quickpizza.grafana.com/');
  sleep(1);
}
```

- **`import http from 'k6/http'`** —— k6 的内置模块,提供 `get`/`post`/`put`/`del` 等方法。k6 脚本跑在 Go 实现的 Goja JS 引擎里,不是 Node.js,所以不能 `require('fs')` 之类的 Node 内置模块,所有 I/O 都要走 `k6/*` 系列模块。
- **`export default function ()`** —— 这是 **VU(Virtual User,虚拟用户)代码**。k6 会让每个虚拟用户反复执行这个函数,每执行一次叫一次 **iteration(迭代)**。
- **`sleep(1)`** —— 模拟真实用户的"思考时间"。没有它,虚拟用户会用尽可能快的速度连续发请求,不符合真实流量模式,也会人为拉高压测强度。

`export const options = { vus, duration }` 是压测强度的两个最基本参数:

- `vus`:并发的虚拟用户数量
- `duration`:压测持续多久

这两个数字**没有标准答案**,取决于你想模拟什么场景(比如"日常均值流量"还是"大促峰值")。

## 目标接口

本章使用 `https://quickpizza.grafana.com/`(Grafana 官方为 k6 教程搭建的公开演示站,`test.k6.io` 现已重定向到这里)。这是一个**公开的练习靶场**,允许轻量级压测流量,但请勿在本教程范围之外对它发起大规模压测——真实项目请始终对自己有权限的系统做压测。

## 练习

打开 [`exercise.js`](./exercise.js),把 `export const options = {}` 改成:

```js
export const options = {
  vus: 3,
  duration: '10s',
};
```

(数字可以自己改,但建议先用 3 个 VU、10 秒,方便和下面的预期输出对照)

## 运行

```powershell
k6 run exercise.js
```

## 预期输出(关键部分)

以 `vus=3, duration=10s` 为例,这是本地实测的真实结果(具体数字会因网络状况浮动,但结构应该一致):

```
    HTTP
    http_req_duration..............: avg=233.92ms min=211.33ms med=227.11ms max=432.31ms p(90)=232.06ms p(95)=233.87ms
    http_req_failed................: 0.00%  0 out of 23
    http_reqs......................: 23     2.198074/s

    EXECUTION
    iterations.....................: 23     2.198074/s
    vus............................: 3      min=3       max=3
    vus_max........................: 3      min=3       max=3

running (10.5s), 0/3 VUs, 23 complete and 0 interrupted iterations
```

### 怎么读这份报告

- **`http_req_duration`** —— 单次请求的响应时间分布。注意给的是**百分位数(percentile)**而不只是平均值:`p(95)=233.87ms` 意思是 95% 的请求都在这个时间内完成。**性能测试几乎不看平均值,只看 p90/p95/p99**——平均值会被少数正常请求"拉低",掩盖长尾延迟问题。
- **`http_req_failed`** —— 请求失败率,后面 `04-thresholds` 章节会用它做"通过/失败"判断标准。
- **`http_reqs` vs `iterations`** —— 本例中两者相等(23=23),因为每次迭代只发 1 个请求。如果一次迭代里调用了多次 `http.get`/`http.post`,`http_reqs` 会比 `iterations` 大很多——这在真实业务场景很常见(一个页面加载可能触发好几个接口调用)。
- **`vus_max` vs `vus`** —— `vus_max` 是压测过程中出现过的最大并发数,`vus` 是结束时刻的并发数。本例中 3 个 VU 全程保持不变,所以两者相同;后面 `03-stages` 引入爬坡后,这两个值就会不同。

## 自查清单

- [ ] `http_reqs` 数量约等于 `vus × duration / (sleep + 单次请求耗时)`,能大致对上就说明理解了 VU/iteration 的关系
- [ ] `http_req_failed` 是 `0.00%`
- [ ] 把 `vus` 改成 10、`duration` 改成 `'5s'` 再跑一次,观察 `http_reqs` 是变多还是变少,想清楚**为什么**

对照答案见 [`solution.js`](./solution.js)。

下一步:[`02-checks`](../02-checks/) —— 光发请求还不够,得校验响应对不对。
