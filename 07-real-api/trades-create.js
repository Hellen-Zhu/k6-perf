import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/3.0.4/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// 目标环境走环境变量,方便切换 dev/uat:
// k6 run -e BASE_URL=http://uklvadptaa0005a.pi.dev.net:9089 trades-create.js
const BASE_URL = __ENV.BASE_URL || 'http://uklvadptaa0005a.pi.dev.net:9089';
const USER_ID = __ENV.USER_ID || 'maker@sc.com';

// ── PLACEHOLDER: 组合数据 ──────────────────────────────────────────
// 目前读的是 data/trade-combos.sample.json 里的占位数据。
// 拿到真实的 portfolioId/counterpartyFmId/counterpartyName 批量数据后,
// 直接覆盖 data/trade-combos.sample.json 的内容即可(格式参考文件本身),不用改这段代码。
//
// 注意: 如果组合数量 < 本次压测计划发出的总请求数,随机挑选会导致同一组合被重复使用。
// 如果接口/环境对 portfolioId+counterparty 组合有唯一性约束,请确保提供的组合数
// >= vus × 预计每个 VU 的迭代次数,否则需要告诉我,换成"不放回"的取用方式。
const tradeCombos = new SharedArray('trade combos', function () {
  return JSON.parse(open('./data/trade-combos.sample.json'));
});

// ── PLACEHOLDER: 上传文件 ──────────────────────────────────────────
// open() 只能在 init 阶段(脚本顶层)调用,不能写进 export default 函数里。
// 目前指向的是一个占位文本文件,请把 data/0_instrument.dat 的内容替换成真实的二进制文件
// (文件名可以保持不变,直接覆盖内容即可)。
// 如果每次请求需要传不同的文件,告诉我,会改成在这里预加载一个文件数组,
// 迭代时和 tradeCombos 一样按下标/随机取用。
const datFile = open('./data/0_instrument.dat', 'b');

const createSuccess = new Counter('trade_create_success');
const createFailure = new Counter('trade_create_failure');

// k6 CLI 没有"只跑某个 scenario"的参数,标准做法是像这样用环境变量在脚本里
// 动态拼 options.scenarios。第一次跑真实接口时强烈建议先 SMOKE_ONLY=true,
// 确认 multipart 构造、鉴权、状态码都符合预期,再去掉这个变量跑完整流程。
const scenarios = {
  // 冒烟测试: 用第 1 组数据发 1 次请求,快速确认接口通不通、multipart 构造对不对
  smoke: {
    executor: 'shared-iterations',
    vus: 1,
    iterations: 1,
    exec: 'smokeTest',
  },
};

if (__ENV.SMOKE_ONLY !== 'true') {
  // 负载测试: 保守的起始爬坡曲线,先验证再逐步加压
  // TODO: 根据真实预期流量调整 target 峰值和各阶段时长
  scenarios.load = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 3 },
      { duration: '30s', target: 5 },
      { duration: '10s', target: 0 },
    ],
    exec: 'loadTest',
    startTime: '5s', // 让 smoke 先跑完
  };
}

export const options = {
  scenarios,
  thresholds: {
    // PLACEHOLDER: 换成基于真实 SLA / 历史基线的数字
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

function createTrade(combo) {
  const tradePayload = {
    basic: {
      portfolioId: combo.portfolioId,
      counterpartyFmId: combo.counterpartyFmId,
      counterpartyName: combo.counterpartyName,
      // PLACEHOLDER: 目前留空,确认是否需要具体值(如 'USD')后在这里/数据里补上
      notionalCurrency: combo.notionalCurrency,
    },
  };

  // body 用 plain object: trade 是字符串字段, datFile 用 http.file() 包装成文件字段,
  // 只要其中有一个值是 http.file(),k6 会自动把整个 body 编码成
  // multipart/form-data 并生成正确的 boundary —— 千万不要手动设置 Content-Type,
  // 否则会覆盖掉 k6 自动生成的 boundary,导致服务端解析失败。
  const data = {
    trade: JSON.stringify(tradePayload),
    datFile: http.file(datFile, '0_instrument.dat', 'application/octet-stream'),
  };

  const params = {
    headers: {
      accept: 'application/json',
      'X-Dry-Run': 'false',
      'X-User-ID': USER_ID,
    },
  };

  const res = http.post(`${BASE_URL}/api/v1/trades/create`, data, params);

  // PLACEHOLDER: 目前只按 2xx 判断成功,拿到真实响应后请确认:
  // 1. 真实的成功状态码(200? 201?)
  // 2. 响应体里有没有该校验的字段(比如返回的 tradeId)
  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  if (ok) {
    createSuccess.add(1);
  } else {
    createFailure.add(1);
    console.error(`trade create failed: status=${res.status} body=${res.body}`);
  }

  return res;
}

export function smokeTest() {
  createTrade(tradeCombos[0]);
}

export function loadTest() {
  const combo = tradeCombos[Math.floor(Math.random() * tradeCombos.length)];
  createTrade(combo);
  sleep(1);
}

// 压测跑完后,除了照常在终端打印文本报告,额外生成一份 summary.html,
// 双击就能用浏览器打开查看(需要跑压测的机器能访问 GitHub Raw 才能加载 k6-reporter/jslib)。
// 注意: 一旦定义了 handleSummary(),k6 默认不会再自动打印终端报告,
// 必须像下面这样自己在返回值里加上 stdout,否则终端会啥都不显示。
export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data, { title: 'trades/create 压测报告' }),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
