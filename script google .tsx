// @ts-nocheck
/* 
  This file contains Google Apps Script code. 
  The declarations below are added to resolve TypeScript compilation errors 
  when this file is included in a web project's source tree.
*/
declare var SpreadsheetApp: any;
declare var ContentService: any;

function doPost(e: any) {
  try {
    // فتح الورقة
    // Added comment: This line uses the Google Apps Script SpreadsheetApp global
    var ss = SpreadsheetApp.openById("17GNjvV79hW5STONMzHoKlG2-49ERUzl3-ZKpjZxhhsQ");
    var sheet = ss.getSheets()[0];

    // التأكد من وجود الصف الأول (العناوين)
    if(sheet.getLastRow() === 0) {
      sheet.appendRow(["اسم الدوار", "رابط الصورة", "الإحداثيات", "نوع الخطر"]);
    }

    // قراءة البيانات من POST
    var data = JSON.parse(e.postData.contents);

    var nomDouar = data.nom_douar || "";
    var imageUrl = data.image_url || "";
    var latitude = data.latitude || "";
    var longitude = data.longitude || "";
    var typeRisk = data.type_risk || "";

    // دمج الإحداثيات في حقل واحد
    var coordinates = latitude && longitude ? latitude + ", " + longitude : "";

    // إضافة الصف الجديد
    sheet.appendRow([nomDouar, imageUrl, coordinates, typeRisk]);

    // Added comment: This uses the ContentService global to return a JSON response
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "تم حفظ البيانات في Google Sheet بنجاح!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err: any) {
    // Added comment: Error handling using ContentService for GAS
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "حدث خطأ: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
