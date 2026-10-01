// ============================================================
//  submit3d.mjs —— Tripo 图转3D 提交（返回 Response）
//  POST /.netlify/functions/submit3d   body: { prompt, imageUrl?, storageKey? }
//  返回: { taskId, storageKey }
// ============================================================
const TRIPO_URL =
  "https://maas.qianwenaiapi.com/api/v1/services/aigc/video-generation/3d-generation";

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") return native(200, "ok", cors());
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return json(500, { error: "缺少 DASHSCOPE_API_KEY" });
  try {
    const input = event.body ? JSON.parse(event.body) : {};
    const prompt = input.prompt || "文生3D文物纹样";
    const storageKey = input.storageKey || ("m_" + Date.now().toString(16));
    const imageUrl = input.imageUrl || null;
    // Tripo 最简 body：带图转3D用 image_url，纯文生用 prompt
    const body = { model: "Tripo/Tripo-H3.1", input: {} };
    if (imageUrl) { body.input.image_url = imageUrl; body.input.prompt = prompt; }
    else { body.input.prompt = prompt; }
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
    let j; try { j = JSON.parse(text); } catch (e) { j = { raw: text }; }
    const taskId = j.output && j.output.task_id;
    if (!taskId) return json(400, { error: "Tripo 提交失败", detail: j });
    return json(200, { taskId, storageKey });
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
function native(code, body, headers) {
  return { statusCode: code, headers, body: typeof body === "string" ? body : JSON.stringify(body) };
}
function json(code, obj) {
  return native(code, obj, { ...cors(), "Content-Type": "application/json; charset=utf-8" });
}
