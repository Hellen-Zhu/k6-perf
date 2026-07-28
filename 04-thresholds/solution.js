import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '15s',
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% 的请求要在 800ms 内完成
    http_req_failed: ['rate<0.01'],   // 请求失败率要低于 1%
    checks: ['rate>0.99'],            // check 通过率要高于 99%
  },
};

export default function () {
  const res = http.get('https://quickpizza.grafana.com/');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
