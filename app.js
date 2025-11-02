// ===============================
// Thrift Market - 前端腳本 (app.js)
// 支援：GitHub Pages + ngrok、API Base 設定/驗證、商品列表、分頁、一鍵下單、訂單流程
// ===============================

const $ = (id) => document.getElementById(id);

// --------- API Base 儲存/取得 ----------
function getApiBase() {
  return (localStorage.getItem("API_BASE") || "").trim().replace(/\/+$/, "");
}
function setApiBase(v) {
  localStorage.setItem("API_BASE", (v || "").trim().replace(/\/+$/, ""));
}

// --------- ngrok 兼容：自動附帶跳過 warning ----------
function isNgrokHost(hostname) {
  return /ngrok(-free)?\.app$/i.test(hostname);
}
function apiUrl(path) {
  const base = getApiBase();
  const full = (base ? base : "") + path; // 例如 https://xxx.ngrok-free.app + /api/products
  const url = new URL(full, window.location.href);
  if (isNgrokHost(url.hostname)) {
    url.searchParams.set("ngrok-skip-browser-warning", "true");
  }
  return url.toString();
}
const commonHeaders = {
  "Content-Type": "application/json",
  // 這行很關鍵：繞過 ngrok 的瀏覽器警告頁
  "ngrok-skip-browser-warning": "true",
};

// --------- 共用請求工具 ----------
async function ensureJsonResponse(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // 回傳 HTML 大多是 API Base 錯誤或被瀏覽器擋
    const text = await res.text();
    throw new Error(
      `後端未回傳 JSON（可能 API Base 設錯或被瀏覽器擋）\n` +
      `HTTP ${res.status} ${res.statusText}\n` +
      `Content-Type: ${ct}\n\n前 200 字：\n${text.slice(0, 200)}`
    );
  }
  return res.json();
}

async function getJSON(path) {
  const res = await fetch(apiUrl(path), { headers: { "ngrok-skip-browser-warning": "true" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  }
  return ensureJsonResponse(res);
}

async function postJSON(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  }
  return ensureJsonResponse(res);
}

async function putJSON(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: commonHeaders,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  }
  return ensureJsonResponse(res);
}

function showResult(el, data) {
  el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

// ===============================
// 商品列表 + 分頁
// ===============================
let paging = { limit: 12, offset: 0, total: 0 };

function statusLabel(s) {
  return s === "onsale" ? "販售中" : s === "sold" ? "已售出" : "已下架";
}

async function fetchProducts() {
  const q = $("searchQ") ? $("searchQ").value.trim() : "";
  const status = $("searchStatus") ? $("searchStatus").value : "onsale";

  const params = new URLSearchParams({
    limit: String(paging.limit),
    offset: String(paging.offset),
  });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const data = await getJSON("/api/products?" + params.toString());
  paging.total = data.total || 0;
  renderProducts(data.items || []);
  renderPageInfo();
}

function renderProducts(items) {
  const grid = $("productGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = `<div class="hint">找不到商品</div>`;
    return;
  }
  for (const p of items) {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    img.src = p.cover_image_url || "https://picsum.photos/seed/placeholder/600/400";
    img.alt = p.title;

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("div");
    title.textContent = p.title;

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = `NT$ ${p.price}`;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = statusLabel(p.status);

    const btn = document.createElement("button");
    btn.textContent = "下單";
    btn.disabled = p.status !== "onsale";
    btn.onclick = async () => {
      try {
        // 將 productId 帶到「快速下單」區塊，也直接發單
        if ($("productId")) $("productId").value = p.id;
        const buyer_id = parseInt(($("buyerId") && $("buyerId").value) || "2", 10) || 2;
        const data = await postJSON("/api/order/create", { buyer_id, product_id: p.id });
        showResult($("createResult"), data);
        if ($("orderId")) $("orderId").value = data.id;
        btn.disabled = true;
        badge.textContent = statusLabel("sold");
      } catch (err) {
        alert(String(err));
      }
    };

    body.appendChild(title);
    body.appendChild(price);
    body.appendChild(badge);
    body.appendChild(btn);

    div.appendChild(img);
    div.appendChild(body);
    grid.appendChild(div);
  }
}

function renderPageInfo() {
  const pageInfo = $("pageInfo");
  if (!pageInfo) return;
  const start = paging.offset + 1;
  const end = Math.min(paging.offset + paging.limit, paging.total);
  pageInfo.textContent = paging.total
    ? `顯示 ${start}-${end} / 共 ${paging.total} 筆`
    : `沒有資料`;
}

// ===============================
// 頁面初始化 & 事件
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  // 把已儲存的 API Base 顯示出來
  if ($("apiBase")) $("apiBase").value = getApiBase();

  // 儲存 API Base 並驗證 /api/health
  if ($("saveApiBtn")) {
    $("saveApiBtn").onclick = async () => {
      const base = ($("apiBase").value || "").trim().replace(/\/+$/, "");
      if (!base) return alert("請填入 API Base（例如 https://xxxxx.ngrok-free.app 或 http://192.168.2.162:8000）");
      try {
        // 優先帶上 ngrok 跳過參數
        const healthUrl = new URL(base + "/api/health");
        if (isNgrokHost(healthUrl.hostname)) {
          healthUrl.searchParams.set("ngrok-skip-browser-warning", "true");
        }
        const r = await fetch(healthUrl.toString(), { headers: { "ngrok-skip-browser-warning": "true" } });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const j = await r.json();
        if (!j.ok) throw new Error("health 回應格式不正確");
        setApiBase(base);
        alert("API Base 驗證成功並已儲存！");
        // 驗證成功後刷新商品
        paging.offset = 0;
        await fetchProducts();
      } catch (e) {
        alert("API Base 驗證失敗：\n" + e);
      }
    };
  }

  // 快速下單
  if ($("createBtn")) {
    $("createBtn").onclick = async () => {
      const buyer_id = parseInt(($("buyerId").value || "").trim(), 10);
      const product_id = parseInt(($("productId").value || "").trim(), 10);
      if (!buyer_id || !product_id) {
        return showResult($("createResult"), "請輸入 buyer_id 與 product_id");
      }
      try {
        const data = await postJSON("/api/order/create", { buyer_id, product_id });
        showResult($("createResult"), data);
        if ($("orderId")) $("orderId").value = data.id;
      } catch (err) {
        showResult($("createResult"), String(err));
      }
    };
  }

  // 賣家確認
  if ($("confirmBtn")) {
    $("confirmBtn").onclick = async () => {
      const order_id = parseInt(($("orderId").value || "").trim(), 10);
      const seller_id = parseInt(($("sellerId").value || "").trim(), 10);
      if (!order_id || !seller_id) {
        return showResult($("flowResult"), "請填入 order_id 與 seller_id");
      }
      try {
        const data = await putJSON("/api/order/confirm", { order_id, seller_id });
        showResult($("flowResult"), data);
      } catch (err) {
        showResult($("flowResult"), String(err));
      }
    };
  }

  // 完成交易
  if ($("finishBtn")) {
    $("finishBtn").onclick = async () => {
      const order_id = parseInt(($("orderId").value || "").trim(), 10);
      const by_user_id = parseInt(($("byUserId").value || "").trim(), 10);
      if (!order_id || !by_user_id) {
        return showResult($("flowResult"), "請填入 order_id 與 by_user_id");
      }
      try {
        const data = await putJSON("/api/order/finish", { order_id, by_user_id });
        showResult($("flowResult"), data);
      } catch (err) {
        showResult($("flowResult"), String(err));
      }
    };
  }

  // 取消訂單
  if ($("cancelBtn")) {
    $("cancelBtn").onclick = async () => {
      const order_id = parseInt(($("orderId").value || "").trim(), 10);
      const by_user_id = parseInt(($("byUserId").value || "").trim(), 10);
      if (!order_id || !by_user_id) {
        return showResult($("flowResult"), "請填入 order_id 與 by_user_id");
      }
      try {
        const data = await putJSON("/api/order/cancel", { order_id, by_user_id });
        showResult($("flowResult"), data);
      } catch (err) {
        showResult($("flowResult"), String(err));
      }
    };
  }

  // 搜尋與分頁
  if ($("searchBtn")) {
    $("searchBtn").onclick = () => {
      paging.offset = 0;
      fetchProducts().catch((e) => alert(String(e)));
    };
  }
  if ($("prevPageBtn")) {
    $("prevPageBtn").onclick = () => {
      paging.offset = Math.max(0, paging.offset - paging.limit);
      fetchProducts().catch((e) => alert(String(e)));
    };
  }
  if ($("nextPageBtn")) {
    $("nextPageBtn").onclick = () => {
      if (paging.offset + paging.limit < paging.total) {
        paging.offset += paging.limit;
        fetchProducts().catch((e) => alert(String(e)));
      }
    };
  }

  // 預設把狀態選為 "販售中"（若存在該元素）
  if ($("searchStatus")) $("searchStatus").value = "onsale";

  // 頁面載入時嘗試抓一次（若 API Base 未設定會失敗，但不阻斷）
  fetchProducts().catch((e) => {
    console.warn("初次載入商品失敗：", e);
  });
});
