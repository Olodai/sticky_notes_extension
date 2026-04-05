// Load and display all sites with notes
chrome.storage.local.get(null, (result) => {
  displaySites(result);
});

// Listen for storage changes (real-time updates if content.js modifies storage)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    chrome.storage.local.get(null, (result) => {
      displaySites(result);
    });
  }
});

function displaySites(allData) {
  const container = document.getElementById('sitesContainer');
  const searchInput = document.getElementById('searchInput');
  
  // Filter out non-URL keys (if any)
  const sites = Object.entries(allData).filter(([key]) => {
    return key.startsWith('http://') || key.startsWith('https://');
  });

  // Update stats
  document.getElementById('totalSites').textContent = sites.length;
  const totalNotes = sites.reduce((sum, [, notes]) => sum + (Array.isArray(notes) ? notes.length : 0), 0);
  document.getElementById('totalNotes').textContent = totalNotes;

  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>No notes yet</p>
        <small>Visit any website and click the green button to start annotating</small>
      </div>
    `;
    return;
  }

  // Render all sites
  const siteElements = sites.map(([url, notes]) => createSiteElement(url, notes)).join('');
  container.innerHTML = siteElements;

  // Add event listeners to action buttons
  document.querySelectorAll('.site-visit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      chrome.tabs.create({ url, active: true });
    });
  });

  document.querySelectorAll('.site-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        btn.textContent = '✓ Copied';
        setTimeout(() => {
          btn.innerHTML = '<span class="btn-icon">📋</span> Copy URL';
        }, 2000);
      });
    });
  });

  document.querySelectorAll('.site-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (confirm(`Delete all notes for ${new URL(url).hostname}?`)) {
        chrome.storage.local.remove([url], () => {
          chrome.storage.local.get(null, (result) => {
            displaySites(result);
          });
        });
      }
    });
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.site-item').forEach(item => {
      const title = item.querySelector('.site-title').textContent.toLowerCase();
      const url = item.querySelector('.site-url').textContent.toLowerCase();
      const preview = item.querySelector('.site-preview')?.textContent.toLowerCase() || '';
      
      const matches = title.includes(query) || url.includes(query) || preview.includes(query);
      item.style.display = matches ? 'block' : 'none';
    });

    // Show empty state if all filtered out
    const visibleItems = Array.from(document.querySelectorAll('.site-item')).filter(
      item => item.style.display !== 'none'
    );
    
    if (visibleItems.length === 0 && query.length > 0) {
      const existingEmpty = container.querySelector('.empty-state');
      if (!existingEmpty) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
          <div class="empty-icon">🔍</div>
          <p>No results for "${query}"</p>
          <small>Try a different search</small>
        `;
        container.appendChild(emptyDiv);
      }
    }
  });
}

function createSiteElement(url, notes) {
  // Extract domain and title
  let domain, hostname;
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
    hostname = domain.replace('www.', '');
  } catch (e) {
    domain = 'Unknown';
    hostname = 'Unknown';
  }

  const noteCount = Array.isArray(notes) ? notes.length : 0;
  const notePreview = Array.isArray(notes) && notes.length > 0 
    ? notes[0].text.substring(0, 80) + (notes[0].text.length > 80 ? '...' : '')
    : 'No content';

  return `
    <div class="site-item">
      <div class="site-item-header">
        <div class="site-icon">🌐</div>
        <div class="site-info">
          <div class="site-title">${hostname}</div>
          <div class="site-url">${url}</div>
        </div>
        <div class="note-count">${noteCount}</div>
      </div>
      
      <div class="site-preview">${notePreview}</div>
      
      <div class="site-actions">
        <button class="site-action-btn site-visit-btn" data-url="${url}">
          <span class="btn-icon">🔗</span> Visit
        </button>
        <button class="site-action-btn site-copy-btn" data-url="${url}">
          <span class="btn-icon">📋</span> Copy URL
        </button>
        <button class="site-action-btn site-delete-btn delete" data-url="${url}">
          <span class="btn-icon">🗑️</span> Delete
        </button>
      </div>
    </div>
  `;
}

// Export functionality
document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get(null, (allData) => {
    // Filter to only URL keys
    const notesData = Object.entries(allData).reduce((acc, [key, value]) => {
      if (key.startsWith('http://') || key.startsWith('https://')) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Create JSON file
    const dataStr = JSON.stringify(notesData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    // Create download link
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
    chrome.storage.local.clear(() => {
      document.getElementById('sitesContainer').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No notes yet</p>
          <small>Visit any website and click the green button to start annotating</small>
        </div>
      `;
      document.getElementById('totalSites').textContent = '0';
      document.getElementById('totalNotes').textContent = '0';
    });
  }
});
