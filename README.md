# CCheck Display Dashboard

General dashboard shown near the inspection tray.

## Run

```bash
npm install
npm run dev
```

The page polls:

```text
GET http://127.0.0.1:8000/api/display/latest
```

If the backend is running on another port, create `.env.local`.

```env
VITE_API_BASE_URL=http://127.0.0.1:8001
```

TTS plays once when a new `event_id` arrives with a non-empty `tts_message`.
