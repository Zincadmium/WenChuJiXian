// ============================================================
//  check3d.mjs —— Tripo 任务轮询 + 成功后存 Netlify Blobs（返回 Response）
//  POST {taskId, storageKey, meta:{prompt,name,imageUrl,...}}
//  返回: {status, modelUrl, meta}   (modelUrl 指向 getmodel 流式端点)
// ============================================================
import { getStore } from "@netlify/blobs";

const TASK_URL = (id) => `https://maas.qianwenaiapi.com/api/v1/tasks/${id}`;

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") return new Response("ok", { status: 200, headers: cors() });
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return json(500, { error: "缺少 DASHSCOPE_API_KEY" });
  try {
    const input = event.body ? JSON.parse(event.body) : {};
    const taskId = input.taskId;
    if (!taskId) return json(400, { error: "缺少 taskId" });
    const resp = await fetch(TASK_URL(taskId), { headers: { "Authorization": `Bearer ${key}` } });
    const text = await resp.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = { raw: text }; }
    const status = j.output && j.output.task_status;
    if (status === "SUCCEEDED") {
      const results = j.output.results || [];
      const pbr = results[0] && results[0].pbr_model_url;
      const preview = results[0] && results[0].rendered_image_url;
      const storageKey = input.storageKey;
      // 存 Netlify Blobs（GLB），供 getmodel 流式返回 + 复用
      let saved = false;
      if (storageKey && pbr) {
        try {
          const dl = await fetch(pbr);
          const buf = Buffer.from(await dl.arrayBuffer());
          const store = getStore("tripo3d");
          await store.set(`${storageKey}.glb`, buf);
          await store.setJSON(`${storageKey}.meta`, { prompt: (input.meta||{}).prompt||"", name: (input.meta||{}).name||"", imageUrl: (input.meta||{}).imageUrl||"" });
          saved = true;
        } catch (e) { /* 存储失败不阻断返回 */ }
      }
      return json(200, { status, modelUrl: saved ? `/.netlify/functions/getmodel?key=${encodeURIComponent(storageKey)}` : pbr, preview, saved });
    }
    return json(200, { status: status || "UNKNOWN" });
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
function json(code, obj) {
  return new Response(JSON.stringify(obj), { status: code, headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" } });
}
