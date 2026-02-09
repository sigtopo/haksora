
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Send, Clock, 
  RefreshCw, Upload, AlertCircle, CheckCircle, ChevronRight, ImagePlus, ChevronDown, 
  Map as MapIcon, Globe, Info, Heart, PartyPopper, Navigation
} from 'lucide-react';
import { Report, GeoLocation, MapMode } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

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

const reportIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #f97316; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(249,115,22,0.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const MapController: React.FC<{ 
  mode: MapMode; 
  onLocationPick: (loc: GeoLocation) => void;
  flyTo: { center: [number, number], zoom: number } | null;
}> = ({ mode, onLocationPick, flyTo }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.setView(flyTo.center, flyTo.zoom, { animate: true, duration: 2 });
  }, [flyTo, map]);
  useMapEvents({
    click(e) { if (mode === 'PICK_LOCATION') onLocationPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
};

const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>('VIEW');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number], zoom: number } | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('disaster_reports_v1');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  const getShortAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      const code = `${Math.floor(lat).toString().slice(-2)}${Math.floor(lng).toString().slice(-2)}`;
      if (data && data.display_name) {
        setPlaceName(`${code} • ${data.address.road || data.address.suburb || "منطقة رصد"}`);
      } else {
        setPlaceName(`ID-${code}`);
      }
    } catch { setPlaceName("نقطة رصد ميدانية"); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChangeOnly = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(file);
        setImagePreview(reader.result as string);
        setShowAddMenu(false);
        if (!isChangeOnly) setShowLocationOptions(true);
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
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const selectRegion = (region: typeof REGIONS[0]) => {
    setMapTarget({ center: region.center as [number, number], zoom: region.zoom });
    setShowRegionPicker(false);
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;
    setLoading(true);
    setIsMinimized(true);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: placeName,
        danger_level: dangerLevel || "بلاغ مستعجل",
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
      setReports([newReport, ...reports]);
      localStorage.setItem('disaster_reports_v1', JSON.stringify([newReport, ...reports]));
      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); resetForm(); }, 3500);
    } catch { 
      setIsMinimized(false); 
      setLoading(false);
      alert("تعذر الإرسال، تحقق من الاتصال");
    }
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
    setShowAddMenu(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden relative">
      
      {/* Dynamic Navigation Header */}
      <header className="z-[2000] bg-[#1d4ed8]/90 backdrop-blur-md text-white px-5 py-3 flex items-center justify-between shadow-xl border-b border-blue-400/20 safe-top">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl border border-white/20">
            <Heart size={24} className="text-orange-400 fill-orange-400" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold tracking-tight">إغاثة ميدانية</h1>
            <p className="text-[9px] text-blue-100 opacity-70 uppercase font-bold tracking-wider">ساهم بصورة لإنقاذ الأرواح</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowRegionPicker(true)}
             className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
           >
             <Globe size={20} />
           </button>
           <div className="relative">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95 border border-orange-400/30"
              >
                <Camera size={18} />
                <span className="text-sm font-bold">رصد</span>
              </button>
              
              {showAddMenu && (
                <div className="absolute left-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
                  <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="w-full px-5 py-4 text-right text-slate-800 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                    <Camera size={18} className="text-blue-600" />
                    <span className="text-sm font-bold">التقاط صورة</span>
                  </button>
                  <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} className="w-full px-5 py-4 text-right text-slate-800 hover:bg-slate-50 flex items-center gap-3">
                    <Upload size={18} className="text-orange-500" />
                    <span className="text-sm font-bold">رفع ملف</span>
                  </button>
                </div>
              )}
           </div>
        </div>
      </header>

      {/* Main Map with ESRI Satellite */}
      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full">
          <TileLayer 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
            attribution="Esri" 
          />
          <TileLayer 
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" 
          />
          <MapController mode={mapMode} flyTo={mapTarget} onLocationPick={(loc) => { setPickedLocation(loc); setMapMode('VIEW'); setIsFormOpen(true); getShortAddress(loc.lat, loc.lng); }} />
          
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right bg-white rounded-lg">
                  <p className="font-bold text-xs text-slate-800">{r.place_name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
            <div className="target-icon"><div className="target-dot"></div></div>
          </div>
        )}

        {/* Region Picker Modal */}
        {showRegionPicker && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-[440px] shadow-2xl overflow-hidden border border-white/20 animate-slide-up">
              <div className="p-8 text-center bg-blue-600 text-white relative">
                <button onClick={() => setShowRegionPicker(false)} className="absolute top-6 left-6 opacity-60 hover:opacity-100 transition-opacity"><X size={24}/></button>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <Globe size={32} />
                </div>
                <h2 className="text-xl font-bold mb-1">اختر الجهة المستهدفة</h2>
                <p className="text-sm opacity-80">اختر منطقتك للبدء بالرصد الميداني</p>
              </div>
              <div className="p-6 region-grid bg-slate-50 no-scrollbar">
                {REGIONS.map(reg => (
                  <button key={reg.id} onClick={() => selectRegion(reg)} className="p-4 bg-white border border-slate-200 rounded-2xl text-right text-slate-700 font-bold text-xs shadow-sm active:bg-blue-50 transition-all hover:border-blue-300">
                    {reg.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Location Flow Modal */}
        {showLocationOptions && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-[380px] shadow-2xl text-center">
              <div className="mb-6 flex justify-center"><div className="p-4 bg-orange-100 rounded-2xl text-orange-600"><MapPin size={32}/></div></div>
              <h3 className="text-xl font-bold text-slate-800 mb-8">أين التقطت هذه الصورة؟</h3>
              <div className="space-y-4">
                 <button onClick={useMyPosition} className="w-full p-5 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-4 font-bold shadow-lg active:scale-95 transition-all">
                    <Navigation size={22} /> موقعي الحالي
                 </button>
                 <button onClick={() => { setShowLocationOptions(false); setMapMode('PICK_LOCATION'); }} className="w-full p-5 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center gap-4 font-bold active:scale-95 transition-all">
                    <MapIcon size={22} className="text-orange-500" /> تحديد من الخريطة
                 </button>
              </div>
              <button onClick={resetForm} className="mt-8 text-slate-400 text-xs font-bold underline">إلغاء</button>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[2800] flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
            <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-[440px] shadow-2xl overflow-hidden animate-slide-up">
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="text-orange-500" />
                    <h3 className="font-bold text-slate-800 text-sm">بيانات منطقة الضرر</h3>
                 </div>
                 <button onClick={resetForm} className="p-2 text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>

              <div className="p-8 max-h-[80vh] overflow-y-auto no-scrollbar">
                <div className="relative aspect-video rounded-[2rem] overflow-hidden mb-8 border-4 border-slate-100 shadow-inner bg-slate-200">
                   <img src={imagePreview!} className="w-full h-full object-cover" />
                   <button onClick={() => changeImageInputRef.current?.click()} className="absolute bottom-3 right-3 bg-white/95 px-4 py-2 rounded-xl shadow-lg text-slate-700 text-[10px] font-bold border flex items-center gap-2"><RefreshCw size={12}/> تغيير الصورة</button>
                </div>

                <div className="space-y-6 text-right">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">موقع الرصد</label>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                       <MapPin size={18} className="text-blue-600" />
                       <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">تفاصيل ميدانية (اختياري)</label>
                    <textarea rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-medium outline-none text-slate-700 resize-none focus:border-blue-300 transition-all" placeholder="مثل: ارتفاع منسوب المياه، انسداد الطريق..." />
                  </div>
                </div>
              </div>

              <div className="p-8 pt-0">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-bold shadow-xl active:scale-95 disabled:bg-slate-200 flex items-center justify-center gap-3 transition-all text-lg"
                  >
                    {loading ? <Loader2 size={24} className="animate-spin"/> : <Send size={20}/>}
                    <span>تأكيد الإرسال للإغاثة</span>
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Congratulations Overlay */}
        {showSuccess && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-6 bg-blue-700/95 backdrop-blur-lg">
             <div className="text-center text-white success-bounce">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white/40">
                   <PartyPopper size={48} className="text-orange-300" />
                </div>
                <h2 className="text-3xl font-bold mb-3">شكراً لمساهمتك!</h2>
                <p className="text-lg opacity-90 max-w-xs mx-auto mb-8">تم إرسال بلاغك بنجاح. بياناتك تساعد فرق الإنقاذ في الوصول للمنكوبين أسرع.</p>
                <div className="bg-white/20 px-6 py-2 rounded-full inline-flex items-center gap-2 border border-white/20 font-bold">
                   <CheckCircle size={18} /> جاري المعالجة الميدانية
                </div>
             </div>
          </div>
        )}

        {/* Minimal Side Loader */}
        {loading && isMinimized && (
          <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[3000] animate-slide-up">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
              <Loader2 size={24} className="animate-spin" />
            </div>
          </div>
        )}

        {/* Hidden Inputs */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      <footer className="z-[1001] bg-slate-900 border-t border-white/5 p-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-3">
        <span>مواطنون من أجل الإغاثة</span>
        <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
        <span>الاستجابة الميدانية</span>
      </footer>
    </div>
  );
};

export default App;
