import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '10s',
};

export default function () {
  const url = 'https://quickpizza.grafana.com/api/users/token/login';
  const payload = JSON.stringify({
    username: 'default',
    password: '12345678',
  });
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, payload, params);

  // TODO: 用 check() 校验这个响应,至少写 3 条:
  // 1. 状态码是 200
  // 2. 响应体里有 token 字段(提示: JSON.parse(r.body).token)
  // 3. 响应时间小于某个阈值(提示: r.timings.duration,单位 ms)
  check(res, {
    // 'status is 200': (r) => ???,
  });

  sleep(1);
}
