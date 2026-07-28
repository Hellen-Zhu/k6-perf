import http from 'k6/http';
import { check, sleep } from 'k6';

// TODO: 加一个 thresholds 配置,定义"通过/失败"标准,例如:
// - http_req_duration 的 p95 要小于 800ms
// - http_req_failed 的失败率要小于 1%
// - checks 的通过率要大于 99%
// 参考: thresholds: { http_req_duration: ['p(95)<800'], http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] }
export const options = {
  vus: 5,
  duration: '15s',
};

export default function () {
  const res = http.get('https://quickpizza.grafana.com/');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
