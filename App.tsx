
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, X, Loader2, MapPin, Trash2, 
  Check, Camera, Image as ImageIcon, 
  AlertTriangle, ChevronDown, Plus, Map as MapIcon
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
  html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
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

  const handleSubmit = async () => {
    if (!pickedLocation || !pointName.trim() || !selectedImage) {
      alert("المرجو إكمال جميع البيانات والصورة");
      return;
    }

    setLoading(true);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: pointName,
        image_url: imageUrl,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        type_risk: riskType
      });

      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: Date.now(),
        nom_douar: pointName,
        imageUrl: imageUrl,
        type_risk: riskType
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('danger_points_v3', JSON.stringify(updated));
      setLoading(false);
      resetForm();
    } catch (error) {
      alert("خطأ في الإرسال");
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F0F2F5] text-[#111B21] overflow-hidden relative">
      {/* Header - Simple & Clean */}
      <header className="z-20 bg-[#00A884] p-4 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <MapIcon size={24} />
          <h1 className="text-lg font-bold">راصد الميدان</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { if(confirm("مسح السجل؟")) { setReports([]); localStorage.removeItem('danger_points_v3'); }}}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Map Area */}
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
              setIsFormOpen(true); // Auto-open form after pick
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
                    <p className="font-bold text-sm text-[#111B21]">{r.nom_douar}</p>
                    <p className="text-[10px] text-gray-500">{r.type_risk}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Action Buttons */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <button 
            onClick={() => handleGetCurrentLocation(true)}
            className="bg-white p-3 rounded-full shadow-lg text-[#00A884] hover:bg-gray-50 active:scale-95 transition"
          >
            <Navigation size={24} />
          </button>
        </div>

        {/* Selection Indicator Overlay */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute inset-0 z-[1001] bg-black/10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#111B21]/80 text-white px-6 py-3 rounded-full flex items-center gap-2 animate-bounce">
              <MapPin size={20} className="text-[#00A884]" />
              <span className="text-sm font-bold">حدد النقطة على الخريطة</span>
            </div>
          </div>
        )}

        {/* WhatsApp Style "Add" Button */}
        {!isFormOpen && mapMode === 'VIEW' && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-[#00A884] text-white p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={28} />
            <span className="font-bold pr-2">إضافة نقطة</span>
          </button>
        )}

        {/* Bottom Sheet Form */}
        {isFormOpen && (
          <div className="absolute inset-x-0 bottom-0 z-[1100] bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[90%] bottom-sheet">
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-4" />
            
            <div className="px-6 pb-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#111B21]">معلومات النقطة</h2>
                <button onClick={resetForm} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                {/* Location Selection Dropdown-like Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleGetCurrentLocation(true)}
                    className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition ${pickedLocation && userLocation ? 'bg-[#E7FCE3] border-[#00A884] text-[#00A884]' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <Navigation size={18} />
                    <span className="text-xs font-bold">موقعي الحالي</span>
                  </button>
                  <button 
                    onClick={() => { setMapMode('PICK_LOCATION'); setIsFormOpen(false); }}
                    className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[#00A884] transition"
                  >
                    <MapPin size={18} />
                    <span className="text-xs font-bold">من الخريطة</span>
                  </button>
                </div>

                {pickedLocation && (
                  <div className="bg-[#F0F2F5] p-3 rounded-xl flex justify-between items-center text-[10px] text-gray-500 font-mono">
                    <span>إحداثيات مؤكدة:</span>
                    <span>{pickedLocation.lat.toFixed(6)}, {pickedLocation.lng.toFixed(6)}</span>
                  </div>
                )}

                {/* Input Fields */}
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-xs text-gray-400 mb-1 block">اسم الدوار / المكان</label>
                    <input 
                      type="text" 
                      value={pointName}
                      onChange={(e) => setPointName(e.target.value)}
                      placeholder="أدخل الاسم هنا..."
                      className="w-full bg-[#F0F2F5] p-4 rounded-xl border-none outline-none font-bold focus:ring-2 focus:ring-[#00A884]/20 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">نوع الخطر</label>
                    <div className="relative">
                      <select 
                        value={riskType}
                        onChange={(e) => setRiskType(e.target.value)}
                        className="w-full bg-[#F0F2F5] p-4 rounded-xl border-none outline-none font-bold appearance-none cursor-pointer"
                      >
                        {RISK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  {/* WhatsApp-Style Image Upload */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">الصورة الميدانية</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative w-full h-48 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden bg-[#F0F2F5] ${imagePreview ? 'border-solid border-[#00A884]' : 'border-gray-200'}`}
                    >
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="bg-white/90 p-2 rounded-full text-[#111B21]"><Camera size={24} /></div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <Camera size={40} className="mb-2" />
                          <p className="text-xs font-bold uppercase tracking-widest">التقط صورة</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageChange} />
                  </div>
                </div>

                {/* Final Submit Button */}
                <button 
                  onClick={handleSubmit}
                  disabled={loading || !pickedLocation || !pointName.trim() || !selectedImage}
                  className="w-full bg-[#00A884] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition disabled:bg-gray-200 disabled:shadow-none"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} />}
                  إرسال التقرير الآن
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
