
// @ts-nocheck
/* 
  هذا الكود يتم وضعه في Google Apps Script الملحق بجدول البيانات
*/
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // صياغة موقع XY
    var locationXY = "";
    if (data.latitude && data.longitude) {
      locationXY = data.latitude + ", " + data.longitude;
    }

    // رابط الصورة (قابل للنقر في جدول البيانات)
    var imageLink = "";
    if (data.lien_image) {
      imageLink = '=HYPERLINK("' + data.lien_image + '","عرض الصورة")';
    }

    // إضافة الصف (الإحداثيات، رابط الخريطة، رابط الصورة)
    sheet.appendRow([
      locationXY,            // العمود 1: الإحداثيات XY
      data.lien_maps || "",  // العمود 2: رابط الخريطة
      imageLink              // العمود 3: رابط الصورة
    ]);

    return ContentService
      .createTextOutput("تم إرسال البيانات بنجاح")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    Logger.log(err);
    return ContentService
      .createTextOutput("حدث خطأ أثناء إرسال البيانات")
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
