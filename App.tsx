
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, X, Loader2, MapPin, Trash2, Check, Camera, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { Report, GeoLocation, MapMode, RISK_TYPES } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const dangerMarkerIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const MapController: React.FC<{ 
  mode: MapMode; 
  onLocationPick: (loc: GeoLocation) => void;
  flyToLocation: GeoLocation | null;
}> = ({ mode, onLocationPick, flyToLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (flyToLocation) {
      map.flyTo([flyToLocation.lat, flyToLocation.lng], 16, { animate: true });
    }
  }, [flyToLocation, map]);

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
  
  // Form States
  const [pointName, setPointName] = useState("");
  const [riskType, setRiskType] = useState(RISK_TYPES[0]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('danger_points_v2');
    if (saved) {
      setReports(JSON.parse(saved));
    }
    handleGetCurrentLocation(false);
  }, []);

  const saveReports = (newReports: Report[]) => {
    setReports(newReports);
    localStorage.setItem('danger_points_v2', JSON.stringify(newReports));
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
      (err) => console.debug("GPS Error", err),
      { enableHighAccuracy: true }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !pointName.trim() || !selectedImage) {
      alert("يرجى إدخال كافة البيانات (الاسم، الموقع، والصورة)");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload to Cloudinary
      const imageUrl = await uploadImageToCloudinary(selectedImage);

      // 2. Upload to Google Sheets
      await uploadReportToServer({
        nom_douar: pointName,
        image_url: imageUrl,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        type_risk: riskType
      });

      // 3. Save locally
      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: Date.now(),
        nom_douar: pointName,
        imageUrl: imageUrl,
        type_risk: riskType
      };

      saveReports([newReport, ...reports]);
      setLoading(false);
      resetForm();
      alert("تم إرسال التقرير بنجاح!");
    } catch (error: any) {
      console.error(error);
      alert("حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPointName("");
    setRiskType(RISK_TYPES[0]);
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 text-gray-900 overflow-hidden relative font-sans">
      {/* Dynamic Header */}
      <header className="z-20 bg-white/90 backdrop-blur-md shadow-sm p-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-2 rounded-lg text-white">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h1 className="text-md font-bold text-gray-800 leading-tight">رصد المخاطر الميدانية</h1>
            <p className="text-[10px] text-gray-400 font-medium">نظام تصدير الإحداثيات المباشر</p>
          </div>
        </div>
        <button 
          onClick={() => { if(confirm("هل تريد مسح السجل المحلي؟")) saveReports([]); }}
          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
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

          {userLocation && (
            <Circle center={[userLocation.lat, userLocation.lng]} radius={40} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 }} />
          )}

          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={dangerMarkerIcon}>
              <Popup>
                <div className="overflow-hidden rounded-xl">
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt={r.nom_douar} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{r.type_risk}</span>
                      <span className="text-[10px] text-gray-400">{new Date(r.timestamp).toLocaleDateString('ar-MA')}</span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm mb-1">{r.nom_douar}</h3>
                    <p className="text-[10px] font-mono text-gray-400">{r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Controls */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
          <button 
            onClick={() => handleGetCurrentLocation(true)}
            className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 hover:bg-gray-50 active:scale-90 transition-all text-blue-600"
            title="تحديد موقعي"
          >
            <Navigation size={22} />
          </button>
        </div>

        {/* Floating Action Button */}
        {!isFormOpen && mapMode === 'VIEW' && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000]">
            <button 
              onClick={() => setIsFormOpen(true)}
              className="bg-red-600 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 hover:bg-red-700 active:scale-95 transition-all animate-bounce"
            >
              <Camera size={20} />
              رصد خطر جديد
            </button>
          </div>
        )}

        {/* Selection Indicator */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute inset-0 z-[1001] bg-black/20 flex items-center justify-center pointer-events-none">
            <div className="bg-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
              <MapPin size={20} className="text-red-500" />
              <span className="font-bold text-sm">انقر على الخريطة لتحديد الموقع</span>
            </div>
          </div>
        )}

        {/* Entry Sidebar/Form */}
        {isFormOpen && (
          <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:w-[400px] bg-white z-[1100] shadow-2xl flex flex-col border-t md:border-t-0 md:border-l animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">تفاصيل الرصد</h2>
                <p className="text-xs text-gray-400">يرجى ملء كافة المعطيات المطلوبة</p>
              </div>
              <button onClick={resetForm} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Location Picker Options */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">الموقع الجغرافي</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleGetCurrentLocation(true)}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${pickedLocation && userLocation ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  >
                    <Navigation size={20} />
                    <span className="text-[10px] font-bold">موقعي الحالي</span>
                  </button>
                  <button 
                    onClick={() => { setMapMode('PICK_LOCATION'); setIsFormOpen(false); }}
                    className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-400 flex flex-col items-center gap-2 hover:border-gray-200 transition-all"
                  >
                    <MapPin size={20} />
                    <span className="text-[10px] font-bold">اختيار يدوياً</span>
                  </button>
                </div>
                {pickedLocation && (
                  <div className="bg-gray-900 text-gray-300 p-3 rounded-xl font-mono text-[10px] flex justify-between items-center">
                    <span className="opacity-50">COORD:</span>
                    <span>{pickedLocation.lat.toFixed(6)}, {pickedLocation.lng.toFixed(6)}</span>
                  </div>
                )}
              </div>

              {/* Input Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">اسم الدوار / المكان</label>
                  <input 
                    type="text" 
                    value={pointName}
                    onChange={(e) => setPointName(e.target.value)}
                    placeholder="مثال: دوار أيت علي"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">نوع الخطر</label>
                  <select 
                    value={riskType}
                    onChange={(e) => setRiskType(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-red-500 outline-none transition-all font-bold appearance-none"
                  >
                    {RISK_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Image Upload Component */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">الصورة الميدانية</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative w-full aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${imagePreview ? 'border-solid border-green-500' : 'border-gray-200 hover:bg-gray-50 hover:border-red-300'}`}
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <ImageIcon className="text-white" size={32} />
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <Camera className="mx-auto text-gray-300 mb-2" size={32} />
                        <p className="text-xs text-gray-400 font-bold">اضغط لالتقاط أو اختيار صورة</p>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                  />
                </div>
              </div>
            </div>

            {/* Submission Area */}
            <div className="p-6 bg-gray-50 border-t">
              <button 
                onClick={handleSubmit}
                disabled={loading || !pickedLocation || !pointName.trim() || !selectedImage}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:bg-gray-200 disabled:text-gray-400 shadow-lg hover:bg-red-700 active:scale-95 transition-all shadow-red-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الرفع والمعالجة...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    إرسال التقرير النهائي
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
