// inject.js

// 1️⃣ Floating FAB
const fab = document.createElement('button');
fab.id = 'meet-ai-fab';
fab.textContent = '🤖';
Object.assign(fab.style, {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  background: '#ffca28',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  zIndex: 10000,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
});
document.body.appendChild(fab);

// 2️⃣ Modal backdrop + panel
const modal = document.createElement('div');
modal.id = 'meet-ai-modal';
Object.assign(modal.style, {
  display: 'none',
  position: 'fixed',
  top: 0, left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.3)',
  zIndex: 9999,
});
modal.innerHTML = `
  <div id="meet-ai-panel">
    <div style="display:flex;justify-content:flex-end;padding:4px;">
      <button id="meet-ai-close" style="border:none;background:transparent;font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div id="meet-ai-content" style="padding:8px;overflow-y:auto;height:calc(100% - 32px);"></div>
  </div>
`;
document.body.appendChild(modal);

// 3️⃣ Panel CSS
const style = document.createElement('style');
style.textContent = `
  #meet-ai-panel {
    position: absolute;
    top: 0;
    right: -320px;
    width: 320px;
    height: 100%;
    background: #fff;
    box-shadow: -2px 0 8px rgba(0,0,0,0.2);
    transition: right 0.3s ease;
  }
  #meet-ai-modal.open #meet-ai-panel {
    right: 0;
  }
`;
document.head.appendChild(style);

// 4️⃣ Open/close logic
function openModal() {
  modal.style.display = 'block';
  setTimeout(() => modal.classList.add('open'), 20);
  loadAllEventsInto(document.getElementById('meet-ai-content'));
}
function closeModal() {
  modal.classList.remove('open');
  modal.addEventListener('transitionend', () => {
    modal.style.display = 'none';
  }, { once: true });
}
fab.addEventListener('click', openModal);
modal.querySelector('#meet-ai-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

// 5️⃣ Load meetings list
function loadAllEventsInto(container) {
  container.innerHTML = '<p>Loading meetings…</p>';
  chrome.runtime.sendMessage({ type: 'GET_EVENTS' }, resp => {
    if (resp.error || !Array.isArray(resp)) {
      return showLogin(container);
    }
    // Render buttons
    container.innerHTML = '<h4>Upcoming Meetings</h4>';
    resp.forEach(ev => {
      const btn = document.createElement('button');
      btn.textContent = ev.summary || '(No title)';
      btn.style = 'display:block;width:100%;margin:4px 0;padding:6px;';
      btn.onclick = () => showEditorInto(container, ev.id, ev.summary);
      container.appendChild(btn);
    });
  });
}

// 6️⃣ Show login prompt
function showLogin(container) {
  container.innerHTML = '';
  const btn = document.createElement('button');
  btn.textContent = '🔑 Login with Google';
  Object.assign(btn.style, {
    display:'block', margin:'8px auto', padding:'8px', width:'80%'
  });
  btn.onclick = () => {
    window.open('http://localhost:3000/api/auth/url', '_blank');
  };
  container.appendChild(btn);
}

// 7️⃣ Notes editor + actions
function showEditorInto(container, meetingId, title='') {
  container.innerHTML = `<h4>${title||'Notes'}</h4>`;
  // Textarea
  const ta = document.createElement('textarea');
  Object.assign(ta.style, { width:'100%', height:'100px' });
  container.appendChild(ta);

  // Load existing notes
  chrome.runtime.sendMessage(
    { type:'GET_NOTES', id: meetingId },
    resp => { if (!resp.error) ta.value = resp.notes||''; }
  );

  // Buttons row
  const btnRow = document.createElement('div');
  btnRow.style = 'margin:6px 0;display:flex;gap:4px;';
  container.appendChild(btnRow);

  // Save Notes
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Save';
  saveBtn.onclick = () => {
    chrome.runtime.sendMessage(
      { type:'SAVE_NOTES', id: meetingId, notes: ta.value },
      r=> { if(r.success) alert('Notes saved'); }
    );
  };
  btnRow.appendChild(saveBtn);

  // Suggest Agenda
  const agBtn = document.createElement('button');
  agBtn.textContent = '📝 Suggest Agenda';
  agBtn.onclick = () => {
    agBtn.disabled = true;
    chrome.runtime.sendMessage(
      { type:'GET_AGENDA', id: meetingId },
      resp => {
        agBtn.disabled = false;
        if (resp.items) showAgenda(resp.items);
      }
    );
  };
  btnRow.appendChild(agBtn);

  // Generate Brief
  const brBtn = document.createElement('button');
  brBtn.textContent = '📰 Generate Brief';
  brBtn.onclick = () => {
    brBtn.disabled = true;
    chrome.runtime.sendMessage(
      { type:'GET_BRIEF', id: meetingId },
      resp => {
        brBtn.disabled = false;
        if (resp.brief) showBrief(resp.brief);
      }
    );
  };
  btnRow.appendChild(brBtn);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.textContent = '← Back';
  backBtn.onclick = () => loadAllEventsInto(container);
  container.appendChild(backBtn);

  // Containers for results
  const agCon = document.createElement('div'); agCon.id='agendaContainer';
  agCon.style = 'margin-top:8px;';
  container.appendChild(agCon);

  const brCon = document.createElement('div'); brCon.id='briefContainer';
  brCon.style = 'margin-top:8px;';
  container.appendChild(brCon);

  // Helpers to show results
  function showAgenda(items) {
    agCon.innerHTML = '<h4>Suggested Agenda</h4>';
    const ul = document.createElement('ul');
    items.forEach(i => {
      const li = document.createElement('li');
      li.textContent = i;
      ul.appendChild(li);
    });
    agCon.appendChild(ul);
  }
  function showBrief(text) {
    brCon.innerHTML = '<h4>Context Brief</h4>';
    const p = document.createElement('p');
    p.textContent = text;
    brCon.appendChild(p);
  }
}