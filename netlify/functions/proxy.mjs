// ============================================================
//  proxy.mjs —— 通义千问 + 通义万相 代理（POST + JSON body）
//  POST /.netlify/functions/proxy
//  body: { kind:"qwen", model?, messages? }  或 { kind:"wanx", prompt, model, size }
//  返回: 千问→{ content }   万相→{ url } 或 { pending }
//  ⚠️ POST + JSON 避免 GET query string 截断长 payload 的问题
// ============================================================

const DASH_CHAT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const WANX_SUBMIT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const WANX_TASK = (id) => `https://dashscope.aliyuncs.com/api/v1/tasks/${id}`;

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") return native(200, "ok", cors());
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return json(500, { error: "缺少 DASHSCOPE_API_KEY" });
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const kind = body.kind || "qwen";
    if (kind === "wanx") {
      return await runWanx(key, body);
    }
    return await runQwen(key, body);
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

/* ---------- 千问 ---------- */
async function runQwen(key, body) {
  const msgs = Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.prompt || "") }];
  const resp = await fetch(DASH_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model: body.model || "qwen-plus", messages: msgs, stream: false }),
  });
  const text = await resp.text();
  let j; try { j = JSON.parse(text); } catch (e) { return json(502, { error: "qwen bad response", raw: text.slice(0,200) }); }
  const content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
  return json(200, { content });
}

/* ---------- 万相（提交+轮询） ---------- */
async function runWanx(key, body) {
  const prompt = body.prompt || "";
  const submit = await fetch(WANX_SUBMIT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "X-DashScope-Async": "enable" },
    body: JSON.stringify({ model: body.model || "wan2.2-t2i-flash", input: { prompt }, parameters: { size: body.size || "1024*1024", n: 1 } }),
  });
  const st = await submit.text();
  let sj; try { sj = JSON.parse(st); } catch (e) { return json(502, { error: "wanx submit bad", raw: st.slice(0,200) }); }
  const taskId = (sj.output && sj.output.task_id) || (sj.output && sj.output.id);
  if (!taskId) return json(400, { error: "万相提交失败", detail: sj });
  // 轮询（Netlify 函数内等待，最长 ~8 秒）
  for (let i = 0; i < 6; i++) {
    await sleep(1300);
    const q = await fetch(WANX_TASK(taskId), { headers: { "Authorization": `Bearer ${key}` } });
    let qj; try { qj = await q.json(); } catch (e) { continue; }
    const st2 = qj.output && qj.output.task_status;
    if (st2 === "SUCCEEDED") {
      const url = (qj.output.results || [])[0] && qj.output.results[0].url;
      return json(200, { url });
    }
    if (st2 === "FAILED") return json(400, { error: "万相生成失败", detail: qj });
  }
  // 未完成 → 返回 pending，前端可再次请求（带 task_id 续查）
  return json(202, { pending: true, task_id: taskId, message: "还在生成" });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
}
function native(code, body, headers) {
  return { statusCode: code, headers, body: typeof body === "string" ? body : JSON.stringify(body) };
}
function json(code, obj) {
  return native(code, obj, { ...cors(), "Content-Type": "application/json; charset=utf-8" });
}
