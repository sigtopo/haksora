
export const uploadImageToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "khatar");
  formData.append("cloud_name", "dyulqoqyd");

  const response = await fetch("https://api.cloudinary.com/v1_1/dyulqoqyd/image/upload", {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  if (!data.secure_url) throw new Error("فشل رفع الصورة إلى Cloudinary");
  return data.secure_url;
};

export const uploadReportToServer = async (data: {
  nom_douar: string;
  image_url: string;
  latitude: number;
  longitude: number;
}) => {
  // الرابط الجديد الذي زودتني به
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnC5_RT7_88yeRyjrvomeBXHTIRbTa11xWwWXuUo_4aRLBoFauzcLfB_L08Uuel0lqEg/exec';
  
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // نستخدم no-cors كما في المثال السابق لتجنب مشاكل الـ CORS مع Apps Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    return { status: 'success', message: 'تم حفظ البيانات بنجاح' };
  } catch (error) {
    console.error('Server upload failed:', error);
    throw error;
  }
};
