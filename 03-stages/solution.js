import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 5 },  // 爬坡: 0 -> 5 VUs
    { duration: '10s', target: 5 }, // 稳定: 保持 5 VUs
    { duration: '5s', target: 0 },  // 收尾: 5 -> 0 VUs
  ],
};

export default function () {
  const res = http.get('https://quickpizza.grafana.com/');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
