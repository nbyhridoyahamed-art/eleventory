// Load test for the public storefront API (k6: https://k6.io). Run against STAGING, never against the live shop.
//
//   k6 run -e API=https://api.staging.example.com/api/v1 -e HOST=demo.staging.example.com \
//          -e SSR_KEY=<STOREFRONT_SSR_KEY if you want to test the server-side path> deploy/loadtest/storefront.k6.js
//
// What it models: shoppers browsing (home data, category tree, product list, product pages, search). With
// -e CHECKOUT=1 a small share of them also place a cash-on-delivery order, which CREATES REAL ROWS: only do
// that on a throwaway database. Public requests are rate limited per IP, so a single load generator will
// hit 429s long before the platform is stressed; use several IPs, or set STOREFRONT_SSR_KEY and pass
// -e SSR_KEY to exercise the exempt server-side path, which is what real page views use.
//
// Targets (edit to taste, they are a starting point, not a promise): p95 under 800 ms, under 1% failures.
// STATUS: written, never run (k6 is not installed on the build machine).

import http from "k6/http";
import { check, sleep } from "k6";

const API = __ENV.API || "http://localhost:8000/api/v1";
const HOST = __ENV.HOST || "";
const SSR_KEY = __ENV.SSR_KEY || "";
const CHECKOUT = __ENV.CHECKOUT === "1";

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    "http_req_duration{name:product-list}": ["p(95)<1000"],
  },
};

const headers = {
  Accept: "application/json",
  ...(HOST ? { "X-Store-Host": HOST } : {}),
  ...(SSR_KEY ? { "X-Storefront-Key": SSR_KEY } : {}),
};

function get(path, name) {
  return http.get(`${API}${path}`, { headers, tags: { name } });
}

export default function () {
  check(get("/storefront/store", "store"), { "store 200": (r) => r.status === 200 });
  check(get("/storefront/theme", "theme"), { "theme 200 or 404": (r) => r.status === 200 || r.status === 404 });
  get("/storefront/categories", "categories");

  const list = get("/storefront/products?per_page=12", "product-list");
  check(list, { "list 200": (r) => r.status === 200 });

  let products = [];
  try {
    products = list.json("data") || [];
  } catch (e) {
    products = [];
  }

  if (products.length > 0) {
    const pick = products[Math.floor(Math.random() * products.length)];
    check(get(`/storefront/products/${pick.slug}`, "product"), { "product 200": (r) => r.status === 200 });
  }

  get("/storefront/products?search=a", "search");

  if (CHECKOUT && products.length > 0 && Math.random() < 0.02) {
    const pick = products[0];
    const res = http.post(
      `${API}/storefront/checkout`,
      JSON.stringify({
        customer_name: "Load Test",
        customer_phone: "017" + String(10000000 + Math.floor(Math.random() * 89999999)),
        shipping_recipient_name: "Load Test",
        shipping_phone: "01712345678",
        shipping_address_line: "Load test address",
        items: [{ product_id: pick.id, quantity: 1 }],
      }),
      { headers: { ...headers, "Content-Type": "application/json" }, tags: { name: "checkout" } },
    );
    check(res, { "checkout 201": (r) => r.status === 201 });
  }

  sleep(1 + Math.random() * 2);
}
