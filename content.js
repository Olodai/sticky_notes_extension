// 1. VARIABLES
const currentUrl = window.location.href;
let notes = []; // Array to store all note DOM elements

// 2. INITIALIZATION - Load ALL notes for this URL when page opens
chrome.storage.local.get([currentUrl], (result) => {
  const savedNotes = result[currentUrl] || [];
  
  // Create all saved notes
  savedNotes.forEach(noteData => {
    createNote(noteData);
  });
  
  // Always show button to allow adding more notes
  createFloatingButton();
});

// 3. HELPER FUNCTIONS

// Generate unique ID for each note
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Save all notes to storage
function saveAllNotes() {
  const notesData = notes.map(noteEl => ({
    id: noteEl.dataset.noteId,
    text: noteEl.querySelector('textarea').value,
    top: noteEl.style.top || '100px',
    left: noteEl.style.left || '100px'
  }));
  chrome.storage.local.set({ [currentUrl]: notesData });
}

// 4. UI CREATION FUNCTIONS

function createFloatingButton() {
  // Prevent duplicate buttons
  if (document.getElementById("my-extension-float-btn")) return;
  
  const btn = document.createElement("div");
  btn.id = "my-extension-float-btn";
  btn.innerHTML = "📝";
  
  btn.onclick = () => {
    // Create a new note with unique ID and default position
    const newNoteData = {
      id: generateId(),
      text: "",
      top: "100px",
      left: "100px"
    };
    createNote(newNoteData);
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
    top = "100px", 
    left = "100px" 
  } = safeData;

  // Create the main container (using class instead of ID for multiple notes)
  const noteElement = document.createElement("div");
  noteElement.className = "my-extension-note";
  noteElement.dataset.noteId = id;
  noteElement.style.top = top;
  noteElement.style.left = left;
  noteElement.style.position = "absolute"; // Ensure positioning works
  noteElement.style.zIndex = 999999;
  noteElement.style.width = "280px";
  noteElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  noteElement.style.background = "#fcf687ff";
  noteElement.style.borderRadius = "6px";
  noteElement.style.overflow = "hidden";
  noteElement.style.fontFamily = "sans-serif";

  // Create the header (for dragging)
  const header = document.createElement("div");
  header.className = "my-extension-header";
  header.style.cursor = "move";
  header.style.padding = "6px 8px";
  header.style.display = "flex";
  header.style.justifyContent = "flex-end";

  // Create close button
  const closeBtn = document.createElement("span");
  closeBtn.className = "my-extension-close";
  closeBtn.innerHTML = "X";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => {
    // Remove from notes array and DOM
    notes = notes.filter(n => n !== noteElement);
    noteElement.remove();
    saveAllNotes();
  };
  /*
  const minBtn = document.createElement("span");
  closeBtn.className = "my-extension-min";
  closeBtn.innerHTML = "-";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => {
    // Remove from notes array and DOM
    notes = notes.filter(n => n !== noteElement);
    noteElement.remove();
    saveAllNotes();
  };
  */

  // Create the text area
  const textarea = document.createElement("textarea");
  textarea.className = "my-extension-textarea";
  textarea.value = text;
  textarea.placeholder = "Type your notes here...";
  textarea.style.width = "100%";
  textarea.style.boxSizing = "border-box";
  textarea.style.border = "none";
  textarea.style.padding = "8px";
  textarea.style.resize = "none";
  textarea.style.height = "160px";

  // Save to storage whenever user types
  textarea.addEventListener("input", () => {
    saveAllNotes();
  });

  // Assemble the pieces
  header.appendChild(closeBtn);
  noteElement.appendChild(header);
  noteElement.appendChild(textarea);
  document.body.appendChild(noteElement);

  // Track this note in our array
  notes.push(noteElement);

  // Enable dragging with position saving
  makeDraggable(noteElement, header);
}

// 5. DRAG LOGIC
function makeDraggable(element, dragHandle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  dragHandle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    // Save position when dragging ends
    saveAllNotes();
  }
}
