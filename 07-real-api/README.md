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

k6 CLI 本身没有"只跑某个 scenario"的参数,脚本里用环境变量 `SMOKE_ONLY` 在 `options.scenarios` 上做了开关(见 `trades-create.js` 顶部注释),**第一次跑真实接口务必先只跑冒烟测试**:

```powershell
# 只跑冒烟测试(1 次请求),先确认接口通不通、multipart 构造对不对
k6 run -e SMOKE_ONLY=true trades-create.js
```

本地验证过(用假数据打不存在的内网地址,`http_req_failed` 会 100% 触发 threshold 失败,退出码 99——这是预期的,因为请求根本没连上,真实环境里换成能连通的地址后这条 threshold 就该正常了):

```
    ✗ status is 2xx
      ↳  0% — ✓ 0 / ✗ 1

    CUSTOM
    trade_create_failure...: 1       4.305223/s

running (00m00.2s), 0/1 VUs, 1 complete and 0 interrupted iterations
smoke ✓ [ 100% ] 1 VUs  00m00.2s/10m0s  1/1 shared iters
```

确认 smoke 跑通、状态码和响应体都符合预期之后,再跑完整流程(smoke + load):

```powershell
k6 run trades-create.js
```

第一次跑完整流程,**强烈建议先把 `load` 场景的 `stages` 峰值改成 1~2 个 VU、跑 10 秒**,肉眼确认没问题(有没有报错、有没有意外创建了不该有的数据)之后,再按需要调大。

## 自查清单

- [ ] `data/trade-combos.sample.json` 已替换成真实数据,数量 ≥ 计划的总请求数
- [ ] `data/0_instrument.dat` 已替换成真实的二进制文件
- [ ] 先跑通 1 次 smoke,确认状态码和响应体符合预期,再加大 `load` 场景的并发
- [ ] 确认过 `notionalCurrency` 是否需要具体值
- [ ] `thresholds` 已经基于真实基线数据调整,不再是占位值
