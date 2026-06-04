require('dotenv').config();
const { google } = require('googleapis');

function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 is not set');
  }
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const getSheetsClient = () => {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
};

async function run() {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  const sheets = getSheetsClient();
  
  const resOrders = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  const orderRows = resOrders.data.values || [];
  const orderHeaders = orderRows[0];
  const orders = orderRows.slice(1).map(row => {
    const obj = {};
    orderHeaders.forEach((h, idx) => obj[h] = row[idx] || '');
    return obj;
  });

  const resBrands = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Brands!A1:Z`,
  });
  const brandRows = resBrands.data.values || [];
  const brandHeaders = brandRows[0];
  const brands = brandRows.slice(1).map(row => {
    const obj = {};
    brandHeaders.forEach((h, idx) => obj[h] = row[idx] || '');
    return obj;
  });

  const fallbackBrand = brands[0] || { code: "ORD", id: "" };
  
  const sortedOrders = [...orders].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const newNumbers = {}; 
  const brandCounts = {};
  
  for (const order of sortedOrders) {
    const brandId = order.brand_id || fallbackBrand.id;
    const brandCode = brands.find(b => b.id === brandId)?.code || fallbackBrand.code;
    
    if (!brandCounts[brandId]) brandCounts[brandId] = 0;
    brandCounts[brandId]++;
    
    newNumbers[order.id] = `${brandCode}${brandCounts[brandId].toString().padStart(6, '0')}`;
  }
  
  const dataValues = orders.map(obj => {
    obj.order_no = newNumbers[obj.id] || obj.order_no;
    return orderHeaders.map(h => obj[h] !== undefined && obj[h] !== null ? String(obj[h]) : '');
  });
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A2:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: dataValues,
    },
  });

  console.log("Migration done. Updated " + dataValues.length + " orders.");
}

run().catch(console.error);
