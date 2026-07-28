# 05 · 自定义指标 + 数据参数化

## 概念 1:自定义指标(Custom Metrics)

k6 内置指标(`http_req_duration`、`http_req_failed`……)只反映"网络层面"的表现,不反映**业务语义**。比如"这次推荐的披萨热量是多少"“素食推荐占比多少”——这些得自己定义。`k6/metrics` 提供 4 种类型:

| 类型 | 用途 | 例子 |
|---|---|---|
| `Counter` | 累加计数,只增不减 | 素食推荐次数 |
| `Trend` | 记录一组数值,自动算 avg/min/max/百分位 | 每次推荐的卡路里分布 |
| `Rate` | 记录"是/否"事件的比例 | 库存不足的比例 |
| `Gauge` | 记录最新值(会被覆盖) | 当前队列长度 |

用法很统一:先 `new` 一个,再在业务代码里 `.add(值)`:

```js
import { Trend, Counter } from 'k6/metrics';
const pizzaCalories = new Trend('pizza_calories');
const vegetarianCount = new Counter('vegetarian_recommendations');
// ...
pizzaCalories.add(320);
vegetarianCount.add(1);
```

它们会自动出现在最终报告的 `CUSTOM` 分组里,和内置指标平级。

## 概念 2:数据参数化(`SharedArray`)

如果每个 VU、每次迭代都发**完全一样**的请求,测出来的数据会失真(比如命中同一条缓存)。`SharedArray` 让你注入一批测试数据,所有 VU **共享同一份内存拷贝**(而不是每个 VU 各自复制一份,数据量大时能省很多内存),然后在迭代里随机/轮询取用:

```js
import { SharedArray } from 'k6/data';

const preferences = new SharedArray('pizza preferences', function () {
  return [
    { maxCaloriesPerSlice: 500, mustBeVegetarian: false, ... },
    { maxCaloriesPerSlice: 300, mustBeVegetarian: true, ... },
  ];
});
// 迭代里: const pref = preferences[Math.floor(Math.random() * preferences.length)];
```

真实项目里这批数据通常来自外部 CSV/JSON 文件(比如一批测试账号、一批商品 ID),用 `open()` 读取后传给 `SharedArray` 的回调函数即可,写法是一样的。

## 概念 3:`setup()` —— 压测前的一次性准备

`setup()` 在整个压测**开始前只执行一次**(不管有多少 VU),典型用途是登录拿 token、初始化远程数据。它的返回值会作为参数传给每一次 `export default function (data)` 调用:

```js
export function setup() {
  const res = http.post(loginUrl, ...);
  return { token: JSON.parse(res.body).token };
}

export default function (data) {
  // 这里可以用 data.token
}
```

## 目标接口

QuickPizza 的核心业务接口——根据偏好条件推荐一个披萨组合:

```
POST /api/pizza
Authorization: Bearer <登录拿到的 token>
Content-Type: application/json

{"maxCaloriesPerSlice":500,"mustBeVegetarian":false,"excludedIngredients":[],"excludedTools":[],"maxNumberOfToppings":5,"minNumberOfToppings":2}
```

返回形如:

```json
{"pizza":{...},"calories":400,"vegetarian":false}
```

## 练习

打开 [`exercise.js`](./exercise.js),按里面 4 个 `TODO` 依次补全:
1. 定义 `pizza_calories`(Trend)和 `vegetarian_recommendations`(Counter)
2. 用 `SharedArray` 定义至少 3 组偏好数据
3. 每次迭代随机选一组偏好
4. 请求成功后把 `calories`/`vegetarian` 记录到对应的自定义指标

## 运行

```powershell
# 打公共演示站
k6 run exercise.js

# 或者切到本地 Docker(推荐,见上一章末尾的说明)
k6 run -e BASE_URL=http://localhost:3333 exercise.js
```

## 预期输出(关键部分,本地实测,针对公共演示站)

```
    checks_total.......: 56      3.305684/s
    checks_succeeded...: 100.00% 56 out of 56

    CUSTOM
    pizza_calories.................: avg=474.55 min=250 med=475 max=800 p(90)=700 p(95)=781.25
    vegetarian_recommendations.....: 32     1.888962/s

    HTTP
    http_req_failed................: 0.00% 0 out of 57
    http_reqs......................: 57    3.364714/s

    EXECUTION
    iterations.....................: 56    3.305684/s

running (16.9s), 0/5 VUs, 56 complete and 0 interrupted iterations
```

### 怎么读

- **`CUSTOM` 分组**——自定义指标独立成一个区块,`pizza_calories` 自动带上了完整的百分位统计,`vegetarian_recommendations` 是一个纯累加计数。
- **`http_reqs=57` 但 `iterations=56`**——差的这 1 次就是 `setup()` 里那一次登录请求。`setup()` 发出的请求也会计入 `http_reqs`,但它**只发生一次**,不随 VU/iteration 数量增长,这是判断"这个额外请求是不是 setup 造成的"的一个经验法则。

## 自查清单

- [ ] `CUSTOM` 分组里能看到 `pizza_calories` 和 `vegetarian_recommendations`
- [ ] 多跑几次,`vegetarian_recommendations` 的数值应该和你 `SharedArray` 里 `mustBeVegetarian:true` 的条目占比大致对得上
- [ ] 能解释为什么 `http_reqs` 比 `iterations` 多 1

对照答案见 [`solution.js`](./solution.js)。

下一步:[`06-scenarios`](../06-scenarios/) —— 用 scenarios 在同一个脚本里组合多种压测模式(冒烟测试 + 负载测试)。
