# Clearpage

An installable web app for ordered, reviewable image transcription. It processes up to 50 JPEG, PNG, or WebP pictures sequentially with Qwen vision on Groq, with an optional second visual verification pass. An optional OpenAI-powered assistant works on extracted text. Review results manually: AI can miss, alter, or hallucinate text, especially with small or unclear writing.

## Run
Requires Node.js 20 or newer. From this folder run `npm start`, then open http://localhost:3000 in Chrome. For installation on another device, deploy the app to a server with HTTPS. Use Chrome's Install icon or menu > Install app. Extraction and the assistant require an internet connection even when installed.

## API keys & privacy
Enter your Groq key and optional OpenAI key in Settings. They are held only in the browser tab's memory, sent with each request to this app's server, and forwarded to the corresponding provider. They are not intentionally written to disk or logged by this app. For a hosted installation, use HTTPS, trust the server operator, and don't deploy a shared unauthenticated instance with shared credentials. Provider data policies, rate limits and charges apply. Groq receives images and drafts; OpenAI receives document text and your question when the assistant is used. Keys, images and text are lost when the tab is reloaded or closed: download your work first. Avoid using sensitive images without reviewing provider policies.

The model IDs are configurable in Settings because providers can change availability. The default Groq vision model is `qwen/qwen3.8-27b`; the OpenAI default is `gpt-4.1-mini`. Your API account needs access to the chosen models.

The app processes one image at a time to avoid overwhelming rate limits, and preserves page order even if you move or reprocess pages. A verification pass makes a second vision call and costs extra; it can still introduce errors. Images are sent at original resolution (max 15 MB each); providers can have their own size limits. For best results use clear, upright, high-resolution photos with good lighting.
