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
});
