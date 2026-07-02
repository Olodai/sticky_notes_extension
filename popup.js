const container = document.getElementById('sitesContainer');
const searchInput = document.getElementById('searchInput');

const EMPTY_STATE_HTML = `
  <div class="empty-state">
    <div class="empty-icon">📝</div>
    <p>No notes yet</p>
    <small>Visit any website and click the green button to start annotating</small>
  </div>
`;

function isNoteUrl(key) {
  return key.startsWith('http://') || key.startsWith('https://');
}

// Escape user-controlled strings (URLs, note text) before inserting into HTML
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function refresh() {
  chrome.storage.local.get(null, displaySites);
}

// Initial render
refresh();

// Re-render on any storage change (notes edited on a page, deletes, clears)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') refresh();
});

function displaySites(allData) {
  const sites = Object.entries(allData).filter(([key]) => isNoteUrl(key));

  // Update stats
  document.getElementById('totalSites').textContent = sites.length;
  const totalNotes = sites.reduce((sum, [, notes]) => sum + (Array.isArray(notes) ? notes.length : 0), 0);
  document.getElementById('totalNotes').textContent = totalNotes;

  if (sites.length === 0) {
    container.innerHTML = EMPTY_STATE_HTML;
    return;
  }

  container.innerHTML = sites.map(([url, notes]) => createSiteElement(url, notes)).join('');

  // Keep the current search filter applied across re-renders
  applySearchFilter();
}

function createSiteElement(url, notes) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    hostname = 'Unknown';
  }

  const noteCount = Array.isArray(notes) ? notes.length : 0;
  const firstText = noteCount > 0 && typeof notes[0].text === 'string' ? notes[0].text : '';
  const notePreview = firstText
    ? firstText.substring(0, 80) + (firstText.length > 80 ? '...' : '')
    : 'No content';

  const safeUrl = escapeHtml(url);

  return `
    <div class="site-item">
      <div class="site-item-header">
        <div class="site-icon">🌐</div>
        <div class="site-info">
          <div class="site-title">${escapeHtml(hostname)}</div>
          <div class="site-url">${safeUrl}</div>
        </div>
        <div class="note-count">${noteCount}</div>
      </div>

      <div class="site-preview">${escapeHtml(notePreview)}</div>

      <div class="site-actions">
        <button class="site-action-btn site-visit-btn" data-url="${safeUrl}">
          <span class="btn-icon">🔗</span> Visit
        </button>
        <button class="site-action-btn site-copy-btn" data-url="${safeUrl}">
          <span class="btn-icon">📋</span> Copy URL
        </button>
        <button class="site-action-btn site-delete-btn delete" data-url="${safeUrl}">
          <span class="btn-icon">🗑️</span> Delete
        </button>
      </div>
    </div>
  `;
}

// One delegated listener handles Visit / Copy / Delete for every site row
container.addEventListener('click', (e) => {
  const btn = e.target.closest('.site-action-btn');
  if (!btn) return;
  e.stopPropagation();
  const url = btn.dataset.url;

  if (btn.classList.contains('site-visit-btn')) {
    chrome.tabs.create({ url, active: true });
  } else if (btn.classList.contains('site-copy-btn')) {
    navigator.clipboard.writeText(url).then(() => {
      btn.textContent = '✓ Copied';
      setTimeout(() => {
        btn.innerHTML = '<span class="btn-icon">📋</span> Copy URL';
      }, 2000);
    });
  } else if (btn.classList.contains('site-delete-btn')) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch (err) {
      hostname = url;
    }
    if (confirm(`Delete all notes for ${hostname}?`)) {
      chrome.storage.local.remove([url]); // onChanged listener re-renders
    }
  }
});

// Search functionality
searchInput.addEventListener('input', applySearchFilter);

function applySearchFilter() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  container.querySelectorAll('.site-item').forEach(item => {
    const haystack = ['.site-title', '.site-url', '.site-preview']
      .map(sel => item.querySelector(sel)?.textContent || '')
      .join(' ')
      .toLowerCase();
    const matches = haystack.includes(query);
    item.style.display = matches ? 'block' : 'none';
    if (matches) visibleCount++;
  });

  // Show/update/remove the "no results" state as the query changes
  let emptyDiv = container.querySelector('.search-empty');
  if (visibleCount === 0 && query) {
    if (!emptyDiv) {
      emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state search-empty';
      container.appendChild(emptyDiv);
    }
    emptyDiv.innerHTML = `
      <div class="empty-icon">🔍</div>
      <p>No results for "${escapeHtml(query)}"</p>
      <small>Try a different search</small>
    `;
  } else if (emptyDiv) {
    emptyDiv.remove();
  }
}

// Export functionality
document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get(null, (allData) => {
    const notesData = Object.fromEntries(
      Object.entries(allData).filter(([key]) => isNoteUrl(key))
    );

    const dataBlob = new Blob([JSON.stringify(notesData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
  });
});

// Clear all functionality
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Are you sure? This will delete ALL notes from ALL sites. This cannot be undone.')) {
    chrome.storage.local.clear(); // onChanged listener re-renders
  }
});
