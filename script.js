// Global Variables
let selectedColor = '#caf0f8';
let history = [];
let historyIndex = -1;
let selectedSlots = new Set();

// DOM Elements
const slots = document.querySelectorAll('.slot');
const colorOptions = document.querySelectorAll('.color-option');
const colorPalette = document.getElementById('colorPalette');
const searchInput = document.getElementById('searchSlot');
const clearSearchBtn = document.getElementById('clearSearch');
const customColorInput = document.getElementById('customColor');
const applyCustomBtn = document.getElementById('applyCustom');

// Tool Buttons
const newBtn = document.getElementById('newBtn');
const deleteBtn = document.getElementById('deleteBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const resetBtn = document.getElementById('resetBtn');
const colorBtn = document.getElementById('colorBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Mobile Menu Elements
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileCloseBtn = document.getElementById('mobileCloseBtn');
const sidebar = document.getElementById('sidebar');

// Download Modal
const downloadModal = document.getElementById('downloadModal');
const closeModal = document.getElementById('closeModal');
const formatButtons = document.querySelectorAll('.format-btn');

// Initialize
function init() {
    saveState();
    setupEventListeners();
    setupMobileMenu();
    loadFromLocalStorage();
}

// Mobile Menu Functions
function setupMobileMenu() {
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', openMobileMenu);
    }
    
    if (mobileCloseBtn) {
        mobileCloseBtn.addEventListener('click', closeMobileMenu);
    }
    
    // Close menu when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== mobileMenuToggle) {
                closeMobileMenu();
            }
        }
    });
    
    // Close mobile menu after clicking any tool button
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
}

function openMobileMenu() {
    sidebar.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    sidebar.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Setup Event Listeners
function setupEventListeners() {
    // Color Palette Toggle
    colorBtn.addEventListener('click', () => {
        colorPalette.classList.toggle('active');
    });

    // Color Selection
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
        });
    });

    // Custom Color
    applyCustomBtn.addEventListener('click', () => {
        selectedColor = customColorInput.value;
        colorOptions.forEach(opt => opt.classList.remove('selected'));
    });

    // Slot Interaction
    slots.forEach(slot => {
        slot.addEventListener('click', function(event) {
            if (this.classList.contains('highlight')) {
                this.classList.remove('highlight');
                return;
            }
            
            if (event.ctrlKey || event.metaKey) {
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    selectedSlots.add(this);
                } else {
                    selectedSlots.delete(this);
                }
            } else {
                this.style.backgroundColor = selectedColor;
                this.style.color = getContrastColor(selectedColor);
                saveState();
            }
        });

        slot.addEventListener('dblclick', function() {
            this.style.backgroundColor = '#eaedf4';
            this.style.color = '#2c3e50';
            this.textContent = '';
            this.classList.remove('highlight');
            saveState();
        });

        slot.addEventListener('blur', function() {
            saveState();
        });
        
        // Touch-friendly for mobile
        slot.addEventListener('touchend', function(e) {
            if (e.cancelable) {
                e.preventDefault();
            }
            this.focus();
        });
    });

    // Search Functionality
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);

    // Tool Buttons
    newBtn.addEventListener('click', createNew);
    deleteBtn.addEventListener('click', deleteSelected);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    resetBtn.addEventListener('click', reset);
    downloadBtn.addEventListener('click', showDownloadModal);

    // Download Modal
    closeModal.addEventListener('click', hideDownloadModal);
    downloadModal.addEventListener('click', function(e) {
        if (e.target === downloadModal) {
            hideDownloadModal();
        }
    });

    // Format Selection
    formatButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const format = this.dataset.format;
            downloadTimetable(format);
            hideDownloadModal();
        });
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
}

// Handle Resize
function handleResize() {
    if (window.innerWidth > 768) {
        closeMobileMenu();
        document.body.style.overflow = 'auto';
    }
}

// Download Modal Functions
function showDownloadModal() {
    downloadModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideDownloadModal() {
    downloadModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Search Functionality
function handleSearch(e) {
    const searchTerm = e.target.value.toUpperCase().trim();
    
    slots.forEach(slot => {
        slot.classList.remove('highlight');
        const slotName = slot.dataset.slot.toUpperCase();
        const slotContent = slot.textContent.toUpperCase();
        
        if (searchTerm && (slotName.includes(searchTerm) || slotContent.includes(searchTerm))) {
            slot.classList.add('highlight');
            if (document.querySelector('.slot.highlight') === slot) {
                slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

function clearSearch() {
    searchInput.value = '';
    slots.forEach(slot => slot.classList.remove('highlight'));
}

// Tool Functions
function createNew() {
    if (confirm('Create a new timetable? Current data will be saved to history.')) {
        saveState();
        slots.forEach(slot => {
            slot.style.backgroundColor = '#eaedf4';
            slot.style.color = '#2c3e50';
            slot.textContent = '';
        });
        selectedSlots.clear();
        clearSearch();
        saveToLocalStorage();
    }
}

function deleteSelected() {
    if (selectedSlots.size === 0) {
        alert('Please select slots to delete (hold Ctrl/Cmd and click)');
        return;
    }
    
    saveState();
    selectedSlots.forEach(slot => {
        slot.style.backgroundColor = '#eaedf4';
        slot.style.color = '#2c3e50';
        slot.textContent = '';
        slot.classList.remove('selected');
    });
    selectedSlots.clear();
    saveToLocalStorage();
}

function reset() {
    if (confirm('Reset the entire timetable? This will clear all data.')) {
        saveState();
        slots.forEach(slot => {
            slot.style.backgroundColor = '#eaedf4';
            slot.style.color = '#2c3e50';
            slot.textContent = '';
            slot.classList.remove('selected');
        });
        selectedSlots.clear();
        clearSearch();
        localStorage.removeItem('timetableData');
    }
}

// History Management
function saveState() {
    const state = {
        slots: Array.from(slots).map(slot => ({
            content: slot.textContent,
            bgColor: slot.style.backgroundColor,
            color: slot.style.color
        }))
    };
    
    history = history.slice(0, historyIndex + 1);
    history.push(state);
    historyIndex++;
    
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
    
    saveToLocalStorage();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
    } else {
        alert('Nothing to undo');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
    } else {
        alert('Nothing to redo');
    }
}

function restoreState(state) {
    state.slots.forEach((slotData, index) => {
        slots[index].textContent = slotData.content;
        slots[index].style.backgroundColor = slotData.bgColor || '#eaedf4';
        slots[index].style.color = slotData.color || '#2c3e50';
    });
}

// Local Storage
function saveToLocalStorage() {
    const data = {
        slots: Array.from(slots).map(slot => ({
            content: slot.textContent,
            bgColor: slot.style.backgroundColor,
            color: slot.style.color
        })),
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('timetableData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('timetableData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            data.slots.forEach((slotData, index) => {
                if (slots[index]) {
                    slots[index].textContent = slotData.content || '';
                    slots[index].style.backgroundColor = slotData.bgColor || '#eaedf4';
                    slots[index].style.color = slotData.color || '#2c3e50';
                }
            });
            console.log('Timetable loaded from local storage');
        } catch (error) {
            console.error('Error loading timetable:', error);
        }
    }
}

// Download Timetable with Multiple Formats
async function downloadTimetable(format) {
    const filename = `FFCS_Timetable_${new Date().toISOString().split('T')[0]}`;
    
    try {
        switch(format) {
            case 'html':
                downloadAsHTML(filename);
                break;
            case 'png':
                await downloadAsImage(filename, 'png');
                break;
            case 'jpg':
                await downloadAsImage(filename, 'jpeg');
                break;
            case 'pdf':
                await downloadAsPDF(filename);
                break;
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed. Please try again.');
    }
}

// Download as HTML
function downloadAsHTML(filename) {
    const table = document.getElementById('timetable');
    const clone = table.cloneNode(true);
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>My Timetable - FFCS</title>
    <style>
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 20px; 
            background: #acb9d3;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .wrapper {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            text-align: center;
            color: #5670a5;
            margin-bottom: 20px;
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            background: white;
        }
        th, td { 
            border: 2px solid #ddd; 
            padding: 12px; 
            text-align: center; 
        }
        th { 
            background: #5670a5; 
            color: white; 
            font-weight: 600; 
        }
        .lunch-column { 
            background: #6e84b2 !important; 
            color: white;
        }
        .lunch-small {
            font-size: 0.75rem;
        }
        .day-column { 
            background: #5670a5 !important; 
            color: white !important; 
        }
        .slot {
            background: #eaedf4;
            min-width: 80px;
            min-height: 50px;
            position: relative;
        }
        .slot::before {
            content: attr(data-placeholder);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.5rem;
            font-weight: 700;
            opacity: 0.35;
            color: #2c3e50;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #5670a5;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <h1>FFCS Timetable</h1>
        ${clone.outerHTML}
        <div class="footer">
            <p><strong>Generated by FFCS Timetable Builder</strong></p>
            <p>Designed by Rishi Raj</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.download = `${filename}.html`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    
    alert('Timetable downloaded as HTML successfully!');
}

// Download as Image (PNG/JPG)
async function downloadAsImage(filename, format) {
    const element = document.getElementById('timetableCapture');
    
    // Temporarily remove highlight effects
    const highlightedSlots = document.querySelectorAll('.slot.highlight');
    highlightedSlots.forEach(slot => slot.classList.add('temp-no-highlight'));
    
    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    });
    
    // Restore highlight effects
    highlightedSlots.forEach(slot => slot.classList.remove('temp-no-highlight'));
    
    canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.download = `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        
        alert(`Timetable downloaded as ${format.toUpperCase()} successfully!`);
    }, `image/${format}`, 0.95);
}

// Download as PDF
async function downloadAsPDF(filename) {
    const element = document.getElementById('timetableCapture');
    
    // Temporarily remove highlight effects
    const highlightedSlots = document.querySelectorAll('.slot.highlight');
    highlightedSlots.forEach(slot => slot.classList.add('temp-no-highlight'));
    
    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    });
    
    // Restore highlight effects
    highlightedSlots.forEach(slot => slot.classList.remove('temp-no-highlight'));
    
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });
    
    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
    
    alert('Timetable downloaded as PDF successfully!');
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 'n':
                e.preventDefault();
                createNew();
                break;
            case 'd':
                e.preventDefault();
                deleteSelected();
                break;
            case 'f':
                e.preventDefault();
                searchInput.focus();
                break;
            case 's':
                e.preventDefault();
                saveToLocalStorage();
                alert('Timetable saved!');
                break;
        }
    }
    
    if (e.key === 'Delete' && selectedSlots.size > 0) {
        deleteSelected();
    }
    
    if (e.key === 'Escape') {
        if (downloadModal.style.display === 'flex') {
            hideDownloadModal();
        }
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            closeMobileMenu();
        }
    }
}

// Utility: Get Contrast Color
function getContrastColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Auto-save every 30 seconds
setInterval(() => {
    saveToLocalStorage();
}, 30000);

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Prevent data loss on page unload
window.addEventListener('beforeunload', (e) => {
    saveToLocalStorage();
});

console.log('FFCS Timetable Builder initialized!');
console.log('Platform:', window.innerWidth <= 768 ? 'Mobile' : 'Desktop');
console.log('Keyboard Shortcuts:');
console.log('Ctrl/Cmd + Z: Undo');
console.log('Ctrl/Cmd + Y: Redo');
console.log('Ctrl/Cmd + N: New Timetable');
console.log('Ctrl/Cmd + D: Delete Selected');
console.log('Ctrl/Cmd + F: Focus Search');
console.log('Ctrl/Cmd + S: Save');
console.log('Delete: Delete Selected Slots');
console.log('Escape: Close Modal/Menu');
