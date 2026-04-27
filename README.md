# World Flipbook Demo

World Flipbook Demo is a visual browsing prototype where every page is a generated image.

Instead of a fixed tile map, the app starts with a world overview and lets you explore by clicking inside the image or typing a theme. Each interaction becomes a new visual page, so the experience feels closer to browsing an illustrated atlas than using a conventional map.

## Highlights

- A single 16:9 image is the page.
- Click any region to continue exploring.
- Type a place or theme to redirect the journey.
- The current image stays visible while the next one loads.
- Generated pages are saved locally so the homepage does not need to regenerate every time.

## Run Locally

```bash
npm start
```

To enable image generation, provide your own API settings:

```bash
OPENAI_API_KEY="your-key" \
OPENAI_BASE_URL="https://api.tu-zi.com/v1" \
OPENAI_IMAGE_MODEL="gpt-image-2" \
OPENAI_REQUEST_TIMEOUT_MS="90000" \
npm start
```

Optional settings:

```bash
OPENAI_IMAGE_SIZE="1024x1024"
OPENAI_IMAGE_QUALITY="auto"
```

Without `OPENAI_API_KEY`, the app still runs using local SVG fallback images.

## How It Works

The browser sends the current page context and click position to a small Node.js server. The server turns that interaction into a prompt and calls an OpenAI-compatible image API. Progress is streamed back with Server-Sent Events, and only the final image replaces the current page.

The default model is `gpt-image-2`.

## Generated Cache

Generated pages are stored locally in `data/generated-images.json`. That file is ignored by Git because it may contain local experiment history and generated image URLs. The repository includes `data/generated-images.example.json` as an empty template.

The homepage uses the saved default image first. If no default image exists, the app generates one and saves it for future visits.

## Safety

- API keys stay in environment variables.
- `.env` is ignored by Git.
- `data/generated-images.json` is ignored by Git.
- The repository includes `.env.example` so other people can configure their own credentials safely.

## More Detail

See [EXPERIMENT.md](./EXPERIMENT.md) for the public experiment notes and design rationale.
