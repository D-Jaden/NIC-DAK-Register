//==============================================
// shared.js
// Common utilities for dak_despatch and dak_acquired
//==============================================


//======================================
// DATA UTILITIES
//======================================

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

//========================================
// MOBILE TOOLBAR
//========================================

function toggleMobileMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('active');
}

function toggleDropdown() {
    const container = document.querySelector('.split-btn-container');
    container.classList.toggle('active');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const toolbar = document.getElementById('toolbar');
    const toggle = document.querySelector('.mobile-menu-toggle');
    if (toolbar && toggle && !toolbar.contains(event.target) && !toggle.contains(event.target)) {
        toolbar.classList.remove('active');
    }
});

// Close split-button dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.split-btn-container');
    if (container && !container.contains(event.target)) {
        container.classList.remove('active');
    }
});

//==========================================
// DATE FUNCTIONALITY
//==========================================

function restrictDateInput(input) {
    input.value = input.value.replace(/[^0-9/]/g, '');
    let value = input.value;

    if (value.length === 2 && !value.includes('/')) {
        input.value = value + '/';
    } else if (value.length === 5 && value.split('/').length === 2) {
        input.value = value + '/';
    }

    if (value.length > 10) {
        input.value = value.slice(0, 10);
    }

    if (value.length === 10) {
        const parts = value.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        let isValid = true;
        if (month < 1 || month > 12) isValid = false;
        if (day < 1 || day > 31) isValid = false;
        if ([4,6,9,11].includes(month) && day > 30) isValid = false;
        if (month === 2 && day > 29) isValid = false;
        if (year < 1000 || year > 9999) isValid = false;

        if (!isValid) {
            input.setCustomValidity('Please enter a valid date in dd/mm/yyyy format');
            input.reportValidity();
            input.classList.add('invalid-date');
            input.style.boxShadow = 'inset 0 0 0 2px red';
            input.title = 'Invalid date. Check month (1-12) and day (1-31).';
        } else {
            input.setCustomValidity('');
            input.classList.remove('invalid-date');
            input.style.boxShadow = '';
            input.title = '';
        }
    } else {
        input.setCustomValidity('');
        input.classList.remove('invalid-date');
        input.style.boxShadow = '';
        input.title = '';
    }
}

function isValidDateString(dateStr) {
    if (!dateStr || dateStr.trim() === '') return false;
    if (dateStr.length !== 10) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if ([4,6,9,11].includes(month) && day > 30) return false;
    if (month === 2) {
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        if (day > (isLeapYear ? 29 : 28)) return false;
    }
    if (year < 1000 || year > 9999) return false;
    return true;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date('1900-01-01');
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date('1900-01-01');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
}

//=============================
// SORT DROPDOWN UI
//=============================

function toggleSortMenu(columnKey) {
    const dropId = `sort-${columnKey}`;
    const dropdown = document.getElementById(dropId);
    if (!dropdown) return;

    document.querySelectorAll('.sort-dropdown').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('show');
            d.classList.remove('show-above');
        }
    });

    const wasShown = dropdown.classList.contains('show');
    dropdown.classList.toggle('show');

    if (!wasShown) {
        positionDropdown(dropdown);
    }

    setTimeout(() => {
        const close = e => {
            if (!dropdown.contains(e.target) && !e.target.closest('.hamburger-btn')) {
                dropdown.classList.remove('show');
                dropdown.classList.remove('show-above');
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 0);
}

function positionDropdown(dropdown) {
    const parentTh = dropdown.closest('th');
    if (!parentTh) return;

    const thRect = parentTh.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight || 200;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - thRect.bottom;
    const spaceAbove = thRect.top;

    dropdown.style.right = (window.innerWidth - thRect.right) + 'px';
    dropdown.style.left = 'auto';

    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = (viewportHeight - thRect.top + 2) + 'px';
        dropdown.classList.add('show-above');
    } else {
        dropdown.style.top = (thRect.bottom + 2) + 'px';
        dropdown.style.bottom = 'auto';
        dropdown.classList.remove('show-above');
    }
}

window.addEventListener('resize', () => {
    document.querySelectorAll('.sort-dropdown.show').forEach(dropdown => {
        positionDropdown(dropdown);
    });
});

window.addEventListener('scroll', () => {
    document.querySelectorAll('.sort-dropdown.show').forEach(dropdown => {
        positionDropdown(dropdown);
    });
}, true);

//=============================
// COLUMN SEARCH / FILTER
//=============================

function searchColumn(column) {
    const input = document.querySelector(`input[data-column="${column}"]`);
    if (!input) {
        console.error(`Input not found for column: ${column}`);
        return;
    }

    const searchTerm = input.value.toLowerCase().trim();

    if (searchTerm === '') {
        clearColumnSearch(column);
        return;
    }

    columnFilters[column] = searchTerm;
    applyAllFilters();

    const dropdown = document.getElementById(`sort-${column}`);
    if (dropdown && dropdown.classList.contains('show')) {
        setTimeout(() => { positionDropdown(dropdown); }, 100);
    }
}

function clearColumnSearch(column) {
    const input = document.querySelector(`input[data-column="${column}"]`);
    if (input) input.value = '';
    delete columnFilters[column];
    applyAllFilters();
}

function applyAllFilters() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;

    rows.forEach(row => {
        let showRow = true;

        for (const [column, searchTerm] of Object.entries(columnFilters)) {
            const cellValue = getCellValueByColumn(row, column).toLowerCase();
            if (!cellValue.includes(searchTerm)) {
                showRow = false;
                break;
            }
        }

        if (showRow) {
            row.style.display = '';
            row.classList.add('filtered-row');
            visibleCount++;
        } else {
            row.style.display = 'none';
            row.classList.remove('filtered-row');
        }
    });

    showNoResultsMessage(visibleCount === 0);
}

//=========================
// FONT STYLE AND SIZE
//=========================

function changeFontStyle(selectElement) {
    const selectedFont = selectElement.value;
    const table = document.getElementById("excelTable");
    if (table) {
        table.style.fontFamily = selectedFont;
    }
}

function changeFontSize(selectElement) {
    const size = selectElement.value;
    const table = document.getElementById("excelTable");
    const tdata = document.getElementById("tableBody");
    table.style.fontSize = size;
    tdata.style.fontSize = size;
    const cells = table.querySelectorAll("td, th, .cell, .hindi-cell");
    cells.forEach(cell => cell.style.fontSize = size);
}

//==========================================
// TEXT FORMATTING FUNCTIONS
//==========================================

function initializeTextFormatting() {
    makeTableCellsEditable();
    setupFormattingButtons();
    setupKeyboardShortcuts();
}

function makeTableCellsEditable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }

    const cells = tableBody.querySelectorAll('td');
    cells.forEach(cell => { setupCellEditing(cell); });

    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.tagName === 'TR') {
                    const cells = node.querySelectorAll('td');
                    cells.forEach(cell => { setupCellEditing(cell); });
                }
            });
        });
    });

    observer.observe(tableBody, { childList: true, subtree: true });
}

function applyFormatting(command) {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        if (start === end) {
            alert('Please select text first by dragging your mouse over it');
            return;
        }
        convertTextareaToContentEditable(activeElement, command);
    } else {
        alert('Please click on a cell and select text first');
    }
}

function convertTextareaToContentEditable(textarea, command) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
        alert('Please select text first by dragging your mouse over it');
        return;
    }

    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end);

    const escapedBefore = escapeHtml(beforeText);
    const escapedAfter = escapeHtml(afterText);
    const escapedSelected = escapeHtml(selectedText);

    let formattedText = '';
    switch(command) {
        case 'bold':      formattedText = `${escapedBefore}<strong>${escapedSelected}</strong>${escapedAfter}`; break;
        case 'italic':    formattedText = `${escapedBefore}<em>${escapedSelected}</em>${escapedAfter}`; break;
        case 'underline': formattedText = `${escapedBefore}<u>${escapedSelected}</u>${escapedAfter}`; break;
    }

    const div = document.createElement('div');
    div.contentEditable = true;
    div.className = textarea.className;
    div.innerHTML = formattedText;

    const computedStyle = window.getComputedStyle(textarea);
    div.style.cssText = `
        width: 100%;
        min-height: ${textarea.offsetHeight}px;
        padding: 12px;
        border: none;
        outline: none;
        background: transparent;
        cursor: text;
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        color: ${computedStyle.color};
        resize: vertical;
        overflow-wrap: break-word;
        word-wrap: break-word;
        white-space: pre-wrap;
        line-height: 1.4;
    `;

    div.setAttribute('data-row', textarea.getAttribute('data-row'));
    div.setAttribute('data-field', textarea.getAttribute('data-field'));
    if (textarea.getAttribute('required')) {
        div.setAttribute('required', 'true');
    }

    const parent = textarea.parentNode;
    parent.replaceChild(div, textarea);

    addContentEditableListeners(div);
    div.focus();

    setTimeout(() => {
        const range = document.createRange();
        const sel = window.getSelection();
        const formattedTag = div.querySelector('strong, em, u');
        if (formattedTag && formattedTag.nextSibling) {
            range.setStart(formattedTag.nextSibling, 0);
        } else {
            range.selectNodeContents(div);
            range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }, 10);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyFormattingToContentEditable(command) {
    const selection = window.getSelection();

    if (!selection.rangeCount || selection.isCollapsed) {
        alert('Please select text first by dragging your mouse over it');
        return;
    }

    let element = selection.anchorNode;
    if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
    }

    const contentEditableDiv = element.closest('[contenteditable="true"]');
    if (!contentEditableDiv || !contentEditableDiv.classList.contains('cell')) {
        alert('Please select text in a cell first');
        return;
    }

    saveState();
    document.execCommand(command, false, null);

    const row = parseInt(contentEditableDiv.getAttribute('data-row'));
    const field = contentEditableDiv.getAttribute('data-field');
    if (tableData[row]) {
        tableData[row][field] = contentEditableDiv.innerHTML;
        if (tableData[row].isFromDatabase) {
            changedRows.add(row);
            tableData[row].hasChanges = true;
        } else {
            newRows.add(row);
        }
        updateRowVisualStatus(row);
    }

    contentEditableDiv.focus();
}

function addContentEditableListeners(div) {
    div.addEventListener('focus', function() {
        this.classList.add('editing');
    });

    div.addEventListener('blur', async function() {
        this.classList.remove('editing');
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            if (tableData[row].isFromDatabase) {
                const currentHash = createRowHash(tableData[row]);
                const originalHash = originalData.get(tableData[row].id || row);
                if (currentHash !== originalHash) {
                    changedRows.add(row);
                    tableData[row].hasChanges = true;
                }
            } else {
                newRows.add(row);
            }
            updateRowVisualStatus(row);
        }
    });

    div.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.blur();
            moveToNextCell(this);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.blur();
            moveToNextCell(this);
        }
    });

    div.addEventListener('input', debounce(async function() {
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            if (tableData[row].isFromDatabase) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            } else {
                newRows.add(row);
            }
            updateRowVisualStatus(row);
        }
    }, 300));
}

//====================================
// KEYBOARD SHORTCUTS FOR FORMATTING
//====================================

document.addEventListener('keydown', function(e) {
    const activeElement = document.activeElement;

    const isInCell = activeElement && (
        (activeElement.tagName === 'TEXTAREA' && activeElement.classList.contains('cell')) ||
        (activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) ||
        (activeElement.contentEditable === 'true' && activeElement.classList.contains('cell'))
    );

    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }

    if (!isInCell) return;

    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        if (activeElement.contentEditable === 'true') applyFormattingToContentEditable('bold');
        else applyFormatting('bold');
    }
    if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        if (activeElement.contentEditable === 'true') applyFormattingToContentEditable('italic');
        else applyFormatting('italic');
    }
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        if (activeElement.contentEditable === 'true') applyFormattingToContentEditable('underline');
        else applyFormatting('underline');
    }
});

//============================
// FORMATTING BUTTON LISTENERS
//============================

function attachFormattingListeners() {
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicsBtn');
    const underlineBtn = document.getElementById('underlineBtn');

    const makeHandler = (command) => function(e) {
        e.preventDefault();
        const activeElement = document.activeElement;
        if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
            applyFormattingToContentEditable(command);
        } else if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
            applyFormatting(command);
        } else {
            alert('Please click on a cell and select text first');
        }
    };

    if (boldBtn)      boldBtn.addEventListener('click', makeHandler('bold'));
    if (italicBtn)    italicBtn.addEventListener('click', makeHandler('italic'));
    if (underlineBtn) underlineBtn.addEventListener('click', makeHandler('underline'));
}

//============================================
// UNDO / REDO
//============================================

let undoStack = [];
let redoStacks = [];
const MAX_HISTORY = 50;

function saveState() {
    const currentState = { data: deepClone(tableData), timestamp: Date.now() };
    undoStack.push(currentState);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStacks = [];
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) { alert('Nothing to undo'); return; }
    const currentState = { data: deepClone(tableData), timestamp: Date.now() };
    redoStacks.push(currentState);
    const previousState = undoStack.pop();
    tableData = deepClone(previousState.data);
    rebuildTable();
    updateUndoRedoButtons();
    showNotification('Undo successful', 'info');
}

function redo() {
    if (redoStacks.length === 0) { alert('Nothing to redo'); return; }
    const currentState = { data: deepClone(tableData), timestamp: Date.now() };
    undoStack.push(currentState);
    const nextState = redoStacks.pop();
    tableData = deepClone(nextState.data);
    rebuildTable();
    updateUndoRedoButtons();
    showNotification('Redo successful', 'info');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '1';
        undoBtn.style.cursor = undoStack.length === 0 ? 'not-allowed' : 'pointer';
    }
    if (redoBtn) {
        redoBtn.disabled = redoStacks.length === 0;
        redoBtn.style.opacity = redoStacks.length === 0 ? '0.5' : '1';
        redoBtn.style.cursor = redoStacks.length === 0 ? 'not-allowed' : 'pointer';
    }
}

const debouncedSaveState = debounce(saveState, 1000);

//===========================
// NO OF ENTRIES DROPDOWN
//===========================

document.addEventListener('DOMContentLoaded', () => {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const splitBtnContainer = document.querySelector('.split-btn-container');
    const entriesBtn = document.querySelector('.entries-btn');
    const dropdownItems = document.querySelectorAll('.dropdown-menu li a');

    if (!dropdownToggle || !splitBtnContainer) return;

    const toggleEntries = () => {
        splitBtnContainer.classList.toggle('active');
        dropdownToggle.setAttribute('aria-expanded', splitBtnContainer.classList.contains('active'));
    };

    dropdownToggle.addEventListener('click', toggleEntries);
    if (entriesBtn) entriesBtn.addEventListener('click', toggleEntries);

    document.addEventListener('click', (e) => {
        if (!splitBtnContainer.contains(e.target)) {
            splitBtnContainer.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });

    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedValue = parseInt(item.textContent);
            if (entriesBtn) entriesBtn.textContent = selectedValue;
            entriesPerPage = selectedValue;
            currentPage = 1;
            rebuildTable();
            splitBtnContainer.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        });
    });
});

//============================
// ROW NAVIGATION
//============================

function moveToNextCell(currentCell) {
    const allCells = Array.from(document.querySelectorAll('.cell, [contenteditable="true"].cell'));
    const currentIndex = allCells.indexOf(currentCell);

    if (currentIndex < allCells.length - 1) {
        allCells[currentIndex + 1].focus();
    } else {
        addNewRow();
        setTimeout(() => {
            const newCells = Array.from(document.querySelectorAll('.cell, [contenteditable="true"].cell'));
            if (newCells.length > 0) {
                newCells[newCells.length - 7].focus();
            }
        }, 100);
    }
}

//============================
// ROW INSERTION
//============================

function setupRowInsertion() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => { addRowInsertionListeners(row); });
}

function addRowInsertionListeners(row) {
    if (row.querySelector('.insert-row-btn')) return;

    const insertBtn = document.createElement('div');
    insertBtn.className = 'insert-row-btn';
    insertBtn.innerHTML = '+ Insert Row';
    insertBtn.style.display = 'none';

    const lastTd = row.querySelector('td:last-child');
    if (lastTd) {
        lastTd.style.position = 'relative';
        lastTd.appendChild(insertBtn);
    } else {
        row.style.position = 'relative';
        row.appendChild(insertBtn);
    }

    row.addEventListener('mouseenter', function() { insertBtn.style.display = 'block'; });
    row.addEventListener('mouseleave', function() { insertBtn.style.display = 'none'; });
    insertBtn.addEventListener('click', function(e) { e.stopPropagation(); insertRowAfter(row); });
    row.addEventListener('contextmenu', function(e) { e.preventDefault(); showContextMenu(e, row); });
}

function updateRowNumbers() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    const startIdx = (currentPage - 1) * entriesPerPage;
    rows.forEach((row, index) => {
        const rowNumberCell = row.querySelector('.row-number');
        if (rowNumberCell) {
            rowNumberCell.textContent = startIdx + index + 1;
        }
    });
}

function showNoResultsMessage(show) {
    let message = document.getElementById('no-results-message');
    if (show) {
        if (!message) {
            message = document.createElement('tr');
            message.id = 'no-results-message';
            message.innerHTML = '<td colspan="100%" style="text-align: center; padding: 20px; color: #666; font-style: italic;">No matching results found</td>';
            document.getElementById('tableBody').appendChild(message);
        }
    } else {
        if (message) message.remove();
    }
}

function showContextMenu(event, row) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" data-action="insert-above">Insert Row Above</div>
        <div class="context-menu-item" data-action="insert-below">Insert Row Below</div>
        <div class="context-menu-item" data-action="delete-row">Delete Row</div>
    `;

    contextMenu.style.position = 'absolute';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.style.zIndex = '1000';

    document.body.appendChild(contextMenu);

    contextMenu.addEventListener('click', function(e) {
        const action = e.target.getAttribute('data-action');
        const tbody = document.getElementById('tableBody');
        const targetIndex = Array.from(tbody.children).indexOf(row);

        switch(action) {
            case 'insert-above': insertRowAt(targetIndex); break;
            case 'insert-below': insertRowAfter(row); break;
            case 'delete-row':   deleteRow(row, targetIndex); break;
        }
        contextMenu.remove();
    });

    document.addEventListener('click', function removeMenu() {
        contextMenu.remove();
        document.removeEventListener('click', removeMenu);
    });
}

function insertRowAt(index) {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    if (index === 0) insertRowBefore(rows[0]);
    else insertRowAfter(rows[index - 1]);
}

//============================
// SCROLL TO TOP BUTTON
//============================
document.addEventListener('DOMContentLoaded', () => {
    const scrollToTopBtn = document.getElementById("scrollToTopBtn");

    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
                scrollToTopBtn.style.display = "flex";
            } else {
                scrollToTopBtn.style.display = "none";
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});
