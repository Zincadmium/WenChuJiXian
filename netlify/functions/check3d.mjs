// ============================================================
//  check3d.mjs —— Tripo 任务轮询 + 成功后存 Netlify Blobs
//  POST {taskId, storageKey, meta:{prompt,name,imageUrl,...}}
//  返回: {status, modelUrl, meta}  （modelUrl 指向 getmodel 流式端点）
// ============================================================
import { getStore } from "@netlify/blobs";

const TASK_URL = (id) =>
  `https://maas.qianwenaiapi.com/api/v1/tasks/${id}`;

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "ok" };
  }
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return json(500, { error: "缺少 DASHSCOPE_API_KEY" });
  try {
    const input = JSON.parse(event.body || "{}");
    const taskId = String(input.taskId || "").trim();
    if (!taskId) return json(400, { error: "缺少 taskId" });

    const resp = await fetch(TASK_URL(taskId), {
      headers: { "Authorization": `Bearer ${key}` },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    const st = data.output && data.output.task_status;

    if (st === "SUCCEEDED") {
      const r = (data.output.results || [])[0] || {};
      const glbUrl = r.pbr_model_url;
      const previewUrl = r.rendered_image_url;
      if (!glbUrl) return json(500, { error: "成功但未取到 GLB", detail: data });

      // 存库（storageKey 为稳定词条）
      const storageKey = String(input.storageKey || `m_${Date.now()}`).trim();
      const store = getStore("tripo3d");
      const meta = {
        key: storageKey,
        name: (input.meta && input.meta.name) || storageKey,
        prompt: (input.meta && input.meta.prompt) || "",
        imageUrl: (input.meta && input.meta.imageUrl) || "",
        sourceGlb: glbUrl,
        preview: previewUrl || "",
        createdAt: new Date().toISOString(),
      };
      // 下载 GLB 到 Blob（若未存过）
      const existing = await store.getJSON(`${storageKey}.meta`).catch(() => null);
      if (!existing) {
        try {
          const g = await fetch(glbUrl);
          if (g.ok) {
            const buf = await g.arrayBuffer();
            await store.set(`${storageKey}.glb`, new Uint8Array(buf), { type: "model/gltf-binary" });
          }
        } catch (_) {}
        await store.setJSON(`${storageKey}.meta`, meta);
      } else {
        await store.setJSON(`${storageKey}.meta`, { ...meta, createdAt: existing.createdAt });
      }

      // 保存 2D 图片（可选，若本地没存）
      setStateValue({ storageKey, imageUrl: meta.imageUrl, preview: previewUrl });

      return json(200, {
        status: "SUCCEEDED",
        modelUrl: `/.netlify/functions/getmodel?key=${encodeURIComponent(storageKey)}`,
        meta,
      });
    }

    if (st === "FAILED") {
      return json(400, { error: "Tripo 任务失败", detail: data });
    }

    return json(200, { status: st || "RUNNING" });
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

function setStateValue(_x) {} // 占位（跨函数共享状态由 Blob 承担）

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
