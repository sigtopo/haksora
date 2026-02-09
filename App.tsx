
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Send, Clock, 
  RefreshCw, Upload, ShieldCheck, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Report, GeoLocation, MapMode } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

// Leaflet Icon Fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const reportIcon = L.divIcon({
  className: 'report-marker',
  html: '<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
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
    if (flyToLocation) map.setView([flyToLocation.lat, flyToLocation.lng], 18, { animate: true });
  }, [flyToLocation, map]);
  useMapEvents({
    click(e) {
      if (mode === 'PICK_LOCATION') onLocationPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>('VIEW');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [countdown, setCountdown] = useState(8);
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gov_reports_v2');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  useEffect(() => {
    let timer: any;
    if (loading && countdown > 0) {
      timer = setInterval(() => setCountdown(p => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [loading, countdown]);

  const getShortAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address;
        setPlaceName(addr.road || addr.suburb || addr.village || addr.city || "إحداثيات جغرافية");
      }
    } catch { setPlaceName("نقطة رصد"); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChangeOnly = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(file);
        setImagePreview(reader.result as string);
        if (!isChangeOnly) {
          setShowWelcome(false);
          setShowLocationOptions(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickedLocation(loc);
        setShowLocationOptions(false);
        setIsFormOpen(true);
        getShortAddress(loc.lat, loc.lng);
        setLoading(false);
      },
      () => { setLoading(false); alert("GPS Error"); },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationPickedOnMap = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setMapMode('VIEW');
    setIsFormOpen(true);
    getShortAddress(loc.lat, loc.lng);
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;
    setLoading(true);
    setIsMinimized(true);
    setCountdown(8);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: placeName,
        danger_level: dangerLevel || "رصد تلقائي",
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        image_url: imageUrl
      });
      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: new Date().toLocaleString('ar-MA'),
        place_name: placeName,
        imageUrl: imageUrl,
      };
      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('gov_reports_v2', JSON.stringify(updated));
      resetForm();
    } catch { 
      setIsMinimized(false); 
      alert("خطأ في الإرسال");
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setShowLocationOptions(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPlaceName("");
    setDangerLevel("");
    setSelectedImage(null);
    setImagePreview(null);
    setIsMinimized(false);
    setShowWelcome(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f1f5f9] overflow-hidden relative">
      
      {/* Side Marginal Indicator (Blinker/Toggle) */}
      {loading && (
        <div className="side-status-indicator flex flex-col items-center gap-2">
           <button 
             onClick={() => setIsMinimized(!isMinimized)}
             className="w-16 h-16 bg-[#064e3b] text-white rounded-full shadow-2xl border-4 border-white flex items-center justify-center transition-transform active:scale-90"
           >
             {isMinimized ? <div className="text-lg font-bold">{countdown}</div> : <ChevronRight size={24} className="rotate-180" />}
           </button>
           <div className="bg-white px-2 py-0.5 rounded shadow text-[9px] font-bold text-slate-500">الحالة</div>
        </div>
      )}

      {/* Welcome Screen */}
      {showWelcome && !isFormOpen && !showLocationOptions && !loading && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[32px] p-10 w-full max-w-[420px] shadow-2xl text-center border border-slate-100">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">منصة الرصد الحكومي</h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed px-2">نظام التوثيق الجغرافي للمناطق المتضررة. يرجى المباشرة بإضافة صورة حية من الميدان.</p>
            <div className="space-y-4">
              <button 
                onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                className="w-full bg-[#064e3b] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl active:scale-95 transition-all"
              >
                <Camera size={24}/> التقاط صورة حية
              </button>
              <button 
                onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Upload size={24}/> رفع من الجهاز
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Source Options */}
      {showLocationOptions && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-10 w-full max-w-[380px] shadow-2xl text-center border border-slate-50">
            <h3 className="text-xl font-bold text-slate-800 mb-8">أين تم التوثيق؟</h3>
            <div className="grid grid-cols-1 gap-4">
               <button onClick={useMyPosition} className="p-6 bg-blue-50 hover:bg-blue-100 rounded-2xl flex items-center justify-center gap-4 text-blue-700 font-bold border border-blue-100 transition-all shadow-sm">
                  <MapPin size={28}/> موقعي الحالي الآن
               </button>
               <button onClick={() => { setShowLocationOptions(false); setMapMode('PICK_LOCATION'); }} className="p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center gap-4 text-slate-700 font-bold border border-slate-200 transition-all shadow-sm">
                  <MapPin size={28} className="text-rose-500" /> التحديد على الخريطة
               </button>
            </div>
            <button onClick={resetForm} className="mt-8 text-slate-300 text-xs font-bold underline hover:text-slate-500 transition-colors">إلغاء التقرير</button>
          </div>
        </div>
      )}

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full">
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          <MapController mode={mapMode} flyToLocation={pickedLocation} onLocationPick={handleLocationPickedOnMap} />
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right">
                  <p className="font-bold text-xs text-slate-700">{r.place_name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Target Crosshair for Picking Mode */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
             <div className="target-circle">
                <div className="target-cross-v"></div>
                <div className="target-cross-v bottom"></div>
                <div className="target-cross-h"></div>
                <div className="target-cross-h right"></div>
                <div className="target-pin"></div>
             </div>
             <div className="mt-8 bg-black/70 text-white px-5 py-2 rounded-full text-[13px] font-bold backdrop-blur-sm border border-white/20">انقر لتحديد موقع الضرر</div>
          </div>
        )}

        {/* Professional Government Form */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-lg animate-in zoom-in-95">
            <div className="bg-white rounded-[32px] w-full max-w-[420px] shadow-2xl overflow-hidden border border-slate-100">
              
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">بيانات التقرير الميداني</h3>
                 </div>
                 {loading ? <div className="text-emerald-600 font-bold text-xs animate-pulse">جاري الإرسال...</div> : <button onClick={resetForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>}
              </div>

              <div className="p-10">
                {/* Image Preview Area with "Replace Only" Logic */}
                <div className="relative aspect-video rounded-3xl overflow-hidden mb-10 border-4 border-slate-50 shadow-inner group">
                   <img src={imagePreview!} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                   <button 
                    onClick={() => changeImageInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-white/95 px-4 py-2 rounded-xl shadow-xl text-slate-700 hover:bg-white transition-all flex items-center gap-2 text-xs font-bold border border-slate-100"
                   >
                     <RefreshCw size={14}/> تبديل الصورة
                   </button>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2 text-right">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider px-1">الموقع الجغرافي (تلقائي)</label>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center gap-4 group focus-within:border-emerald-200 transition-all">
                       <MapPin size={20} className="text-emerald-600" />
                       <input 
                        type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                        className="w-full bg-transparent text-base font-bold text-slate-800 outline-none"
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-right">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider px-1">وصف الضرر / الملاحظات</label>
                    <textarea 
                      rows={3} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm font-medium outline-none text-slate-700 resize-none focus:border-emerald-300 transition-all"
                      placeholder="أدخل أي ملاحظات ميدانية إضافية هنا..."
                    />
                  </div>

                  <div className="flex justify-between items-center px-2 text-[11px] text-slate-400 font-medium">
                     <div className="flex items-center gap-1.5"><Clock size={12}/> {new Date().toLocaleTimeString('ar-MA')}</div>
                     <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold">اتصال آمن ومؤمن</div>
                  </div>
                </div>
              </div>

              <div className="p-8 pt-0 flex gap-4">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="flex-[4] bg-[#064e3b] text-white py-5 rounded-2xl font-bold shadow-xl active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-3 transition-all text-xl"
                  >
                    {loading ? <Loader2 size={28} className="animate-spin"/> : <Send size={22}/>}
                    <span>اعتماد ورفع التقرير</span>
                  </button>
                  {!loading && <button onClick={resetForm} className="flex-1 text-slate-400 font-bold text-sm hover:text-slate-600">تجاهل</button>}
              </div>
            </div>
          </div>
        )}
        
        {/* Main Hidden File Inputs */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        {/* Dedicated Change Input to keep state cleaner */}
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      <footer className="z-[1001] bg-white border-t border-slate-100 p-2.5 text-center text-[10px] text-slate-300 font-bold uppercase tracking-[2.5px]">
        نظام الرصد الميداني الرقمي • وزارة الداخلية
      </footer>
    </div>
  );
};

export default App;
