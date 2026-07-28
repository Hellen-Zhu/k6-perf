import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// 目标环境走环境变量,方便本地/预发/生产切换:
// k6 run -e BASE_URL=https://staging.example.com template.js
const BASE_URL = __ENV.BASE_URL || 'https://CHANGE_ME.example.com';

// TODO: 按需定义业务自定义指标,参考 05-metrics-and-data
// const someTrend = new Trend('some_business_metric');

export const options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'smokeTest',
    },
    load: {
      executor: 'ramping-vus', // 或改成 constant-arrival-rate,参考 06-scenarios
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 }, // TODO: 按真实预期流量调整峰值和爬坡时间
        { duration: '1m', target: 5 },
        { duration: '30s', target: 0 },
      ],
      exec: 'loadTest',
      startTime: '5s',
    },
  },
  thresholds: {
    // TODO: 换成基于真实 SLA/历史基线的数字
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// TODO: 如果接口需要鉴权,在这里做登录/取 token,返回值会传给下面两个函数
export function setup() {
  return {};
}

export function smokeTest(data) {
  const res = http.get(`${BASE_URL}/CHANGE_ME`);
  check(res, { 'smoke: status is 200': (r) => r.status === 200 });
}

export function loadTest(data) {
  const res = http.get(`${BASE_URL}/CHANGE_ME`);
  check(res, { 'load: status is 200': (r) => r.status === 200 });
  sleep(1);
}
