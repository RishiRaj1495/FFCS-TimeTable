// ─────────────────────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────────────────────
let selectedColor = '#caf0f8';
let history       = [];
let historyIndex  = -1;
let ctrlSelectedSlots = new Set(); // Ctrl+click → bulk delete

// Subject management
let subjects = [];

// NEW: colour-group selection mode
// When user is in "selection mode", every plain click TOGGLES a slot into/out of
// the pending group (shown in the selected colour). Clicking "Add Subject" commits.
let pendingGroup = new Set(); // Set of slot elements waiting to be assigned

// DOM
const slots          = document.querySelectorAll('.slot');
const colorOptions   = document.querySelectorAll('.color-option');
const colorPalette   = document.getElementById('colorPalette');
const searchInput    = document.getElementById('searchSlot');
const clearSearchBtn = document.getElementById('clearSearch');
const customColorInput = document.getElementById('customColor');
const applyCustomBtn   = document.getElementById('applyCustom');

const newBtn      = document.getElementById('newBtn');
const deleteBtn   = document.getElementById('deleteBtn');
const undoBtn     = document.getElementById('undoBtn');
const redoBtn     = document.getElementById('redoBtn');
const resetBtn    = document.getElementById('resetBtn');
const colorBtn    = document.getElementById('colorBtn');
const downloadBtn = document.getElementById('downloadBtn');

const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileCloseBtn   = document.getElementById('mobileCloseBtn');
const sidebar          = document.getElementById('sidebar');

const downloadModal = document.getElementById('downloadModal');
const closeModal    = document.getElementById('closeModal');
const formatButtons = document.querySelectorAll('.format-btn');

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function init() {
    saveState();
    setupEventListeners();
    setupMobileMenu();
    setupMobileBottomBar();
    loadFromLocalStorage();
    setupSubjectForm();
    renderSubjectsTable();
}

// ─────────────────────────────────────────────────────────────
// MOBILE MENU
// ─────────────────────────────────────────────────────────────
function setupMobileMenu() {
    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openMobileMenu);
    if (mobileCloseBtn)   mobileCloseBtn.addEventListener('click', closeMobileMenu);
    document.addEventListener('click', e => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileMenuToggle) closeMobileMenu();
    });
    document.querySelectorAll('.tool-btn').forEach(btn =>
        btn.addEventListener('click', () => { if (window.innerWidth <= 768) closeMobileMenu(); })
    );
}
function openMobileMenu()  { sidebar.classList.add('active');    document.body.style.overflow = 'hidden'; }
function closeMobileMenu() { sidebar.classList.remove('active'); document.body.style.overflow = 'auto';   }

// ─────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
    colorBtn.addEventListener('click', () => colorPalette.classList.toggle('active'));

    colorOptions.forEach(opt => {
        opt.addEventListener('click', function () {
            colorOptions.forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
            updateColorPreview();
            // Re-preview pending group in new colour
            pendingGroup.forEach(s => {
                s.style.backgroundColor = selectedColor;
                s.style.color           = getContrastColor(selectedColor);
            });
        });
    });

    applyCustomBtn.addEventListener('click', () => {
        selectedColor = customColorInput.value;
        colorOptions.forEach(o => o.classList.remove('selected'));
        updateColorPreview();
        pendingGroup.forEach(s => {
            s.style.backgroundColor = selectedColor;
            s.style.color           = getContrastColor(selectedColor);
        });
    });

    // ── SLOT CLICKS ──────────────────────────────────────────
    slots.forEach(slot => {
        slot.addEventListener('click', function (e) {
            if (this.classList.contains('highlight')) {
                this.classList.remove('highlight');
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+click → bulk-delete multi-select (independent of pending group)
                this.classList.toggle('ctrl-selected');
                if (this.classList.contains('ctrl-selected')) ctrlSelectedSlots.add(this);
                else ctrlSelectedSlots.delete(this);
            } else {
                // Plain click → toggle slot in/out of pending group
                handleSlotToggle(this);
            }
        });

        slot.addEventListener('dblclick', function () {
            // Double-click → clear slot
            clearSlotVisual(this);
            pendingGroup.delete(this);
            saveState();
        });

        slot.addEventListener('blur', () => saveState());

        // Mobile touch: single tap = toggle slot selection (no zoom)
        let touchStartTime = 0;
        slot.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
        }, { passive: true });

        slot.addEventListener('touchend', function(e) {
            const duration = Date.now() - touchStartTime;
            if (duration < 300) {
                // Short tap → treat as click (toggle slot)
                if (e.cancelable) e.preventDefault();
                handleSlotToggle(this);
            }
            // Long tap → allow native text editing
        });
    });

    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);

    newBtn.addEventListener('click', createNew);
    deleteBtn.addEventListener('click', deleteSelected);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    resetBtn.addEventListener('click', reset);
    downloadBtn.addEventListener('click', showDownloadModal);

    closeModal.addEventListener('click', hideDownloadModal);
    downloadModal.addEventListener('click', e => { if (e.target === downloadModal) hideDownloadModal(); });
    formatButtons.forEach(btn => btn.addEventListener('click', function () {
        downloadTimetable(this.dataset.format); hideDownloadModal();
    }));

    document.addEventListener('keydown', handleKeyboardShortcuts);
    window.addEventListener('resize', handleResize);
}
function handleResize() { if (window.innerWidth > 768) { closeMobileMenu(); document.body.style.overflow='auto'; } }

// ─────────────────────────────────────────────────────────────
// MOBILE BOTTOM BAR
// ─────────────────────────────────────────────────────────────
function setupMobileBottomBar() {
    const mobMenuBtn    = document.getElementById('mobMenuBtn');
    const mobUndoBtn    = document.getElementById('mobUndoBtn');
    const mobColorBtn   = document.getElementById('mobColorBtn');
    const mobDownloadBtn = document.getElementById('mobDownloadBtn');
    const mobResetBtn   = document.getElementById('mobResetBtn');

    if (mobMenuBtn)     mobMenuBtn.addEventListener('click',     openMobileMenu);
    if (mobUndoBtn)     mobUndoBtn.addEventListener('click',     undo);
    if (mobColorBtn)    mobColorBtn.addEventListener('click',    () => {
        colorPalette.classList.toggle('active');
        openMobileMenu();
    });
    if (mobDownloadBtn) mobDownloadBtn.addEventListener('click', showDownloadModal);
    if (mobResetBtn)    mobResetBtn.addEventListener('click',    reset);
}

// ─────────────────────────────────────────────────────────────
// PENDING-GROUP SELECTION MODEL
// ─────────────────────────────────────────────────────────────

/**
 * Toggle a slot in/out of the pending group.
 * - If it's already in the pending group → remove it (restore old look).
 * - If it's already committed (has a subject) → clicking it selects ONLY that
 *   subject's colour-group so you can edit all of them at once.
 * - Otherwise → add it to the pending group, paint it the selected colour.
 */
function handleSlotToggle(slot) {
    // Case 1: slot is already in the current pending group → deselect it
    if (pendingGroup.has(slot)) {
        pendingGroup.delete(slot);
        slot.classList.remove('form-selected');
        // Restore to saved subject colour or default
        const saved = subjects.find(s => s.slot === slot.dataset.slot);
        if (saved) {
            slot.style.backgroundColor = saved.color;
            slot.style.color           = getContrastColor(saved.color);
            slot.textContent           = saved.subject;
        } else {
            clearSlotVisual(slot);
        }
        refreshBadgeAndHint();
        return;
    }

    // Case 2: slot belongs to an already-committed subject → load that group for editing
    const existing = subjects.find(s => s.slot === slot.dataset.slot);
    if (existing && pendingGroup.size === 0) {
        // Load all slots that share this subject's colour as the edit group
        loadExistingGroup(existing.color, existing);
        return;
    }

    // Case 3: add slot to pending group
    pendingGroup.add(slot);
    slot.style.backgroundColor = selectedColor;
    slot.style.color           = getContrastColor(selectedColor);
    slot.classList.add('form-selected');

    refreshBadgeAndHint();
    // Focus subject field
    const subjEl = document.getElementById('subjectName');
    if (subjEl && pendingGroup.size === 1) setTimeout(() => subjEl.focus(), 50);
}

/**
 * When clicking an already-filled slot with an empty pending group,
 * load all slots of that subject's colour into the pending group for re-editing.
 */
function loadExistingGroup(color, existingSubject) {
    clearPendingGroup();

    // Find every slot that currently shows this colour
    slots.forEach(s => {
        if (colorsMatch(s.style.backgroundColor, color)) {
            pendingGroup.add(s);
            s.classList.add('form-selected');
        }
    });

    // Pre-fill the form
    document.getElementById('subjectName').value = existingSubject.subject || '';
    document.getElementById('facultyName').value = existingSubject.faculty || '';
    document.getElementById('venueInput').value  = existingSubject.venue   || '';
    document.querySelectorAll('.venue-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.venue === (existingSubject.venue || '').toUpperCase());
    });

    // Match the colour in the palette
    selectedColor = color;
    colorOptions.forEach(o => o.classList.toggle('selected', o.dataset.color === color));
    updateColorPreview();

    refreshBadgeAndHint();
    document.getElementById('addSubjectBtn').disabled = false;
    setTimeout(() => document.getElementById('subjectName').focus(), 50);
}

function clearPendingGroup() {
    pendingGroup.forEach(s => {
        s.classList.remove('form-selected');
        const saved = subjects.find(sub => sub.slot === s.dataset.slot);
        if (saved) {
            s.style.backgroundColor = saved.color;
            s.style.color           = getContrastColor(saved.color);
            const vl = saved.venue ? `<span class="slot-venue-label">${saved.venue}</span>` : '';
            s.innerHTML             = `<span class="slot-subject-label">${saved.subject}</span>${vl}`;
        } else {
            clearSlotVisual(s);
        }
    });
    pendingGroup.clear();
}

function refreshBadgeAndHint() {
    const badge    = document.getElementById('slotBadge');
    const badgeVal = document.getElementById('slotBadgeValue');
    const addBtn   = document.getElementById('addSubjectBtn');
    const hint     = document.getElementById('slotHint');

    if (pendingGroup.size === 0) {
        if (badge)    badge.classList.remove('has-slot');
        if (badgeVal) { badgeVal.textContent = '—'; badgeVal.style.fontSize = ''; }
        if (addBtn)   addBtn.disabled = true;
        if (hint) {
            hint.classList.remove('active-slot');
            hint.innerHTML = `<i class="fas fa-mouse-pointer"></i> Click slots to select them, then fill in details and hit Add Subject.`;
        }
        return;
    }

    const names = Array.from(pendingGroup).map(s => s.dataset.slot);
    if (badge)    badge.classList.add('has-slot');
    if (badgeVal) {
        badgeVal.textContent  = names.join(' + ');
        badgeVal.style.fontSize = names.length > 3 ? '0.78rem' : names.length > 1 ? '1rem' : '';
    }
    if (addBtn)   addBtn.disabled = false;
    if (hint) {
        hint.classList.add('active-slot');
        if (names.length > 1) {
            hint.innerHTML = `<i class="fas fa-layer-group"></i>&nbsp;<strong>${names.length} slots</strong> selected (${names.join(', ')}) — fill once &amp; hit Add.`;
        } else {
            hint.innerHTML = `<i class="fas fa-check-circle"></i>&nbsp;Slot <strong>${names[0]}</strong> selected — fill in details above.`;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// ADD SUBJECT (commits pending group)
// ─────────────────────────────────────────────────────────────
function handleAddSubject() {
    if (pendingGroup.size === 0) {
        alert('Please click slots on the timetable first.');
        return;
    }

    const subjectName = document.getElementById('subjectName').value.trim();
    const facultyName = document.getElementById('facultyName').value.trim();
    const venue       = document.getElementById('venueInput').value.trim();

    if (!subjectName) {
        alert('Please enter a subject name.');
        document.getElementById('subjectName').focus();
        return;
    }

    pendingGroup.forEach(slotEl => {
        const slotId = slotEl.dataset.slot;
        const entry  = { slot: slotId, subject: subjectName, faculty: facultyName, venue, color: selectedColor };
        const idx    = subjects.findIndex(s => s.slot === slotId);
        if (idx >= 0) subjects[idx] = entry; else subjects.push(entry);

        // Commit visual — show subject name + venue inside the slot
        const venueLabel = venue ? `<span class="slot-venue-label">${venue}</span>` : '';
        slotEl.innerHTML             = `<span class="slot-subject-label">${subjectName}</span>${venueLabel}`;
        slotEl.style.backgroundColor = selectedColor;
        slotEl.style.color           = getContrastColor(selectedColor);
        slotEl.classList.remove('form-selected');
    });

    pendingGroup.clear();
    saveState();
    refreshBadgeAndHint();

    // Clear form
    document.getElementById('subjectName').value = '';
    document.getElementById('facultyName').value = '';
    document.getElementById('venueInput').value  = '';
    document.querySelectorAll('.venue-btn').forEach(b => b.classList.remove('active'));

    saveSubjectsToLocalStorage();
    renderSubjectsTable();
}

// ─────────────────────────────────────────────────────────────
// SUBJECT FORM SETUP
// ─────────────────────────────────────────────────────────────
function setupSubjectForm() {
    const addBtn = document.getElementById('addSubjectBtn');
    if (addBtn) addBtn.addEventListener('click', handleAddSubject);

    ['subjectName','facultyName','venueInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddSubject(); });
    });

    document.querySelectorAll('.venue-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const wasActive = this.classList.contains('active');
            document.querySelectorAll('.venue-btn').forEach(b => b.classList.remove('active'));
            if (!wasActive) { this.classList.add('active'); document.getElementById('venueInput').value = this.dataset.venue; }
            else document.getElementById('venueInput').value = '';
        });
    });

    const venueInput = document.getElementById('venueInput');
    if (venueInput) {
        venueInput.addEventListener('input', function () {
            const val = this.value.trim().toUpperCase();
            document.querySelectorAll('.venue-btn').forEach(b => b.classList.toggle('active', b.dataset.venue === val));
        });
    }

    updateColorPreview();
    const savedSubjects = localStorage.getItem('subjectsData');
    if (savedSubjects) { try { subjects = JSON.parse(savedSubjects); } catch(e) { subjects = []; } }
}

function updateColorPreview() {
    const swatch = document.getElementById('colorPreviewSwatch');
    const text   = document.getElementById('colorPreviewText');
    if (swatch) swatch.style.background = selectedColor;
    if (text)   text.textContent        = selectedColor.toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// SUBJECTS TABLE
// ─────────────────────────────────────────────────────────────
// Group subjects by (subject name + color) → merge slots into one row
function getGroupedSubjects() {
    const groups = [];
    const seen   = new Set();
    subjects.forEach((sub, i) => {
        const key = sub.subject + '||' + sub.color;
        if (seen.has(key)) return;
        seen.add(key);
        // Collect all entries with the same subject+color
        const members = subjects
            .map((s, idx) => ({ ...s, _idx: idx }))
            .filter(s => s.subject === sub.subject && s.color === sub.color);
        groups.push({
            subject: sub.subject,
            faculty: sub.faculty,
            venue:   sub.venue,
            color:   sub.color,
            slots:   members.map(m => m.slot),
            indices: members.map(m => m._idx)
        });
    });
    return groups;
}

function deleteSubjectGroup(groupKey) {
    // groupKey = "subjectName||color"
    const [subjectName, color] = groupKey.split('||COLOR||');
    const toRemove = subjects.filter(s => s.subject === subjectName && s.color === color);
    toRemove.forEach(s => {
        const slotEl = document.querySelector(`.slot[data-slot="${s.slot}"]`);
        if (slotEl) clearSlotVisual(slotEl);
    });
    subjects = subjects.filter(s => !(s.subject === subjectName && s.color === color));
    saveState();
    saveSubjectsToLocalStorage();
    renderSubjectsTable();
}

function renderSubjectsTable() {
    const tbody   = document.getElementById('subjectsTableBody');
    const noMsg   = document.getElementById('noSubjectsMsg');
    const countEl = document.getElementById('subjectsCount');
    if (!tbody) return;
    tbody.innerHTML = '';

    const groups = getGroupedSubjects();
    const uniqueCount = groups.length;
    if (countEl) countEl.textContent = `${uniqueCount} subject${uniqueCount !== 1 ? 's' : ''}`;

    if (groups.length === 0) { if (noMsg) noMsg.style.display = 'block'; return; }
    if (noMsg) noMsg.style.display = 'none';

    groups.forEach((grp, i) => {
        const tr = document.createElement('tr');
        // Slots + venue inline: B11+B12+B13 (AB2)
        const slotTags = grp.slots
            .map(s => `<span class="slot-tag">${s}</span>`)
            .join('<span class="slot-joiner">+</span>');
        const venueInline = grp.venue
            ? `<span class="slot-venue-inline">(${grp.venue})</span>`
            : '';
        // Safe key for delete
        const deleteKey = (grp.subject + '||COLOR||' + grp.color).replace(/"/g, '&quot;');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td class="slot-group-cell">${slotTags}${venueInline}</td>
            <td class="subject-name-cell">${grp.subject}</td>
            <td>${grp.faculty || '<span style="color:#b0bec5;">—</span>'}</td>
            <td>${grp.venue ? `<span class="venue-tag">${grp.venue}</span>` : '<span style="color:#b0bec5;">—</span>'}</td>
            <td><span class="color-dot" style="background:${grp.color};" title="${grp.color}"></span></td>
            <td><button class="table-delete-btn" onclick="deleteSubjectGroup('${deleteKey}')"><i class="fas fa-trash"></i> Remove</button></td>`;
        tbody.appendChild(tr);
    });
}

function saveSubjectsToLocalStorage() { localStorage.setItem('subjectsData', JSON.stringify(subjects)); }

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function clearSlotVisual(slotEl) {
    slotEl.style.backgroundColor = '#eaedf4';
    slotEl.style.color           = '#2c3e50';
    slotEl.innerHTML             = '';
    slotEl.classList.remove('highlight','ctrl-selected','form-selected');
}

function getContrastColor(color) {
    let r, g, b;
    if (!color) return '#000000';
    if (color.startsWith('#')) {
        r = parseInt(color.slice(1,3),16); g = parseInt(color.slice(3,5),16); b = parseInt(color.slice(5,7),16);
    } else {
        const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!m) return '#000000';
        r=+m[1]; g=+m[2]; b=+m[3];
    }
    return (0.299*r + 0.587*g + 0.114*b)/255 > 0.5 ? '#000000' : '#ffffff';
}

function colorsMatch(cssColor, hexOrCss) {
    return normalizeToRgb(cssColor) === normalizeToRgb(hexOrCss);
}

function normalizeToRgb(c) {
    if (!c) return '';
    const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return `${m[1]},${m[2]},${m[3]}`;
    if (c.startsWith('#')) {
        const h = c.replace('#','');
        return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
    }
    return c;
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────
function handleSearch(e) {
    const term = e.target.value.toUpperCase().trim();
    let first = null;
    slots.forEach(s => {
        s.classList.remove('highlight');
        if (term && (s.dataset.slot.toUpperCase().includes(term) || s.innerText.toUpperCase().includes(term))) {
            s.classList.add('highlight');
            if (!first) first = s;
        }
    });
    if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
}
function clearSearch() { searchInput.value = ''; slots.forEach(s => s.classList.remove('highlight')); }

// ─────────────────────────────────────────────────────────────
// TOOL ACTIONS
// ─────────────────────────────────────────────────────────────
function createNew() {
    if (confirm('Create a new timetable? This will clear the grid and subject list.')) {
        saveState();
        slots.forEach(s => clearSlotVisual(s));
        ctrlSelectedSlots.clear(); clearPendingGroup(); clearSearch();
        subjects = []; saveSubjectsToLocalStorage(); renderSubjectsTable();
        saveToLocalStorage();
    }
}
function deleteSelected() {
    if (ctrlSelectedSlots.size === 0) { alert('Hold Ctrl/Cmd and click slots to select them for deletion.'); return; }
    saveState();
    ctrlSelectedSlots.forEach(s => clearSlotVisual(s));
    ctrlSelectedSlots.clear(); saveToLocalStorage();
}
function reset() {
    if (confirm('Reset the entire timetable? This will clear all data.')) {
        saveState();
        slots.forEach(s => clearSlotVisual(s));
        ctrlSelectedSlots.clear(); clearPendingGroup(); clearSearch();
        subjects = []; saveSubjectsToLocalStorage(); renderSubjectsTable();
        localStorage.removeItem('timetableData');
    }
}

// ─────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────
function saveState() {
    const state = { slots: Array.from(slots).map(s => ({ content: s.innerHTML, bgColor: s.style.backgroundColor, color: s.style.color })) };
    history = history.slice(0, historyIndex+1);
    history.push(state); historyIndex++;
    if (history.length > 50) { history.shift(); historyIndex--; }
    saveToLocalStorage();
}
function undo() { if (historyIndex > 0) { historyIndex--; restoreState(history[historyIndex]); } else alert('Nothing to undo'); }
function redo() { if (historyIndex < history.length-1) { historyIndex++; restoreState(history[historyIndex]); } else alert('Nothing to redo'); }
function restoreState(state) {
    state.slots.forEach((d,i) => { slots[i].innerHTML=d.content||''; slots[i].style.backgroundColor=d.bgColor||'#eaedf4'; slots[i].style.color=d.color||'#2c3e50'; });
}

// ─────────────────────────────────────────────────────────────
// LOCAL STORAGE
// ─────────────────────────────────────────────────────────────
function saveToLocalStorage() {
    localStorage.setItem('timetableData', JSON.stringify({
        slots: Array.from(slots).map(s => ({ content: s.innerHTML, bgColor: s.style.backgroundColor, color: s.style.color })),
        timestamp: new Date().toISOString()
    }));
}
function loadFromLocalStorage() {
    // Clear everything on fresh page load — timetable grid AND subject list
    slots.forEach(s => clearSlotVisual(s));
    subjects = [];
    saveSubjectsToLocalStorage();
    renderSubjectsTable();
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD
// ─────────────────────────────────────────────────────────────
function showDownloadModal() { downloadModal.style.display='flex'; document.body.style.overflow='hidden'; }
function hideDownloadModal() { downloadModal.style.display='none'; document.body.style.overflow='auto';   }

async function downloadTimetable(format) {
    const fn = `FFCS_Timetable_${new Date().toISOString().split('T')[0]}`;
    try {
        if (format==='html') downloadAsHTML(fn);
        else if (format==='pdf') await downloadAsPDF(fn);
        else await downloadAsImage(fn, format==='jpg'?'jpeg':'png');
    } catch(e) { console.error(e); alert('Download failed.'); }
}

function downloadAsHTML(filename) {
    const clone = document.getElementById('timetable').cloneNode(true);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FFCS Timetable</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;background:#acb9d3;display:flex;justify-content:center;min-height:100vh}
.wrapper{background:white;padding:30px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
h1{text-align:center;color:#5670a5;margin-bottom:20px}
table{border-collapse:collapse;width:100%;table-layout:fixed}
th,td{border:2px solid #ddd;padding:8px 4px;text-align:center;font-size:.8rem;word-break:break-word}
th{background:#5670a5;color:white;font-weight:600}
.lunch-column{background:#6e84b2!important;color:white}
.day-column{background:#5670a5!important;color:white!important}
.slot{background:#eaedf4;min-height:45px}
.footer{text-align:center;margin-top:20px;color:#5670a5;font-size:13px}
</style></head><body><div class="wrapper"><h1>FFCS Timetable</h1>${clone.outerHTML}
<div class="footer"><strong>Generated by FFCS Timetable Builder</strong> — Designed by Rishi Raj — ${new Date().toLocaleDateString()}</div>
</div></body></html>`;
    const link = document.createElement('a');
    link.download = filename+'.html';
    link.href = URL.createObjectURL(new Blob([html],{type:'text/html'}));
    link.click(); URL.revokeObjectURL(link.href);
    alert('Downloaded as HTML!');
}

async function downloadAsImage(filename, format) {
    const el  = document.getElementById('timetableCapture');
    const hl  = document.querySelectorAll('.slot.highlight');
    hl.forEach(s => s.classList.add('temp-no-highlight'));
    const canvas = await html2canvas(el,{scale:2,backgroundColor:'#fff',logging:false,useCORS:true});
    hl.forEach(s => s.classList.remove('temp-no-highlight'));
    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.download = `${filename}.${format==='jpeg'?'jpg':'png'}`;
        link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href);
        alert(`Downloaded as ${format.toUpperCase()}!`);
    }, `image/${format}`, 0.95);
}

async function downloadAsPDF(filename) {
    const el = document.getElementById('timetableCapture');
    const hl = document.querySelectorAll('.slot.highlight');
    hl.forEach(s => s.classList.add('temp-no-highlight'));
    const canvas = await html2canvas(el,{scale:2,backgroundColor:'#fff',logging:false,useCORS:true});
    hl.forEach(s => s.classList.remove('temp-no-highlight'));
    const {jsPDF} = window.jspdf;
    const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const w=280, h=(canvas.height*w)/canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',10,10,w,h);
    pdf.save(filename+'.pdf'); alert('Downloaded as PDF!');
}

// ─────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey||e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'z': e.preventDefault(); e.shiftKey?redo():undo(); break;
            case 'y': e.preventDefault(); redo(); break;
            case 'n': e.preventDefault(); createNew(); break;
            case 'd': e.preventDefault(); deleteSelected(); break;
            case 'f': e.preventDefault(); searchInput.focus(); break;
            case 's': e.preventDefault(); saveToLocalStorage(); alert('Saved!'); break;
        }
    }
    if (e.key==='Delete' && ctrlSelectedSlots.size>0) deleteSelected();
    if (e.key==='Escape') {
        if (downloadModal.style.display==='flex') hideDownloadModal();
        if (window.innerWidth<=768 && sidebar.classList.contains('active')) closeMobileMenu();
        clearPendingGroup(); refreshBadgeAndHint();
    }
}

setInterval(saveToLocalStorage, 30000);
window.addEventListener('beforeunload', saveToLocalStorage);
document.addEventListener('DOMContentLoaded', init);
console.log('FFCS Timetable Builder v1.2 — click-to-select multi-slot mode');
