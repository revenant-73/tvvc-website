// Google Apps Script code for handling form submissions to Google Sheets
// Copy and paste this into your Google Apps Script editor

// Replace this with your Google Sheet ID
// You can find this in the URL of your Google Sheet: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const SHEET_NAME = 'Tryout Registrations'; // The name of the sheet tab

// Process data from either GET or POST requests
function processRequest(e) {
  try {
    // Log the incoming request for debugging
    Logger.log("Received request: " + JSON.stringify(e));
    
    // Get data from either POST JSON or URL parameters
    let data = {};
    
    if (e.postData && e.postData.contents) {
      // Try to parse JSON from POST body
      try {
        data = JSON.parse(e.postData.contents);
        Logger.log("Parsed POST data: " + JSON.stringify(data));
      } catch (error) {
        Logger.log("Error parsing JSON: " + error.message);
        // If JSON parsing fails, try to use URL parameters if available
        if (e.parameter) {
          data = e.parameter;
          Logger.log("Using URL parameters instead: " + JSON.stringify(data));
        }
      }
    } else if (e.parameter) {
      // Use URL parameters (from GET request)
      data = e.parameter;
      Logger.log("Using URL parameters: " + JSON.stringify(data));
    }
    
    // If we have no data, return an error
    if (Object.keys(data).length === 0) {
      Logger.log("No data found in request");
      return ContentService.createTextOutput(JSON.stringify({
        'status': 'error',
        'message': 'No data found in request'
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
    
    // Log the data being added to the sheet
    Logger.log("Adding row to sheet: " + JSON.stringify(rowData));
    
    // Append the data to the sheet
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Registration data saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Log the error for debugging
    Logger.log("Error processing request: " + error.message);
    
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'Error processing registration: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests
function doPost(e) {
  return processRequest(e);
}

// Handle GET requests
function doGet(e) {
  // If there are parameters, process as a form submission
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    return processRequest(e);
  }
  
  // Otherwise return a test message
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'The Google Apps Script is working correctly. Add parameters to submit data.'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Test function to verify the script is working
function testScript() {
  const testData = {
    parameter: {
      timestamp: new Date().toISOString(),
      playerName: 'Test Player',
      birthDate: '2010-01-01',
      ageGroup: '14u',
      position: 'setter',
      parentEmail: 'test@example.com',
      parentPhone: '555-123-4567'
    }
  };
  
  // Call doGet with the test data
  const result = doGet(testData);
  
  // Log the result
  Logger.log(result.getContent());
}