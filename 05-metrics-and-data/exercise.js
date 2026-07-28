import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';

// TODO 1: 定义两个自定义指标
// - 一个 Trend,叫 'pizza_calories',用来记录每次推荐的卡路里分布
// - 一个 Counter,叫 'vegetarian_recommendations',用来累计"素食推荐"出现了几次
// 提示: import { Trend, Counter } from 'k6/metrics'; const x = new Trend('name');

// TODO 2: 用 SharedArray 定义至少 3 组不同的 pizza 偏好条件(数组里每个元素是一个 object),
// 字段包括: maxCaloriesPerSlice, mustBeVegetarian, maxNumberOfToppings, minNumberOfToppings
// 提示: const preferences = new SharedArray('pizza preferences', function () { return [...]; });

export const options = {
  vus: 5,
  duration: '15s',
};

// setup() 只在压测开始前执行一次,常用来做登录、准备测试数据
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/users/token/login`,
    JSON.stringify({ username: 'default', password: '12345678' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return { token: JSON.parse(res.body).token };
}

export default function (data) {
  // TODO 3: 从 preferences 里随机选一组偏好(提示: Math.floor(Math.random() * preferences.length))

  const payload = JSON.stringify({
    // TODO: 展开随机选中的偏好 + excludedIngredients: [] + excludedTools: []
  });

  const res = http.post(`${BASE_URL}/api/pizza`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  });

  check(res, { 'status is 200': (r) => r.status === 200 });

  // TODO 4: 如果 res.status === 200,解析 body,把 calories 记录到 pizza_calories,
  // 如果 body.vegetarian 为 true,给 vegetarian_recommendations 加 1

  sleep(1);
}
