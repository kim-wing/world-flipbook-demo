import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const imageStorePath = path.join(dataDir, "generated-images.json");
const PORT = Number(process.env.PORT || 8788);
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "auto";
const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 45000);
const OPENAI_IMAGE_ENDPOINT =
  process.env.OPENAI_IMAGE_ENDPOINT || (OPENAI_IMAGE_MODEL.includes("gemini") ? "chat" : "images");

const nodes = new Map();
let imageStoreWrite = Promise.resolve();

const WORLD_TOPICS = [
  {
    key: "asia",
    title: "亚洲文明与自然地貌地图",
    label: "亚洲",
    palette: ["#d8eadf", "#6f9f94", "#d1a861", "#263f3e"],
    details: ["东亚城市群", "丝绸之路", "喜马拉雅山脉", "东南亚海岛", "恒河流域"]
  },
  {
    key: "europe",
    title: "欧洲历史城市与山河地图",
    label: "欧洲",
    palette: ["#e5e0cf", "#617f91", "#c49356", "#27323a"],
    details: ["地中海沿岸", "阿尔卑斯山", "北欧峡湾", "古典城市", "多瑙河流域"]
  },
  {
    key: "africa",
    title: "非洲大陆地貌与文化地图",
    label: "非洲",
    palette: ["#eadcc4", "#8b7b52", "#c2763e", "#352d22"],
    details: ["撒哈拉边缘", "尼罗河流域", "东非大裂谷", "西非海岸", "南部草原"]
  },
  {
    key: "americas",
    title: "美洲山脉、城市与荒野地图",
    label: "美洲",
    palette: ["#dce6dc", "#5c8b75", "#c18d58", "#2d3b33"],
    details: ["落基山脉", "亚马孙雨林", "安第斯山脉", "加勒比海", "北美城市带"]
  },
  {
    key: "oceania",
    title: "大洋洲海岛、珊瑚与荒原地图",
    label: "大洋洲",
    palette: ["#d6e8e7", "#4f91a1", "#d0a35d", "#253a42"],
    details: ["澳洲内陆", "大堡礁", "新西兰峡湾", "南太平洋群岛", "火山海岸"]
  },
  {
    key: "polar-ocean",
    title: "极地、海洋与地球边界地图",
    label: "极地与海洋",
    palette: ["#dbe9ed", "#517f94", "#b7a36c", "#263846"],
    details: ["北极航道", "南极冰盖", "深海海沟", "岛链航线", "海洋环流"]
  }
];

function pickTopic(parentQuery = "", point = { x: 0.5, y: 0.5 }) {
  const bias = Math.floor(point.x * 3) + Math.floor(point.y * 2) * 3;
  const parentIndex = WORLD_TOPICS.findIndex((topic) => parentQuery.includes(topic.label) || parentQuery.includes(topic.key));
  const nextIndex = parentIndex >= 0 ? (parentIndex + bias + 1) % WORLD_TOPICS.length : bias % WORLD_TOPICS.length;
  return WORLD_TOPICS[nextIndex];
}

function svgDataUrl(topic, options = {}) {
  const id = options.id || crypto.randomUUID();
  const depth = options.depth || 1;
  const [bg, water, accent, ink] = topic.palette;
  const detail = topic.details[(depth + Math.floor((options.point?.x || 0.5) * topic.details.length)) % topic.details.length];
  const next = topic.details[(depth + 2) % topic.details.length];
  const title = options.title || topic.title;
  const safeTitle = escapeXml(title);
  const safeDetail = escapeXml(detail);
  const safeNext = escapeXml(next);
  const paths = [
    `M145 410 C240 300 365 338 455 250 C560 145 725 185 826 274 C920 356 1015 350 1110 284 L1110 620 C930 685 790 636 642 672 C492 708 339 677 145 742 Z`,
    `M148 226 C277 144 398 172 512 122 C677 48 840 82 1018 178`,
    `M265 724 C396 615 551 592 691 522 C830 453 942 442 1066 494`
  ];

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="sky-${id}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#fffaf0"/>
    </linearGradient>
    <filter id="paper-${id}">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values=".12"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .18"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#sky-${id})"/>
  <rect width="1280" height="720" fill="#ffffff" filter="url(#paper-${id})" opacity=".55"/>
  <path d="${paths[0]}" fill="${water}" opacity=".58"/>
  <path d="${paths[1]}" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".34"/>
  <path d="${paths[2]}" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" opacity=".78"/>
  <g transform="translate(735 206)">
    <rect x="-88" y="-54" width="176" height="108" rx="8" fill="#fffaf2" stroke="${ink}" stroke-width="3"/>
    <path d="M-58 54 L-32 90 L-2 54" fill="#fffaf2" stroke="${ink}" stroke-width="3"/>
    <text x="0" y="-12" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="${ink}" font-weight="700">${safeDetail}</text>
    <text x="0" y="24" text-anchor="middle" font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="18" fill="${ink}" opacity=".72">点击继续深入</text>
  </g>
  <g stroke="${ink}" stroke-width="4" fill="#fff8e8">
    <rect x="220" y="310" width="92" height="72" rx="10"/>
    <path d="M246 310 L266 270 L286 310"/>
    <rect x="918" y="370" width="108" height="86" rx="10"/>
    <path d="M940 370 L973 318 L1006 370"/>
    <circle cx="520" cy="468" r="42" fill="${accent}" opacity=".84"/>
    <path d="M498 468 H542 M520 446 V490"/>
  </g>
  <g transform="translate(70 72)">
    <text font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="${ink}" font-weight="700">${safeTitle}</text>
    <text y="58" font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="22" fill="${ink}" opacity=".72">世界视觉探索 · 第 ${depth} 页 · ${safeDetail}</text>
  </g>
  <g transform="translate(72 548)">
    <rect width="440" height="100" rx="14" fill="#fffaf2" stroke="${ink}" stroke-width="2" opacity=".92"/>
    <text x="26" y="38" font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="22" fill="${ink}" font-weight="700">下一层线索</text>
    <text x="26" y="72" font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="20" fill="${ink}" opacity=".76">${safeNext}、周边区域、文化故事</text>
  </g>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function homeSvgDataUrl() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="home-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#dceee9"/>
      <stop offset=".58" stop-color="#fff7e8"/>
      <stop offset="1" stop-color="#e8dac0"/>
    </linearGradient>
    <filter id="home-paper">
      <feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values=".1"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 .15"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#home-bg)"/>
  <rect width="1280" height="720" fill="#fff" filter="url(#home-paper)" opacity=".54"/>
  <ellipse cx="640" cy="384" rx="430" ry="236" fill="#92b9b8" opacity=".6"/>
  <path d="M266 370 C342 300 440 294 512 346 C580 395 666 372 742 310 C832 238 962 272 1030 354 C940 428 840 450 716 424 C620 404 544 454 452 450 C370 446 306 416 266 370 Z" fill="#fff8e8" stroke="#1d201b" stroke-width="4"/>
  <path d="M210 512 C365 438 482 464 624 398 C780 326 916 348 1072 438" fill="none" stroke="#d0aa66" stroke-width="18" stroke-linecap="round" opacity=".82"/>
  <path d="M190 224 C326 148 452 168 574 130 C728 82 894 106 1076 184" fill="none" stroke="#22302c" stroke-width="5" stroke-linecap="round" opacity=".26"/>
  <g fill="#fffaf0" stroke="#1d201b" stroke-width="4">
    <circle cx="360" cy="350" r="44"/>
    <circle cx="540" cy="414" r="36" fill="#d0aa66"/>
    <rect x="702" y="268" width="118" height="76" rx="12"/>
    <rect x="894" y="346" width="128" height="82" rx="12"/>
    <rect x="458" y="228" width="112" height="68" rx="12"/>
  </g>
  <g font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="24" fill="#1d201b" font-weight="700">
    <text x="320" y="424">美洲</text>
    <text x="500" y="492">大西洋</text>
    <text x="712" y="388">欧洲</text>
    <text x="900" y="468">亚洲</text>
    <text x="486" y="270">非洲</text>
    <text x="840" y="570">大洋洲</text>
    <text x="588" y="646">极地与海洋</text>
  </g>
  <g transform="translate(72 76)">
    <text font-family="Georgia, 'Times New Roman', serif" font-size="54" fill="#1d201b" font-weight="700">世界全域视觉导览图</text>
    <text y="52" font-family="'PingFang SC', 'Noto Sans CJK SC', sans-serif" font-size="23" fill="#1d201b" opacity=".72">从大陆、海洋、城市与文明线索进入全球探索</text>
  </g>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[char]);
}

async function readImageStore() {
  try {
    const raw = await readFile(imageStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      default_home_id: parsed.default_home_id || "",
      images: Array.isArray(parsed.images) ? parsed.images : []
    };
  } catch {
    return { default_home_id: "", images: [] };
  }
}

async function writeImageStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(imageStorePath, `${JSON.stringify(store, null, 2)}\n`);
}

function queueImageStoreUpdate(update) {
  imageStoreWrite = imageStoreWrite
    .then(async () => {
      const store = await readImageStore();
      await update(store);
      await writeImageStore(store);
    })
    .catch((error) => {
      console.error(`Failed to update generated image store: ${error.message}`);
    });
  return imageStoreWrite;
}

async function saveGeneratedImage(payload, { makeDefaultHome = false } = {}) {
  if (!payload?.image_url) return;
  await queueImageStoreUpdate(async (store) => {
    const id = crypto.randomBytes(12).toString("hex");
    const record = {
      id,
      role: makeDefaultHome ? "default-home" : "generated-page",
      scope: "world",
      image_url: payload.image_url,
      image_variants: payload.image_variants || { "16:9": payload.image_url },
      query: payload.query || "",
      page_title: payload.page_title || payload.query || "世界视觉页",
      image_model: payload.image_model || "",
      prompt_author_model: payload.prompt_author_model || "",
      authored_prompt: payload.authored_prompt || "",
      final_prompt: payload.final_prompt || "",
      generation_error: payload.generation_error || "",
      session_id: payload.session_id || "",
      created_at: new Date().toISOString()
    };
    store.images.unshift(record);
    if (makeDefaultHome) store.default_home_id = id;
  });
}

async function getDefaultHomeImage() {
  const store = await readImageStore();
  const image = store.images.find((item) => item.id === store.default_home_id && item.scope === "world") || null;
  return image;
}

async function generateWithOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
  const endpoint = OPENAI_IMAGE_ENDPOINT === "chat" ? "chat/completions" : "images/generations";
  const body = OPENAI_IMAGE_ENDPOINT === "chat"
    ? {
        model: OPENAI_IMAGE_MODEL,
        stream: false,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n请直接生成图片，并在响应中返回图片链接。`
          }
        ]
      }
    : {
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        n: 1
      };
  let response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Image generation timed out after ${Math.round(OPENAI_REQUEST_TIMEOUT_MS / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || text || "Image generation failed.");
  }
  const image = data?.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  const chatImage = extractImageFromChatResponse(data);
  if (chatImage) return chatImage;
  return null;
}

function extractImageFromChatResponse(data) {
  const candidates = [];
  const choices = Array.isArray(data?.choices) ? data.choices : [];
  for (const choice of choices) {
    const content = choice?.message?.content;
    if (typeof content === "string") candidates.push(content);
    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part?.text === "string") candidates.push(part.text);
        if (typeof part?.image_url?.url === "string") candidates.push(part.image_url.url);
        if (typeof part?.url === "string") candidates.push(part.url);
        if (typeof part?.b64_json === "string") return `data:image/png;base64,${part.b64_json}`;
      }
    }
  }
  if (typeof data?.content === "string") candidates.push(data.content);
  const jsonText = JSON.stringify(data || {});
  candidates.push(jsonText);
  for (const candidate of candidates) {
    const dataUrl = candidate.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)?.[0];
    if (dataUrl) return dataUrl;
    const url = candidate.match(/https?:\/\/[^\s"'<>\\)]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>\\)]*)?/i)?.[0];
    if (url) return url;
  }
  return "";
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handleGenerate(req, res) {
  const body = await readJson(req);
  const point = extractPoint(body.image) || body.point || { x: 0.5, y: 0.5 };
  const depth = Number(body.depth || 1);
  const isHome = body.mode === "home";
  const userQuery = String(body.query || "").trim();
  const topic = isHome ? WORLD_TOPICS[0] : pickTopic(`${body.parent_query || ""} ${userQuery}`, point);
  const subject = isHome
    ? "世界总览"
    : userQuery || topic.details[Math.floor(Math.max(0, Math.min(0.999, point.x)) * topic.details.length)] || topic.label;
  const title = isHome ? "世界全域视觉导览图" : `${topic.title}：${subject}`;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const homePreviewUrl = isHome ? homeSvgDataUrl() : "";

  sendSse(res, "start", { ok: true });
  sendSse(res, "tap_subject", { subject });
  sendSse(res, "tap_icon", { image_url: homePreviewUrl || svgDataUrl(topic, { title: subject, point, depth }) });

  const preview = {
    image_url: homePreviewUrl || svgDataUrl(topic, { title, point, depth }),
    image_variants: {},
    aspectRatio: "16:9",
    query: subject,
    page_title: title,
    image_model: "local-svg-preview",
    prompt_author_model: "local-router"
  };
  preview.image_variants["16:9"] = preview.image_url;
  sendSse(res, "preview", { aspectRatio: "16:9", imageUrl: preview.image_url });
  sendSse(res, "draft_complete", preview);

  const prompt = isHome
    ? [
        "Create a refined visual guide map of the entire world, as the first page of an infinite visual browser.",
        "Topic: 世界全域视觉导览图.",
        "This must be a broad global overview, not a single-city or single-country scene.",
        "Show an elegant, information-rich world atlas overview with multiple labeled regions: Asia, Europe, Africa, the Americas, Oceania, Arctic/Antarctic, major oceans, mountain ranges, rivers, deserts, cultural routes, and iconic world cities.",
        "Use clear simplified Chinese labels integrated into the artwork. Make the regions clickable-looking through visual hierarchy, but do not draw website UI controls.",
        "Style: elegant Chinese editorial atlas, isometric/top-down, museum plate, calm natural palette, clean ink linework, subtle paper texture, readable composition.",
        "Make it a single finished 16:9 image, no UI chrome, no browser frame."
      ].join("\n")
    : [
        "Create a refined visual atlas page about the real world.",
        `Topic: ${title}.`,
        `The user tapped normalized coordinates x=${point.x.toFixed(2)}, y=${point.y.toFixed(2)} on the previous page; interpret that as a request to explore ${subject}.`,
        "If the user typed a place or theme, follow that request even if it is outside the suggested region.",
        "Style: elegant Chinese editorial atlas, isometric/top-down, museum plate, clear labels in simplified Chinese, calm natural palette, clean ink lines, subtle paper texture.",
        "Include real geographic, cultural, historical, natural, and urban references for the selected part of the world. Make it a single finished 16:9 image, no UI chrome."
      ].join("\n");

  let finalImage = null;
  let imageModel = "local-svg-fallback";
  let generationError = "";
  try {
    finalImage = await generateWithOpenAI(prompt);
    if (finalImage) imageModel = OPENAI_IMAGE_MODEL;
  } catch (error) {
    generationError = error.message || "Image generation failed.";
    sendSse(res, "draft_error", { message: generationError });
  }

  const complete = {
    image_url: finalImage || homePreviewUrl || svgDataUrl(topic, { title, point, depth: depth + 1 }),
    image_variants: {},
    query: subject,
    page_title: title,
    authored_prompt: prompt,
    final_prompt: prompt,
    image_model: imageModel,
    prompt_author_model: "demo-router",
    generation_error: generationError,
    session_id: body.session_id || `session_${crypto.randomUUID()}`
  };
  complete.image_variants["16:9"] = complete.image_url;
  await saveGeneratedImage(complete, { makeDefaultHome: isHome });
  sendSse(res, "complete", complete);
  res.end();
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

function extractPoint(image) {
  if (typeof image !== "string") return null;
  const match = image.match(/tap=([0-9.]+),([0-9.]+)/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function handleNodePost(req, res) {
  const body = await readJson(req);
  const id = crypto.randomBytes(16).toString("hex");
  const node = {
    id,
    parent_id: body.parent_id || null,
    session_id: body.session_id || `session_${crypto.randomUUID()}`,
    query: body.query || "",
    page_title: body.page_title || body.query || "世界视觉页",
    image_variants: body.image_variants || {},
    image_model: body.image_model || "",
    prompt_author_model: body.prompt_author_model || "",
    authored_prompt: body.authored_prompt || "",
    final_prompt: body.final_prompt || "",
    created_at: new Date().toISOString(),
    version: 1
  };
  nodes.set(id, node);
  json(res, { ...node });
}

async function handleNodeGet(id, res) {
  const node = nodes.get(id);
  if (!node) {
    json(res, { error: "Node not found." }, 404);
    return;
  }
  const history = [];
  let current = node;
  while (current) {
    history.unshift(current);
    current = current.parent_id ? nodes.get(current.parent_id) : null;
  }
  json(res, { node, history });
}

async function handleHomeImageGet(res) {
  const image = await getDefaultHomeImage();
  json(res, { image });
}

async function handleGeneratedImagesGet(res) {
  const store = await readImageStore();
  json(res, store);
}

function json(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = url.pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, url.pathname);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    const type = ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    res.end(data);
  } catch {
    const data = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && url.pathname === "/api/iteratively-generate-next-page") {
      await handleGenerate(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/home-image") {
      await handleHomeImageGet(res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/generated-images") {
      await handleGeneratedImagesGet(res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/nodes") {
      await handleNodePost(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/nodes/")) {
      await handleNodeGet(url.pathname.split("/").pop(), res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    if (!res.headersSent) json(res, { error: error.message || "Server error." }, 500);
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`World Flipbook demo: http://localhost:${PORT}`);
  console.log(`Image base URL: ${OPENAI_BASE_URL}`);
  console.log(`Image model: ${OPENAI_IMAGE_MODEL}, endpoint: ${OPENAI_IMAGE_ENDPOINT}, size: ${OPENAI_IMAGE_SIZE}, quality: ${OPENAI_IMAGE_QUALITY}${process.env.OPENAI_API_KEY ? "" : " (fallback SVG mode; set OPENAI_API_KEY to use OpenAI-compatible API)"}`);
});
