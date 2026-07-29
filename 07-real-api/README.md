# 07 · 实战:trades/create 接口压测

针对这个真实接口:

```
POST http://uklvadptaa0005a.pi.dev.net:9089/api/v1/trades/create
Headers: accept: application/json, X-Dry-Run: false, X-User-ID: maker@sc.com
Body(multipart/form-data):
  trade    = {"basic":{"portfolioId":"...","counterpartyFmId":"...","counterpartyName":"...","notionalCurrency":""}}   (字符串字段)
  datFile  = @0_instrument.dat  (文件字段, application/octet-stream)
```

对应脚本:[`trades-create.js`](./trades-create.js)。(通用骨架仍保留在 [`template.js`](./template.js),以后压其他接口可以照着抄。)

## 这一章新出现的知识点:multipart/form-data 文件上传

前面章节的 POST 都是纯 JSON body,这次的请求是 `curl -F` 那种表单——一个字符串字段(`trade`)+ 一个文件字段(`datFile`)。k6 的处理方式:

```js
const datFile = open('./data/0_instrument.dat', 'b'); // 'b' = 二进制模式

const data = {
  trade: JSON.stringify(tradePayload),                     // 普通字符串字段
  datFile: http.file(datFile, '0_instrument.dat', 'application/octet-stream'), // 文件字段
};

http.post(url, data, { headers: { /* 不要手动加 Content-Type */ } });
```

三个要记住的点:

1. **`open()` 只能在 init 阶段调用**——也就是脚本顶层,不能写进 `export default` 或场景函数里。k6 会在压测正式开始前,把文件内容一次性读进内存,之后每个 VU/迭代复用同一份数据,不会重复读盘。
2. **body 是 plain object,只要有一个值是 `http.file(...)`,k6 就会自动把整个请求编码成 `multipart/form-data`**,并生成正确的 boundary。
3. **千万不要手动设置 `Content-Type` 头**——手动设置会覆盖掉 k6 自动生成的 boundary,导致服务端解析 multipart 失败(这是这类请求最常见的坑)。

## 当前脚本里的占位符(PLACEHOLDER),需要你替换

| 位置 | 现状 | 怎么替换 |
|---|---|---|
| [`data/trade-combos.sample.json`](./data/trade-combos.sample.json) | 2 组占位的 `portfolioId`/`counterpartyFmId`/`counterpartyName` | 直接用你的真实批量数据覆盖这个文件(格式照抄现有结构),脚本代码不用改 |
| [`data/0_instrument.dat`](./data/0_instrument.dat) | 一个纯文本占位文件,不是真实的二进制文件 | 用真实的 `.dat` 文件覆盖(文件名保持不变) |
| `notionalCurrency` | 目前留空 `""` | 确认接口是否要求具体值(如 `USD`),需要的话在数据文件里补上 |
| `thresholds` 里的数字(`p(95)<2000`、`rate<0.01`) | 随手写的保守占位值 | 先拿到几次真实运行的基线数据,再回头定成有依据的 SLA 数字 |
| `load` 场景的 `stages`(峰值 3→5 VUs) | 保守起始值 | 按你们真实预期流量调整,建议还是从小往大加,别一上来就打峰值 |
| `status is 2xx` 的判断 | 只按 2xx 粗略判断成功 | 拿到真实响应后,确认准确的成功状态码,以及要不要校验响应体里的字段(比如返回的 `tradeId`) |

## ⚠️ 这个接口的特殊之处:会创建真实数据,不是只读查询

和前面章节的 GET/查询类接口不同,`X-Dry-Run: false` 意味着**每次成功请求都会在 dev 环境里创建一条真实的交易记录**。几件事要留意:

- **组合数量要够用**:如果 `data/trade-combos.sample.json` 里的组合数 < 这次压测计划发出的总请求数,`loadTest()` 里的随机挑选会导致同一组合被重复使用。如果 `portfolioId + counterparty` 组合在系统里有唯一性约束,重复使用可能会触发冲突报错。**建议提供的组合数量 ≥ `vus × 预计每个 VU 的迭代次数`**,或者告诉我,我可以把随机挑选改成"用完就报错提醒"而不是循环复用。
- **失败请求会打印到控制台**:脚本里 `createTrade()` 失败时会 `console.error` 打出状态码和响应体,方便你第一次跑的时候快速定位是数据问题还是接口问题。
- **数据没法在这台 Mac 上验证**:这个接口在你们内网 `pi.dev.net` 域下,我这边访问不到,所以这次没法像前面章节那样跑出"本地实测的真实输出"给你对照。**你在 Windows 上第一次跑,务必先只跑 `smoke` 场景(1 次请求),确认 multipart 结构和鉴权没问题,再跑 `load` 场景**,方法见下面。

## 怎么跑

### 0. 准备

在 Windows 上(确认 `00-install` 里 `k6 version` 能跑通之后):

```powershell
git clone https://github.com/Hellen-Zhu/k6-perf.git
cd k6-perf/07-real-api
```

把真实数据放进去(替换掉占位文件,文件名不变):
- `data/trade-combos.sample.json` → 换成真实的 portfolioId/counterpartyFmId 组合
- `data/0_instrument.dat` → 换成真实的二进制文件

### 1. 先只跑冒烟测试(务必第一步做这个)

k6 CLI 本身没有"只跑某个 scenario"的参数,脚本里用环境变量 `SMOKE_ONLY` 在 `options.scenarios` 上做了开关(见 `trades-create.js` 顶部注释):

```powershell
k6 run -e SMOKE_ONLY=true trades-create.js
```

只会发 **1 次请求**,几秒内跑完。这一步的唯一目的是确认:接口能连通、multipart 构造对、鉴权头对、返回的状态码符合预期。**这一步不过,后面加并发毫无意义**,先把这一步的报告发我看也行。

### 2. 跑完整流程(smoke + load)

```powershell
k6 run trades-create.js
```

第一次跑,**强烈建议先把 `trades-create.js` 里 `load` 场景的 `stages` 峰值临时改成 1~2 个 VU、跑 10 秒**,肉眼确认没问题(有没有报错、有没有意外创建了不该有的数据)之后,再按需要调大。

也可以不改文件,直接用 CLI 参数临时覆盖 VU 数和时长(会整个替换掉 `scenarios` 配置,变成跑一个简单的 `default` 场景——但这个脚本没有 `default` 函数,所以**这种覆盖方式对这个脚本不适用**,要调并发只能改脚本里的 `stages` 数字,这是当前脚本设计带来的限制)。

### 3. 想换目标环境(比如从 dev 切到 uat)

```powershell
k6 run -e BASE_URL=http://your-uat-host:port trades-create.js
```

## 怎么看报告

k6 默认只在终端打印文本报告,跑完之后大概长这样(下面是本地拿假数据、打不通的地址跑出来的,结构和真实跑出来的一样,只是数字会不同):

```
    ✗ status is 2xx
      ↳  0% — ✓ 0 / ✗ 73

    CUSTOM
    trade_create_success...: 0        0/s
    trade_create_failure...: 73       1.24816/s

    HTTP
    http_req_duration......: avg=1.21s min=227.45ms med=783.65ms max=11.54s p(90)=2.14s p(95)=3.4s
    http_req_failed........: 100.00% 73 out of 73
    http_reqs..............: 73      1.24816/s

    EXECUTION
    iterations.............: 73      1.24816/s
    vus.....................: 1       min=1        max=5
    vus_max.................: 6       min=6        max=6

  █ THRESHOLDS

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.4s

    http_req_failed
    ✗ 'rate<0.01' rate=100.00%

running (00m58.5s), 0/6 VUs, 73 complete and 0 interrupted iterations
```

按看报告的顺序,从上往下应该关心这几件事:

1. **`✗`/`✓ status is 2xx` 这一行**——最先看这个。如果大量 `✗`,先别看别的指标,直接看下面第 2 点定位是什么错。
2. **失败时终端会打印具体错误**——脚本里 `console.error` 会把每次失败请求的状态码和响应体原样打出来,滚动往上翻日志能看到类似 `trade create failed: status=400 body={"error":"..."}` 这种行,这是判断"到底是数据错了还是接口错了"最直接的线索。
3. **`CUSTOM` 分组的 `trade_create_success`/`trade_create_failure`**——一眼看出总共成功/失败了多少次交易创建,不用自己数。
4. **`HTTP` 分组**——`http_req_failed`(网络层面失败率,包括超时/连接失败/非 2xx)和 `http_req_duration` 的 `p(95)`(95% 的请求响应多快)。这两个是判断接口"扛不扛得住"最核心的两个数。
5. **`EXECUTION` 分组的 `vus_max`**——确认压测过程中真的达到了你设置的并发峰值,不是因为哪里卡住了没爬到目标值。
6. **`THRESHOLDS` 分组(如果有失败会单独列出来)**——这是"通过/失败"的判定结果,只要这里有 `✗`,整个 k6 进程就会以非 0 退出码结束。PowerShell 里用 `$LASTEXITCODE` 查看:退出码 `99` 专指"因为 thresholds 被突破"。
7. **最后一行 `running (...), X/Y VUs, N complete and M interrupted iterations`**——`M interrupted` 如果不是 0,说明有迭代因为压测提前结束/收尾而被打断,不算真正跑完,解读其它指标时要考虑这部分噪声。

### 想要 JSON/HTML 格式的报告(方便存档或发给别人)

终端报告只在这次运行时可见,想留存或者发给同事看,有两种常用方式:

**方式一:导出精简版摘要(和终端最后那段汇总内容一样,存成 JSON 文件)**

```powershell
k6 run --summary-export=summary.json trades-create.js
```

**方式二:生成可视化的 HTML 报告**

k6 本身不自带 HTML 报告,业界通用做法是在脚本末尾加一个 `handleSummary()` 函数,借助开源的 [k6-reporter](https://github.com/benc-uk/k6-reporter) 生成 HTML。如果你需要这个,告诉我,我帮你把这几行加到 `trades-create.js` 里:

```js
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data), // 生成一份可以直接用浏览器打开的报告
  };
}
```

(这一行 `import` 是从网上加载脚本,需要压测的机器能访问 GitHub Raw——如果 Windows 那台机器是完全隔离的内网,这个方式不可行,只能用方式一的 JSON。)

## 自查清单

- [ ] `data/trade-combos.sample.json` 已替换成真实数据,数量 ≥ 计划的总请求数
- [ ] `data/0_instrument.dat` 已替换成真实的二进制文件
- [ ] 先跑通 1 次 smoke,确认状态码和响应体符合预期,再加大 `load` 场景的并发
- [ ] 确认过 `notionalCurrency` 是否需要具体值
- [ ] `thresholds` 已经基于真实基线数据调整,不再是占位值
