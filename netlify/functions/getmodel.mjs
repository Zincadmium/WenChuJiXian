// ============================================================
//  getmodel.mjs —— 从 Netlify Blobs 流式返回 GLB 二进制
//  GET /.netlify/functions/getmodel?key=<storageKey>
//  model-viewer 直接引用此 URL 渲染；不受 CDN 防盗链/过期影响。
// ============================================================
import { getStore } from "@netlify/blobs";

export default async function handler(event) {
  const key = (new URL(event.rawUrl || `https://x/${event.path}`)).searchParams.get("key") || "";
  if (!key) return bin(400, "model/gltf-binary", "missing key");
  try {
    const store = getStore("tripo3d");
    const blob = await store.get(`${key}.glb`);
    if (!blob) return bin(404, "model/gltf-binary", "not found");
    const buf = await blob.arrayBuffer();
    return bin(200, "model/gltf-binary", Buffer.from(buf));
  } catch (e) {
    return bin(500, "application/json", JSON.stringify({ error: String(e) }));
  }
}

function bin(code, type, body) {
  const isBuf = typeof body !== "string";
  return {
    statusCode: code,
    headers: { "Content-Type": type, "Access-Control-Allow-Origin": "*" },
    body: isBuf ? body.toString("base64"), // Netlify 函数二进制需 base64?
    isBase64Encoded: isBuf,
  };
}
