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

// ===============================
// 訂單清單（買家/賣家） + 分頁 + 操作
// ===============================
let orderPaging = { limit: 10, offset: 0, total: 0 };
let orderMode = "buyer"; // buyer | seller

async function fetchOrders() {
  const whoId = parseInt(($("whoId") && $("whoId").value) || "0", 10);
  const status = $("orderStatus") ? $("orderStatus").value : "";
  if (!whoId) {
    $("orderList").innerHTML = `<div class="hint">請先輸入你的 user_id</div>`;
    $("orderPageInfo").textContent = "";
    return;
  }

  const params = new URLSearchParams({
    limit: String(orderPaging.limit),
    offset: String(orderPaging.offset),
  });
  if (status) params.set("status", status);
  if (orderMode === "buyer") params.set("buyer_id", String(whoId));
  else params.set("seller_id", String(whoId));

  const data = await getJSON("/api/orders?" + params.toString());
  orderPaging.total = data.total || 0;
  renderOrders(data.items || [], whoId);
  renderOrderPageInfo();
}

function renderOrders(items, whoId) {
  const box = $("orderList");
  box.innerHTML = "";
  if (!items.length) {
    box.innerHTML = `<div class="hint">目前沒有資料</div>`;
    return;
  }
  for (const o of items) {
    const card = document.createElement("div");
    card.className = "card order-card";

    const img = document.createElement("img");
    img.src = o.product_cover || "https://picsum.photos/seed/product/600/400";
    img.alt = o.product_title || `#${o.product_id}`;

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("div");
    title.textContent = o.product_title || `商品 #${o.product_id}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `訂單 #${o.id} ｜ 價格 NT$ ${o.product_price ?? "-"} ｜ 狀態：${statusLabelOrder(o.status)}`;

    const ops = document.createElement("div");
    ops.className = "ops";

    // 依身分與狀態顯示可用操作
    const canConfirm = (orderMode === "seller" && o.status === "pending" && o.seller_id === whoId);
    const canFinish  = (["buyer","seller"].includes(orderMode) && o.status === "confirmed");
    const canCancel  = (["buyer","seller"].includes(orderMode) && ["pending","confirmed"].includes(o.status));

    if (canConfirm) {
      const b = document.createElement("button");
      b.textContent = "賣家確認";
      b.onclick = async () => {
        try {
          const data = await putJSON("/api/order/confirm", { order_id: o.id, seller_id: whoId });
          alert("已確認訂單 #" + data.id);
          await fetchOrders();
        } catch (e) { alert(e); }
      };
      ops.appendChild(b);
    }
    if (canFinish) {
      const b = document.createElement("button");
      b.textContent = "完成交易";
      b.onclick = async () => {
        try {
          const data = await putJSON("/api/order/finish", { order_id: o.id, by_user_id: whoId });
          alert("已完成訂單 #" + data.id);
          await fetchOrders();
        } catch (e) { alert(e); }
      };
      ops.appendChild(b);
    }
    if (canCancel) {
      const b = document.createElement("button");
      b.textContent = "取消訂單";
      b.onclick = async () => {
        try {
          const data = await putJSON("/api/order/cancel", { order_id: o.id, by_user_id: whoId });
          alert("已取消訂單 #" + data.id);
          await fetchOrders();
        } catch (e) { alert(e); }
      };
      ops.appendChild(b);
    }

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(ops);
    card.appendChild(img);
    card.appendChild(body);
    box.appendChild(card);
  }
}

function statusLabelOrder(s) {
  return s === "pending" ? "待確認"
       : s === "confirmed" ? "已確認"
       : s === "completed" ? "已完成"
       : "已取消";
}

function renderOrderPageInfo() {
  const pageInfo = $("orderPageInfo");
  const start = orderPaging.offset + 1;
  const end = Math.min(orderPaging.offset + orderPaging.limit, orderPaging.total);
  pageInfo.textContent = orderPaging.total
    ? `顯示 ${start}-${end} / 共 ${orderPaging.total} 筆`
    : `沒有資料`;
}

// 綁定事件（放在原本 DOMContentLoaded 的最後面）
window.addEventListener("DOMContentLoaded", () => {
  if ($("tabBuyer")) {
    $("tabBuyer").onclick = () => {
      orderMode = "buyer";
      $("tabBuyer").classList.add("active");
      $("tabSeller").classList.remove("active");
      orderPaging.offset = 0;
      fetchOrders().catch(e => alert(String(e)));
    };
  }
  if ($("tabSeller")) {
    $("tabSeller").onclick = () => {
      orderMode = "seller";
      $("tabSeller").classList.add("active");
      $("tabBuyer").classList.remove("active");
      orderPaging.offset = 0;
      fetchOrders().catch(e => alert(String(e)));
    };
  }
  if ($("orderSearch")) {
    $("orderSearch").onclick = () => {
      orderPaging.offset = 0;
      fetchOrders().catch(e => alert(String(e)));
    };
  }
  if ($("orderPrev")) {
    $("orderPrev").onclick = () => {
      orderPaging.offset = Math.max(0, orderPaging.offset - orderPaging.limit);
      fetchOrders().catch(e => alert(String(e)));
    };
  }
  if ($("orderNext")) {
    $("orderNext").onclick = () => {
      if (orderPaging.offset + orderPaging.limit < orderPaging.total) {
        orderPaging.offset += orderPaging.limit;
        fetchOrders().catch(e => alert(String(e)));
      }
    };
  }

  // 預設進入「我的訂單（買家）」分頁
  if ($("tabBuyer")) $("tabBuyer").click();
});
