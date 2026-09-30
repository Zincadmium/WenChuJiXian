// ============================================================
//  proxy.mjs —— 通义千问（同步）+ 通义万相（原生异步，服务端轮询到出图）
//  前端调用：
//    GET  /api?kind=qwen&model=...&payload=<json消息数组>   → 千问
//    GET  /api?kind=wanx&prompt=...&model=...&size=...    → 万相（已轮询，返回 {url})
//  统一返回 JSON；key 存于环境变量，不暴露给前端。
// ============================================================

const DASH_CHAT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const WANX_SUBMIT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const WANX_TASK = (id) => `https://dashscope.aliyuncs.com/api/v1/tasks/${id}`;

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "ok" };
  }
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "缺少 DASHSCOPE_API_KEY" }) };
  }
  try {
    const url = new URL(event.rawUrl || `https://x/${event.path}`);
    const kind = url.searchParams.get("kind") || "qwen";

    if (kind === "wanx") {
      return await runWanx(key, url);
    }
    return await runQwen(key, url);
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: String(e) }) };
  }
}

/* ---------- 千问（文本，兼容模式一次性返回） ---------- */
async function runQwen(key, url) {
  const payload = url.searchParams.get("payload") || "";
  let msgs;
  try { msgs = JSON.parse(payload); } catch (e) { msgs = [{ role: "user", content: payload }]; }
  const body = {
    model: url.searchParams.get("model") || "qwen-plus",
    messages: msgs,
    stream: false,
  };
  const resp = await fetch(DASH_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return { statusCode: resp.status, headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" }, body: text };
}

/* ---------- 万相（原生异步：提交→轮询→返回图片URL） ---------- */
async function runWanx(key, url) {
  const prompt = url.searchParams.get("prompt") || "";
  const model = url.searchParams.get("model") || "wan2.2-t2i-flash";
  const size = url.searchParams.get("size") || "1024*1024";
  const body = {
    model,
    input: { prompt },
    parameters: { size, n: 1 },
  };
  // 1) 提交异步任务
  const submit = await fetch(WANX_SUBMIT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(body),
  });
  const submitText = await submit.text();
  let sj;
  try { sj = JSON.parse(submitText); } catch (e) { sj = { raw: submitText }; }
  const taskId = sj.output && sj.output.task_id;
  if (!taskId) {
    return { statusCode: (sj.code ? 400 : submit.status), headers: cors(), body: JSON.stringify({ error: "万相提交失败", detail: sj }) };
  }
  // 2) 轮询（最多30次，每2秒；Netlify 函数最长10秒，此处用有限轮询）
  for (let i = 0; i < 5; i++) {
    await sleep(2000);
    const q = await fetch(WANX_TASK(taskId), {
      headers: { "Authorization": `Bearer ${key}` },
    });
    const qt = await q.text();
    let qj; try { qj = JSON.parse(qt); } catch (e) { qj = { raw: qt }; }
    const st = qj.output && qj.output.task_status;
    if (st === "SUCCEEDED") {
      const results = qj.output.results || [];
      const imgUrl = results[0] && results[0].url;
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ url: imgUrl, task_id: taskId }) };
    }
    if (st === "FAILED") {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "万相生成失败", detail: qj }) };
    }
    // RUNNING/PENDING 继续
  }
  return { statusCode: 202, headers: cors(), body: JSON.stringify({ pending: true, task_id: taskId, error: "仍在生成，请稍后再试" }) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
