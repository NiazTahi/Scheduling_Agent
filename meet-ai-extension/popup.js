let ws = null;
let audioStream = null;
let audioCtx = null;
let processor = null;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');

startBtn.onclick = async () => {
  if (!chrome.tabCapture || !chrome.tabCapture.capture) {
    statusDiv.textContent = "tabCapture API not available. Please open this popup from a tab.";
    startBtn.disabled = true;
    stopBtn.disabled = true;
    return;
  }
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusDiv.textContent = "Starting transcription...";

  // Capture the current active tab's audio
  chrome.tabCapture.capture({ audio: true, video: false }, stream => {
    if (!stream) {
      statusDiv.textContent = "Audio capture failed.";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      return;
    }
    audioStream = stream;
    ws = new WebSocket('ws://localhost:3000/audio');
    ws.onopen = () => {
      statusDiv.textContent = "Transcribing...";
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);
      processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        const buf = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          buf[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
        }
        ws.send(buf.buffer);
      };
    };
    ws.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.transcript) {
        statusDiv.textContent = data.transcript;
        // Optionally, send to content script for in-page display
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'TRANSCRIPT_UPDATE', data: msg.data });
          }
        });
      }
    };
    ws.onerror = err => {
      statusDiv.textContent = "WebSocket error.";
      console.error('WebSocket error:', err);
    };
    ws.onclose = () => {
      statusDiv.textContent = "Transcription stopped.";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      if (audioCtx) audioCtx.close();
      if (audioStream) audioStream.getTracks().forEach(t => t.stop());
    };
  });
};

stopBtn.onclick = () => {
  if (ws) ws.close();
  if (audioCtx) audioCtx.close();
  if (audioStream) audioStream.getTracks().forEach(t => t.stop());
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusDiv.textContent = "Transcription stopped.";
};

document.getElementById('capture').onclick = () => {
  const status = document.getElementById('status');
  if (!chrome.tabCapture || !chrome.tabCapture.capture) {
    status.textContent = "tabCapture API not available.";
    return;
  }
  chrome.tabCapture.capture({ audio: true, video: false }, stream => {
    if (!stream) {
      status.textContent = "Failed to capture audio.";
      return;
    }
    status.textContent = "Audio stream captured!";
    stream.getTracks().forEach(t => t.stop());
  });
};
