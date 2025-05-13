import sounddevice as sd
import websocket
import numpy as np

# Set your backend WebSocket URL
WS_URL = "ws://localhost:3000/audio"

def on_open(ws):
    def callback(indata, frames, time, status):
        ws.send(indata.tobytes(), opcode=websocket.ABNF.OPCODE_BINARY)
    # Use the correct device for system audio (see below)
    stream = sd.RawInputStream(samplerate=16000, blocksize=4096, dtype='int16', channels=1, callback=callback)
    stream.start()
    ws.stream = stream

def on_close(ws, close_status_code, close_msg):
    ws.stream.stop()
    ws.stream.close()

ws = websocket.WebSocketApp(WS_URL, on_open=on_open, on_close=on_close)
ws.run_forever()
