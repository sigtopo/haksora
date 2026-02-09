
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Send, Clock, 
  RefreshCw, Upload, ShieldCheck, CheckCircle2, ChevronRight, ImagePlus, ChevronDown, 
  Map as MapIcon, Globe
} from 'lucide-react';
import { Report, GeoLocation, MapMode } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

// Moroccan Regions Data
const REGIONS = [
  { id: 1, name: "طنجة - تطوان - الحسيمة", center: [35.4, -5.5], zoom: 9 },
  { id: 2, name: "الشرق", center: [34.0, -2.5], zoom: 8 },
  { id: 3, name: "فاس - مكناس", center: [33.8, -4.5], zoom: 9 },
  { id: 4, name: "الرباط - سلا - القنيطرة", center: [34.0, -6.3], zoom: 10 },
  { id: 5, name: "بني ملال - خنيفرة", center: [32.5, -6.2], zoom: 9 },
  { id: 6, name: "الدار البيضاء - سطات", center: [33.3, -7.5], zoom: 10 },
  { id: 7, name: "مراكش - آسفي", center: [31.6, -8.3], zoom: 9 },
  { id: 8, name: "درعة - تافيلالت", center: [31.3, -4.5], zoom: 8 },
  { id: 9, name: "سوس - ماسة", center: [30.2, -8.8], zoom: 9 },
  { id: 10, name: "كلميم - واد نون", center: [28.5, -10.5], zoom: 8 },
  { id: 11, name: "العيون - الساقية الحمراء", center: [26.5, -12.5], zoom: 8 },
  { id: 12, name: "الداخلة - وادي الذهب", center: [23.5, -14.8], zoom: 8 },
];

// Leaflet Icon Fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const reportIcon = L.divIcon({
  className: 'report-marker',
  html: '<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const MapController: React.FC<{ 
  mode: MapMode; 
  onLocationPick: (loc: GeoLocation) => void;
  flyTo: { center: [number, number], zoom: number } | null;
}> = ({ mode, onLocationPick, flyTo }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.setView(flyTo.center, flyTo.zoom, { animate: true, duration: 1.5 });
  }, [flyTo, map]);
  
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
  const [loading, setLoading] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number], zoom: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gov_reports_v5');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  useEffect(() => {
    let timer: any;
    if (loading && countdown > 0) {
      timer = setInterval(() => setCountdown(p => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [loading, countdown]);

  const generatePlusCodePlaceholder = (lat: number, lng: number) => {
    const chars = '23456789CFGHJMPQRVWX';
    const rand = (n: number) => Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${rand(4)}+${rand(2)} ${Math.floor(lat)},${Math.floor(lng)}`;
  };

  const getShortAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      const code = generatePlusCodePlaceholder(lat, lng);
      if (data && data.display_name) {
        const addr = data.address;
        const main = addr.road || addr.suburb || addr.city || "إقليم مجهول";
        setPlaceName(`${code} • ${main}`);
      } else {
        setPlaceName(code);
      }
    } catch { setPlaceName(generatePlusCodePlaceholder(lat, lng)); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChangeOnly = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(file);
        setImagePreview(reader.result as string);
        setShowDropdown(false);
        if (!isChangeOnly) {
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
        setMapTarget({ center: [loc.lat, loc.lng], zoom: 18 });
        setShowLocationOptions(false);
        setIsFormOpen(true);
        getShortAddress(loc.lat, loc.lng);
        setLoading(false);
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS للمتابعة"); },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationPickedOnMap = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setMapTarget({ center: [loc.lat, loc.lng], zoom: 18 });
    setMapMode('VIEW');
    setIsFormOpen(true);
    getShortAddress(loc.lat, loc.lng);
  };

  const selectRegion = (region: typeof REGIONS[0]) => {
    setSelectedRegionId(region.id);
    setMapTarget({ center: region.center as [number, number], zoom: region.zoom });
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
        danger_level: dangerLevel || "تم الرصد الميداني",
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
      localStorage.setItem('gov_reports_v5', JSON.stringify(updated));
      resetForm();
    } catch { 
      setIsMinimized(false); 
      alert("خطأ في الاتصال بالخادم");
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
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f1f5f9] overflow-hidden relative">
      
      {/* Official Header */}
      <header className="z-[2000] bg-[#064e3b] text-white px-6 py-4 flex flex-col gap-4 shadow-xl border-b border-emerald-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-400/30">
              <ShieldCheck size={26} className="text-emerald-300" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold leading-none tracking-tight">منصة الرصد الميداني</h1>
              <p className="text-[9px] text-emerald-200/60 mt-1 uppercase font-bold tracking-[0.15em]">المملكة المغربية • وزارة الداخلية</p>
            </div>
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="bg-emerald-800/50 hover:bg-emerald-700/60 px-4 py-2.5 rounded-2xl transition-all flex items-center gap-3 border border-emerald-700/50 group"
            >
              <ImagePlus size={20} className="text-emerald-300 group-active:scale-90" />
              <span className="text-sm font-bold">بدء رصد جديد</span>
              <ChevronDown size={14} className={`transition-transform duration-300 text-emerald-400 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute left-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden dropdown-shadow animate-in slide-in-from-top-2 duration-300">
                <button 
                  onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                  className="w-full px-6 py-5 text-right text-slate-700 hover:bg-slate-50 flex items-center gap-4 border-b border-slate-50 transition-colors"
                >
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><Camera size={18} /></div>
                  <span className="text-sm font-bold">التقاط صورة ميدانية</span>
                </button>
                <button 
                  onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                  className="w-full px-6 py-5 text-right text-slate-700 hover:bg-slate-50 flex items-center gap-4 transition-colors"
                >
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Upload size={18} /></div>
                  <span className="text-sm font-bold">رفع ملف من الجهاز</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Regions Scrolling Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          <div className="flex-shrink-0 flex items-center gap-2 px-2 bg-emerald-900/30 rounded-lg text-emerald-100/50 mr-1">
             <Globe size={14} />
             <span className="text-[10px] font-bold uppercase py-1">الجهات:</span>
          </div>
          {REGIONS.map(reg => (
            <button
              key={reg.id}
              onClick={() => selectRegion(reg)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                selectedRegionId === reg.id 
                ? 'bg-emerald-400 text-[#064e3b] border-emerald-300' 
                : 'bg-emerald-900/40 text-emerald-100 border-emerald-800/50 hover:bg-emerald-800'
              }`}
            >
              {reg.name}
            </button>
          ))}
        </div>
      </header>

      {/* Side Status Indicator */}
      {loading && (
        <div className="side-status-indicator flex flex-col items-center gap-3">
           <button 
             onClick={() => setIsMinimized(!isMinimized)}
             className="w-14 h-14 bg-[#064e3b] text-white rounded-full shadow-2xl border-4 border-white flex items-center justify-center transition-all active:scale-90"
           >
             {isMinimized ? <div className="text-lg font-bold">{countdown}</div> : <ChevronRight size={22} className="rotate-180" />}
           </button>
           {!isMinimized && (
             <div className="bg-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-100 text-[10px] font-bold text-emerald-700">جاري الرفع</div>
           )}
        </div>
      )}

      {/* Location Source Flow */}
      {showLocationOptions && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md">
          <div className="bg-white rounded-[36px] p-12 w-full max-w-[400px] shadow-2xl text-center border border-slate-100 animate-in slide-in-from-bottom-4">
            <h3 className="text-2xl font-bold text-slate-800 mb-8">تحديد الإحداثيات الميدانية</h3>
            <div className="grid grid-cols-1 gap-5">
               <button onClick={useMyPosition} className="p-6 bg-emerald-50 hover:bg-emerald-100 rounded-[24px] flex items-center justify-center gap-5 text-emerald-800 font-bold border border-emerald-200/50 transition-all group">
                  <div className="bg-emerald-100 p-2.5 rounded-xl group-hover:scale-110 transition-transform"><MapPin size={26}/></div>
                  <span className="text-base">استخدام موقعي الحالي (GPS)</span>
               </button>
               <button onClick={() => { setShowLocationOptions(false); setMapMode('PICK_LOCATION'); }} className="p-6 bg-slate-50 hover:bg-slate-100 rounded-[24px] flex items-center justify-center gap-5 text-slate-700 font-bold border border-slate-200 transition-all group">
                  <div className="bg-rose-50 p-2.5 rounded-xl text-rose-600 group-hover:scale-110 transition-transform"><MapIcon size={26} /></div>
                  <span className="text-base">الاختيار يدوياً من الخريطة</span>
               </button>
            </div>
            <button onClick={resetForm} className="mt-8 text-slate-300 text-xs font-bold underline hover:text-slate-500">إلغاء</button>
          </div>
        </div>
      )}

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full">
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          <MapController mode={mapMode} flyTo={mapTarget} onLocationPick={handleLocationPickedOnMap} />
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right">
                  <p className="font-bold text-[11px] text-slate-800 leading-snug">{r.place_name}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 justify-end"><Clock size={10}/> {r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Target Crosshair */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
             <div className="target-simple">
                <div className="target-center"></div>
             </div>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xl">
            <div className="bg-white rounded-[40px] w-full max-w-[440px] shadow-2xl overflow-hidden border border-slate-200/50">
              
              <div className="bg-slate-50/80 px-10 py-6 border-b border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <CheckCircle2 size={24} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">بيانات البلاغ المعتمدة</h3>
                 </div>
                 {!loading && <button onClick={resetForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>}
              </div>

              <div className="p-10">
                <div className="relative aspect-[16/10] rounded-[28px] overflow-hidden mb-10 border-4 border-slate-50 shadow-inner group bg-slate-100">
                   <img src={imagePreview!} className="w-full h-full object-cover" />
                   <button 
                    onClick={() => changeImageInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-white/95 px-5 py-2.5 rounded-2xl shadow-xl text-slate-700 hover:bg-white transition-all flex items-center gap-2.5 text-xs font-bold border border-slate-200"
                   >
                     <RefreshCw size={14} className="text-emerald-600"/> تبديل الصورة
                   </button>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2 text-right">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] px-1">الموقع (Plus Code)</label>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center gap-4 focus-within:border-emerald-300 transition-all">
                       <MapPin size={22} className="text-emerald-600" />
                       <input 
                        type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                        className="w-full bg-transparent text-base font-bold text-slate-800 outline-none"
                       />
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-right">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] px-1">وصف الضرر الميداني</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-200 text-sm font-medium outline-none text-slate-700 resize-none focus:border-emerald-400 transition-all"
                      placeholder="أدخل أي ملاحظات ميدانية..."
                    />
                  </div>

                  <div className="flex justify-between items-center px-2 text-[10px] text-slate-400 font-bold uppercase">
                     <div className="flex items-center gap-2"><Clock size={12}/> {new Date().toLocaleTimeString('ar-MA')}</div>
                     <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 tracking-wider">رصد جغرافي مؤمن</div>
                  </div>
                </div>
              </div>

              <div className="p-10 pt-0 flex gap-5">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="flex-[4] bg-[#064e3b] text-white py-5 rounded-[24px] font-bold shadow-xl active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 flex items-center justify-center gap-4 transition-all text-xl"
                  >
                    {loading ? <Loader2 size={32} className="animate-spin"/> : <Send size={24}/>}
                    <span>إرسال التقرير الموحد</span>
                  </button>
                  {!loading && <button onClick={resetForm} className="flex-1 text-slate-400 font-bold text-sm hover:text-slate-600">إلغاء</button>}
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden Inputs */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      <footer className="z-[1001] bg-white border-t border-slate-100 p-3 text-center text-[10px] text-slate-400 font-bold uppercase tracking-[3px] flex items-center justify-center gap-4">
        <span>المملكة المغربية</span>
        <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full"></span>
        <span>نظام الرصد الرقمي</span>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
