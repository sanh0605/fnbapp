const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rhbewMyE6ws9G3_DSmEbfg_w0omMwFI';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Convert "#001" -> "PHD000001"
function supabaseToPHD(orderNum) {
  const num = parseInt(orderNum.replace('#', ''), 10);
  if (isNaN(num)) return null;
  return `PHD${num.toString().padStart(6, '0')}`;
}

const TARGET_ORDERS = [
  'PHD000001','PHD000002','PHD000003','PHD000004','PHD000005','PHD000006','PHD000007',
  'PHD000008','PHD000009','PHD000010','PHD000011','PHD000012','PHD000013','PHD000014',
  'PHD000015','PHD000016','PHD000017','PHD000018','PHD000019','PHD000020','PHD000021',
  'PHD000022','PHD000023','PHD000024','PHD000025','PHD000026','PHD000027','PHD000028',
  'PHD000029','PHD000030','PHD000031','PHD000032','PHD000033','PHD000034','PHD000035',
  'PHD000036','PHD000037','PHD000038','PHD000039','PHD000040','PHD000041','PHD000042',
  'PHD000043','PHD000044','PHD000045','PHD000046','PHD000047','PHD000048','PHD000049',
  'PHD000050','PHD000051','PHD000052','PHD000053','PHD000054','PHD000055','PHD000056',
  'PHD000057','PHD000058','PHD000059','PHD000060','PHD000061','PHD000062','PHD000063',
  'PHD000064','PHD000065','PHD000066','PHD000067','PHD000068','PHD000069','PHD000070',
  'PHD000071','PHD000072','PHD000073','PHD000074','PHD000075','PHD000076','PHD000077',
  'PHD000078','PHD000079','PHD000080','PHD000081','PHD000082','PHD000083','PHD000084',
  'PHD000085','PHD000086','PHD000087','PHD000088','PHD000089','PHD000090','PHD000091',
  'PHD000092','PHD000093','PHD000094','PHD000095','PHD000096','PHD000097','PHD000098',
  'PHD000099','PHD000100','PHD000101','PHD000102','PHD000103','PHD000104','PHD000105',
  'PHD000106','PHD000107','PHD000108','PHD000109','PHD000110','PHD000111','PHD000112',
  'PHD000113','PHD000114','PHD000115','PHD000116','PHD000117','PHD000118','PHD000119',
  'PHD000120','PHD000121','PHD000122','PHD000123','PHD000124','PHD000125','PHD000126',
  'PHD000127','PHD000128','PHD000129','PHD000130','PHD000131','PHD000132','PHD000133',
  'PHD000134','PHD000135','PHD000136','PHD000137','PHD000138','PHD000139','PHD000140',
  'PHD000141','PHD000142','PHD000143','PHD000144','PHD000145','PHD000146','PHD000147',
  'PHD000148','PHD000149','PHD000150','PHD000151','PHD000152','PHD000153','PHD000154',
  'PHD000155','PHD000156','PHD000157','PHD000158','PHD000159','PHD000160','PHD000161',
  'PHD000162','PHD000163','PHD000164','PHD000165','PHD000166','PHD000167','PHD000168',
  'PHD000169','PHD000170','PHD000171','PHD000172','PHD000173','PHD000174','PHD000175',
  'PHD000176','PHD000177','PHD000178','PHD000179','PHD000180','PHD000181','PHD000182',
  'PHD000183','PHD000184','PHD000185','PHD000186','PHD000187','PHD000188','PHD000189',
  'PHD000190','PHD000191','PHD000192','PHD000193','PHD000194','PHD000195','PHD000196',
  'PHD000197','PHD000198','PHD000199','PHD000200','PHD000201','PHD000202','PHD000203',
  'PHD000204','PHD000205','PHD000206','PHD000207','PHD000208','PHD000209','PHD000210',
  'PHD000211','PHD000212','PHD000213','PHD000214','PHD000215','PHD000216','PHD000217',
  'PHD000218','PHD000219','PHD000220','PHD000221','PHD000222','PHD000223','PHD000224',
  'PHD000225','PHD000226','PHD000227','PHD000228','PHD000229','PHD000230','PHD000231',
  'PHD000232','PHD000233','PHD000234','PHD000235','PHD000236','PHD000237','PHD000238',
  'PHD000239','PHD000240','PHD000241','PHD000242','PHD000243','PHD000244','PHD000245',
  'PHD000246','PHD000247','PHD000248','PHD000249','PHD000250','PHD000251','PHD000252',
  'PHD000253','PHD000254','PHD000255','PHD000256','PHD000257','PHD000258','PHD000259',
  'PHD000260','PHD000261','PHD000262','PHD000263','PHD000264','PHD000265','PHD000266',
  'PHD000267','PHD000268','PHD000269','PHD000270','PHD000271','PHD000272','PHD000273',
  'PHD000274','PHD000275','PHD000276','PHD000277','PHD000278','PHD000279','PHD000280',
  'PHD000281','PHD000282','PHD000283','PHD000284','PHD000285','PHD000286','PHD000287',
  'PHD000288','PHD000289','PHD000290','PHD000291','PHD000292','PHD000293','PHD000294',
  'PHD000295','PHD000296','PHD000297','PHD000298','PHD000299','PHD000300','PHD000301',
  'PHD000302','PHD000303','PHD000304','PHD000305','PHD000306','PHD000307','PHD000308',
  'PHD000309','PHD000310','PHD000311','PHD000312','PHD000313','PHD000314','PHD000315',
  'PHD000316','PHD000317','PHD000318','PHD000319','PHD000320','PHD000321','PHD000322',
  'PHD000323','PHD000324','PHD000325','PHD000326','PHD000327','PHD000328','PHD000329',
  'PHD000330','PHD000331','PHD000332','PHD000333','PHD000334','PHD000335','PHD000336',
  'PHD000337','PHD000338','PHD000339','PHD000340','PHD000341','PHD000342','PHD000343',
  'PHD000344','PHD000345','PHD000346','PHD000347','PHD000348','PHD000349','PHD000350',
  'PHD000351','PHD000352','PHD000353','PHD000354','PHD000355','PHD000356','PHD000357',
  'PHD000358','PHD000359','PHD000360','PHD000361','PHD000362','PHD000363','PHD000364',
  'PHD000365','PHD000366','PHD000367','PHD000368','PHD000369'
];

const targetSet = new Set(TARGET_ORDERS);

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Fetch from Supabase
  console.log('Fetching from Supabase...');
  let allSupabaseOrders = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('order_num, created_at')
      .range(page * 500, (page + 1) * 500 - 1)
      .order('created_at', { ascending: true });
    if (error) { console.error('Supabase error:', error); return; }
    if (data.length === 0) break;
    allSupabaseOrders.push(...data);
    if (data.length < 500) break;
    page++;
  }
  console.log(`Total Supabase orders: ${allSupabaseOrders.length}`);

  // Map using PHD format
  const supabaseMap = {};
  for (const o of allSupabaseOrders) {
    const phd = supabaseToPHD(o.order_num);
    if (phd && targetSet.has(phd)) {
      supabaseMap[phd] = o.created_at;
    }
  }
  console.log(`Matched ${Object.keys(supabaseMap).length} target orders in Supabase`);

  // 2. Fetch from Google Sheets
  console.log('Fetching from Google Sheets...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Orders!A1:Z',
  });
  const rows = res.data.values || [];
  const headers = rows[0];
  const orderNoIdx = headers.indexOf('order_no');
  const createdAtIdx = headers.indexOf('created_at');

  // 3. Compare
  const mismatches = [];
  const sheetsFound = {};

  for (let i = 1; i < rows.length; i++) {
    const orderNo = rows[i][orderNoIdx];
    if (orderNo && targetSet.has(orderNo)) {
      const sheetsDate = rows[i][createdAtIdx] || '';
      sheetsFound[orderNo] = true;
      const sbDate = supabaseMap[orderNo];
      if (sbDate) {
        const sbNorm = new Date(sbDate).toISOString();
        const shNorm = sheetsDate ? new Date(sheetsDate).toISOString() : '';
        if (sbNorm !== shNorm) {
          const colLetter = String.fromCharCode(65 + createdAtIdx);
          mismatches.push({
            orderNo,
            rowIndex: i + 1,
            sheetsDate,
            supabaseDate: sbDate,
            cellRef: `${colLetter}${i + 1}`
          });
        }
      }
    }
  }

  // 4. Report
  console.log(`\n=== COMPARISON RESULTS ===`);
  console.log(`Matched & correct: ${Object.keys(supabaseMap).length - mismatches.length}`);
  console.log(`Mismatches: ${mismatches.length}`);
  console.log(`Only in Sheets (not in Supabase): ${TARGET_ORDERS.filter(o => !supabaseMap[o] && sheetsFound[o]).length}`);
  console.log(`Only in Supabase (not in Sheets): ${TARGET_ORDERS.filter(o => supabaseMap[o] && !sheetsFound[o]).length}`);
  console.log(`In neither: ${TARGET_ORDERS.filter(o => !supabaseMap[o] && !sheetsFound[o]).length}`);

  if (mismatches.length === 0) {
    console.log('\nAll dates match! No updates needed.');
    return;
  }

  console.log('\n=== MISMATCHES ===');
  console.log('Order | Sheets created_at | Supabase created_at');
  console.log('---|---|---');
  for (const m of mismatches) {
    console.log(`${m.orderNo} | ${m.sheetsDate} | ${m.supabaseDate}`);
  }

  // 5. Fix in Google Sheets
  console.log(`\nFixing ${mismatches.length} orders in Google Sheets...`);
  const batchUpdateValues = mismatches.map(m => ({
    range: `Orders!${m.cellRef}`,
    values: [[m.supabaseDate]]
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: batchUpdateValues
    }
  });

  console.log(`Done! Updated ${mismatches.length} order dates.`);
}

main().catch(console.error);
