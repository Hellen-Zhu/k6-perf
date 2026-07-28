import http from 'k6/http';
import { check, sleep } from 'k6';

// TODO: 用 stages 定义一条"爬坡 -> 稳定 -> 收尾"的曲线
// 参考:
// export const options = {
//   stages: [
//     { duration: '5s', target: 5 },   // 0 -> 5 VUs
//     { duration: '10s', target: 5 },  // 保持 5 VUs
//     { duration: '5s', target: 0 },   // 5 -> 0 VUs
//   ],
// };
export const options = {};

export default function () {
  const res = http.get('https://quickpizza.grafana.com/');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
