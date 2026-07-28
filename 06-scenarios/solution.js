import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';

export const options = {
  scenarios: {
    // 冒烟测试: 1 个 VU 跑 1 次,快速确认接口"能不能通",不追求压力
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'smokeTest',
    },
    // 负载测试: 用 constant-arrival-rate(到达率执行器),
    // 不管服务器响应快慢,固定"每秒发起 3 次迭代"这个目标速率
    load: {
      executor: 'constant-arrival-rate',
      rate: 3,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 5, // 预先分配够用的 VU,避免压测中途现分配影响测量
      maxVUs: 10,          // 如果 preAllocatedVUs 不够撑住目标速率,最多再借到这个数
      exec: 'loadTest',
      startTime: '3s',     // 让 smoke 先跑完,两个场景的日志不混在一起
    },
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/users/token/login`,
    JSON.stringify({ username: 'default', password: '12345678' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return { token: JSON.parse(res.body).token };
}

export function smokeTest() {
  const res = http.get(`${BASE_URL}/`);
  check(res, { 'smoke: status is 200': (r) => r.status === 200 });
}

export function loadTest(data) {
  const payload = JSON.stringify({
    maxCaloriesPerSlice: 500,
    mustBeVegetarian: false,
    excludedIngredients: [],
    excludedTools: [],
    maxNumberOfToppings: 5,
    minNumberOfToppings: 2,
  });
  const res = http.post(`${BASE_URL}/api/pizza`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  });
  check(res, { 'load: status is 200': (r) => r.status === 200 });
  sleep(1);
}
