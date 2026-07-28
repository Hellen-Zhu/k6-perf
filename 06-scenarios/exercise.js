import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';

// TODO: 定义两个 scenarios:
// 1. 'smoke': executor 'shared-iterations', vus:1, iterations:1, exec: 'smokeTest'
//    (冒烟测试: 快速确认接口能通,不追求压力)
// 2. 'load': executor 'constant-arrival-rate', rate:3, timeUnit:'1s', duration:'15s',
//    preAllocatedVUs:5, maxVUs:10, exec: 'loadTest', startTime:'3s'
//    (负载测试: 固定"每秒发起 N 次迭代"的目标速率,不管服务器响应快慢)
export const options = {
  scenarios: {},
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
