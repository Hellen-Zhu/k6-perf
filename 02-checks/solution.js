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

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has token': (r) => JSON.parse(r.body).token !== undefined,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
