/**
 * 클라우드 세이브 - Google Apps Script
 * 기존 리더보드 스크립트에 아래 함수들을 추가하세요.
 * 스프레드시트에 "CloudSave" 시트를 추가하세요 (A: code, B: data, C: timestamp)
 */

// ── 기존 doPost에 아래 분기 추가 ──
// function doPost(e) {
//   const body = JSON.parse(e.postData.contents);
//   if (body.action === "cloud_save") return cloudSave(body);
//   if (body.action === "cloud_load") return cloudLoad(body);
//   // ... 기존 리더보드 로직 ...
// }

function cloudSave(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CloudSave");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "시트 없음" }))
    .setMimeType(ContentService.MimeType.JSON);

  const code = body.code;
  const data = body.data;

  // 기존 코드 찾기 → 덮어쓰기
  const codes = sheet.getRange("A:A").getValues();
  let row = -1;
  for (let i = 0; i < codes.length; i++) {
    if (codes[i][0] === code) { row = i + 1; break; }
  }

  if (row > 0) {
    sheet.getRange(row, 2).setValue(data);
    sheet.getRange(row, 3).setValue(new Date().toISOString());
  } else {
    sheet.appendRow([code, data, new Date().toISOString()]);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true, code: code }))
    .setMimeType(ContentService.MimeType.JSON);
}

function cloudLoad(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CloudSave");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "시트 없음" }))
    .setMimeType(ContentService.MimeType.JSON);

  const code = body.code;
  const codes = sheet.getRange("A:A").getValues();
  for (let i = 0; i < codes.length; i++) {
    if (codes[i][0] === code) {
      const data = sheet.getRange(i + 1, 2).getValue();
      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "코드를 찾을 수 없습니다" }))
    .setMimeType(ContentService.MimeType.JSON);
}
