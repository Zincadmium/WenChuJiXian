// ============================================================
//  纹初迹现 · 全局配置
//  说明：所有 AI key 都放在 Netlify 后台环境变量里，
//  页面通过 netlify/functions 代理调用，不在前端暴露。
// ============================================================

const CFG = {
  // ① 通义千问（AI精化 / 智能问答）—— 由 proxy 转发到 dashscope
  qwen: {
    proxy: "/.netlify/functions/proxy",
    model: "qwen-plus",
  },

  // ② 通义万相（2D 写实文物图）—— 由 proxy 转发
  wanx: {
    proxy: "/.netlify/functions/proxy",
    model: "wan2.2-t2i-flash",
    size: "1024*1024",
  },

  // ③ Tripo（3D 写实模型，图转3D）—— 由 submit3d / check3d 转发
  tripo: {
    submit: "/.netlify/functions/submit3d",
    check: "/.netlify/functions/check3d",
    model: "Tripo/Tripo-H3.1",
    // 生成时是否带高清贴图（true=更高清更贵，false=标准）；实际由后端固定，可改
    texture: "high",
  },

  // ④ 模型库 API（保存/复用已生成的3D模型）
  models: {
    // 使用 Netlify Blobs 的能力。地址留空则自动用 /.netlify/functions/* 的
    // BLOBS 相关端点（见 netlify/functions/modelStore）
    tag: "tripo3d",   // 模型库分区标识，方便统一管理
  },

  // 各步骤标题文案
  titles: {
    s1: "① 输入文化需求",
    s2: "② 文化配方",
    s3: "③ AI 提示词精化",
    s4: "④ AI 写实文物图（可跳过）",
    s5: "⑤ 元素溯源卡片",
    s6: "⑥ AI 3D 写实模型（可跳过）",
    s7: "⑦ 智能问答",
  },
};

// 提供给全局使用
window.CFG = CFG;
