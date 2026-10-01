// ============================================================
//  getmodel.mjs —— 从 Netlify Blobs 流式返回 GLB 二进制（返回 Response）
//  GET /.netlify/functions/getmodel?key=<storageKey>
//  model-viewer 直接引用此 URL。<model-viewer> 内部会 fetch 该 URL。
//  ⚠️ 前端需用相对路径或同源完整地址调用；返回标准 Response。
// ============================================================
import { getStore } from "@netlify/blobs";

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") return native(200, "ok", cors());
  try {
    const url = new URL(event.rawUrl || `https://x/${event.path}`);
    const key = url.searchParams.get("key") || "";
    if (!key) return json(400, { error: "missing key" });
    const store = getStore("tripo3d");
    const blob = await store.get(`${key}.glb`).catch(() => null);
    if (!blob) return json(404, { error: "not found" });
    const buf = Buffer.from(await blob.arrayBuffer());
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
      body: buf.toString("base64"),
    };
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

function cors() {
  return { "Access-Control-Allow-Origin": "*" };
}
function native(code, body, headers) {
  return { statusCode: code, headers, body: typeof body === "string" ? body : JSON.stringify(body) };
}
function json(code, obj) {
  return native(code, obj, { ...cors(), "Content-Type": "application/json; charset=utf-8" });
}
