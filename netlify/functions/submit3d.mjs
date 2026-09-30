// ============================================================
//  submit3d.mjs —— Tripo 图转3D 提交（最简 body，已验证可用）
//  POST /.netlify/functions/submit3d
//  body: { prompt, imageUrl?, storageKey? }
//  返回: { taskId, storageKey }
// ============================================================

const TRIPO_URL =
  "https://maas.qianwenaiapi.com/api/v1/services/aigc/video-generation/3d-generation";

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "ok" };
  }
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "缺少 DASHSCOPE_API_KEY" }) };
  }
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch (e) { input = {}; }

  // 最简 body（不带 parameters —— 之前测试证实带 texture_quality 会报 InvalidParameter）
  const body = {
    model: "Tripo/Tripo-H3.1",
    input: {},
  };

  // 图转3D：优先 prompt + 参考图；无图则纯文生3D
  if (input.imageUrl) {
    body.input = { prompt: input.prompt || "文物写实3D模型", image_url: input.imageUrl };
  } else {
    body.input = { prompt: input.prompt || "文物写实3D模型" };
  }

  try {
    const resp = await fetch(TRIPO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    const taskId = data.output && data.output.task_id;
    if (!taskId) {
      return { statusCode: (data.code ? 400 : resp.status), headers: cors(), body: JSON.stringify({ error: "Tripo 提交失败", detail: data }) };
    }
    return {
      statusCode: 200,
      headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ taskId, storageKey: input.storageKey || "", status: "PENDING" }),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: String(e) }) };
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
