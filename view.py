import asyncio
import websockets
import os

async def listen():
    uri = "ws://localhost:9905/c/TheKoreanSavage"
    async with websockets.connect(uri) as websocket:
        while True:
            message = await websocket.recv()
            print(f"Received message: {message}")

# channel is the first arg
# channel = os.sys.argv[1]
asyncio.get_event_loop().run_until_complete(listen())
