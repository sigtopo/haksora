
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Send, Clock, 
  RefreshCw, Upload, AlertCircle, CheckCircle, ChevronRight, ImagePlus, ChevronDown, 
  Map as MapIcon, Globe, Info, Heart, PartyPopper, Navigation, MessageCircle
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
  html: `<div class="pulse-marker"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const MapController: React.FC<{ 
  onMapClick: (loc: GeoLocation) => void;
  flyTo: { center: [number, number], zoom: number } | null;
}> = ({ onMapClick, flyTo }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.setView(flyTo.center, flyTo.zoom, { animate: true, duration: 1.5 });
  }, [flyTo, map]);
  
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const App: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number], zoom: number } | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('disaster_reports_v2');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  const getFullAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        setPlaceName(data.display_name);
      } else {
        setPlaceName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch { 
      setPlaceName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); 
    }
  };

  const handleMapClick = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setShowSourceSelector(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChangeOnly = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(file);
        setImagePreview(reader.result as string);
        setShowSourceSelector(false);
        setShowAddMenu(false);
        if (!isChangeOnly) {
          if (pickedLocation) {
            getFullAddress(pickedLocation.lat, pickedLocation.lng);
          }
          setIsFormOpen(true);
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
        getFullAddress(loc.lat, loc.lng);
        setLoading(false);
        // If we are in the source selector, we proceed to source selection.
        // If we are already in form, it just updates location.
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
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: placeName,
        danger_level: dangerLevel || "بلاغ مناطق منكوبة",
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
      localStorage.setItem('disaster_reports_v2', JSON.stringify(updated));
      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); resetForm(); }, 3000);
    } catch { 
      setLoading(false);
      alert("خطأ في الإرسال");
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setShowSourceSelector(false);
    setPickedLocation(null);
    setPlaceName("");
    setDangerLevel("");
    setSelectedImage(null);
    setImagePreview(null);
    setShowAddMenu(false);
  };

  const openWhatsApp = () => {
    window.open("https://wa.me/212668090285", "_blank");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden relative">
      
      {/* Rescue Header */}
      <header className="z-[2000] bg-[#1d4ed8] text-white px-5 py-4 flex items-center justify-between shadow-2xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl border border-white/20 shadow-inner">
            <Heart size={22} className="text-white fill-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight">مواطنون من أجل الإغاثة</h1>
            <p className="text-[9px] text-blue-100 opacity-80 uppercase font-bold tracking-widest">الاستجابة الميدانية للمناطق المنكوبة</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowRegionPicker(true)}
             className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
             title="اختر الجهة"
           >
             <Globe size={18} />
           </button>
           <div className="relative">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="bg-orange-500 hover:bg-orange-600 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 border border-white/20"
              >
                <ImagePlus size={18} />
                <span className="text-sm font-bold">إضافة رصد</span>
              </button>
              
              {showAddMenu && (
                <div className="absolute left-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up z-[3000]">
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

      {/* Main Map */}
      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full">
          <TileLayer 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
            attribution="Esri" 
          />
          <TileLayer 
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" 
          />
          <MapController flyTo={mapTarget} onMapClick={handleMapClick} />
          
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-2 text-right bg-white rounded-lg">
                  <p className="font-bold text-[10px] text-slate-800 leading-tight">{r.place_name}</p>
                  <p className="text-[8px] text-slate-400 mt-1">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* WhatsApp Button */}
        <button 
          onClick={openWhatsApp}
          className="fixed bottom-24 left-6 z-[2000] w-14 h-14 whatsapp-bg text-white rounded-full flex items-center justify-center shadow-2xl fab-shadow animate-bounce active:scale-90 transition-transform"
        >
          <MessageCircle size={30} fill="white" />
        </button>

        {/* Locate Me Button */}
        <button 
          onClick={useMyPosition}
          className="fixed bottom-24 right-6 z-[2000] w-14 h-14 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-2xl fab-shadow active:scale-90 transition-transform border border-slate-100"
        >
          <Navigation size={24} className="fill-blue-50" />
        </button>

        {/* Region Picker Modal */}
        {showRegionPicker && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] w-full max-w-[440px] shadow-2xl overflow-hidden border border-white/20 animate-slide-up">
              <div className="p-8 text-center bg-blue-600 text-white relative">
                <button onClick={() => setShowRegionPicker(false)} className="absolute top-6 left-6 opacity-60 hover:opacity-100 transition-opacity"><X size={24}/></button>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <Globe size={32} />
                </div>
                <h2 className="text-xl font-bold mb-1">اختر الجهة المستهدفة</h2>
                <p className="text-sm opacity-80">حدد منطقتك لتسهيل عملية الرصد</p>
              </div>
              <div className="p-6 region-grid bg-slate-50 no-scrollbar">
                {REGIONS.map(reg => (
                  <button key={reg.id} onClick={() => selectRegion(reg)} className="p-4 bg-white border border-slate-200 rounded-2xl text-right text-slate-700 font-bold text-[11px] shadow-sm active:bg-blue-50 transition-all hover:border-blue-400">
                    {reg.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Source Selector Modal (Appears after map click) */}
        {showSourceSelector && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-[380px] shadow-2xl text-center animate-slide-up">
              <div className="mb-6 flex justify-center"><div className="p-5 bg-orange-100 rounded-3xl text-orange-600 animate-pulse"><Camera size={38}/></div></div>
              <h3 className="text-xl font-bold text-slate-800 mb-6">إضافة صورة للمكان المختار</h3>
              <div className="space-y-4">
                 <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="w-full p-5 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-4 font-bold shadow-lg active:scale-95 transition-all">
                    <Camera size={22} /> التقاط صورة حية
                 </button>
                 <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} className="w-full p-5 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center gap-4 font-bold active:scale-95 transition-all">
                    <Upload size={22} className="text-orange-500" /> اختيار من المعرض
                 </button>
              </div>
              <button onClick={resetForm} className="mt-8 text-slate-400 text-xs font-bold underline">تجاهل النقطة</button>
            </div>
          </div>
        )}

        {/* Final Confirmation Form */}
        {isFormOpen && (
          <div className="fixed inset-0 z-[3800] flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
            <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-[460px] shadow-2xl overflow-hidden animate-slide-up">
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-3">
                    <MapPin size={20} className="text-orange-500" />
                    <h3 className="font-bold text-slate-800 text-sm">تفاصيل بلاغ الإغاثة</h3>
                 </div>
                 <button onClick={resetForm} className="p-2 text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>

              <div className="p-8 max-h-[75vh] overflow-y-auto no-scrollbar">
                <div className="relative aspect-video rounded-[2rem] overflow-hidden mb-8 border-4 border-slate-100 shadow-inner bg-slate-200">
                   {imagePreview && <img src={imagePreview} className="w-full h-full object-cover" />}
                   <button onClick={() => changeImageInputRef.current?.click()} className="absolute bottom-3 right-3 bg-white/95 px-4 py-2 rounded-xl shadow-lg text-slate-700 text-[10px] font-bold border flex items-center gap-2"><RefreshCw size={12}/> تغيير الصورة</button>
                </div>

                <div className="space-y-6 text-right">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">الموقع الجغرافي (كامل)</label>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                       <MapPin size={18} className="text-blue-600 mt-1 flex-shrink-0" />
                       <div className="text-[12px] font-bold text-slate-800 break-words w-full text-right leading-relaxed">
                          {placeName || "جاري التحديد..."}
                       </div>
                    </div>
                    <button onClick={useMyPosition} className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-1 justify-end px-1 hover:underline">
                       تحديث حسب موقعي الحالي <Navigation size={10} />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">حالة المنطقة المنكوبة</label>
                    <textarea rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-medium outline-none text-slate-700 resize-none focus:border-blue-400 transition-all" placeholder="صف نوع الضرر أو المساعدة المطلوبة..." />
                  </div>
                </div>
              </div>

              <div className="p-8 pt-0">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="w-full bg-blue-600 text-white py-5 rounded-[1.8rem] font-bold shadow-xl active:scale-95 disabled:bg-slate-200 flex items-center justify-center gap-3 transition-all text-lg"
                  >
                    {loading ? <Loader2 size={24} className="animate-spin"/> : <Send size={20}/>}
                    <span>إرسال نداء الإغاثة</span>
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Congratulations */}
        {showSuccess && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-blue-700/95 backdrop-blur-xl">
             <div className="text-center text-white success-bounce">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white/40 shadow-2xl">
                   <PartyPopper size={48} className="text-orange-300" />
                </div>
                <h2 className="text-3xl font-bold mb-3">تهانينا! تم الإرسال</h2>
                <p className="text-lg opacity-90 max-w-xs mx-auto mb-8">مساهمتك قد تنقذ حياة. تم توثيق النقطة بنجاح وتوجيهها لفرق الاستجابة الميدانية.</p>
                <div className="bg-white text-blue-700 px-8 py-3 rounded-full inline-flex items-center gap-2 font-bold shadow-xl">
                   <CheckCircle size={20} /> شكراً لوعيك المجتمعي
                </div>
             </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 z-[4500] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
             <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin text-blue-600" />
                <span className="text-slate-800 font-bold">جاري رفع البيانات...</span>
             </div>
          </div>
        )}

        {/* Hidden Inputs */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      <footer className="z-[1001] bg-slate-900 border-t border-white/5 p-4 text-center text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center flex-col gap-2">
        <div className="flex items-center gap-3">
          <span>مواطنون من أجل الإغاثة</span>
          <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
          <span>الاستجابة الميدانية</span>
        </div>
        <div className="opacity-60">Copyright Jilit 2026 © جميع الحقوق محفوظة</div>
      </footer>
    </div>
  );
};

export default App;
