# 纹初迹现 · AI 纹样创作与 3D 生成平台

AIC 校赛·智能文化赛道作品。7 步工作台：输入需求 → AI 文化配方 → 千问精化提示词 → （可选）万相 2D 写实文物图 → 元素溯源卡片 → （可选）Tripo 3D 写实模型 → 智能问答。

## 一键部署到 Netlify（推荐，线上直接用）

本目录**本身就是可部署的 Netlify 站点根目录**，无需构建。

1. **推送到 GitHub**
   - 用 GitHub Desktop 新建仓库（或已有仓库），把本目录**里所有内容**放进去（保留 `netlify/`、`netlify.toml`、`index.html`、`config.js`、`data/`、`images/`、`libs/`、`package.json`，**不要**把 `wenyang3d` 外层文件夹也包进去）。
   - Commit & Push。

2. **接入 Netlify**
   - 登录 [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → 选 GitHub 仓库。
   - Build command：留空即可（`netlify.toml` 里已写 `echo 'static site - nothing to build'`）。
   - Publish directory：输入 `.`（当前目录）。

3. **配置密钥（关键，否则 AI 接口 500）**
   - 站点 → **Site settings → Environment variables → Add a variable**：
     - 变量名：`DASHSCOPE_API_KEY`
     - 值：你的阿里云百炼 API Key（千问 / 万相 / Tripo 全部用这一个 key）
   - 保存后 **Deploys → 手动触发一次重新部署（Trigger deploy）**，让环境变量生效。
   - 若没有 `DASHSCOPE_API_KEY`，千问/万相/三合一 3D 会返回「缺少 DASHSCOPE_API_KEY」。

> 阿里云百炼需开通「3D 生成（Tripo/Tripo-H3.1）」产品，否则提交 3D 会提示「产品未开通」。

## 技术说明（给评委 / 答辩）

- **千问（AI 精化 / 智能问答）**：`netlify/functions/proxy.mjs` 转发到
  `dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，模型 `qwen-plus`。
  前端发送 `{ kind:'qwen', messages:[...] }`。
- **万相（2D 写实文物图）**：`proxy.mjs` 用原生异步接口
  `.../api/v1/services/aigc/text2image/image-synthesis`（提交 + 轮询），模型 `wan2.2-t2i-flash`。
  前端发送 `{ kind:'wanx', prompt, model, size }`。
- **Tripo（3D 图转3D）**：`submit3d.mjs` 提交（`X-DashScope-Async: enable`）、`check3d.mjs` 轮询，
  接口 `maas.qianwenaiapi.com/api/v1/services/aigc/video-generation/3d-generation`，模型 `Tripo/Tripo-H3.1`。
- **模型库复用**：`check3d.mjs` 生成成功后把 GLB 存入 **Netlify Blobs**（分区 `tripo3d`），
  `modelStore.mjs` 负责查重 / 列表，`getmodel.mjs` 流式返回 GLB。相同词条再次生成直接复用，不重复消耗 API。
- 前端 **不暴露任何 Key**，所有调用经由 `/.netlify/functions/*` 代理。

## 本次更新（修复）要点

- 修复前端千问调用字段不一致：原 `payload:` → 统一为 `messages:`，与 `proxy.mjs` 对齐（这是 ③千问精化 / ⑦问答 报错的根因）。
- 修复模型库列表接口 `list` 过滤条件（`prefix` 匹配不到实际 key），改为遍历后按 `endsWith(".meta")` 过滤。
- 全量 `node --check` 校验通过：`config.js`、`proxy/submit3d/check3d/modelStore/getmodel`、前端内联 JS。

## 目录结构

```
index.html            主页面（单页应用，JS 内联）
config.js             前端配置（模型名、代理路径）
netlify.toml          Netlify 函数与超时配置
package.json          @netlify/blobs 依赖
netlify/functions/    5 个无服务器函数
  proxy.mjs           千问 + 万相 代理
  submit3d.mjs        Tripo 提交
  check3d.mjs         Tripo 轮询 + 入库 Blobs
  modelStore.mjs      模型库查重/列表/删除
  getmodel.mjs        GLB 流式返回
data/patterns.json    500 条真实纹样数据
images/patterns/      500 张纹样图
libs/model-viewer.min.js  3D 查看器（含内嵌 Draco 解码）
```

## 本地预览（可选）

本地无 Node/Python 时无法直接双击打开（`fetch` 读取本地 JSON 会被浏览器 CORS 拦截）。
建议直接走 Netlify 部署预览；如需本地，可自行起任意静态服务器指向本项目根目录（AI 接口仍走线上函数）。
