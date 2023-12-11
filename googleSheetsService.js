const { google } = require("googleapis");
const sheets = google.sheets("v4");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// const spreadsheetId = "1IUBE1QjigsLsrYMe9AzpWDGA7OmMqvoSk5Djh5A88V4";
const spreadsheetId = "1UlhN-IsiaT6bTbFHAWop7iu5L9tmx_HGq6Ct3yxqDyI";
const sheetName = "Sheet1";

const getAuthToken = async () => {
  const auth = new google.auth.GoogleAuth({
    // keyFile: "./service_account_credentials.json",
    // projectId: "course-401211",
    keyFile: "./course_allocation.json",
    projectId: "bits-goa-csis",
    scopes: SCOPES,
  });
  const authToken = await auth.getClient();
  return authToken;
};

const getSpreadSheetValues = async ({ spreadsheetId, auth, sheetName }) => {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    auth,
    range: sheetName,
  });
  return res;
};

const updateSpreadSheetValues = async ({
  spreadsheetId,
  auth,
  range,
  values,
}) => {
  let resource = { values };
  let valueInputOption = "USER_ENTERED";
  sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption,
    auth,
    resource,
  });
};

const appendSpreadSheetValues = async ({
  spreadsheetId,
  auth,
  range,
  values,
}) => {
  let resource = { values };
  let valueInputOption = "USER_ENTERED";
  sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    auth,
    resource,
  });
};

const readData = async (auth) => {
  try {
    const response = await getSpreadSheetValues({
      spreadsheetId,
      sheetName,
      auth,
    });
    console.log("Read data", response.data?.values);
  } catch (error) {
    console.log(error.message, error.stack);
  }
};

const updateData = (auth, range, values) => {
  try {
    updateSpreadSheetValues({
      spreadsheetId,
      sheetName,
      auth,
      range,
      values,
    });
    console.log("Updated from range", range.split("!")[1]);
  } catch (error) {
    console.log(error.message, error.stack);
  }
};

const appendData = (auth, values) => {
  try {
    appendSpreadSheetValues({
      spreadsheetId,
      sheetName,
      auth,
      // range: sheetName,
      range: "A2",
      values,
    });
    console.log("Appended data");
  } catch (error) {
    console.log(error.message, error.stack);
  }
};

var range = "A2:G200";
const clearData = async (auth) => {
  try {
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
      auth,
    });
  } catch (error) {
    console.log(error.message, error.stack);
  }
};

module.exports = {
  getAuthToken,
  readData,
  updateData,
  appendData,
  clearData,
};
