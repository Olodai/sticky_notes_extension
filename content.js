// 1. VARIABLES
const currentUrl = window.location.href;
let notes = []; // Array to store all note DOM elements
let saveTimeout = null;

// 2. INITIALIZATION - Load ALL notes for this URL when page opens
chrome.storage.local.get([currentUrl], (result) => {
  (result[currentUrl] || []).forEach(createNote);

  // Always show button to allow adding more notes
  createFloatingButton();
});

// 3. HELPER FUNCTIONS

// Generate unique ID for each note
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Save all notes to storage
function saveAllNotes() {
  const notesData = notes.map(noteEl => ({
    id: noteEl.dataset.noteId,
    text: noteEl.querySelector('textarea').value,
    top: noteEl.style.top,
    left: noteEl.style.left,
    isCollapsed: noteEl.classList.contains('collapsed')
  }));
  chrome.storage.local.set({ [currentUrl]: notesData });
}

// Coalesce rapid changes (e.g. typing) into a single storage write
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveAllNotes, 300);
}

// 4. UI CREATION FUNCTIONS

function createFloatingButton() {
  // Prevent duplicate buttons
  if (document.getElementById("my-extension-float-btn")) return;

  const btn = document.createElement("div");
  btn.id = "my-extension-float-btn";
  btn.textContent = "N";

  btn.onclick = () => {
    const btnRect = btn.getBoundingClientRect();
    // Open the note above and to the left of the button, clamped on-screen
    const newNoteTop = Math.max(10, btnRect.top + window.scrollY - 190) + "px";
    const newNoteLeft = Math.max(10, btnRect.left + window.scrollX - 200) + "px";

    createNote({
      id: generateId(),
      text: "",
      top: newNoteTop,
      left: newNoteLeft
    });
    saveAllNotes();
  };

  document.body.appendChild(btn);
}

function createNote(noteData) {
  // Guard against undefined/malformed input and provide sensible defaults
  const safeData = noteData && typeof noteData === 'object' ? noteData : {};
  const {
    id = generateId(),
    text = "",
    top,
    left,
    isCollapsed = false
  } = safeData;

  // Create the main container (appearance lives in styles.css)
  const noteElement = document.createElement("div");
  noteElement.className = "my-extension-note";
  noteElement.dataset.noteId = id;
  if (top) noteElement.style.top = top;
  if (left) noteElement.style.left = left;
  if (isCollapsed) noteElement.classList.add('collapsed');

  // Create the header (for dragging)
  const header = document.createElement("div");
  header.className = "my-extension-header";

  // Create minimize button
  const minBtn = document.createElement("span");
  minBtn.className = "my-extension-min";
  minBtn.textContent = "-";
  minBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent drag from minimizing/expanding
    noteElement.classList.toggle('collapsed');
    saveAllNotes();
  };

  // Create close button
  const closeBtn = document.createElement("span");
  closeBtn.className = "my-extension-close";
  closeBtn.textContent = "X";
  closeBtn.onclick = () => {
    notes = notes.filter(n => n !== noteElement);
    noteElement.remove();
    saveAllNotes();
  };

  // Create the text area
  const textarea = document.createElement("textarea");
  textarea.className = "my-extension-textarea";
  textarea.value = text;
  textarea.placeholder = "Type your notes here...";
  textarea.addEventListener("input", scheduleSave);

  // Assemble the pieces
  header.appendChild(minBtn);
  header.appendChild(closeBtn);
  noteElement.appendChild(header);
  noteElement.appendChild(textarea);
  document.body.appendChild(noteElement);

  // Track this note in our array
  notes.push(noteElement);

  // Click a collapsed note to expand it
  noteElement.addEventListener('click', (e) => {
    if (noteElement.classList.contains('collapsed')) {
      e.stopPropagation();
      noteElement.classList.remove('collapsed');
      saveAllNotes();
    }
  });

  // Enable dragging with position saving
  makeDraggable(noteElement, header);
}

// 5. DRAG LOGIC
function makeDraggable(element, dragHandle) {
  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onMove = (ev) => {
      ev.preventDefault();
      element.style.top = (element.offsetTop + ev.clientY - lastY) + "px";
      element.style.left = (element.offsetLeft + ev.clientX - lastX) + "px";
      lastX = ev.clientX;
      lastY = ev.clientY;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Save position when dragging ends
      saveAllNotes();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
