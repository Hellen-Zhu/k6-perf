import http from 'k6/http';
import { sleep } from 'k6';

// TODO: 设置 vus(虚拟用户数)和 duration(持续时间)
// 参考格式: export const options = { vus: 3, duration: '10s' };
export const options = {};

export default function () {
  http.get('https://quickpizza.grafana.com/');
  sleep(1);
}
