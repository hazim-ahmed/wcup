from fastapi import APIRouter
from api import YacineTV
import requests
import urllib.parse
from fastapi import Request, Response
from fastapi.responses import StreamingResponse

ytv = YacineTV()
router = APIRouter(tags=["YacineTV"])


@router.get("/categories")
def categories():
    return ytv.get_categories()

@router.get("/proxy")
def proxy(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Referer": "https://x.com/"
    }
    try:
        r = requests.get(url, headers=headers, stream=True)
        if ".m3u8" in url or "mpegurl" in r.headers.get("Content-Type", ""):
            text = r.text
            new_text = ""
            for line in text.splitlines():
                if line.startswith("http"):
                    encoded_url = urllib.parse.quote(line, safe='')
                    new_text += f"/proxy?url={encoded_url}\n"
                elif line and not line.startswith("#"):
                    abs_url = urllib.parse.urljoin(url, line)
                    encoded_url = urllib.parse.quote(abs_url, safe='')
                    new_text += f"/proxy?url={encoded_url}\n"
                else:
                    new_text += f"{line}\n"
            return Response(content=new_text, media_type="application/vnd.apple.mpegurl")
            
        def generate():
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        return StreamingResponse(generate(), media_type=r.headers.get("content-type", "application/octet-stream"))
    except Exception as e:
        return {"error": str(e)}

@router.get("/categories/{category_id}/channels")
def channels(category_id: int):
    return ytv.get_category_channels(category_id)

@router.get("/channel/{channel_id}")
def channel(channel_id: int):
    return ytv.get_channel(channel_id)

@router.get("/events")
def events():
    return ytv.get_events()

@router.get("/event/{event_id}")
def event(event_id: int):
    return ytv.get_event(event_id)
