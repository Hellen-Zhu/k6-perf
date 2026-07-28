import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '10s',
};

export default function () {
  http.get('https://quickpizza.grafana.com/');
  sleep(1);
}
