// ── Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

// ── PWA Install prompt ──
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('visible');
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBanner').classList.remove('visible');
});

document.getElementById('installDismiss')?.addEventListener('click', () => {
  document.getElementById('installBanner').classList.remove('visible');
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner')?.classList.remove('visible');
  deferredInstallPrompt = null;
});

// ── Auto-spin if launched with ?action=spin (shortcut) ──
if (new URLSearchParams(location.search).get('action') === 'spin') {
  window.addEventListener('load', () => setTimeout(fetchRandom, 600));
}

// ── Categories & Settings ──
const CATEGORY_GROUPS = {
  'Mathematics & Logic': ['Mathematics', 'Algebra', 'Calculus', 'Geometry', 'Statistics', 'Logic', 'Number_theory'],
  'People & Self': ['Philosophers', 'Scientists', 'Inventors', 'Mathematicians'],
  'Philosophy & Thinking': ['Philosophy', 'Ethics', 'Epistemology', 'Metaphysics', 'Cognitive_science', 'Aesthetics'],
  'Technology & Sciences': ['Computing', 'Artificial_intelligence', 'Computer_science', 'Software_engineering', 'Electronics', 'Robotics', 'Biotechnology', 'Aerospace_engineering']
};

const CATEGORY_LABELS = {
  Mathematics: 'Mathematics', Algebra: 'Algebra', Calculus: 'Calculus',
  Geometry: 'Geometry', Statistics: 'Statistics', Logic: 'Logic',
  Number_theory: 'Number Theory', Philosophers: 'Philosophers',
  Scientists: 'Scientists', Inventors: 'Inventors', Mathematicians: 'Mathematicians',
  Philosophy: 'Philosophy', Ethics: 'Ethics', Epistemology: 'Epistemology',
  Metaphysics: 'Metaphysics', Cognitive_science: 'Cognitive Science',
  Aesthetics: 'Aesthetics', Computing: 'Computing',
  Artificial_intelligence: 'Artificial Intelligence',
  Computer_science: 'Computer Science', Software_engineering: 'Software Engineering',
  Electronics: 'Electronics', Robotics: 'Robotics',
  Biotechnology: 'Biotechnology', Aerospace_engineering: 'Aerospace Engineering',
};

let userCategories = [];
try { 
  const savedCats = localStorage.getItem('wikiCategories');
  if (savedCats) userCategories = JSON.parse(savedCats);
} catch(_) {}

if (!userCategories.length) {
  userCategories = Object.keys(CATEGORY_GROUPS);
}

function getActiveCategories() {
  let active = [];
  userCategories.forEach(grp => {
    if (CATEGORY_GROUPS[grp]) active.push(...CATEGORY_GROUPS[grp]);
  });
  return active.length ? active : CATEGORY_GROUPS['Technology & Sciences'];
}

// ── Settings UI ──
const settingsModal = document.getElementById('settingsModal');
document.getElementById('settingsBtn')?.addEventListener('click', () => {
  renderSettings();
  settingsModal.classList.add('visible');
});
document.getElementById('settingsClose')?.addEventListener('click', () => {
  settingsModal.classList.remove('visible');
});
settingsModal?.addEventListener('click', e => {
  if (e.target === settingsModal) settingsModal.classList.remove('visible');
});

function renderSettings() {
  const container = document.getElementById('categoryToggles');
  container.innerHTML = Object.keys(CATEGORY_GROUPS).map(grp => `
    <label class="checkbox-label">
      <input type="checkbox" value="${grp}" ${userCategories.includes(grp) ? 'checked' : ''}>
      ${grp}
    </label>
  `).join('');
  
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) userCategories.push(input.value);
      else userCategories = userCategories.filter(c => c !== input.value);
      try { localStorage.setItem('wikiCategories', JSON.stringify(userCategories)); } catch(_) {}
    });
  });
}

// ── Audio & Haptics ──
let audioCtx;
function playTick() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

let spinCount = 0;
const history = [];
let bookmarks = [];
const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Restore state from localStorage
try {
  const savedH = localStorage.getItem('wikiHistory');
  if (savedH) history.push(...JSON.parse(savedH));
  const savedB = localStorage.getItem('wikiBookmarks');
  if (savedB) bookmarks.push(...JSON.parse(savedB));
  
  spinCount = parseInt(localStorage.getItem('wikiSpinCount') || '0');
  if (spinCount > 0) document.getElementById('dice').textContent = dice[spinCount % 6];
  
  if (history.length) renderHistory();
  if (bookmarks.length) renderBookmarks();
} catch (_) {}

document.getElementById('spinBtn').addEventListener('click', fetchRandom);

// Swipe up to spin on mobile
let touchStartY = 0;
document.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', e => {
  const delta = touchStartY - e.changedTouches[0].clientY;
  // Only trigger swipe if not scrolling the article
  if (delta > 80 && !document.getElementById('card').contains(e.target)) fetchRandom();
}, { passive: true });

async function fetchRandom() {
  const btn = document.getElementById('spinBtn');
  const diceEl = document.getElementById('dice');
  const btnText = document.getElementById('btnText');
  const errorMsg = document.getElementById('errorMsg');

  btn.classList.add('loading');
  btnText.textContent = 'Spinning...';
  errorMsg.classList.remove('visible');

  let tickInterval;
  
  try {
    tickInterval = setInterval(() => {
      if (navigator.vibrate) navigator.vibrate([10]);
      playTick();
    }, 120);

    const activeCats = getActiveCategories();
    const category = activeCats[Math.floor(Math.random() * activeCats.length)];
    const categoryLabel = CATEGORY_LABELS[category] || category;

    const catRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmtype=page&cmlimit=100&format=json&origin=*`
    );
    if (!catRes.ok) throw new Error('Category fetch failed');
    const catData = await catRes.json();
    const pages = catData.query?.categorymembers;
    if (!pages || pages.length === 0) throw new Error('No pages found');

    const pick = pages[Math.floor(Math.random() * pages.length)];
    const title = pick.title;

    const sumRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    const summary = sumRes.ok
      ? await sumRes.json()
      : { title, content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` } } };

    const pageRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`
    );
    if (!pageRes.ok) throw new Error('Page fetch failed');
    const html = await pageRes.text();

    clearInterval(tickInterval);
    if (navigator.vibrate) navigator.vibrate([30]); // Final tick
    playTick();

    spinCount++;
    diceEl.textContent = dice[spinCount % 6];
    try { localStorage.setItem('wikiSpinCount', spinCount); } catch (_) {}

    // Save previous to history
    const prevTitleEl = document.getElementById('cardTitle');
    const prevLinkEl  = document.getElementById('cardLink');
    const prevCatEl   = document.getElementById('cardCategory');
    if (spinCount > 1 && prevTitleEl?.textContent) {
      addHistory(prevTitleEl.textContent, prevLinkEl?.href, spinCount - 1, prevCatEl?.textContent);
    }

    renderFullPage(title, summary, html, categoryLabel);

  } catch (e) {
    console.error(e);
    errorMsg.classList.add('visible');
  } finally {
    if (tickInterval) clearInterval(tickInterval);
    btn.classList.remove('loading');
    btnText.textContent = 'Spin again';
  }
}

function renderFullPage(title, summary, rawHtml, categoryLabel) {
  const cardWrap   = document.getElementById('cardWrap');
  const emptyState = document.getElementById('emptyState');
  const card       = document.getElementById('card');

  const wikiPageUrl = summary.content_urls?.desktop?.page ||
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  [
    'style','script','link','meta',
    '.mw-editsection','.reference','.reflist',
    '.mw-references-wrap','#References','.navbox',
    '.vertical-navbox','.sistersitebox','.noprint',
    '.mw-empty-elt','sup',
  ].forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href?.startsWith('./')) {
      a.href = `https://en.wikipedia.org/wiki/${href.slice(2)}`;
      a.target = '_blank'; a.rel = 'noopener';
    } else if (href?.startsWith('#')) {
      a.href = '#';
    } else if (href && !href.startsWith('http')) {
      a.href = `https://en.wikipedia.org${href}`;
      a.target = '_blank'; a.rel = 'noopener';
    } else {
      a.target = '_blank'; a.rel = 'noopener';
    }
  });

  doc.querySelectorAll('img').forEach(img => {
    let src = img.getAttribute('src') || '';
    if (src.startsWith('//')) src = 'https:' + src;
    img.src = src; img.loading = 'lazy';
  });

  const bodyContent = doc.querySelector('.mw-parser-output') || doc.querySelector('body');

  const container = document.createElement('div');
  container.className = 'wiki-page';

  const tag = document.createElement('span');
  tag.className = 'wiki-category-tag';
  tag.textContent = categoryLabel;
  container.appendChild(tag);

  const titleEl = document.createElement('h1');
  titleEl.className = 'wiki-title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  const from = document.createElement('p');
  from.className = 'wiki-from';
  from.textContent = 'From Wikipedia, the free encyclopedia';
  container.appendChild(from);

  // ── Actions ──
  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';

  const isBookmarked = bookmarks.some(b => b.title === title);
  const btnBookmark = document.createElement('button');
  btnBookmark.className = `action-btn ${isBookmarked ? 'active' : ''}`;
  btnBookmark.innerHTML = `<span>🔖</span> ${isBookmarked ? 'Saved' : 'Save'}`;
  btnBookmark.onclick = () => {
    toggleBookmark(title, wikiPageUrl, categoryLabel);
    const nowBookmarked = bookmarks.some(b => b.title === title);
    btnBookmark.className = `action-btn ${nowBookmarked ? 'active' : ''}`;
    btnBookmark.innerHTML = `<span>🔖</span> ${nowBookmarked ? 'Saved' : 'Save'}`;
  };
  cardActions.appendChild(btnBookmark);

  if (window.speechSynthesis) {
    const btnListen = document.createElement('button');
    btnListen.className = 'action-btn';
    btnListen.innerHTML = `<span>🔊</span> Listen`;
    
    let utterance = null;
    btnListen.onclick = () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        btnListen.innerHTML = `<span>🔊</span> Listen`;
        btnListen.classList.remove('audio-playing');
        return;
      }
      const extract = summary.extract || "No summary available.";
      utterance = new SpeechSynthesisUtterance(extract);
      
      // Make voice sound more human
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Premium') || v.name.includes('Enhanced')))
                     || voices.find(v => v.name === 'Samantha' || v.name === 'Google US English')
                     || voices.find(v => v.lang.startsWith('en-'));
      
      if (bestVoice) utterance.voice = bestVoice;
      utterance.rate = 0.92; // Slightly slower for natural pacing
      utterance.pitch = 1.0;
      utterance.onend = () => {
        btnListen.innerHTML = `<span>🔊</span> Listen`;
        btnListen.classList.remove('audio-playing');
      };
      btnListen.innerHTML = `<span>⏹</span> Stop`;
      btnListen.classList.add('audio-playing');
      speechSynthesis.speak(utterance);
    };
    cardActions.appendChild(btnListen);
  }
  
  if (navigator.share) {
    const btnShare = document.createElement('button');
    btnShare.className = 'action-btn';
    btnShare.innerHTML = `<span>📤</span> Share`;
    btnShare.onclick = () => {
      navigator.share({
        title: `Wiki Roulette: ${title}`,
        text: `I just spun "${title}" on Wiki Roulette!`,
        url: wikiPageUrl
      }).catch(console.error);
    };
    cardActions.appendChild(btnShare);
  }

  container.appendChild(cardActions);

  const hr = document.createElement('hr');
  hr.className = 'wiki-hr';
  container.appendChild(hr);

  if (bodyContent) {
    const content = document.createElement('div');
    content.className = 'wiki-content';
    content.innerHTML = bodyContent.innerHTML;
    container.appendChild(content);
  }

  const footer = document.createElement('div');
  footer.className = 'wiki-footer';
  footer.innerHTML = `<a href="${wikiPageUrl}" target="_blank" rel="noopener">Read full article on Wikipedia →</a>`;
  container.appendChild(footer);

  const meta = document.createElement('div');
  meta.style.display = 'none';
  meta.innerHTML = `
    <span id="cardTitle">${title}</span>
    <a id="cardLink" href="${wikiPageUrl}"></a>
    <span id="cardCategory">${categoryLabel}</span>
  `;
  container.appendChild(meta);

  card.innerHTML = '';
  card.appendChild(container);
  emptyState.style.display = 'none';
  card.style.display = 'block';

  cardWrap.classList.remove('visible');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cardWrap.classList.add('visible');
    cardWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function addHistory(title, url, num, category) {
  if (history.length > 0 && history[0].title === title) return; // prevent dupes
  history.unshift({ title, url, num, category });
  if (history.length > 10) history.pop();
  try { localStorage.setItem('wikiHistory', JSON.stringify(history)); } catch (_) {}
  renderHistory();
}

function renderHistory() {
  document.getElementById('historySection').classList.add('has-items');
  document.getElementById('historyList').innerHTML = history.map(h => `
    <a class="history-item" href="${h.url}" target="_blank" rel="noopener">
      <span class="history-item-num">#${h.num}</span>
      <span class="history-item-text">
        <span class="history-item-title">${h.title}</span>
        <span class="history-item-cat">${h.category}</span>
      </span>
    </a>
  `).join('');
}

// ── Bookmarks ──
function toggleBookmark(title, url, category) {
  const existingIdx = bookmarks.findIndex(b => b.title === title);
  if (existingIdx >= 0) {
    bookmarks.splice(existingIdx, 1);
  } else {
    bookmarks.unshift({ title, url, category });
  }
  try { localStorage.setItem('wikiBookmarks', JSON.stringify(bookmarks)); } catch (_) {}
  renderBookmarks();
}

function renderBookmarks() {
  const section = document.getElementById('bookmarksSection');
  const list = document.getElementById('bookmarksList');
  
  if (!bookmarks.length) {
    list.innerHTML = `<p class="empty-list" id="emptyBookmarks">No saved articles yet.</p>`;
    return;
  }
  
  section.classList.add('has-items');
  list.innerHTML = bookmarks.map(b => `
    <div class="history-item">
      <span class="history-item-text">
        <a href="${b.url}" target="_blank" rel="noopener" class="history-item-title" style="color: inherit; text-decoration: none;">${b.title}</a>
        <span class="history-item-cat">${b.category}</span>
      </span>
      <button class="delete-btn" onclick="removeBookmark('${b.title.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">✕</button>
    </div>
  `).join('');
}

window.removeBookmark = function(title) {
  bookmarks = bookmarks.filter(b => b.title !== title);
  try { localStorage.setItem('wikiBookmarks', JSON.stringify(bookmarks)); } catch (_) {}
  renderBookmarks();
  
  // Update card button if current page is removed from bookmarks
  const activeTitle = document.getElementById('cardTitle')?.textContent;
  if (activeTitle === title) {
    const btn = document.querySelector('.action-btn.active');
    if (btn) {
      btn.className = 'action-btn';
      btn.innerHTML = `<span>🔖</span> Save`;
    }
  }
};