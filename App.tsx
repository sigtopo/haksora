
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, X, Loader2, MapPin, Trash2, 
  Check, Camera, Map as MapIcon, RotateCcw, Plus
} from 'lucide-react';
import { Report, GeoLocation, MapMode, RISK_TYPES } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

// Leaflet Icon Fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const redIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('danger_points_v3');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  const handleGetCurrentLocation = (setAsPicked = true) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (setAsPicked) {
          setPickedLocation(loc);
          setFlyToTarget(loc);
          setMapMode('VIEW');
          setIsFormOpen(true);
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
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRetakePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage) {
      alert("المرجو تحديد الموقع والتقاط صورة");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload to Cloudinary
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      
      // 2. Prepare Google Maps Link
      const mapsLink = `https://www.google.com/maps?q=${pickedLocation.lat},${pickedLocation.lng}`;

      // 3. Upload to Google Sheets
      await uploadReportToServer({
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        lien_image: imageUrl,
        lien_maps: mapsLink
      });

      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: Date.now(),
        nom_douar: pointName || "نقطة جديدة",
        imageUrl: imageUrl,
        type_risk: "رصد ميداني"
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('danger_points_v3', JSON.stringify(updated));
      resetForm();
    } catch (error) {
      alert("حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPointName("");
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleAddPointClick = () => {
    setMapMode('PICK_LOCATION');
    handleGetCurrentLocation(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F0F2F5] text-[#111B21] overflow-hidden relative">
      <header className="z-20 bg-[#00A884] p-4 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <MapIcon size={24} />
          <h1 className="text-lg font-bold">راصد الميدان v2</h1>
        </div>
        <button 
          onClick={() => { if(confirm("مسح السجل المحلي؟")) { setReports([]); localStorage.removeItem('danger_points_v3'); }}}
          className="p-2 hover:bg-white/10 rounded-full"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full">
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
            <Circle center={[userLocation.lat, userLocation.lng]} radius={30} pathOptions={{ color: '#00A884', fillColor: '#00A884', fillOpacity: 0.2 }} />
          )}
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={redIcon}>
              <Popup className="custom-popup">
                <div className="flex flex-col">
                  {r.imageUrl && <img src={r.imageUrl} className="w-full h-24 object-cover" />}
                  <div className="p-2">
                    <p className="font-bold text-xs">{r.nom_douar}</p>
                    <p className="text-[10px] text-gray-500">{new Date(r.timestamp).toLocaleString('ar-SA')}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute top-4 right-4 z-[1000]">
          <button 
            onClick={() => handleGetCurrentLocation(true)}
            className="bg-white p-3 rounded-full shadow-lg text-[#00A884]"
          >
            <Navigation size={24} />
          </button>
        </div>

        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute inset-0 z-[1001] bg-black/10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111B21]/80 text-white px-6 py-3 rounded-full flex items-center gap-2 animate-bounce">
              <MapPin size={20} className="text-[#00A884]" />
              <span className="text-sm font-bold">انقر لتحديد النقطة</span>
            </div>
          </div>
        )}

        {!isFormOpen && mapMode === 'VIEW' && (
          <button 
            onClick={handleAddPointClick}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-[#00A884] text-white p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={28} />
            <span className="font-bold pr-1">إضافة رصد</span>
          </button>
        )}

        {isFormOpen && (
          <div className="absolute inset-x-0 bottom-0 z-[1100] bg-white rounded-t-[32px] shadow-2xl flex flex-col bottom-sheet">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3" />
            <div className="px-6 pb-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">تفاصيل الرصد</h2>
                <button onClick={resetForm} className="p-2 text-gray-400"><X size={20} /></button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleGetCurrentLocation(true)} className={`p-4 rounded-2xl border-2 transition ${pickedLocation && userLocation ? 'bg-[#E7FCE3] border-[#00A884] text-[#00A884]' : 'bg-gray-50 border-gray-100'}`}>
                    <Navigation size={18} className="inline ml-2" />
                    <span className="text-xs font-bold">موقعي</span>
                  </button>
                  <button onClick={() => { setMapMode('PICK_LOCATION'); setIsFormOpen(false); }} className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50">
                    <MapPin size={18} className="inline ml-2" />
                    <span className="text-xs font-bold">الخريطة</span>
                  </button>
                </div>

                {pickedLocation && (
                  <div className="bg-[#F0F2F5] p-3 rounded-xl flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span>{pickedLocation.lat.toFixed(6)}, {pickedLocation.lng.toFixed(6)}</span>
                    <span className="text-[#00A884]">✓ موقع محدد</span>
                  </div>
                )}

                <input 
                  type="text" 
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                  placeholder="اسم المكان (اختياري)"
                  className="w-full bg-[#F0F2F5] p-4 rounded-xl border-none outline-none font-bold"
                />

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative w-full h-52 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-[#F0F2F5] ${imagePreview ? 'border-solid border-[#00A884]' : 'border-gray-200'}`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center gap-3">
                        <button onClick={handleRetakePhoto} className="bg-red-500 text-white px-5 py-2 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg">
                          <RotateCcw size={16} /> إعادة التقاط
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Camera size={48} className="mb-2" />
                      <p className="text-xs font-bold">التقط صورة الميدان</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageChange} />

                <button 
                  onClick={handleSubmit}
                  disabled={loading || !pickedLocation || !selectedImage}
                  className="w-full bg-[#00A884] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl disabled:bg-gray-200"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} />}
                  حفظ وإرسال للجدول
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
