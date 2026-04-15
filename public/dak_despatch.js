//=========================
//START
//=========================

let rowCount = 0;
let tableData = [];
let entriesPerPage = 6;
let currentPage = 1;
let translationCache = new Map();
const translatableColumns = ['toWhom', 'copySentTo', 'mainAddress', 'place', 'subject', 'sentBy'];

let originalData = new Map();
let changedRows = new Set();
let newRows = new Set();

let columnFilters = {};
let originalTableOrder = []; // for neutral sort

//======================================
//UTILITY FUNCTIONS FOR DATA HANDLING
//======================================

// Create a hash of row data for comparison
function createRowHash(rowData) {
    const relevantData = {
        letterDate: rowData.letterDate || '',
        registrationDate: rowData.registrationDate || '',

        toWhom: rowData.toWhom || '',
        toWhomHindi: rowData.toWhomHindi || '',
        copySentTo: rowData.copySentTo || '',
        copySentToHindi: rowData.copySentToHindi || '',

        mainAddress: rowData.mainAddress || '',
        mainAddressHindi: rowData.mainAddressHindi || '',
        place: rowData.place || '',
        placeHindi: rowData.placeHindi || '',

        subject: rowData.subject || '',
        subjectHindi: rowData.subjectHindi || '',

        sentBy: rowData.sentBy || '',
        sentByHindi: rowData.sentByHindi || '',

        letterNo: rowData.letterNo || '',
        deliveryMethod: rowData.deliveryMethod || '',
        letterLanguage: rowData.letterLanguage || '',
        zone: rowData.zone || ''
    };
    return JSON.stringify(relevantData);
}

//========================================
//MOBILE TOOLBAR
//========================================

// Function to switch to the other page with flip effect
function switchPage(targetPage) {
    // SAVE current table data to sessionStorage before switching
    syncTableDataWithDOM(); // Make sure we have latest data
    sessionStorage.setItem('despatch_preservedTableData', JSON.stringify(tableData));
    sessionStorage.setItem('despatch_preservedRowCount', rowCount.toString());

    localStorage.setItem('flipTo', targetPage);
    const flipContainer = document.getElementById('flipContainer');
    flipContainer.classList.add('flip-out');
    setTimeout(() => {
        window.location.href = targetPage === 'despatch' ? 'dak_despatch.html' : 'dak_acquired.html';
    }, 600);
}

// On page load, check if flip-in animation should be applied
window.addEventListener('load', () => {
    const flipTo = localStorage.getItem('flipTo');
    const currentPage = window.location.pathname.includes('dak_despatch.html') ? 'despatch' : 'acquired';

    if (flipTo === currentPage) {
        const flipContainer = document.getElementById('flipContainer');
        flipContainer.classList.add('flip-in');
        localStorage.removeItem('flipTo');
    }
});

//=============================
//=====SORTING COLUMNS=========
//=============================

//----------------------------------------SORT COLUMN---------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();

    if (order === 'neutral') {
        if (originalTableOrder.length > 0) {
            tableData = originalTableOrder.map(row => ({ ...row }));
        }
        rebuildTable();
        applyAllFilters();
        document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
        return;
    }

    // Separate empty and filled rows
    const filledRows = [];
    const emptyRows = [];

    tableData.forEach((row, index) => {
        const hasData = Object.values(row).some(value =>
            value && value.toString().trim() !== ''
        );
        if (hasData) {
            filledRows.push({ ...row, originalIndex: index });
        } else {
            emptyRows.push({ ...row, originalIndex: index });
        }
    });

    // Sort only filled rows
    filledRows.sort((a, b) => {
        let aValue = a[field] || '';
        let bValue = b[field] || '';

        if (field === 'date') {
            aValue = parseDate(aValue);
            bValue = parseDate(bValue);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
        }

        return order === 'asc' ?
            (aValue > bValue ? 1 : -1) :
            (aValue < bValue ? 1 : -1);
    });

    // Rebuild tableData with filled rows first, then empty rows
    tableData = [...filledRows, ...emptyRows].map(row => {
        const { originalIndex, ...cleanRow } = row;
        return cleanRow;
    });

    rebuildTable();
    applyAllFilters();
    document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
}

//==========================================
//INITIALIZE TABLE
//==========================================
function initializeTable() {

    if (window.tableInitialized) {
        return;
    }
    const preservedData = sessionStorage.getItem('despatch_preservedTableData');
    const preservedRowCount = sessionStorage.getItem('despatch_preservedRowCount');

    if (preservedData && preservedRowCount) {
        tableData = JSON.parse(preservedData);
        rowCount = parseInt(preservedRowCount);
        rebuildTable();

        // Clear the preserved data
        sessionStorage.removeItem('despatch_preservedTableData');
        sessionStorage.removeItem('despatch_preservedRowCount');

        setupRowInsertion();
        attachAllEventListeners();
        window.tableInitialized = true;

        return;
    }

    const userIsAuthenticated = isAuthenticated();

    if (userIsAuthenticated) {
        loadUserData(); // This will handle BOTH cases: existing data OR new user
    } else {
        for (let i = 0; i < 6; i++) {
            addNewRow();
        }
        rebuildTable();
    }

    setupRowInsertion();

    // Add event listeners with null checks
    const addRowBtn = document.querySelector('.add-row-btn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);

    // Save button listener
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToDatabase);
    } else {
        console.error('Save button not found!');
    }
    
    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopImmediatePropagation(); // Prevent event bubbling and duplicate listener execution
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0]; // Gets the class name like 'date', 'whomSent', etc.

            // Map class names to field names
            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy',
                'letterNo': 'letterNo',
                'deliveryMethod': 'deliveryMethod',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone'
            };

            const field = columnMap[column] || column;
            toggleSortMenu(field);
        });
    });

    //============================
    // FORMATTING BUTTON LISTENERS
    //============================

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicsBtn');
    const underlineBtn = document.getElementById('underlineBtn');

    if (boldBtn) {
        boldBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('bold');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('bold');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (italicBtn) {
        italicBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('italic');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('italic');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (underlineBtn) {
        underlineBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('underline');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('underline');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    //============================
    // UNDO/REDO BUTTON LISTENERS
    //============================

    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    if (undoBtn) {
        undoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            undo();
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            redo();
        });
    }

    // Initialize button states
    updateUndoRedoButtons();

    window.tableInitialized = true;
}

//==========================================
// HELPER: ATTACH ALL EVENT LISTENERS
//==========================================

function attachAllEventListeners() {
    // Add event listeners with null checks
    const addRowBtn = document.querySelector('.add-row-btn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);

    // Save button listener
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToDatabase);
    } else {
        console.error('❌ Save button not found!');
    }

    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopImmediatePropagation();
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0];

            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy',
                'letterNo': 'letterNo',
                'deliveryMethod': 'deliveryMethod',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone'
            };

            const field = columnMap[column] || column;
            toggleSortMenu(field);
        });
    });

    //============================
    // FORMATTING BUTTON LISTENERS
    //============================

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicsBtn');
    const underlineBtn = document.getElementById('underlineBtn');

    if (boldBtn) {
        boldBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('bold');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('bold');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (italicBtn) {
        italicBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('italic');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('italic');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (underlineBtn) {
        underlineBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('underline');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('underline');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    //============================
    // UNDO/REDO BUTTON LISTENERS
    //============================

    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    if (undoBtn) {
        undoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            undo();
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            redo();
        });
    }

    updateUndoRedoButtons();
}

//=========================
//FONT STYLE AND SIZE
//=========================

let activeCell = null;

document.getElementById('tableBody').addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (cell && cell.isContentEditable) {
        activeCell = cell;
        cell.focus();
    }
});
let currentEditingCell = null;
//============================================
// TEXT FORMATTING FUNCTIONS
//============================================
document.addEventListener('keydown', function (e) {
    const activeElement = document.activeElement;

    // Check if we're in a cell (textarea, input, or contentEditable)
    const isInCell = activeElement && (
        (activeElement.tagName === 'TEXTAREA' && activeElement.classList.contains('cell')) ||
        (activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) ||
        (activeElement.contentEditable === 'true' && activeElement.classList.contains('cell'))
    );

    // Ctrl+Z for Undo (works globally)
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }

    // Ctrl+Y for Redo (works globally)
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }

    // Formatting shortcuts only work when in a cell
    if (!isInCell) return;

    // Ctrl+B for Bold
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();

        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('bold');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('bold');
        }
    }

    // Ctrl+I for Italic
    if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();

        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('italic');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('italic');
        }
    }

    // Ctrl+U for Underline
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();

        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('underline');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('underline');
        }
    }
});

//============================
// FORMATTING BUTTON LISTENERS
//============================
//============================================
// UNDO/REDO FUNCTIONALITY
//============================================


document.addEventListener('DOMContentLoaded', initializeTable);

//==================================================
//FIND AND REPLACE 
//==================================================

function validateDateLogic(rowData) {
    if (rowData.letterDate && rowData.registrationDate) {
        const letter = parseDate(rowData.letterDate);
        const registered = parseDate(rowData.registrationDate);
        const diffTime = registered.getTime() - letter.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        if (diffDays < 0) {
            return { valid: false, error: 'Registration Date cannot be earlier than Date of Letter.' };
        }
    }
    return { valid: true };
}

const findInput = document.querySelector('.find-box');
const replaceInput = document.querySelector('.replace-box');
const replaceBtn = document.querySelector('.replace-btn');
const matchCounter = document.querySelector('.match-counter span');
const tableBody = document.getElementById('tableBody');

function getCells() {
    return tableBody.querySelectorAll('.cell, [contenteditable="true"].cell');
}

findInput.addEventListener('input', () => {
    const searchTerm = findInput.value.trim().toLowerCase();
    const cells = getCells();

    if (!searchTerm) {
        cells.forEach(cell => cell.classList.remove('highlight'));
        matchCounter.textContent = '0';
        return;
    }

    let matchCount = 0;
    cells.forEach(cell => {
        let text = '';
        if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
            text = cell.value.toLowerCase();
        } else if (cell.contentEditable === 'true') {
            text = cell.textContent.toLowerCase();
        }

        if (text.includes(searchTerm)) {
            cell.classList.add('highlight');
            matchCount++;
        } else {
            cell.classList.remove('highlight');
        }
    });
    matchCounter.textContent = matchCount;
});

replaceBtn.addEventListener('click', () => {
    const searchTerm = findInput.value.trim();
    const replaceTerm = replaceInput.value;
    if (!searchTerm) return;

    saveState();

    const cells = getCells();
    let replacedCount = 0;

    cells.forEach(cell => {
        if (cell.classList.contains('highlight')) {
            const regex = new RegExp(searchTerm, 'gi');
            const row = parseInt(cell.getAttribute('data-row'));
            const field = cell.getAttribute('data-field');

            if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
                cell.value = cell.value.replace(regex, replaceTerm);
                if (tableData[row]) {
                    tableData[row][field] = cell.value;
                }
            } else if (cell.contentEditable === 'true') {
                cell.innerHTML = cell.innerHTML.replace(regex, replaceTerm);
                if (tableData[row]) {
                    tableData[row][field] = cell.innerHTML;
                }
            }

            cell.classList.remove('highlight');

            if (tableData[row]) {
                if (tableData[row].isFromDatabase) {
                    changedRows.add(row);
                    tableData[row].hasChanges = true;
                } else {
                    newRows.add(row);
                }
                updateRowVisualStatus(row);
                replacedCount++;
            }
        }
    });

    matchCounter.textContent = '0';
    if (replacedCount > 0) {
        showNotification(`Replaced ${replacedCount} occurrences`, 'success');
    }
});

//============================================
// FORMATTING FUNCTIONS - COMPLETE FIX
//============================================
//====================================================
//TABLE OPTIONS
//====================================================


//-------------------------------ADD NEW ROW--------------------------------------//

function addNewRow() {
    rowCount++;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');

    const rowData = {
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.push(rowData);
    row.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${rowCount - 1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${rowCount - 1}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="resize: vertical; min-height: 53px;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${rowCount - 1}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${rowCount - 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="deliveryMethod">
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${rowCount - 1}" value="Speed Post" onchange="enforceCheckboxLimit(this, 3)"> Speed Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${rowCount - 1}" value="Registered Post" onchange="enforceCheckboxLimit(this, 3)"> Registered Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${rowCount - 1}" value="Hand Delivery" onchange="enforceCheckboxLimit(this, 3)"> Hand Delivery</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${rowCount - 1}" value="Email" onchange="enforceCheckboxLimit(this, 3)"> Email</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${rowCount - 1}" value="E-file" onchange="enforceCheckboxLimit(this, 3)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="zone">
                <label class="radio-label"><input type="checkbox" name="zone_${rowCount - 1}" value="Zone A" onchange="enforceCheckboxLimit(this, 2)"> Zone A</label>
                <label class="radio-label"><input type="checkbox" name="zone_${rowCount - 1}" value="Zone B" onchange="enforceCheckboxLimit(this, 2)"> Zone B</label>
                <label class="radio-label"><input type="checkbox" name="zone_${rowCount - 1}" value="Zone C" onchange="enforceCheckboxLimit(this, 2)"> Zone C</label>
            </div>
        </td>
    `;

    tbody.appendChild(row);

    const cells = row.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(row);
}

//-------------------------------------MOVE TO NEXT CELL---------------------------------------------//
// Sync table data with DOM
function syncTableDataWithDOM() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach((row) => {
        // Use data-row from the first cell — DOM index is wrong on page 2+
        // because rebuildTable sets data-row = startIdx+index, so DOM row 0
        // on page 2 with 6 entries/page = tableData[6], not tableData[0].
        const firstCell = row.querySelector('[data-row]');
        if (!firstCell) return;
        const dataIndex = parseInt(firstCell.getAttribute('data-row'));
        if (isNaN(dataIndex) || !tableData[dataIndex]) return;

        const getCellValue = (cell) => {
            if (!cell) return '';
            if (cell.tagName === 'INPUT') return cell.value;
            if (cell.tagName === 'TEXTAREA') return cell.value;
            if (cell.contentEditable === 'true') return cell.innerHTML;
            return '';
        };

        // Use data-field attributes — reliable on every page
        const allInputs = row.querySelectorAll('input.cell, textarea.cell, [contenteditable="true"].cell');
        allInputs.forEach(input => {
            const field = input.getAttribute('data-field');
            if (field) {
                tableData[dataIndex][field] = getCellValue(input);
            }
        });

        // Radio buttons and Checkboxes
        const radioCells = row.querySelectorAll('.radio-cell');
        radioCells.forEach(radioCell => {
            const field = radioCell.getAttribute('data-field');
            if (field) {
                const checkboxes = radioCell.querySelectorAll('input[type="checkbox"]:checked');
                if (checkboxes.length > 0) {
                    tableData[dataIndex][field] = Array.from(checkboxes).map(cb => cb.value).join(', ');
                } else {
                    const checkedRadio = radioCell.querySelector('input[type="radio"]:checked');
                    if (checkedRadio) {
                        tableData[dataIndex][field] = checkedRadio.value;
                    } else if (radioCell.querySelector('input[type="checkbox"]')) {
                        tableData[dataIndex][field] = '';
                    }
                }
            }
        });
    });
}

function getCellValueByColumn(row, column) {
    const allCells = row.querySelectorAll('.cell, [contenteditable="true"].cell, input.cell, textarea.cell');

    const getCellValue = (cell) => {
        if (!cell) return '';
        if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
            return cell.value || '';
        }
        if (cell.contentEditable === 'true') {
            return cell.textContent || '';
        }
        return '';
    };

    // Map columns to their cell indices
    const columnMapping = {
        'letterDate': [0],
        'registrationDate': [1],
        'letterNo': [2],
        'toWhom': [3, 4],
        'copySentTo': [5, 6],
        'mainAddress': [7, 8],
        'place': [9, 10],
        'sentBy': [11, 12],
        'subject': [13, 14],
        'deliveryMethod': [15],
        'letterLanguage': [16],
        'zone': [17]
    };

    const indices = columnMapping[column] || [];
    const values = indices.map(i => getCellValue(allCells[i])).filter(Boolean);
    return values.join(' ');
}
//------------------------------------------TOGGLE SORT MENU-------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();

    if (order === 'neutral') {
        if (originalTableOrder.length > 0) {
            tableData = originalTableOrder.map(row => ({ ...row }));
        }
        rebuildTable();
        applyAllFilters();
        document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
        return;
    }

    // Separate empty and filled rows
    const filledRows = [];
    const emptyRows = [];

    tableData.forEach((row, index) => {
        const hasData = Object.values(row).some(value =>
            value && value.toString().trim() !== ''
        );
        if (hasData) {
            filledRows.push({ ...row, originalIndex: index });
        } else {
            emptyRows.push({ ...row, originalIndex: index });
        }
    });

    // Sort only filled rows
    filledRows.sort((a, b) => {
        let aValue = a[field] || '';
        let bValue = b[field] || '';

        if (field === 'date') {
            aValue = parseDate(aValue);
            bValue = parseDate(bValue);
            return order === 'asc' ?
                (aValue > bValue ? 1 : -1) :
                (aValue < bValue ? 1 : -1);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();

            if (order === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        }
    });

    // Rebuild tableData with filled rows first, then empty rows
    tableData = [...filledRows, ...emptyRows].map(row => {
        const { originalIndex, ...cleanRow } = row;
        return cleanRow;
    });

    rebuildTable();
    applyAllFilters();
    document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
}

//ROW INSERTION
//============================================
// LOAD USER DATA ON LOGIN
//============================================

async function loadUserData() {
    if (window.isLoadingData) {
        return;
    }

    if (!isAuthenticated()) {
        return;
    }

    window.isLoadingData = true;

    try {

        const response = await fetch('/api/despatch/load', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            removeAuthToken();
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {

            // Store original data for comparison
            originalData.clear();
            changedRows.clear();
            newRows.clear();

            // Process loaded data
            tableData = result.data.map((row, index) => {
                originalData.set(index, createRowHash(row));

                return {
                    id: row.id,
                    serialNo: row.serialNo || index + 1,
                    letterDate: row.letterDate || row.date || '',
                    registrationDate: row.registrationDate || '',
                    toWhom: row.toWhom || '',
                    toWhomHindi: row.toWhomHindi || '',
                    copySentTo: row.copySentTo || '',
                    copySentToHindi: row.copySentToHindi || '',
                    mainAddress: row.mainAddress || '',
                    mainAddressHindi: row.mainAddressHindi || '',
                    place: row.place || '',
                    placeHindi: row.placeHindi || '',
                    subject: row.subject || '',
                    subjectHindi: row.subjectHindi || '',
                    sentBy: row.sentBy || '',
                    sentByHindi: row.sentByHindi || '',
                    letterNo: row.letterNo || '',
                    deliveryMethod: row.deliveryMethod || '',
                    letterLanguage: row.letterLanguage || '',
                    zone: row.zone || '',
                    isFromDatabase: true,
                    hasChanges: false
                };
            });

            rowCount = tableData.length;
            // Snapshot original order for neutral sort
            originalTableOrder = tableData.map(row => ({ ...row }));
            rebuildTable();

            showNotification(`Loaded ${result.data.length} existing records`, 'success');

        } else {
            // NEW USER - NO DATA FOUND

            // Clear any existing data
            tableData = [];
            rowCount = 0;

            // Initialize with 6 empty rows for NEW users
            for (let i = 0; i < 6; i++) {
                addNewRow();
            }
            rebuildTable();

            showNotification('Welcome! Start entering your data', 'info');
        }

    } catch (error) {
        console.error(' Error loading user data:', error);
        showNotification('Error loading data. Starting fresh.', 'error');

        // Fallback: Create 6 empty rows
        tableData = [];
        rowCount = 0;
        for (let i = 0; i < 6; i++) {
            addNewRow();
        }
        rebuildTable();
    } finally {
        window.isLoadingData = false;
    }
}

//======================================================
//SMALL FEATURES
//=====================================================

// INSERT ROW AFTER ANOTHER ROW

function insertRowAfter(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);

    rowCount++;
    const newRow = document.createElement('tr');

    const rowData = {
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.splice(targetIndex + 1, 0, rowData);

    newRow.innerHTML = `
        <td class="row-number"></td>/td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex + 1}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="resize: vertical; min-height: 53px;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex + 1}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex + 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="deliveryMethod">
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex + 1}" value="Speed Post" onchange="enforceCheckboxLimit(this, 3)"> Speed Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex + 1}" value="Registered Post" onchange="enforceCheckboxLimit(this, 3)"> Registered Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex + 1}" value="Hand Delivery" onchange="enforceCheckboxLimit(this, 3)"> Hand Delivery</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex + 1}" value="Email" onchange="enforceCheckboxLimit(this, 3)"> Email</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex + 1}" value="E-file" onchange="enforceCheckboxLimit(this, 3)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="zone">
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex + 1}" value="Zone A" onchange="enforceCheckboxLimit(this, 2)"> Zone A</label>
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex + 1}" value="Zone B" onchange="enforceCheckboxLimit(this, 2)"> Zone B</label>
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex + 1}" value="Zone C" onchange="enforceCheckboxLimit(this, 2)"> Zone C</label>
            </div>
        </td>
    `;


    targetRow.parentNode.insertBefore(newRow, targetRow.nextSibling);

    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(newRow);
    updateRowNumbers();
    cells[0].focus();
}
// INSERT ROW BEFORE TARGET

function insertRowBefore(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);

    rowCount++;
    const newRow = document.createElement('tr');

    const rowData = {
        serialNo: rowCount,
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.splice(targetIndex, 0, rowData);

    newRow.innerHTML = `
        <td class="row-number"></td>/td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="resize: vertical; min-height: 53px;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="deliveryMethod">
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex}" value="Speed Post" onchange="enforceCheckboxLimit(this, 3)"> Speed Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex}" value="Registered Post" onchange="enforceCheckboxLimit(this, 3)"> Registered Post</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex}" value="Hand Delivery" onchange="enforceCheckboxLimit(this, 3)"> Hand Delivery</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex}" value="Email" onchange="enforceCheckboxLimit(this, 3)"> Email</label>
                <label class="radio-label"><input type="checkbox" name="deliveryMethod_${targetIndex}" value="E-file" onchange="enforceCheckboxLimit(this, 3)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="zone">
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex}" value="Zone A" onchange="enforceCheckboxLimit(this, 2)"> Zone A</label>
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex}" value="Zone B" onchange="enforceCheckboxLimit(this, 2)"> Zone B</label>
                <label class="radio-label"><input type="checkbox" name="zone_${targetIndex}" value="Zone C" onchange="enforceCheckboxLimit(this, 2)"> Zone C</label>
            </div>
        </td>
    `;


    targetRow.parentNode.insertBefore(newRow, targetRow);

    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(newRow);
    updateRowNumbers();
    cells[0].focus();
}

//DELETE ROW

function deleteRow(row, index) {
    const tbody = document.getElementById('tableBody');
    if (tbody.children.length <= 1) {
        alert('Cannot delete the last row!');
        return;
    }

    tableData.splice(index, 1);
    row.remove();
    updateRowNumbers();
    rowCount--;
}

//ADD CELL EVENT LISTENERS

// Save radio button value to tableData
function saveRadioValue(radioInput) {
    const radioCell = radioInput.closest('.radio-cell');
    if (!radioCell) return;
    const row = parseInt(radioCell.getAttribute('data-row'));
    const field = radioCell.getAttribute('data-field');
    const value = radioInput.value;

    if (tableData[row]) {
        tableData[row][field] = value;

        if (tableData[row].isFromDatabase) {
            const currentHash = createRowHash(tableData[row]);
            const originalHash = originalData.get(row);
            if (currentHash !== originalHash) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            }
        } else {
            newRows.add(row);
        }
        updateRowVisualStatus(row);
    }
}

function validateCell(cell) {
    const field = cell.getAttribute('data-field');
    if (!field) return;

    const val = cell.value.trim();
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo'];
    
    // Remove old warnings in this cell's parent
    const parent = cell.parentElement;
    const existingWarning = parent.querySelector('.char-count-warning, .char-count-error');
    if (existingWarning) existingWarning.remove();

    // Required fields check
    if (requiredFields.includes(field)) {
        if (!val) {
            cell.classList.add('validation-error');
        } else {
            cell.classList.remove('validation-error');
        }
    }
    
    // Subject character limit check (5000 chars)
    if (field === 'subject' || field === 'subjectHindi') {
        const maxLen = 5000;
        if (val.length > maxLen) {
            cell.classList.add('validation-error');
            const span = document.createElement('span');
            span.className = 'char-count-error';
            span.textContent = `${val.length}/${maxLen}`;
            parent.appendChild(span);
        } else if (val.length > maxLen * 0.9) {
            const span = document.createElement('span');
            span.className = 'char-count-warning';
            span.textContent = `${val.length}/${maxLen}`;
            parent.appendChild(span);
        }
    }
}

function addCellEventListeners(cell) {
    const field = cell.getAttribute('data-field');
    if (field === 'letterDate' || field === 'registrationDate') {
        cell.placeholder = 'DD/MM/YYYY';
        cell.addEventListener('input', () => restrictDateInput(cell));
        cell.addEventListener('blur', () => restrictDateInput(cell));
        
        cell.addEventListener('blur', function() {
            const row = this.getAttribute('data-row');
            if (field === 'letterDate' || field === 'registrationDate') {
                const rowData = tableData[row];
                if (rowData.letterDate && rowData.registrationDate && isValidDateString(rowData.letterDate) && isValidDateString(rowData.registrationDate)) {
                    const result = validateDateLogic(rowData);
                    if (!result.valid) {
                        this.classList.add('invalid-date');
                        this.title = result.error;
                    } else {
                        this.classList.remove('invalid-date');
                        this.title = "";
                    }
                }
            }
        });
    }

    cell.addEventListener('focus', function () {
        this.classList.add('editing');
        if (this.tagName === 'INPUT') {
            this.select();
        }
    });

    cell.addEventListener('blur', async function () {
        this.classList.remove('editing');
        validateCell(this);
        await saveData(this);
    });

    cell.addEventListener('keydown', async function (e) {
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

    cell.addEventListener('input', debounce(async function () {
        validateCell(this);
        await saveData(this);
    }, 300));
}
//----------------------------------------------SAVE THINGY-------------------------------------------//

//==============================================
// DATABASE INTEGRATION FUNCTIONS
//==============================================

// Validate row data - checks if all required fields are filled
function validateRowData(rowData, rowIndex) {
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage'];
    const missingFields = [];

    for (const field of requiredFields) {
        if (!rowData[field] || rowData[field].trim() === '') {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        return {
            isValid: false,
            error: `Row ${rowIndex + 1}: Missing required fields - ${missingFields.join(', ')}`
        };
    }

    return { isValid: true };
}

// Get filled rows from table data
function getFilledRows() {
    const filledRows = [];
    const validationErrors = [];
    let foundFirstEmpty = false;

    for (let index = 0; index < tableData.length; index++) {
        const rowData = tableData[index];
        // Check if at least one field is filled (excluding serialNo)
        const hasData = Object.values(rowData).some(value =>
            value && value.toString().trim() !== '' && value !== index + 1
        );

        if (hasData) {
            if (foundFirstEmpty) {
                validationErrors.push(
                    `Row ${index}: Has empty fields. Please fill all required fields before Saving.` // rows in-between cannot be empty 
                );
            }
            const validation = validateRowData(rowData, index);
            if (validation.isValid) {
                filledRows.push({
                    ...rowData,
                    serialNo: index + 1
                });
            } else {
                validationErrors.push(validation.error);
            }
        }
        else {
            foundFirstEmpty = true; // mark that we found an empty row
        }
    }
    return { filledRows, validationErrors };
}
//=============================
//SAVE TO DATABASE
//=============================

async function saveToDatabase() {
    if (!isAuthenticated()) {
        alert('Please login first to save data.');
        window.location.href = 'login.html';
        return;
    }

    // Sync table data with DOM first
    syncTableDataWithDOM();

    // Validate: no empty middle rows
    if (!validateNoMiddleEmptyRows()) return;

    // Get only changed and new rows
    const changedRowsData = [];
    const newRowsData = [];

    tableData.forEach((rowData, rowIndex) => {
        if (rowData.isFromDatabase) {
            const currentHash = createRowHash(rowData);
            const originalHash = originalData.get(rowIndex);
            if (originalHash !== undefined && currentHash !== originalHash) {
                changedRows.add(rowIndex);
                rowData.hasChanges = true;
            }
        } else {
            const hasAnyData = Object.entries(rowData).some(([k, v]) =>
                k !== 'isFromDatabase' && k !== 'hasChanges' && k !== 'id' &&
                v && v.toString().trim() !== ''
            );
            if (hasAnyData) newRows.add(rowIndex);
        }
    });

    let hasInvalidDates = false;
    let logicErrorMsg = '';

    changedRows.forEach(rowIndex => {
        if (tableData[rowIndex]) {
            const rowData = tableData[rowIndex];
            if ((rowData.letterDate && !isValidDateString(rowData.letterDate)) || (rowData.registrationDate && !isValidDateString(rowData.registrationDate))) {
                hasInvalidDates = true;
            } else if (hasRequiredFields(rowData)) {
                const logic = validateDateLogic(rowData);
                if (!logic.valid) {
                    hasInvalidDates = true;
                    logicErrorMsg = logic.error;
                } else {
                    changedRowsData.push({
                        ...rowData,
                        serialNo: rowIndex + 1,
                        operation: 'update'
                    });
                }
            }
        }
    });

    newRows.forEach(rowIndex => {
        if (tableData[rowIndex]) {
            const rowData = tableData[rowIndex];
            if ((rowData.letterDate && !isValidDateString(rowData.letterDate)) || (rowData.registrationDate && !isValidDateString(rowData.registrationDate))) {
                hasInvalidDates = true;
            } else if (hasRequiredFields(rowData)) {
                const logic = validateDateLogic(rowData);
                if (!logic.valid) {
                    hasInvalidDates = true;
                    logicErrorMsg = logic.error;
                } else {
                    newRowsData.push({
                        ...rowData,
                        serialNo: rowIndex + 1,
                        operation: 'insert'
                    });
                }
            }
        }
    });

    if (hasInvalidDates) {
        alert(logicErrorMsg || 'One or more rows contain an invalid date. Please ensure dates are in DD/MM/YYYY format with valid days and months.');
        return;
    }

    const totalChanges = changedRowsData.length + newRowsData.length;

    if (totalChanges === 0) {
        alert('No changes to save.');
        return;
    }

    const confirmMessage = `Save ${totalChanges} changes?\n\n` +
        ` ${newRowsData.length} new rows\n` +
        ` ${changedRowsData.length} modified rows`;

    if (!confirm(confirmMessage)) {
        return;
    }


    try {
        const saveBtn = document.querySelector('.save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = ' Saving Changes...';
        saveBtn.disabled = true;

        const response = await fetch('/api/despatch/save-changes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                changedRows: changedRowsData,
                newRows: newRowsData
            })
        });

        if (response.status === 401 || response.status === 403) {
            removeAuthToken();
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            // Update tracking after successful save
            changedRows.forEach(rowIndex => {
                if (tableData[rowIndex]) {
                    originalData.set(rowIndex, createRowHash(tableData[rowIndex]));
                    tableData[rowIndex].hasChanges = false;
                }
            });

            newRows.forEach(rowIndex => {
                if (tableData[rowIndex] && result.newRowIds && result.newRowIds[rowIndex]) {
                    tableData[rowIndex].id = result.newRowIds[rowIndex];
                    tableData[rowIndex].isFromDatabase = true;
                    originalData.set(rowIndex, createRowHash(tableData[rowIndex]));
                }
            });

            changedRows.clear();
            newRows.clear();

            // Update visual indicators
            document.querySelectorAll('.row-changed, .row-new').forEach(row => {
                row.classList.remove('row-changed', 'row-new');
            });

            saveBtn.textContent = ' Changes Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 3000);

            showNotification(`Successfully saved ${totalChanges} changes`, 'success');

        } else {
            throw new Error(result.error || 'Failed to save changes');
        }

    } catch (error) {
        console.error(' Save error:', error);
        alert(' Error saving changes: ' + error.message);
    } finally {
        const saveBtn = document.querySelector('.save-btn');
        if (!saveBtn.textContent.includes('')) {
            saveBtn.textContent = 'Save Changes';
        }
        saveBtn.disabled = false;
    }
}


//============================================
//TRANSLATION
//============================================
let debounceTimer = null;
const API_BASE = "https://d-jaden02-pys-deep-transalator.hf.space";

async function translateText(text) {
    if (!text?.trim()) return text;
    if (translationCache.has(text)) return translationCache.get(text);
    
    try {
        const response = await fetch(`${API_BASE}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        const translated = data.translated_text;
        translationCache.set(text, translated);
        return translated;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

async function translateTextBatch(texts) {
    try {
        const response = await fetch(`${API_BASE}/batch_translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts })
        });

        if (!response.ok) throw new Error(`Batch API error: ${response.status}`);

        const data = await response.json();
        const map = {};
        data.results.forEach((result, index) => {
            if (result.translated_text) {
                map[texts[index]] = result.translated_text;
                translationCache.set(texts[index], result.translated_text);
            } else {
                map[texts[index]] = texts[index]; // fallback
            }
        });
        return map;
    } catch (error) {
        console.error('Batch translation error:', error);
        const fallback = {};
        texts.forEach(t => fallback[t] = t);
        return fallback;
    }
}





//SAVE DATA AND HANDLE TRANSLATION

async function saveData(cell) {
    const row = parseInt(cell.getAttribute('data-row'));
    const field = cell.getAttribute('data-field');
    const value = cell.contentEditable === 'true' ? cell.innerHTML : cell.value;

    if (tableData[row]) {
        const oldValue = tableData[row][field];
        tableData[row][field] = value;

        // Check if this is a change from original data
        if (tableData[row].isFromDatabase) {
            const currentHash = createRowHash(tableData[row]);
            const originalHash = originalData.get(row);

            if (currentHash !== originalHash) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            } else {
                changedRows.delete(row);
                tableData[row].hasChanges = false;
            }
        } else {
            newRows.add(row);
        }

        // Handle automatic translation
        if (translatableColumns.includes(field) && !field.endsWith('Hindi') && value) {
            const hindiField = `${field}Hindi`;
            // CHANGED: Look for textarea instead of input
            const hindiInput = document.querySelector(`textarea[data-row="${row}"][data-field="${hindiField}"]`);


            if (hindiInput) {
                // Strip HTML tags for translation
                const textToTranslate = value.replace(/<[^>]*>/g, '');

                const translatedText = await translateText(textToTranslate);

                hindiInput.value = translatedText;
                hindiInput.disabled = false;
                tableData[row][hindiField] = translatedText;

                if (tableData[row].isFromDatabase) {
                    const currentHash = createRowHash(tableData[row]);
                    const originalHash = originalData.get(row);

                    if (currentHash !== originalHash) {
                        changedRows.add(row);
                        tableData[row].hasChanges = true;
                    }
                }
            } else {
            }
        }

        updateRowVisualStatus(row);
    }
}
//============================================
// VISUAL INDICATORS FOR CHANGED ROWS
//============================================

function updateRowVisualStatus(rowIndex) {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    const startIdx = (currentPage - 1) * entriesPerPage;
    const tableRowIndex = rowIndex - startIdx;

    if (rows[tableRowIndex]) {
        const row = rows[tableRowIndex];

        if (changedRows.has(rowIndex)) {
            row.classList.add('row-changed');
            row.title = 'This row has been modified';
        } else if (newRows.has(rowIndex)) {
            row.classList.add('row-new');
            row.title = 'This is a new row';
        } else {
            row.classList.remove('row-changed', 'row-new');
            row.title = '';
        }
    }
}

//================================
// CONFIRM LOGOUT
//================================

document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?Remember To Save')) {
                window.location.href = 'login.html';
            }
        });
    }
});

//============================================
// PDF EXPORT FUNCTIONALITY
//============================================
function exportToPDF() {
    syncTableDataWithDOM();

    // ── 1. Filter: only rows with at least one meaningful field ────────────
    const meaningfulRows = tableData
        .map((row, idx) => ({ row, idx }))
        .filter(({ row }) =>
            ['letterDate','registrationDate','toWhom','copySentTo','mainAddress','place',
             'subject','sentBy','letterNo','deliveryMethod','letterLanguage','zone']
            .some(k => (row[k] || '').trim() !== '')
        );

    if (meaningfulRows.length === 0) {
        showNotification('No data to export.', 'error');
        return;
    }

    // ── 2. Column definitions ──────────────────────────────────────────────
    // [header label , data key        , width , align ]
    const cols = [
        ['No.',               '_serial',          '4%',  'center'],
        ['Date of Letter',    'letterDate',       '7%',  'center'],
        ['Registered On',     'registrationDate', '7%',  'center'],
        ['Name of Receiver',  'toWhom',           '9%',  'left'  ],
        ['Copy Sent To',      'copySentTo',       '8%',  'left'  ],
        ['Main Address',      'mainAddress',      '8%',  'left'  ],
        ['Place',             'place',            '7%',  'left'  ],
        ['Subject',           'subject',          '18%', 'left'  ],
        ['Sent By',           'sentBy',           '8%',  'left'  ],
        ['Letter No.',        'letterNo',         '8%',  'left'  ],
        ['Delivery Method',   'deliveryMethod',   '7%',  'center'],
        ['Language',          'letterLanguage',   '5%',  'center'],
        ['Zone',              'zone',             '4%',  'center'],
    ];

    // Hindi companion keys
    const hindiMap = {
        toWhom:      'toWhomHindi',
        copySentTo:  'copySentToHindi',
        mainAddress: 'mainAddressHindi',
        place:       'placeHindi',
        subject:     'subjectHindi',
        sentBy:      'sentByHindi'
    };

    function esc(v) {
        return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── 3. Build thead ─────────────────────────────────────────────────────
    let thead = '<thead><tr>';
    cols.forEach(([label,,w]) => {
        thead += `<th style="width:${w}">${esc(label)}</th>`;
    });
    thead += '</tr></thead>';

    // ── 4. Build tbody ─────────────────────────────────────────────────────
    let tbody = '<tbody>';
    meaningfulRows.forEach(({ row }, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f5f5f5';
        tbody += `<tr style="background:${bg}">`;
        cols.forEach(([,key,,align]) => {
            let val = key === '_serial' ? String(i + 1) : esc(row[key] || '');
            let extra = '';
            if (hindiMap[key]) {
                const hval = (row[hindiMap[key]] || '').trim();
                if (hval) {
                    extra = `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${esc(hval)}</div>`;
                }
            }
            tbody += `<td style="text-align:${align};vertical-align:top">${val}${extra}</td>`;
        });
        tbody += '</tr>';
    });
    tbody += '</tbody>';

    // ── 5. Assemble HTML string ────────────────────────────────────────────
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 10mm; background: white; width: 400mm;">
            <style>
                .pdf-print-area table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .pdf-print-area th { 
                    background-color: #34495e !important; color: white !important; 
                    padding: 6px; font-size: 10px; border: 1px solid #2c3e50; 
                    text-align: center; word-wrap: break-word; 
                }
                .pdf-print-area td { 
                    border: 1px solid #ccc; padding: 5px; font-size: 10px; 
                    line-height: 1.4; word-wrap: break-word; vertical-align: top; 
                    white-space: normal; overflow-wrap: break-word; 
                }
                .pdf-print-area td:first-child { text-align: center; font-weight: bold; background-color: #ecf0f1; }
                .pdf-print-area tr:nth-child(even) td { background-color: #f9f9f9; }
            </style>
            <h2 style="text-align: center; font-size: 14px; margin: 0 0 5px; color: #1a2e44;">DAK Delivered / Despatch Register</h2>
            <div style="text-align: center; font-size: 10px; color: #555; margin-bottom: 10px;">Printed on ${new Date().toLocaleDateString('en-IN')} &nbsp;|&nbsp; ${meaningfulRows.length} record(s)</div>
            <div class="pdf-print-area">
                <table>${thead}${tbody}</table>
            </div>
        </div>
    `;

    const opt = {
        margin: [5, 5, 5, 5],
        filename: `DAK_Despatch_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape', compress: true },
        pagebreak: { mode: ['css','legacy'], avoid: 'tr' }
    };

    html2pdf().set(opt).from(htmlContent).save()
        .then(() => {
            showNotification('PDF exported successfully!', 'success');
        })
        .catch(err => {
            showNotification('Error generating PDF: ' + err.message, 'error');
        });
}

//=====================================
// REBUILD DATA FOR NO OF ENTRIES
//===================================== 

function rebuildTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    // Ensure enough rows for the current page
    const requiredRows = entriesPerPage * currentPage;
    while (tableData.length < requiredRows) {
        const rowData = {
            letterDate: '',
            registrationDate: '',
            toWhom: '',
            toWhomHindi: '',
            copySentTo: '',
            copySentToHindi: '',
            mainAddress: '',
            mainAddressHindi: '',
            place: '',
            placeHindi: '',
            subject: '',
            subjectHindi: '',
            sentBy: '',
            sentByHindi: '',
            letterNo: '',
            deliveryMethod: '',
            letterLanguage: '',
            zone: ''
        };
        tableData.push(rowData);
    }

    // PAGINATION LOGIC
    const startIdx = (currentPage - 1) * entriesPerPage;
    const endIdx = Math.min(startIdx + entriesPerPage, tableData.length);
    const pageRows = tableData.slice(startIdx, endIdx);

    pageRows.forEach((rowData, index) => {
        const serialNumber = startIdx + index + 1;
        const row = document.createElement('tr');

        // Check if data contains HTML formatting
        const hasHTMLFormatting = (text) => {
            return text && (text.includes('<strong>') || text.includes('<em>') || text.includes('<u>'));
        };

        // Updated: Create cell content - textarea/input for non-formatted, contentEditable for formatted
        const createCellContent = (field, value, isEnglish = true, isDate = false) => {
            const className = isEnglish ? 'cell english-cell' : 'cell hindi-cell';
            const placeholder = isDate ? 'DD/MM/YYYY' : (isEnglish ? 'Enter text...' : 'Hindi translation...');
            // registration date is not strict required to avoid empty submission errors
            const required = isDate && field === 'letterDate' || (isEnglish && !field.endsWith('Hindi') && field !== 'registrationDate' && field !== 'place' && field !== 'copySentTo') ? 'required' : '';
            const disabled = !isEnglish && !value ? 'disabled' : '';

            if (hasHTMLFormatting(value)) {
                // Use contenteditable div for formatted text (supports wrapping via CSS)
                return `<div contenteditable="true" class="${className}" data-row="${startIdx + index}" data-field="${field}" style="width: 100%; min-height: 90px; height: auto; padding: 12px; border: none; outline: none; resize: none;">${value || ''}</div>`;
            } else if (isDate) {
                // Date always uses input (no wrapping needed)
                return `<input type="text" class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" value="${value || ''}" style="height: 90px; resize: none;">`;
            } else {
                // Use textarea for text fields (enables wrapping)
                const maxLengthAttr = (field === 'subject' || field === 'subjectHindi') ? 'maxlength="5000"' : '';
                return `<textarea class="${className}" ${required} ${maxLengthAttr} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" ${disabled} rows="2" style="resize: vertical; min-height: 90px; height: auto;">${value || ''}</textarea>`;
            }
        };

        const chk = (field, val) => (rowData[field] || '').includes(val) ? 'checked' : '';
        const r = startIdx + index;

        row.innerHTML = `
            <td class="row-number">${serialNumber}</td>
            <td>${createCellContent('letterDate', rowData.letterDate, true, true)}</td>
            <td>${createCellContent('registrationDate', rowData.registrationDate, true, true)}</td>
            <td>
                <textarea class="cell english-cell" required data-row="${r}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="resize: vertical; min-height: 53px;">${rowData.letterNo || ''}</textarea>
            </td>
            <td>
                ${createCellContent('toWhom', rowData.toWhom, true, false)}
                ${createCellContent('toWhomHindi', rowData.toWhomHindi, false, false)}
            </td>
            <td>
                ${createCellContent('copySentTo', rowData.copySentTo, true, false)}
                ${createCellContent('copySentToHindi', rowData.copySentToHindi, false, false)}
            </td>
            <td>
                ${createCellContent('mainAddress', rowData.mainAddress, true, false)}
                ${createCellContent('mainAddressHindi', rowData.mainAddressHindi, false, false)}
            </td>
            <td>
                ${createCellContent('place', rowData.place, true, false)}
                ${createCellContent('placeHindi', rowData.placeHindi, false, false)}
            </td>
            <td>
                ${createCellContent('sentBy', rowData.sentBy, true, false)}
                ${createCellContent('sentByHindi', rowData.sentByHindi, false, false)}
            </td>
            <td>
                ${createCellContent('subject', rowData.subject, true, false)}
                ${createCellContent('subjectHindi', rowData.subjectHindi, false, false)}
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="deliveryMethod">
                    <label class="radio-label"><input type="checkbox" name="deliveryMethod_${r}" value="Speed Post" ${chk('deliveryMethod', 'Speed Post')} onchange="enforceCheckboxLimit(this, 3)"> Speed Post</label>
                    <label class="radio-label"><input type="checkbox" name="deliveryMethod_${r}" value="Registered Post" ${chk('deliveryMethod', 'Registered Post')} onchange="enforceCheckboxLimit(this, 3)"> Registered Post</label>
                    <label class="radio-label"><input type="checkbox" name="deliveryMethod_${r}" value="Hand Delivery" ${chk('deliveryMethod', 'Hand Delivery')} onchange="enforceCheckboxLimit(this, 3)"> Hand Delivery</label>
                    <label class="radio-label"><input type="checkbox" name="deliveryMethod_${r}" value="Email" ${chk('deliveryMethod', 'Email')} onchange="enforceCheckboxLimit(this, 3)"> Email</label>
                    <label class="radio-label"><input type="checkbox" name="deliveryMethod_${r}" value="E-file" ${chk('deliveryMethod', 'E-file')} onchange="enforceCheckboxLimit(this, 3)"> E-file</label>
                </div>
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="letterLanguage">
                    <label class="radio-label"><input type="radio" name="letterLanguage_${r}" value="Hindi" ${rowData.letterLanguage === 'Hindi' ? 'checked' : ''} onchange="saveRadioValue(this)"> Hindi</label>
                    <label class="radio-label"><input type="radio" name="letterLanguage_${r}" value="English" ${rowData.letterLanguage === 'English' ? 'checked' : ''} onchange="saveRadioValue(this)"> English</label>
                    <label class="radio-label"><input type="radio" name="letterLanguage_${r}" value="Bilingual" ${rowData.letterLanguage === 'Bilingual' ? 'checked' : ''} onchange="saveRadioValue(this)"> Bilingual</label>
                </div>
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="zone">
                    <label class="radio-label"><input type="checkbox" name="zone_${r}" value="Zone A" ${chk('zone', 'Zone A')} onchange="enforceCheckboxLimit(this, 2)"> Zone A</label>
                    <label class="radio-label"><input type="checkbox" name="zone_${r}" value="Zone B" ${chk('zone', 'Zone B')} onchange="enforceCheckboxLimit(this, 2)"> Zone B</label>
                    <label class="radio-label"><input type="checkbox" name="zone_${r}" value="Zone C" ${chk('zone', 'Zone C')} onchange="enforceCheckboxLimit(this, 2)"> Zone C</label>
                </div>
            </td>
        `;
        tbody.appendChild(row);

        // Add listeners to all cells (both input/textarea and contentEditable)
        const cells = row.querySelectorAll('.cell, [contenteditable="true"]');
        cells.forEach(cell => {
            if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
                addCellEventListeners(cell); // Handles both inputs and textareas
            } else if (cell.contentEditable === 'true') {
                addContentEditableListeners(cell);
            }
        });

        addRowInsertionListeners(row);
    });

    renderPaginationControls();
}

//============================================
// HELPER FUNCTIONS
//============================================

function hasRequiredFields(rowData) {
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage', 'zone'];
    const hasAll = requiredFields.every(field =>
        rowData[field] && rowData[field].toString().trim() !== ''
    );
    if (!hasAll) return false;

    if (rowData.letterDate && !isValidDateString(rowData.letterDate)) return false;
    if (rowData.registrationDate && !isValidDateString(rowData.registrationDate)) return false;

    return true;
}

function isRowEmpty(rowData) {
    const meaningfulFields = ['letterDate', 'registrationDate', 'toWhom', 'copySentTo', 'mainAddress', 'place', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage', 'zone'];
    return meaningfulFields.every(field => !rowData[field] || rowData[field].toString().trim() === '');
}

function validateNoMiddleEmptyRows() {
    syncTableDataWithDOM();
    let lastFilledIndex = -1;
    
    for (let i = tableData.length - 1; i >= 0; i--) {
        if (!isRowEmpty(tableData[i])) {
            lastFilledIndex = i;
            break;
        }
    }
    
    if (lastFilledIndex === -1) return true;
    
    for (let i = 0; i <= lastFilledIndex; i++) {
        if (isRowEmpty(tableData[i])) {
            alert(`Row ${i + 1} is empty but row ${lastFilledIndex + 1} has data.\nPlease fill rows sequentially from top to bottom.\nRow ${i + 1} must be completed before saving.`);
            return false;
        }
    }
    
    return true;
}

function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(notification);
    }

    // Set color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3'
    };

    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    notification.style.opacity = '1';

    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

//==========================================================
// PAGINATION CONTROLS FOR GOING FROM ONE PAGE TO ANOTHER
//==========================================================

function renderPaginationControls() {
    let pagination = document.getElementById('pagination-controls');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination-controls';
        pagination.style.margin = '10px 0';
        pagination.style.textAlign = 'center';
        document.getElementById('excelTable').after(pagination);
    }

    const totalPages = Math.ceil(tableData.length / entriesPerPage);
    pagination.innerHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} id="prevPageBtn">Previous</button>
        <span> Page ${currentPage} of ${totalPages} </span>
        <button ${currentPage === totalPages ? 'disabled' : ''} id="nextPageBtn">Next</button>
    `;

    document.getElementById('prevPageBtn').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            rebuildTable();
        }
    };
    document.getElementById('nextPageBtn').onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            rebuildTable();
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // Trigger initial stats load
    setTimeout(fetchStatsAndRender, 1000);
});
function enforceCheckboxLimit(element, limit) {
    const parent = element.closest('.radio-cell');
    const checkedBoxes = parent.querySelectorAll('input[type="checkbox"]:checked');
    if (checkedBoxes.length > limit) {
        element.checked = false;
        alert('You can select a maximum of ' + limit + ' options.');
    }
    saveRadioValue(element);
}
