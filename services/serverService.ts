
const CLOUD_NAME = "dyulqoqyd";
const UPLOAD_PRESET = "khatar";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJ5AUAusHA1SknpkYrOhFACvw9bhOGyNTpBzJSAbB4pCBeWAl1RbCJjsCYLLpo10NCRg/exec';

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
  nom_douar: string;
  danger_level: string;
  latitude: number;
  longitude: number;
  image_url: string;
}): Promise<void> => {
  try {
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
