const $ = (id) => document.getElementById(id);

function getApiBase() {
  return localStorage.getItem("API_BASE") || "";
}

function setApiBase(v) {
  localStorage.setItem("API_BASE", v.trim());
}

function apiUrl(path) {
  const base = getApiBase();
  if (!base) return path; // 不建議，但保留
  return base.replace(/\/+$/, "") + path;
}

async function postJSON(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

async function putJSON(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

function showResult(el, data) {
  el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

window.addEventListener("DOMContentLoaded", () => {
  $("apiBase").value = getApiBase();

  $("saveApiBtn").onclick = () => {
    setApiBase($("apiBase").value);
    alert("API Base 儲存完成！");
  };

  $("createBtn").onclick = async () => {
    const buyer_id = parseInt($("buyerId").value, 10);
    const product_id = parseInt($("productId").value, 10);
    if (!buyer_id || !product_id) {
      return showResult($("createResult"), "請輸入 buyer_id 與 product_id");
    }
    try {
      const data = await postJSON("/api/order/create", { buyer_id, product_id });
      showResult($("createResult"), data);
      $("orderId").value = data.id; // 自動帶入後續流程
    } catch (err) {
      showResult($("createResult"), String(err));
    }
  };

  $("confirmBtn").onclick = async () => {
    const order_id = parseInt($("orderId").value, 10);
    const seller_id = parseInt($("sellerId").value, 10);
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

  $("finishBtn").onclick = async () => {
    const order_id = parseInt($("orderId").value, 10);
    const by_user_id = parseInt($("byUserId").value, 10);
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

  $("cancelBtn").onclick = async () => {
    const order_id = parseInt($("orderId").value, 10);
    const by_user_id = parseInt($("byUserId").value, 10);
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

  // ==============================================================加入載入 & 繪製邏輯
    // 初始狀態
  $("searchStatus").value = "onsale";
  // 綁搜尋
  $("searchBtn").onclick = () => {
    paging.offset = 0;
    fetchProducts().catch(e => alert(String(e)));
  };
  $("prevPageBtn").onclick = () => {
    paging.offset = Math.max(0, paging.offset - paging.limit);
    fetchProducts().catch(e => alert(String(e)));
  };
  $("nextPageBtn").onclick = () => {
    if (paging.offset + paging.limit < paging.total) {
      paging.offset += paging.limit;
      fetchProducts().catch(e => alert(String(e)));
    }
  };

  // 頁面載入就抓一次
  fetchProducts().catch(e => console.error(e));

});

// =========================================================== Products 列表 ===============
let paging = { limit: 12, offset: 0, total: 0 };

async function fetchProducts() {
  const q = $("searchQ").value.trim();
  const status = $("searchStatus").value;
  const params = new URLSearchParams({
    limit: String(paging.limit),
    offset: String(paging.offset),
  });
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  const url = "/api/products?" + params.toString();
  const res = await fetch(apiUrl(url));
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  paging.total = data.total;
  renderProducts(data.items);
  renderPageInfo();
}

function renderProducts(items) {
  const grid = $("productGrid");
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
      $("productId").value = p.id; // 帶入「快速下單」區塊
      // 也可直接幫你下單：
      try {
        const buyer_id = parseInt($("buyerId").value, 10) || 2;
        const data = await postJSON("/api/order/create", { buyer_id, product_id: p.id });
        showResult($("createResult"), data);
        $("orderId").value = data.id;
        // 標記 UI
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
  const start = paging.offset + 1;
  const end = Math.min(paging.offset + paging.limit, paging.total);
  pageInfo.textContent = paging.total
    ? `顯示 ${start}-${end} / 共 ${paging.total} 筆`
    : `沒有資料`;
}

function statusLabel(s) {
  return s === "onsale" ? "販售中" : s === "sold" ? "已售出" : "已下架";
}

