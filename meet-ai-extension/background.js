// background.js
let recorder = null, tabStream = null;

// Single message‐handler function
function handleMessage(msg, sender, sendResponse) {
    // 1) GET_EVENTS: fetch calendar events
    if (msg.type === 'GET_EVENTS') {
      chrome.identity.getAuthToken({ interactive: true }, token => {
        if (chrome.runtime.lastError || !token) {
          sendResponse({ error: chrome.runtime.lastError?.message || 'No token' });
          return;
        }
        const now = encodeURIComponent(new Date().toISOString());
        const url =
          'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
          `?timeMin=${now}&maxResults=5&singleEvents=true&orderBy=startTime`;
        fetch(url, { headers: { Authorization: 'Bearer ' + token } })
          .then(r => r.json())
          .then(data => {
            if (data.error) sendResponse({ error: data.error.message });
            else sendResponse(data.items || []);
          })
          .catch(err => sendResponse({ error: err.toString() }));
      });
      // Because we'll call sendResponse asynchronously:
      return true;
    }
  
    // 2) GET_NOTES: load saved notes
    if (msg.type === 'GET_NOTES') {
      fetch(`http://localhost:3000/api/meeting/${msg.id}/notes`)
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ error: err.toString() }));
      return true;
    }
  
    // 3) SAVE_NOTES: save edited notes
    if (msg.type === 'SAVE_NOTES') {
      fetch(`http://localhost:3000/api/meeting/${msg.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: msg.notes })
      })
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ error: err.toString() }));
      return true;
    }
  
    // 4) GET_AGENDA: fetch AI-suggested agenda
    if (msg.type === 'GET_AGENDA') {
      fetch(`http://localhost:3000/api/meeting/${msg.id}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ error: err.toString() }));
      return true;
    }
    if (msg.type === 'GET_BRIEF') {
        fetch(`http://localhost:3000/api/meeting/${msg.id}/brief`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(r => r.json())
          .then(data => sendResponse(data))
          .catch(err => sendResponse({ error: err.toString() }));
        return true;
      }

  
    // If we get here, we didn't match any msg.type: do nothing
  }
  
  // Register the listener
chrome.runtime.onMessage.addListener(handleMessage);