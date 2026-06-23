// Global Variables
let selectedColor = '#caf0f8';
let history = [];
let historyIndex = -1;
let selectedSlots = new Set(); // Ctrl+click multi-select for delete

// Subject Management
let subjects = [];
let activeFormSlot = null;      // single slot (plain click)
let activeFormSlots = [];       // all slots in the same-color group

// DOM Elements
const slots = document.querySelectorAll('.slot');
const colorOptions = document.querySelectorAll('.color-option');
const colorPalette = document.getElementById('colorPalette');
const searchInput = document.getElementById('searchSlot');
const clearSearchBtn = document.getElementById('clearSearch');
const customColorInput = document.getElementById('customColor');
const applyCustomBtn = document.getElementById('applyCustom');

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

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileMenuToggle) {
            closeMobileMenu();
        }
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeMobileMenu();
        });
    });
}
function openMobileMenu()  { sidebar.classList.add('active');    document.body.style.overflow = 'hidden'; }
function closeMobileMenu() { sidebar.classList.remove('active'); document.body.style.overflow = 'auto';   }

// ─────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
    colorBtn.addEventListener('click', () => colorPalette.classList.toggle('active'));

    colorOptions.forEach(option => {
        option.addEventListener('click', function () {
            colorOptions.forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
            updateColorPreview();
        });
    });

    applyCustomBtn.addEventListener('click', () => {
        selectedColor = customColorInput.value;
        colorOptions.forEach(o => o.classList.remove('selected'));
        updateColorPreview();
    });

    // ── SLOT CLICK LOGIC ──────────────────────────────────────
    slots.forEach(slot => {
        slot.addEventListener('click', function (e) {
            // Remove highlight (search result) on click
            if (this.classList.contains('highlight')) {
                this.classList.remove('highlight');
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                // Ctrl+click → multi-select for bulk-delete
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    selectedSlots.add(this);
                } else {
                    selectedSlots.delete(this);
                }
            } else {
                // Plain click → open subject form; also pick up same-color siblings
                handleSlotFormClick(this);
            }
        });

        slot.addEventListener('dblclick', function () {
            clearSlotVisual(this);
            saveState();
        });

        slot.addEventListener('blur', () => saveState());

        slot.addEventListener('touchend', function (e) {
            if (e.cancelable) e.preventDefault();
            this.focus();
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

    formatButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            downloadTimetable(this.dataset.format);
            hideDownloadModal();
        });
    });

    document.addEventListener('keydown', handleKeyboardShortcuts);
    window.addEventListener('resize', handleResize);
}

function handleResize() {
    if (window.innerWidth > 768) { closeMobileMenu(); document.body.style.overflow = 'auto'; }
}

// ─────────────────────────────────────────────────────────────
// SAME-COLOR GROUP DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Returns all slot elements that currently have the same background colour
 * as `anchorSlot`. Only coloured slots (not the default #eaedf4) are matched.
 */
function getSameColorGroup(anchorSlot) {
    const bg = anchorSlot.style.backgroundColor;
    const DEFAULT = normalizeRgb('rgb(234, 237, 244)'); // #eaedf4
    const anchor  = normalizeRgb(bg);

    if (!anchor || anchor === DEFAULT) return [anchorSlot]; // uncoloured → just itself

    const group = [];
    slots.forEach(s => {
        if (normalizeRgb(s.style.backgroundColor) === anchor) group.push(s);
    });
    return group.length ? group : [anchorSlot];
}

/** Normalise any rgb(…) / hex string to "r,g,b" for comparison */
function normalizeRgb(color) {
    if (!color) return null;
    // Already rgb(...)
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return `${m[1]},${m[2]},${m[3]}`;
    // Hex
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0,2), 16);
        const g = parseInt(hex.slice(2,4), 16);
        const b = parseInt(hex.slice(4,6), 16);
        return `${r},${g},${b}`;
    }
    return color;
}

// ─────────────────────────────────────────────────────────────
// SUBJECT FORM – SLOT CLICK
// ─────────────────────────────────────────────────────────────
function handleSlotFormClick(slot) {
    // Clear previous group highlights
    clearFormGroupHighlights();

    activeFormSlot  = slot;
    activeFormSlots = getSameColorGroup(slot);   // ← all same-color slots

    // Highlight the whole group
    activeFormSlots.forEach(s => s.classList.add('form-selected'));

    // Slot badge: show primary slot; if group > 1, show count
    const badge    = document.getElementById('slotBadge');
    const badgeVal = document.getElementById('slotBadgeValue');
    if (badge)    badge.classList.add('has-slot');
    if (badgeVal) {
        if (activeFormSlots.length > 1) {
            const slotNames = activeFormSlots.map(s => s.dataset.slot).join(', ');
            badgeVal.textContent = slotNames;
            badgeVal.style.fontSize = activeFormSlots.length > 3 ? '0.85rem' : '1.1rem';
        } else {
            badgeVal.textContent  = slot.dataset.slot;
            badgeVal.style.fontSize = '';
        }
    }

    const addBtn = document.getElementById('addSubjectBtn');
    if (addBtn) addBtn.disabled = false;

    const hint = document.getElementById('slotHint');
    if (hint) {
        hint.classList.add('active-slot');
        if (activeFormSlots.length > 1) {
            const names = activeFormSlots.map(s => s.dataset.slot).join(' + ');
            hint.innerHTML = `<i class="fas fa-layer-group"></i>&nbsp;Group selected: <strong>${names}</strong> — same colour, fill once!`;
        } else {
            hint.innerHTML = `<i class="fas fa-check-circle"></i>&nbsp;Slot <strong>${slot.dataset.slot}</strong> selected — fill in details above.`;
        }
    }

    // Clear form
    document.getElementById('subjectName').value = '';
    document.getElementById('facultyName').value = '';
    document.getElementById('venueInput').value  = '';
    document.querySelectorAll('.venue-btn').forEach(b => b.classList.remove('active'));

    // Pre-fill from existing subject (use anchor slot's data)
    const existing = subjects.find(s => s.slot === slot.dataset.slot);
    if (existing) {
        document.getElementById('subjectName').value = existing.subject || '';
        document.getElementById('facultyName').value = existing.faculty || '';
        document.getElementById('venueInput').value  = existing.venue   || '';
        document.querySelectorAll('.venue-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.venue === (existing.venue || '').toUpperCase());
        });
    }

    setTimeout(() => document.getElementById('subjectName').focus(), 50);
    updateColorPreview();
}

function clearFormGroupHighlights() {
    slots.forEach(s => s.classList.remove('form-selected'));
    activeFormSlot  = null;
    activeFormSlots = [];
}

// ─────────────────────────────────────────────────────────────
// ADD SUBJECT – applies to entire colour group
// ─────────────────────────────────────────────────────────────
function handleAddSubject() {
    if (!activeFormSlot) {
        alert('Please click a slot on the timetable first.');
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

    // Apply to ALL slots in the group
    activeFormSlots.forEach(slotEl => {
        const slotId = slotEl.dataset.slot;
        const entry  = { slot: slotId, subject: subjectName, faculty: facultyName, venue, color: selectedColor };

        const existingIndex = subjects.findIndex(s => s.slot === slotId);
        if (existingIndex >= 0) subjects[existingIndex] = entry;
        else subjects.push(entry);

        slotEl.textContent            = subjectName;
        slotEl.style.backgroundColor  = selectedColor;
        slotEl.style.color            = getContrastColor(selectedColor);
    });

    saveState();
    clearFormGroupHighlights();

    // Reset badge
    const badge    = document.getElementById('slotBadge');
    const badgeVal = document.getElementById('slotBadgeValue');
    if (badge)    badge.classList.remove('has-slot');
    if (badgeVal) { badgeVal.textContent = '—'; badgeVal.style.fontSize = ''; }

    const addBtn = document.getElementById('addSubjectBtn');
    if (addBtn) addBtn.disabled = true;

    const hint = document.getElementById('slotHint');
    if (hint) {
        hint.classList.remove('active-slot');
        hint.innerHTML = `<i class="fas fa-mouse-pointer"></i> Click any slot on the timetable to select it first.`;
    }

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

    ['subjectName', 'facultyName', 'venueInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddSubject(); });
    });

    document.querySelectorAll('.venue-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const wasActive = this.classList.contains('active');
            document.querySelectorAll('.venue-btn').forEach(b => b.classList.remove('active'));
            if (!wasActive) {
                this.classList.add('active');
                document.getElementById('venueInput').value = this.dataset.venue;
            } else {
                document.getElementById('venueInput').value = '';
            }
        });
    });

    const venueInput = document.getElementById('venueInput');
    if (venueInput) {
        venueInput.addEventListener('input', function () {
            const val = this.value.trim().toUpperCase();
            document.querySelectorAll('.venue-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.venue === val);
            });
        });
    }

    updateColorPreview();

    const savedSubjects = localStorage.getItem('subjectsData');
    if (savedSubjects) {
        try { subjects = JSON.parse(savedSubjects); } catch(e) { subjects = []; }
    }
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
function deleteSubject(index) {
    const sub = subjects[index];
    if (!sub) return;
    if (!confirm(`Remove "${sub.subject}" from slot ${sub.slot}?`)) return;

    const slotEl = document.querySelector(`.slot[data-slot="${sub.slot}"]`);
    if (slotEl) clearSlotVisual(slotEl);

    subjects.splice(index, 1);
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
    if (countEl) countEl.textContent = `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`;

    if (subjects.length === 0) {
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    subjects.forEach((sub, i) => {
        const tr = document.createElement('tr');
        const venueBadge = sub.venue
            ? `<span class="venue-tag">${sub.venue}</span>`
            : `<span style="color:#b0bec5;">—</span>`;
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td><span class="slot-tag">${sub.slot}</span></td>
            <td class="subject-name-cell">${sub.subject}</td>
            <td>${sub.faculty || '<span style="color:#b0bec5;">—</span>'}</td>
            <td>${venueBadge}</td>
            <td><span class="color-dot" style="background:${sub.color};" title="${sub.color}"></span></td>
            <td>
                <button class="table-delete-btn" onclick="deleteSubject(${i})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveSubjectsToLocalStorage() {
    localStorage.setItem('subjectsData', JSON.stringify(subjects));
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function clearSlotVisual(slotEl) {
    slotEl.style.backgroundColor = '#eaedf4';
    slotEl.style.color           = '#2c3e50';
    slotEl.textContent           = '';
    slotEl.classList.remove('highlight', 'selected', 'form-selected');
}

function getContrastColor(hexColor) {
    // Handle rgb() strings too
    let r, g, b;
    if (hexColor.startsWith('#')) {
        r = parseInt(hexColor.slice(1,3), 16);
        g = parseInt(hexColor.slice(3,5), 16);
        b = parseInt(hexColor.slice(5,7), 16);
    } else {
        const m = hexColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!m) return '#000000';
        [, r, g, b] = m.map(Number);
    }
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.5 ? '#000000' : '#ffffff';
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────
function handleSearch(e) {
    const term = e.target.value.toUpperCase().trim();
    slots.forEach(slot => {
        slot.classList.remove('highlight');
        if (term && (slot.dataset.slot.toUpperCase().includes(term) ||
                     slot.textContent.toUpperCase().includes(term))) {
            slot.classList.add('highlight');
        }
    });
    const first = document.querySelector('.slot.highlight');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearSearch() {
    searchInput.value = '';
    slots.forEach(s => s.classList.remove('highlight'));
}

// ─────────────────────────────────────────────────────────────
// TOOL ACTIONS
// ─────────────────────────────────────────────────────────────
function createNew() {
    if (confirm('Create a new timetable? Current data will be saved to history.')) {
        saveState();
        slots.forEach(s => clearSlotVisual(s));
        selectedSlots.clear();
        clearSearch();
        subjects = [];
        saveSubjectsToLocalStorage();
        renderSubjectsTable();
        saveToLocalStorage();
    }
}

function deleteSelected() {
    if (selectedSlots.size === 0) {
        alert('Please select slots to delete (hold Ctrl/Cmd and click)');
        return;
    }
    saveState();
    selectedSlots.forEach(slot => clearSlotVisual(slot));
    selectedSlots.clear();
    saveToLocalStorage();
}

function reset() {
    if (confirm('Reset the entire timetable? This will clear all data.')) {
        saveState();
        slots.forEach(s => clearSlotVisual(s));
        selectedSlots.clear();
        clearSearch();
        subjects = [];
        saveSubjectsToLocalStorage();
        renderSubjectsTable();
        localStorage.removeItem('timetableData');
    }
}

// ─────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────
function saveState() {
    const state = {
        slots: Array.from(slots).map(s => ({
            content: s.textContent,
            bgColor: s.style.backgroundColor,
            color:   s.style.color
        }))
    };
    history = history.slice(0, historyIndex + 1);
    history.push(state);
    historyIndex++;
    if (history.length > 50) { history.shift(); historyIndex--; }
    saveToLocalStorage();
}

function undo() {
    if (historyIndex > 0) { historyIndex--; restoreState(history[historyIndex]); }
    else alert('Nothing to undo');
}

function redo() {
    if (historyIndex < history.length - 1) { historyIndex++; restoreState(history[historyIndex]); }
    else alert('Nothing to redo');
}

function restoreState(state) {
    state.slots.forEach((d, i) => {
        slots[i].textContent            = d.content;
        slots[i].style.backgroundColor = d.bgColor || '#eaedf4';
        slots[i].style.color           = d.color   || '#2c3e50';
    });
}

// ─────────────────────────────────────────────────────────────
// LOCAL STORAGE
// ─────────────────────────────────────────────────────────────
function saveToLocalStorage() {
    const data = {
        slots: Array.from(slots).map(s => ({
            content: s.textContent,
            bgColor: s.style.backgroundColor,
            color:   s.style.color
        })),
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('timetableData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('timetableData');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        data.slots.forEach((d, i) => {
            if (!slots[i]) return;
            slots[i].textContent            = d.content || '';
            slots[i].style.backgroundColor = d.bgColor || '#eaedf4';
            slots[i].style.color           = d.color   || '#2c3e50';
        });
    } catch (err) { console.error('Error loading timetable:', err); }
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD
// ─────────────────────────────────────────────────────────────
function showDownloadModal() { downloadModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function hideDownloadModal() { downloadModal.style.display = 'none'; document.body.style.overflow = 'auto';   }

async function downloadTimetable(format) {
    const filename = `FFCS_Timetable_${new Date().toISOString().split('T')[0]}`;
    try {
        switch(format) {
            case 'html': downloadAsHTML(filename); break;
            case 'png':  await downloadAsImage(filename, 'png');   break;
            case 'jpg':  await downloadAsImage(filename, 'jpeg');  break;
            case 'pdf':  await downloadAsPDF(filename);            break;
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('Download failed. Please try again.');
    }
}

function downloadAsHTML(filename) {
    const table = document.getElementById('timetable');
    const clone = table.cloneNode(true);
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>My Timetable - FFCS</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;background:#acb9d3;display:flex;justify-content:center;align-items:center;min-height:100vh}
.wrapper{background:white;padding:30px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
h1{text-align:center;color:#5670a5;margin-bottom:20px}
table{border-collapse:collapse;width:100%}
th,td{border:2px solid #ddd;padding:10px;text-align:center}
th{background:#5670a5;color:white;font-weight:600}
.lunch-column{background:#6e84b2!important;color:white}
.day-column{background:#5670a5!important;color:white!important}
.slot{background:#eaedf4;min-width:70px;min-height:45px}
.footer{text-align:center;margin-top:20px;color:#5670a5;font-size:14px}
</style></head>
<body><div class="wrapper"><h1>FFCS Timetable</h1>${clone.outerHTML}
<div class="footer"><p><strong>Generated by FFCS Timetable Builder</strong></p><p>Designed by Rishi Raj</p><p>Date: ${new Date().toLocaleDateString()}</p></div>
</div></body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    const link = document.createElement('a');
    link.download = `${filename}.html`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    alert('Timetable downloaded as HTML successfully!');
}

async function downloadAsImage(filename, format) {
    const element = document.getElementById('timetableCapture');
    const highlighted = document.querySelectorAll('.slot.highlight');
    highlighted.forEach(s => s.classList.add('temp-no-highlight'));
    const canvas = await html2canvas(element, {scale:2, backgroundColor:'#ffffff', logging:false, useCORS:true});
    highlighted.forEach(s => s.classList.remove('temp-no-highlight'));
    canvas.toBlob(blob => {
        const link = document.createElement('a');
        link.download = `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        alert(`Timetable downloaded as ${format.toUpperCase()} successfully!`);
    }, `image/${format}`, 0.95);
}

async function downloadAsPDF(filename) {
    const element = document.getElementById('timetableCapture');
    const highlighted = document.querySelectorAll('.slot.highlight');
    highlighted.forEach(s => s.classList.add('temp-no-highlight'));
    const canvas = await html2canvas(element, {scale:2, backgroundColor:'#ffffff', logging:false, useCORS:true});
    highlighted.forEach(s => s.classList.remove('temp-no-highlight'));
    const imgData = canvas.toDataURL('image/png');
    const {jsPDF} = window.jspdf;
    const pdf = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
    alert('Timetable downloaded as PDF successfully!');
}

// ─────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); break;
            case 'y': e.preventDefault(); redo();        break;
            case 'n': e.preventDefault(); createNew();   break;
            case 'd': e.preventDefault(); deleteSelected(); break;
            case 'f': e.preventDefault(); searchInput.focus(); break;
            case 's': e.preventDefault(); saveToLocalStorage(); alert('Timetable saved!'); break;
        }
    }
    if (e.key === 'Delete' && selectedSlots.size > 0) deleteSelected();
    if (e.key === 'Escape') {
        if (downloadModal.style.display === 'flex') hideDownloadModal();
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) closeMobileMenu();
        clearFormGroupHighlights();
        // Reset badge & hint
        const badge = document.getElementById('slotBadge');
        const badgeVal = document.getElementById('slotBadgeValue');
        if (badge)    badge.classList.remove('has-slot');
        if (badgeVal) badgeVal.textContent = '—';
        const addBtn = document.getElementById('addSubjectBtn');
        if (addBtn) addBtn.disabled = true;
        const hint = document.getElementById('slotHint');
        if (hint) {
            hint.classList.remove('active-slot');
            hint.innerHTML = `<i class="fas fa-mouse-pointer"></i> Click any slot on the timetable to select it first.`;
        }
    }
}

// Auto-save
setInterval(saveToLocalStorage, 30000);
window.addEventListener('beforeunload', saveToLocalStorage);

document.addEventListener('DOMContentLoaded', init);
console.log('FFCS Timetable Builder v1.1 — same-colour group assignment enabled');
