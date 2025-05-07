// Google Apps Script code for handling form submissions to Google Sheets
// Copy and paste this into your Google Apps Script editor

// Replace this with your Google Sheet ID
// You can find this in the URL of your Google Sheet: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
const SHEET_ID = '1BT3mtYKfLcdCTR_jTDc9aq_S-6vX2LIzxW2CD50gLNQ';
const SHEET_NAME = 'Tryout Registrations'; // The name of the sheet tab

function doPost(e) {
  try {
    // Parse the JSON data from the request
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        'status': 'error',
        'message': 'Invalid JSON data'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Open the spreadsheet and get the sheet
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // If the sheet doesn't exist, create it with headers
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp',
        'Player Name',
        'Birth Date',
        'Age Group',
        'Position',
        'Parent Email',
        'Parent Phone'
      ]);
    }
    
    // Format the data for the spreadsheet
    const rowData = [
      data.timestamp || new Date().toISOString(),
      data.playerName || '',
      data.birthDate || '',
      data.ageGroup || '',
      data.position || '',
      data.parentEmail || '',
      data.parentPhone || ''
    ];
    
    // Append the data to the sheet
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Registration data saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Log the error for debugging
    console.error('Error in doPost: ' + error.message);
    
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'Error processing registration: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// This function handles GET requests (for testing)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'The Google Apps Script is working correctly. Use POST to submit data.'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Test function to verify the script is working
function testScript() {
  const testData = {
    timestamp: new Date().toISOString(),
    playerName: 'Test Player',
    birthDate: '2010-01-01',
    ageGroup: '14u',
    position: 'setter',
    parentEmail: 'test@example.com',
    parentPhone: '555-123-4567'
  };
  
  // Simulate a POST request
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  // Call doPost with the mock event
  const result = doPost(mockEvent);
  
  // Log the result
  Logger.log(result.getContent());
}