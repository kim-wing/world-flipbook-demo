# World Flipbook Demo

World Flipbook Demo is an experimental visual browser for exploring the world through generated images.

Instead of using a traditional tiled map, every screen is a generated 16:9 image. You start from a world overview, click any region that looks interesting, and the app generates the next visual page from that context. The result feels closer to browsing an illustrated atlas than zooming a normal map.

## What You Can Try

- Start from a global visual guide map.
- Click any area in the image to continue exploring.
- Type a place or theme, such as `Silk Road`, `Iceland`, `Amazon rainforest`, or `Tokyo architecture`.
- Move through generated pages with the breadcrumb history.
- Keep the current image visible while the next one is loading.

## How It Works

The browser sends the current page context and clicked coordinates to a small Node.js server. The server turns that interaction into a prompt and calls an OpenAI-compatible image generation API.

The app uses Server-Sent Events to stream generation stages back to the browser, so the UI can show progress without replacing the current image too early. Only the final generated image becomes the next page.

The default model is:

```text
gpt-image-2
```

The API key is read from environment variables and is never stored in the repository.

## Local Setup

```bash
npm start
```

To use image generation, provide your own API settings:

```bash
OPENAI_API_KEY="your-key" \
OPENAI_BASE_URL="https://api.tu-zi.com/v1" \
OPENAI_IMAGE_MODEL="gpt-image-2" \
OPENAI_REQUEST_TIMEOUT_MS="90000" \
npm start
```

Without `OPENAI_API_KEY`, the app still runs with local SVG fallback images.

## Generated Image Cache

Generated images are saved locally in:

```text
data/generated-images.json
```

That file is ignored by Git because it may contain generated image URLs and local experiment history. The repository includes only this empty example:

```text
data/generated-images.example.json
```

The first generated world overview can be reused as the default home image, so opening the app again does not need to regenerate the homepage.

## Why This Exists

This demo explores a different direction for maps and travel discovery:

- A map can be semantic, not only geometric.
- A click can mean “tell me more about this idea,” not just “zoom in.”
- Generated images can act as navigable pages.
- A visual browsing session can become an expanding tree of places, cultures, landscapes, and stories.

## Current Limitations

- Generated labels and geography may be inaccurate.
- Click handling is still approximate; it does not yet use true image understanding.
- The local JSON store is for demos, not production multi-user storage.
- Remote generated image URLs may expire depending on the API provider.

## Possible Next Steps

- Add vision-based click understanding.
- Store the full exploration tree in a database.
- Add controls for regenerating, pinning, and setting default images.
- Add export/share links for generated routes.
- Create specialized prompt templates for cities, nature, history, architecture, food, and culture.
