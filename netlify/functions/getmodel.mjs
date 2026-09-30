// ============================================================
//  getmodel.mjs —— 从 Netlify Blobs 流式返回 GLB 二进制
//  GET /.netlify/functions/getmodel?key=<storageKey>
//  model-viewer 直接引用此 URL 渲染；不受 CDN 防盗链/过期影响。
//
//  ⚠️ 关于二进制返回：Netlify 函数不支持直接返回原始二进制，
//  需将 Buffer 转 base64 并置 isBase64Encoded:true，Netlify 会解码回二进制。
// ============================================================
import { getStore } from "@netlify/blobs";

export default async function handler(event) {
  const url = new URL(event.rawUrl || `https://x/${event.path}`);
  const key = url.searchParams.get("key") || "";
  if (!key) {
    return json(400, { error: "missing key" });
  }
  const store = getStore("tripo3d");
  const blob = await store.get(`${key}.glb`).catch(() => null);
  if (!blob) {
    return json(404, { error: "not found" });
  }
  const buf = await blob.arrayBuffer();
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
    body: Buffer.from(buf).toString("base64"),
    isBase64Encoded: true,
  };
}

function json(code, obj) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(obj),
  };
}
