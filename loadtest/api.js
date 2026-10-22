import http from 'k6/http';
import { check } from 'k6';
export const options = { vus: 50, duration: '60s', thresholds: { http_req_failed: ['rate<0.01'] } };
const BASE = __ENV.BASE_URL || 'http://gateway:8080';
export function setup() {
  const r = http.post(`${BASE}/login`, JSON.stringify({ username: __ENV.LT_USER, password: __ENV.LT_PASS }),
    { headers: { 'Content-Type': 'application/json' } });
  return { token: r.cookies.token[0].value };
}
export default function (d) {
  const r = http.get(`${BASE}/api/videos`, { headers: { Cookie: `token=${d.token}` }, redirects: 0 });
  check(r, { 'status 200': (x) => x.status === 200 });
}