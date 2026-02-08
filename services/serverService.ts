
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dyulqoqyd/image/upload";
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnC5_RT7_88yeRyjrvomeBXHTIRbTa11xWwWXuUo_4aRLBoFauzcLfB_L08Uuel0lqEg/exec';

export const uploadImageToCloudinary = async (imageFile: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", imageFile);
  formData.append("upload_preset", "khatar");
  
  try {
    const response = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.secure_url) {
      return data.secure_url;
    }
    throw new Error("فشل الحصول على رابط الصورة");
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

export const uploadReportToServer = async (data: {
  nom_douar: string;
  image_url: string;
  latitude: number;
  longitude: number;
  type_risk: string;
}) => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
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
