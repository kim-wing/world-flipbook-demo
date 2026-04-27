# World Flipbook Demo

本地全球视觉浏览 demo。首页会优先读取 `data/generated-images.json` 里的默认「世界全域视觉导览图」；没有默认图时才自动生成。之后点击画面任意区域，会通过 `/api/iteratively-generate-next-page` 发起生成流程，并用 SSE 返回 `tap_subject`、`preview`、`draft_complete`、`complete` 事件。

## Start

```bash
OPENAI_API_KEY="..." \
OPENAI_BASE_URL="https://api.tu-zi.com/v1" \
OPENAI_IMAGE_MODEL="gpt-image-2" \
OPENAI_REQUEST_TIMEOUT_MS="90000" \
npm start
```

可选：

```bash
OPENAI_IMAGE_SIZE="1024x1024"
OPENAI_IMAGE_QUALITY="auto"
```

不设置 `OPENAI_API_KEY` 时会自动使用本地 SVG fallback，方便离线演示。

生成完成的图片都会追加保存到 `data/generated-images.json`，首页生成结果会自动设为新的 `default_home_id`。旧杭州图片会继续留在历史里，但不会作为全球首页默认图使用。

## Notes

- 不要把真实 API key 写进代码或提交到仓库；使用 `.env.example` 作为配置模板。
- `data/generated-images.json` 是本地生成缓存，已被 `.gitignore` 排除；仓库只保留 `data/generated-images.example.json`。
- 实验原理与限制见 [EXPERIMENT.md](./EXPERIMENT.md)。
