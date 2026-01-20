// ========================================
// Wellbound Email Signature - Google Apps Script
// ========================================
// 
// SETUP INSTRUCTIONS:
// 1. Open Google Sheets and create a new spreadsheet
// 2. Name the first sheet "Employees"
// 3. Add these headers in row 1:
//    A1: Worker Name
//    B1: Job Title
//    C1: Phone Number
//    D1: Extension Number
//    E1: Email
//    F1: Profile Image URL
//
// 4. Go to Extensions > Apps Script
// 5. Delete any existing code and paste this entire file
// 6. Click Deploy > New deployment
// 7. Select type: Web app
// 8. Set "Execute as" to: Me
// 9. Set "Who has access" to: Anyone
// 10. Click Deploy and authorize
// 11. Copy the Web App URL and paste it in script.js CONFIG.scriptUrl
//
// ========================================

// Configuration
const SHEET_NAME = 'Employees';

// Column indices (0-based)
const COLS = {
  NAME: 0,       // A - Worker Name
  TITLE: 1,      // B - Job Title
  PHONE: 2,      // C - Phone Number
  EXTENSION: 3,  // D - Extension Number
  EMAIL: 4,      // E - Email
  IMAGE_URL: 5   // F - Profile Image URL
};

/**
 * Handle GET requests - List all employees or search
 */
function doGet(e) {
  const action = e.parameter.action || 'list';
  
  try {
    if (action === 'list') {
      return handleList();
    } else if (action === 'search') {
      const firstName = (e.parameter.firstName || '').toLowerCase().trim();
      const lastName = (e.parameter.lastName || '').toLowerCase().trim();
      return handleSearch(firstName, lastName);
    }
    
    return jsonResponse({ error: 'Invalid action' });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

/**
 * Handle POST requests - Add new employee
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'add') {
      return handleAdd(data);
    }
    
    return jsonResponse({ error: 'Invalid action' });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

/**
 * List all employees
 */
function handleList() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  const employees = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COLS.NAME]) { // Only include rows with a name
      employees.push({
        name: row[COLS.NAME] || '',
        title: row[COLS.TITLE] || '',
        phone: row[COLS.PHONE] || '718.400.WELL (9355)',
        extension: row[COLS.EXTENSION] || '',
        email: row[COLS.EMAIL] || '',
        imageUrl: row[COLS.IMAGE_URL] || ''
      });
    }
  }
  
  return jsonResponse(employees);
}

/**
 * Search for an employee by first and/or last name (case insensitive)
 */
function handleSearch(firstName, lastName) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fullName = (row[COLS.NAME] || '').toLowerCase();
    
    // Split full name into parts
    const nameParts = fullName.split(/\s+/);
    const rowFirstName = nameParts[0] || '';
    const rowLastName = nameParts.slice(1).join(' ') || '';
    
    // Check for match
    let match = false;
    
    if (firstName && lastName) {
      // Both provided - match both
      match = rowFirstName.includes(firstName) && rowLastName.includes(lastName);
    } else if (firstName) {
      // Only first name - check if it matches first name or is contained anywhere
      match = rowFirstName.includes(firstName) || fullName.includes(firstName);
    } else if (lastName) {
      // Only last name - check if it matches last name or is contained anywhere
      match = rowLastName.includes(lastName) || fullName.includes(lastName);
    }
    
    if (match) {
      return jsonResponse({
        found: true,
        employee: {
          name: row[COLS.NAME] || '',
          title: row[COLS.TITLE] || '',
          phone: row[COLS.PHONE] || '718.400.WELL (9355)',
          extension: row[COLS.EXTENSION] || '',
          email: row[COLS.EMAIL] || '',
          imageUrl: row[COLS.IMAGE_URL] || ''
        }
      });
    }
  }
  
  return jsonResponse({ found: false });
}

/**
 * Add a new employee to the sheet
 */
function handleAdd(data) {
  const sheet = getSheet();
  
  // Append new row
  sheet.appendRow([
    data.name || '',
    data.title || '',
    data.phone || '718.400.WELL (9355)',
    data.extension || '',
    data.email || '',
    data.imageUrl || ''
  ]);
  
  return jsonResponse({ success: true, message: 'Employee added successfully' });
}

/**
 * Get the employees sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.getRange(1, 1, 1, 6).setValues([[
      'Worker Name',
      'Job Title',
      'Phone Number',
      'Extension Number',
      'Email',
      'Profile Image URL'
    ]]);
    // Format headers
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#561640').setFontColor('#ffffff');
    // Freeze header row
    sheet.setFrozenRows(1);
    // Auto-resize columns
    for (let i = 1; i <= 6; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  return sheet;
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - run this to verify the sheet is set up correctly
 */
function testSetup() {
  const sheet = getSheet();
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('Number of rows: ' + sheet.getLastRow());
  Logger.log('Headers: ' + sheet.getRange(1, 1, 1, 6).getValues());
}
