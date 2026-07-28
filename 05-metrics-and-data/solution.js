import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';

// 自定义指标: k6 内置指标(http_req_duration 等)覆盖不了业务语义,
// 这两个就是"业务指标"的例子——它们会和内置指标一起出现在最终报告里
const pizzaCalories = new Trend('pizza_calories');       // 记录每次推荐的卡路里分布
const vegetarianCount = new Counter('vegetarian_recommendations'); // 累计推荐了几次素食

// SharedArray: 所有 VU 共享同一份数据,只在初始化时解析一次(而不是每个 VU 各自复制一份),
// 数据量大的时候能显著省内存
const preferences = new SharedArray('pizza preferences', function () {
  return [
    { maxCaloriesPerSlice: 500, mustBeVegetarian: false, maxNumberOfToppings: 5, minNumberOfToppings: 2 },
    { maxCaloriesPerSlice: 300, mustBeVegetarian: true, maxNumberOfToppings: 3, minNumberOfToppings: 1 },
    { maxCaloriesPerSlice: 800, mustBeVegetarian: false, maxNumberOfToppings: 8, minNumberOfToppings: 4 },
  ];
});

export const options = {
  vus: 5,
  duration: '15s',
};

// setup() 只在压测开始前执行一次(不管多少 VU),常用来做登录、准备测试数据等"前置工作"
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/users/token/login`,
    JSON.stringify({ username: 'default', password: '12345678' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return { token: JSON.parse(res.body).token };
}

// setup() 的返回值会作为参数传给每一次迭代
export default function (data) {
  const pref = preferences[Math.floor(Math.random() * preferences.length)];
  const payload = JSON.stringify({
    ...pref,
    excludedIngredients: [],
    excludedTools: [],
  });

  const res = http.post(`${BASE_URL}/api/pizza`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  });

  check(res, { 'status is 200': (r) => r.status === 200 });

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    pizzaCalories.add(body.calories);
    if (body.vegetarian) vegetarianCount.add(1);
  }

  sleep(1);
}
