
const CLOUD_NAME = "dyulqoqyd";
const UPLOAD_PRESET = "khatar";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjNwL7EDAZQXnt8LL9Aca0M4Io5zx5gWR2w_KR-5fn/exec';

export const uploadImageToCloudinary = async (imageFile: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", imageFile);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);
  
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
  place_name: string;
  latitude: number;
  longitude: number;
  lien_maps: string;
  lien_image: string;
}): Promise<void> => {
  try {
    // السكريبت الجديد يتوقع هذه الحقول بالضبط ليقوم هو بتوليد التاريخ والوقت داخلياً أو استقباله
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error("Server upload error:", error);
    throw error;
  }
};
