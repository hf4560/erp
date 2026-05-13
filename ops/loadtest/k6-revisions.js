import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500']
  }
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'dev-write-key';

export default function () {
  const res = http.post(`${BASE}/devices`, JSON.stringify({ name: `Device-${__VU}-${__ITER}` }), {
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }
  });

  check(res, {
    'status is 201': (r) => r.status === 201
  });

  sleep(1);
}
