
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, X, Loader2, Target, Send, Database, Trash2, Image as ImageIcon, Camera } from 'lucide-react';
import { Report, GeoLocation, MapMode } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const pointIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative;">
      <div class="marker-pulse" style="color: #ef4444"></div>
      <div class="marker-pin" style="background-color: #ef4444"></div>
    </div>
  `,
  iconSize: [30, 42],
  iconAnchor: [15, 42]
});

const selectionIcon = L.divIcon({
  className: 'selection-icon',
  html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-bounce">
          <div class="w-2 h-2 bg-white rounded-full"></div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// وظيفة لضغط الصورة قبل الرفع
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // تقليل الأبعاد إذا كانت كبيرة جداً للحفاظ على الحجم
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("فشل ضغط الصورة"));
            }
          },
          'image/jpeg',
          0.7 // الجودة (0.7 كافية جداً لتبقى أقل من 1 ميجا)
        );
      };
    };
    reader.onerror = (err) => reject(err);
  });
};

const MapController: React.FC<{ 
  mode: MapMode; 
  onLocationPick: (loc: GeoLocation) => void;
  flyToLocation: GeoLocation | null;
}> = ({ mode, onLocationPick, flyToLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (flyToLocation) {
      map.flyTo([flyToLocation.lat, flyToLocation.lng], 17, {
        animate: true,
        duration: 1.5
      });
    }
  }, [flyToLocation, map]);

  useEffect(() => {
    if (mode === 'PICK_LOCATION') {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [mode, map]);

  useMapEvents({
    click(e) {
      if (mode === 'PICK_LOCATION') {
        onLocationPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  return null;
};

const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>('VIEW');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<GeoLocation | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pointName, setPointName] = useState("");
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('field_reports_with_images');
    if (saved) {
      setReports(JSON.parse(saved));
    }
    handleGetCurrentLocation(false);
  }, []);

  const saveReports = (newReports: Report[]) => {
    setReports(newReports);
    localStorage.setItem('field_reports_with_images', JSON.stringify(newReports));
  };

  const handleGetCurrentLocation = (setAsPicked = true) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (setAsPicked) {
          setPickedLocation(loc);
          setFlyToTarget(loc);
        }
      },
      (err) => console.debug("GPS Fetch error", err),
      { enableHighAccuracy: true }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!pickedLocation) {
      alert("يرجى تحديد موقع أولاً.");
      return;
    }
    if (!imageFile) {
      alert("يرجى اختيار صورة أولاً.");
      return;
    }

    setLoading(true);
    try {
      // 1. ضغط الصورة قبل الرفع
      setStatusMsg("جاري معالجة وضغط الصورة...");
      const compressedFile = await compressImage(imageFile);
      
      console.log(`Original size: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      // 2. الرفع إلى Cloudinary
      setStatusMsg("جاري رفع الصورة إلى Cloudinary...");
      const imageUrl = await uploadImageToCloudinary(compressedFile);

      // 3. إرسال البيانات إلى Google Sheets
      setStatusMsg("جاري حفظ البيانات في السجل...");
      const finalName = pointName || `نقطة ${pickedLocation.lat.toFixed(4)}`;
      
      await uploadReportToServer({
        nom_douar: finalName,
        image_url: imageUrl,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng
      });

      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: Date.now(),
        nom_douar: finalName,
        imageUrl: imageUrl
      };

      saveReports([newReport, ...reports]);
      setLoading(false);
      setStatusMsg(null);
      alert("تم الحفظ والرفع بنجاح!");
      resetForm();
    } catch (error: any) {
      console.error(error);
      alert("حدث خطأ: " + error.message);
      setLoading(false);
      setStatusMsg(null);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPointName("");
    setImageFile(null);
    setImagePreview(null);
  };

  const clearHistory = () => {
    if (confirm("هل تريد مسح النقاط المسجلة في هذا الجهاز فقط؟ (لن تحذف من السيرفر)")) {
      saveReports([]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-white overflow-hidden relative font-sans">
      {/* Header */}
      <header className="z-20 bg-white shadow-md p-4 flex justify-between items-center text-gray-800 border-b-4 border-emerald-600">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-200">
            <Camera size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">رصد المواقع بالصور</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Google Hybrid + Auto Compression</p>
          </div>
        </div>
        <button 
          onClick={clearHistory}
          className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-100 transition"
        >
          <Trash2 size={16} />
          مسح النقاط
        </button>
      </header>

      {/* Map View */}
      <main className="flex-1 relative">
        <MapContainer 
          center={[31.7917, -7.0926]} 
          zoom={6} 
          className="h-full w-full"
        >
          {/* طبقة جوجل هايبرد - قمر صناعي مع تسميات */}
          <TileLayer
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          />

          <MapController 
            mode={mapMode} 
            flyToLocation={flyToTarget}
            onLocationPick={(loc) => {
              setPickedLocation(loc);
              setFlyToTarget(loc);
              setMapMode('VIEW');
              setIsFormOpen(true);
            }} 
          />

          {pickedLocation && mapMode === 'VIEW' && isFormOpen && (
            <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={selectionIcon} />
          )}

          {userLocation && (
            <Circle 
              center={[userLocation.lat, userLocation.lng]} 
              radius={20} 
              pathOptions={{ fillColor: '#3b82f6', color: 'white', weight: 3, fillOpacity: 0.4 }} 
            />
          )}

          {reports.map((report) => (
            <Marker 
              key={report.id} 
              position={[report.location.lat, report.location.lng]}
              icon={pointIcon}
            >
              <Popup className="custom-popup">
                <div className="p-0 text-gray-800 w-full bg-white rounded-lg overflow-hidden">
                  {report.imageUrl && (
                    <div className="relative group cursor-pointer" onClick={() => window.open(report.imageUrl, '_blank')}>
                      <img 
                        src={report.imageUrl} 
                        alt={report.nom_douar} 
                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500" 
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">تكبير</span>
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-white">
                    <div className="font-black text-lg text-emerald-700 mb-1 leading-tight">{report.nom_douar}</div>
                    <div className="text-[10px] font-mono text-gray-400 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                      {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase">
                      <span>{new Date(report.timestamp).toLocaleDateString('ar-EG')}</span>
                      <span>{new Date(report.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* GPS Control */}
        <div className="absolute top-4 left-4 z-[1000]">
           <button 
            onClick={() => handleGetCurrentLocation(true)}
            className="bg-white text-blue-600 p-4 rounded-2xl shadow-2xl hover:bg-gray-50 transition border-2 border-white flex items-center justify-center active:scale-90"
            title="تحديد موقعي الآن"
          >
            <Navigation size={24} />
          </button>
        </div>

        {/* Action Button */}
        {!isFormOpen && mapMode === 'VIEW' && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xs px-4">
            <button 
              onClick={() => setIsFormOpen(true)}
              className="w-full bg-emerald-600 text-white py-5 rounded-[25px] shadow-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 font-black text-xl border-4 border-white active:scale-95 shadow-emerald-500/30"
            >
              <Camera size={28} />
              إرسال صورة ونقطة
            </button>
          </div>
        )}

        {/* Sidebar Panel */}
        {isFormOpen && (
          <div className="absolute inset-y-0 right-0 w-full md:w-[420px] bg-white z-[1100] shadow-2xl flex flex-col border-l border-gray-100 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                  <Camera size={20} />
                </div>
                <h2 className="text-lg font-black text-gray-900">إضافة بيانات جديدة</h2>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              {/* 1. Location Selection */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">تحديد الموقع</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleGetCurrentLocation(true)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all ${
                      pickedLocation && userLocation && Math.abs(pickedLocation.lat - userLocation.lat) < 0.0001 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <Navigation size={24} />
                    <span className="text-[10px] font-bold">موقعي الحالي</span>
                  </button>
                  <button 
                    onClick={() => {
                      setMapMode('PICK_LOCATION');
                      setIsFormOpen(false);
                    }}
                    className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all ${
                      pickedLocation && (!userLocation || Math.abs(pickedLocation.lat - userLocation.lat) >= 0.0001)
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                      : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <Target size={24} />
                    <span className="text-[10px] font-bold">تحديد على الخريطة</span>
                  </button>
                </div>
              </div>

              {/* 2. Image Selection */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">الصورة (أقل من 1 ميجا تلقائياً)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative w-full aspect-video rounded-3xl border-2 border-dashed cursor-pointer overflow-hidden transition-all flex flex-col items-center justify-center gap-2 ${
                    imagePreview ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                  }`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
                         <span className="bg-white/90 text-gray-900 px-4 py-2 rounded-full font-black text-xs shadow-xl">تغيير الصورة</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white p-3 rounded-full shadow-sm text-emerald-600">
                        <ImageIcon size={28} />
                      </div>
                      <span className="text-[11px] font-bold text-gray-400">التقط صورة أو اختر من المعرض</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    capture="environment"
                  />
                </div>
              </div>

              {/* 3. Name */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">اسم النقطة / الدوار</label>
                <input 
                  type="text" 
                  placeholder="أدخل اسم الموقع..." 
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-gray-800 font-bold transition-all bg-gray-50"
                />
              </div>

              {/* Location Feedback */}
              {pickedLocation && (
                <div className="bg-emerald-900 text-white p-5 rounded-3xl space-y-2">
                  <div className="text-[10px] text-emerald-300 font-black uppercase flex items-center justify-between">
                    <span>الإحداثيات المختارة</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  </div>
                  <div className="font-mono text-xs flex justify-between bg-black/20 p-3 rounded-xl">
                    <span>{pickedLocation.lat.toFixed(6)}</span>
                    <span className="opacity-30">|</span>
                    <span>{pickedLocation.lng.toFixed(6)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t">
              <button 
                onClick={handleSubmit}
                disabled={loading || !pickedLocation || !imageFile}
                className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black hover:bg-emerald-700 disabled:bg-gray-200 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-500/20 flex flex-col items-center justify-center relative active:scale-95"
              >
                <div className="flex items-center gap-3">
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={20} />}
                  <span>{loading ? 'جاري الرفع...' : 'تأكيد وحفظ'}</span>
                </div>
                {statusMsg && <span className="text-[9px] font-bold opacity-70 mt-1">{statusMsg}</span>}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Status */}
      <footer className="z-10 bg-white border-t p-2 px-6 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <span>النقاط: {reports.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-blue-500">
          <Database size={10} />
          Synced to Google Sheets
        </div>
      </footer>
    </div>
  );
};

export default App;
