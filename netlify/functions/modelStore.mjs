// ============================================================
//  modelStore.mjs —— 3D 模型库（Netlify Blobs）查重/列表/删除
//  POST {op:"get", key}    命中返回 {found:true, key, meta}
//  POST {op:"list"}        列出全部条目
//  POST {op:"remove", key} 删除
//  说明：GLB 二进制读取走独立的 getmodel.mjs（流式返回）。
// ============================================================
import { getStore } from "@netlify/blobs";

const STORE = () => getStore("tripo3d");

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "ok" };
  }
  try {
    const parsed = JSON.parse(event.body || "{}");
    const op = parsed.op || "get";
    const store = STORE();

    if (op === "get") {
      const key = String(parsed.key || "").trim();
      if (!key) return json(400, { error: "缺少 key" });
      const meta = await store.getJSON(`${key}.meta`).catch(() => null);
      if (!meta) return json(200, { found: false, key });
      return json(200, { found: true, key, meta, modelUrl: `/.netlify/functions/getmodel?key=${encodeURIComponent(key)}` });
    }

    if (op === "list") {
      const items = [];
      const list = await store.list({ prefix: "", limit: 1000 }).catch(() => ({ blobs: [] }));
      for (const b of list.blobs || []) {
        if (b.key.endsWith(".meta")) {
          const meta = await store.getJSON(b.key).catch(() => null);
          if (meta) items.push({ key: b.key.replace(/\.meta$/, ""), ...meta });
        }
      }
      items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return json(200, { items });
    }

    if (op === "remove") {
      const key = String(parsed.key || "").trim();
      if (!key) return json(400, { error: "缺少 key" });
      await store.delete(`${key}.glb`).catch(() => {});
      await store.delete(`${key}.meta`).catch(() => {});
      return json(200, { ok: true });
    }

    return json(400, { error: "未知 op" });
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

function json(code, obj) {
  return {
    statusCode: code,
    headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
