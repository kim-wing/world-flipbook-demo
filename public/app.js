const frame = document.querySelector("#frame");
const image = document.querySelector("#mainImage");
const marker = document.querySelector("#tapMarker");
const ripple = document.querySelector("#ripple");
const statusEl = document.querySelector("#status");
const draftCard = document.querySelector("#draftCard");
const draftPhase = document.querySelector("#draftPhase");
const draftText = document.querySelector("#draftText");
const crumbs = document.querySelector("#crumbs");
const form = document.querySelector("#searchForm");
const input = document.querySelector("#queryInput");
const clearButton = document.querySelector("#clearButton");

let entries = [];
let activeIndex = -1;
let operation = 0;
let loadingTicker = null;

const sessionId = `session_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
const loadingLines = [
  "检索全球地理与文化线索",
  "整理大陆、海洋与城市层次",
  "给画面加入中文标注与视觉层级",
  "等待模型返回最终图像"
];

function localInitialImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#d9ebe6"/>
        <stop offset=".58" stop-color="#fff7e8"/>
        <stop offset="1" stop-color="#e7d8bb"/>
      </linearGradient>
      <filter id="grain"><feTurbulence baseFrequency=".75" numOctaves="2"/><feColorMatrix type="saturate" values=".08"/><feComponentTransfer><feFuncA type="table" tableValues="0 .16"/></feComponentTransfer></filter>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <rect width="1280" height="720" fill="#fff" filter="url(#grain)" opacity=".55"/>
    <ellipse cx="640" cy="384" rx="430" ry="236" fill="#9bbfba" opacity=".64"/>
    <path d="M260 372 C344 300 452 296 524 350 C590 400 672 372 748 310 C834 240 960 270 1030 354 C940 428 842 450 716 424 C620 404 544 454 452 450 C366 446 304 416 260 372 Z" fill="#fff8e8" stroke="#1d201b" stroke-width="4"/>
    <path d="M242 560 C395 471 512 504 650 426 C802 340 938 363 1072 454" fill="none" stroke="#d0aa66" stroke-width="20" stroke-linecap="round"/>
    <g fill="#fffaf0" stroke="#1d201b" stroke-width="4">
      <circle cx="360" cy="350" r="44"/>
      <circle cx="540" cy="414" r="36" fill="#d0aa66"/>
      <rect x="704" y="268" width="118" height="76" rx="12"/>
      <rect x="900" y="346" width="128" height="82" rx="12"/>
    </g>
    <text x="72" y="96" font-family="Georgia, serif" font-size="54" fill="#1d201b" font-weight="700">世界全域视觉导览图</text>
    <text x="76" y="142" font-family="PingFang SC, sans-serif" font-size="24" fill="#1d201b" opacity=".72">从大陆、海洋、城市与文明线索进入全球探索</text>
    <g font-family="PingFang SC, sans-serif" font-size="24" fill="#1d201b" font-weight="700">
      <text x="320" y="424">美洲</text>
      <text x="500" y="492">大西洋</text>
      <text x="712" y="388">欧洲</text>
      <text x="900" y="468">亚洲</text>
      <text x="486" y="270">非洲</text>
      <text x="840" y="570">大洋洲</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function addEntry(payload, { parentId = null, persistEntry = true } = {}) {
  const entry = {
    id: `local_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    parentId,
    title: payload.page_title || payload.query || "世界视觉页",
    query: payload.query || "",
    payload
  };
  entries = entries.slice(0, activeIndex + 1).concat(entry);
  activeIndex = entries.length - 1;
  render();
  if (persistEntry) persist(entry);
}

function render() {
  const entry = entries[activeIndex];
  if (!entry) return;
  image.src = entry.payload.image_url;
  image.alt = entry.title;
  crumbs.innerHTML = "";
  entries.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `crumb${index === activeIndex ? " active" : ""}`;
    button.textContent = item.title;
    button.title = item.title;
    button.addEventListener("click", () => {
      activeIndex = index;
      render();
    });
    crumbs.append(button);
  });
}

async function persist(entry) {
  try {
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_id: entry.parentId,
        session_id: sessionId,
        query: entry.query,
        page_title: entry.title,
        image_variants: entry.payload.image_variants || { "16:9": entry.payload.image_url },
        image_model: entry.payload.image_model,
        prompt_author_model: entry.payload.prompt_author_model,
        authored_prompt: entry.payload.authored_prompt,
        final_prompt: entry.payload.final_prompt
      })
    });
    const data = await response.json();
    if (data.id) entry.nodeId = data.id;
  } catch {
    // Sharing is optional in this demo.
  }
}

function setStatus(text, visible = true) {
  statusEl.textContent = text;
  statusEl.classList.toggle("visible", visible);
}

function setLoading(isLoading) {
  frame.classList.toggle("loading", isLoading);
  draftCard.hidden = !isLoading;
  if (isLoading) {
    startLoadingTicker();
  } else {
    stopLoadingTicker();
    setStatus("", false);
  }
}

function setLoadingStage(stage, phase, text) {
  draftCard.dataset.stage = stage;
  if (phase) draftPhase.textContent = phase;
  if (text) draftText.textContent = text;
}

function startLoadingTicker() {
  stopLoadingTicker();
  let index = 0;
  loadingTicker = window.setInterval(() => {
    if (draftCard.hidden) return;
    const stage = draftCard.dataset.stage;
    if (stage === "render" || stage === "polish") {
      draftText.textContent = loadingLines[index % loadingLines.length];
      index += 1;
    }
  }, 2600);
}

function stopLoadingTicker() {
  if (loadingTicker) {
    window.clearInterval(loadingTicker);
    loadingTicker = null;
  }
}

function imagePointFromEvent(event) {
  const rect = frame.getBoundingClientRect();
  const ratio = 16 / 9;
  let width = rect.width;
  let height = rect.height;
  let offsetX = 0;
  let offsetY = 0;
  if (rect.width / rect.height > ratio) {
    width = rect.height * ratio;
    offsetX = (rect.width - width) / 2;
  } else {
    height = rect.width / ratio;
    offsetY = (rect.height - height) / 2;
  }
  const x = (event.clientX - rect.left - offsetX) / width;
  const y = (event.clientY - rect.top - offsetY) / height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), left: event.clientX - rect.left, top: event.clientY - rect.top };
}

function showTap(point) {
  frame.style.setProperty("--tap-x", `${point.left}px`);
  frame.style.setProperty("--tap-y", `${point.top}px`);
  marker.hidden = false;
  ripple.hidden = false;
  marker.style.left = `${point.left}px`;
  marker.style.top = `${point.top}px`;
  ripple.style.left = `${point.left}px`;
  ripple.style.top = `${point.top}px`;
}

async function streamGenerate(body, parentEntry) {
  const thisOperation = ++operation;
  const isHome = body.mode === "home";
  setLoading(true);
  setStatus(isHome ? "生成世界总导览图..." : "识别点击区域...");
  setLoadingStage("locate", "定位画面", isHome ? "正在生成世界总导览图" : "正在理解你点击的世界细节");

  const response = await fetch("/api/iteratively-generate-next-page", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok || !response.body) {
    throw new Error("生成接口不可用");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  async function handleBlock(block) {
    const lines = block.split("\n");
    let dataLines = [];
    eventName = "message";
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length || thisOperation !== operation) return;
    const data = JSON.parse(dataLines.join("\n"));
    if (eventName === "tap_subject") {
      input.value = data.subject || "";
      setStatus(`正在展开：${data.subject || "选中区域"}`);
      setLoadingStage("compose", "重组语义", `已识别为：${data.subject || "世界细节"}`);
    }
    if (eventName === "preview" && data.imageUrl) {
      setLoadingStage("render", "生成图像", "保持当前画面，等待最终页");
    }
    if (eventName === "draft_complete" && data.image_url) {
      setLoadingStage("polish", "模型成像", "最终图像生成中");
    }
    if (eventName === "draft_error") {
      setLoadingStage("polish", "降级处理", data.message || "图片模型失败，使用本地草稿");
    }
    if (eventName === "complete") {
      setLoadingStage("done", "完成", "正在切换到新页面");
      if (isHome && entries.length === 1 && activeIndex === 0) {
        replaceInitialEntry(data);
      } else {
        addEntry(data, { parentId: parentEntry?.nodeId || parentEntry?.id || null });
      }
      setLoading(false);
      if (data.generation_error) {
        setStatus(`图片接口未返回：${data.generation_error}`, true);
      }
      marker.hidden = true;
      ripple.hidden = true;
      input.value = "";
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let index;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      await handleBlock(block);
    }
    if (done) break;
  }
}

frame.addEventListener("click", async (event) => {
  const point = imagePointFromEvent(event);
  const current = entries[activeIndex];
  if (!point || !current || frame.classList.contains("loading")) return;
  showTap(point);
  try {
    await streamGenerate({
      mode: "tap",
      image: `${current.payload.image_url}#tap=${point.x.toFixed(3)},${point.y.toFixed(3)}`,
      point: { x: point.x, y: point.y },
      aspect_ratio: "16:9",
      parent_query: current.query,
      parent_title: current.title,
      session_id: sessionId,
      current_node_id: current.nodeId || "",
      depth: entries.length + 1
    }, current);
  } catch (error) {
    setLoading(false);
    setStatus(error.message || "生成失败", true);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query || frame.classList.contains("loading")) return;
  const current = entries[activeIndex];
  try {
    await streamGenerate({
      query,
      aspect_ratio: "16:9",
      parent_query: current?.query || "",
      parent_title: current?.title || "",
      session_id: sessionId,
      current_node_id: current?.nodeId || "",
      point: { x: 0.5, y: 0.5 },
      depth: entries.length + 1
    }, current);
  } catch (error) {
    setLoading(false);
    setStatus(error.message || "生成失败", true);
  }
});

clearButton.addEventListener("click", () => {
  entries = [];
  activeIndex = -1;
  operation += 1;
  marker.hidden = true;
  ripple.hidden = true;
  setLoading(false);
  bootstrap();
});

async function loadCachedHomeImage() {
  try {
    const response = await fetch("/api/home-image");
    if (!response.ok) return null;
    const data = await response.json();
    return data.image || null;
  } catch {
    return null;
  }
}

async function bootstrap() {
  const cachedHome = await loadCachedHomeImage();
  if (cachedHome?.image_url) {
    addEntry({
      image_url: cachedHome.image_url,
      image_variants: cachedHome.image_variants || { "16:9": cachedHome.image_url },
      query: cachedHome.query || "世界总览",
      page_title: cachedHome.page_title || "世界全域视觉导览图",
      image_model: cachedHome.image_model || "cached",
      prompt_author_model: cachedHome.prompt_author_model || "stored",
      authored_prompt: cachedHome.authored_prompt || "",
      final_prompt: cachedHome.final_prompt || "",
      generation_error: cachedHome.generation_error || ""
    }, { persistEntry: false });
    setStatus("已载入默认世界导览图", true);
    window.setTimeout(() => setStatus("", false), 1400);
    return;
  }

  addEntry({
    image_url: localInitialImage(),
    image_variants: {},
    query: "世界",
    page_title: "世界全域视觉导览图",
    image_model: "local-svg",
    prompt_author_model: "demo"
  }, { persistEntry: false });
  generateHomeImage();
}

bootstrap();

function replaceInitialEntry(payload) {
  const existing = entries[0] || {};
  const entry = {
    ...existing,
    title: payload.page_title || "世界总导览图",
    query: payload.query || "世界",
    payload
  };
  entries = [entry];
  activeIndex = 0;
  render();
  persist(entry);
}

async function generateHomeImage() {
  if (frame.classList.contains("loading")) return;
  try {
    await streamGenerate({
      mode: "home",
      query: "世界总导览图",
      aspect_ratio: "16:9",
      parent_query: "",
      parent_title: "",
      session_id: sessionId,
      current_node_id: "",
      point: { x: 0.5, y: 0.5 },
      depth: 1
    }, null);
  } catch (error) {
    setLoading(false);
    setStatus(`首页导览图生成失败：${error.message || "未知错误"}`, true);
  }
}
