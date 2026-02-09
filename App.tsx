
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, RefreshCw, Upload, AlertCircle, 
  CheckCircle, ImagePlus, Globe, PartyPopper, Navigation, 
  Search, Info, Map as MapIcon
} from 'lucide-react';
import { Report, GeoLocation } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

const REGIONS = [
  { id: 1, name: "جهة طنجة - تطوان - الحسيمة", center: [35.4, -5.5], zoom: 9 },
  { id: 2, name: "جهة الشرق", center: [34.0, -2.5], zoom: 8 },
  { id: 3, name: "جهة فاس - مكناس", center: [33.8, -4.5], zoom: 9 },
  { id: 4, name: "جهة الرباط - سلا - القنيطرة", center: [34.0, -6.3], zoom: 10 },
  { id: 5, name: "جهة بني ملال - خنيفرة", center: [32.5, -6.2], zoom: 9 },
  { id: 6, name: "جهة الدار البيضاء - سطات", center: [33.3, -7.5], zoom: 10 },
  { id: 7, name: "جهة مراكش - آسفي", center: [31.6, -8.3], zoom: 9 },
  { id: 8, name: "جهة درعة - تافيلالت", center: [31.3, -4.5], zoom: 8 },
  { id: 9, name: "جهة سوس - ماسة", center: [30.2, -8.8], zoom: 9 },
  { id: 10, name: "جهة كلميم - واد نون", center: [28.5, -10.5], zoom: 8 },
  { id: 11, name: "جهة العيون - الساقية الحمراء", center: [26.5, -12.5], zoom: 8 },
  { id: 12, name: "جهة الداخلة - وادي الذهب", center: [23.5, -14.8], zoom: 8 },
];

const reportIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="pulse-marker"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// Simple Bold Red + marker
const pickingIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
           <div style="position: absolute; width: 4px; height: 24px; background: #ef4444; border-radius: 2px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></div>
           <div style="position: absolute; width: 24px; height: 4px; background: #ef4444; border-radius: 2px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></div>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
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
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number], zoom: number } | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mapMode, setMapMode] = useState<'VIEW' | 'PICK'>('VIEW');
  
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('haksora_reports_v6');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ma&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const getFullAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      setPlaceName(data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch { setPlaceName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); }
  };

  const handleMapClick = (loc: GeoLocation) => {
    if (mapMode === 'PICK') {
      setPickedLocation(loc);
      setMapMode('VIEW');
      getFullAddress(loc.lat, loc.lng);
      setIsFormOpen(true);
    } else if (!isFormOpen && !showLocationPicker && !showAddMenu) {
      setPickedLocation(loc);
      setShowAddMenu(true);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChangeOnly = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(file);
        setImagePreview(reader.result as string);
        setShowAddMenu(false);
        if (!isChangeOnly) {
          setShowLocationPicker(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const centerOnMeOnly = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapTarget({ center: [pos.coords.latitude, pos.coords.longitude], zoom: 20 });
        setLoading(false);
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const useMyPositionForReport = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickedLocation(loc);
        setMapTarget({ center: [loc.lat, loc.lng], zoom: 20 });
        setLoading(false);
        setShowLocationPicker(false);
        setMapMode('VIEW');
        getFullAddress(loc.lat, loc.lng);
        setIsFormOpen(true);
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;
    setLoading(true);
    setIsMinimized(true);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: placeName,
        danger_level: dangerLevel || "بلاغ هاك صورة",
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
      localStorage.setItem('haksora_reports_v6', JSON.stringify(updated));
      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); resetForm(); }, 3000);
    } catch { 
      setLoading(false);
      setIsMinimized(false);
      alert("خطأ في الإرسال");
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setShowLocationPicker(false);
    setPickedLocation(null);
    setPlaceName("");
    setDangerLevel("");
    setSelectedImage(null);
    setImagePreview(null);
    setShowAddMenu(false);
    setIsMinimized(false);
    setMapMode('VIEW');
  };

  const openWhatsApp = () => {
    window.open("https://wa.me/212668090285", "_blank");
  };

  return (
    <div className={`flex flex-col h-screen w-screen bg-black overflow-hidden relative ${mapMode === 'PICK' ? 'map-pick-mode' : ''}`}>
      
      {/* Moroccan Header */}
      <header className="z-[2000] bg-gradient-to-r from-red-600 to-green-600 text-white px-5 py-3 flex items-center justify-between shadow-2xl border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-2xl border border-white/30 backdrop-blur-sm">
            <Camera size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-[18px] font-black italic flex items-baseline gap-2">
              Haksora <span className="text-[14px] not-italic font-bold">هاك صورة</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative">
           <button onClick={() => setShowRegionPicker(true)} className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-all border border-white/30">
             <Globe size={18} />
           </button>

           <div className="flex items-center bg-white/10 p-1 rounded-2xl border border-white/20 shadow-inner">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all ${showAddMenu ? 'bg-red-600 text-white' : 'bg-white text-green-700 shadow-lg'}`}
              >
                {showAddMenu ? <X size={16} /> : <ImagePlus size={16} />}
                <span>رصد</span>
              </button>

              {/* Top Inline Menu */}
              {showAddMenu && (
                <div className="flex items-center gap-1.5 px-2 animate-in fade-in slide-in-from-right-2 duration-300">
                   <button 
                    onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all active:scale-90"
                   >
                     <Camera size={18} />
                   </button>
                   <button 
                    onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all active:scale-90"
                   >
                     <Upload size={18} />
                   </button>
                </div>
              )}
           </div>
        </div>
      </header>

      {/* Main Map with Google Satellite Tiles */}
      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} maxZoom={20} className="h-full w-full">
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
            attribution="Google Maps Satellite" 
            maxZoom={20}
          />
          <MapController flyTo={mapTarget} onMapClick={handleMapClick} />
          
          {pickedLocation && (mapMode === 'PICK' || !isFormOpen) && (
            <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickingIcon} />
          )}

          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right bg-white rounded-2xl shadow-xl border border-slate-100 min-w-[120px]">
                  <p className="font-bold text-[10px] text-slate-800 mb-1 leading-tight">{r.place_name}</p>
                  <p className="text-[8px] text-slate-400">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Locate Me - Top Right */}
        <button 
          onClick={centerOnMeOnly} 
          className="absolute top-6 right-6 z-[2000] w-12 h-12 bg-white text-green-600 rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-transform border border-slate-200"
        >
          <Navigation size={22} className="fill-green-50" />
        </button>

        {/* Region Picker Modal */}
        {showRegionPicker && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-slate-50 rounded-[2.5rem] w-full max-w-[500px] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh] border border-slate-200">
              <div className="p-8 text-center bg-white border-b border-slate-200 relative">
                <button onClick={() => setShowRegionPicker(false)} className="absolute top-6 left-6 w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90">
                  <X size={24} strokeWidth={3} />
                </button>
                <div className="flex justify-center mb-4">
                   <div className="p-4 bg-slate-100 rounded-3xl border border-slate-200"><Globe size={36} className="text-slate-700" /></div>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">اختر الجهة المستهدفة</h2>
                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-[12px] text-blue-900 font-bold leading-relaxed mb-6 text-right">
                   هذه المنصة كتسمح بتوثيق المناطق المتضررة أو المهددة بالخطر، وتسهّل على الجهات المعنية التدخل والصيانة، مع تنبيه الساكنة للأماكن الخطِرة.
                </div>
                
                <div className="relative">
                   <div className="bg-white rounded-2xl flex items-center px-4 py-3 shadow-md border border-slate-200">
                      <Search size={20} className="text-slate-400" />
                      <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="ابحث عن مكان محدد..." className="w-full bg-transparent outline-none px-3 text-slate-800 font-bold text-sm" />
                      {isSearching && <Loader2 size={18} className="animate-spin text-green-600" />}
                   </div>
                   {searchResults.length > 0 && (
                     <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 text-right">
                        {searchResults.map((res, i) => (
                          <button key={i} onClick={() => {
                             const loc = { lat: parseFloat(res.lat), lng: parseFloat(res.lon) };
                             setMapTarget({ center: [loc.lat, loc.lng], zoom: 20 });
                             setPickedLocation(loc);
                             setShowRegionPicker(false);
                             setSearchResults([]);
                          }} className="w-full px-5 py-3 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                             <MapPin size={16} className="text-red-500" />
                             <span className="text-[11px] font-bold text-slate-700 truncate">{res.display_name}</span>
                          </button>
                        ))}
                     </div>
                   )}
                </div>
              </div>

              <div className="p-6 overflow-y-auto no-scrollbar grid grid-cols-2 gap-3 flex-grow bg-slate-100">
                {REGIONS.map(reg => (
                  <button key={reg.id} onClick={() => { setMapTarget({ center: reg.center as [number, number], zoom: reg.zoom }); setShowRegionPicker(false); }} className="p-5 bg-white border border-slate-200 rounded-3xl text-right text-slate-700 font-black text-[11px] shadow-sm hover:border-green-600 hover:text-green-700 transition-all flex items-center justify-between">
                    <span>{reg.name}</span>
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Location Selection Flow */}
        {showLocationPicker && (
          <div className="fixed inset-0 z-[4600] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] p-10 w-full max-w-[400px] shadow-2xl text-center border border-slate-200 animate-slide-up relative">
              <button onClick={resetForm} className="absolute -top-6 right-1/2 translate-x-1/2 bg-red-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-xl"><X size={24} /></button>
              <div className="mb-6 mt-4 flex justify-center">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-slate-100 shadow-xl rotate-3">
                  <img src={imagePreview!} className="w-full h-full object-cover" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-8">حدد مكان الرصد</h3>
              <div className="space-y-4">
                 <button onClick={useMyPositionForReport} className="w-full p-6 bg-green-600 text-white rounded-[2rem] flex items-center justify-center gap-4 font-black shadow-xl active:scale-95 transition-all">
                    <Navigation size={24} /> موقعي الحالي (GPS)
                 </button>
                 <button onClick={() => { setShowLocationPicker(false); setMapMode('PICK'); }} className="w-full p-6 bg-white text-slate-800 border-2 border-slate-200 rounded-[2rem] flex items-center justify-center gap-4 font-black active:scale-95 transition-all">
                    <MapIcon size={24} className="text-orange-500" /> اختيار على الخريطة
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Report Form */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[4700] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-[460px] shadow-2xl overflow-hidden animate-slide-up">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <AlertCircle size={22} className="text-red-500" />
                    <h3 className="font-black text-slate-800 text-sm">توثيق حالة ميدانية</h3>
                 </div>
                 <button onClick={resetForm} className="p-2 text-slate-400 hover:text-red-500"><X size={28}/></button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div className="relative aspect-video rounded-[2.5rem] overflow-hidden mb-8 border-4 border-slate-100 shadow-xl bg-slate-900">
                   {imagePreview && <img src={imagePreview} className="w-full h-full object-cover" />}
                   <button onClick={() => changeImageInputRef.current?.click()} className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-lg text-[10px] font-black flex items-center gap-2"><RefreshCw size={14}/> تغيير الصورة</button>
                </div>
                <div className="space-y-6 text-right">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-black uppercase px-1">الموقع المكتشف</label>
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 flex items-start gap-4">
                       <MapPin size={20} className="text-red-500 mt-1 flex-shrink-0" />
                       <div className="text-[12px] font-bold text-slate-700 leading-relaxed text-right">{placeName}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-black uppercase px-1">وصف الحالة :</label>
                    <textarea rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-200 text-sm font-bold text-slate-800 outline-none resize-none focus:border-green-500" placeholder="صف المشكلة هنا (مثال: حفرة عميقة، انزلاق تربة...)" />
                  </div>
                </div>
              </div>
              <div className="p-8 pt-0">
                 <button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white py-6 rounded-[2rem] font-black shadow-2xl active:scale-95 disabled:bg-slate-300">
                    رفع البيانات وتنبيه الجهات المعنية
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Widget */}
        {loading && isMinimized && (
          <div className="fixed inset-x-0 bottom-24 z-[4000] flex justify-center items-center pointer-events-none px-6">
            <div className="bg-white/95 backdrop-blur-xl px-8 py-5 rounded-[2.5rem] shadow-2xl border border-slate-200 flex items-center gap-5 animate-in slide-in-from-bottom-10 pointer-events-auto">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-800 leading-none">جاري الإرسال...</p>
                <p className="text-[9px] text-slate-400 mt-1 font-bold">يرجى الانتظار قليلاً</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Congratulations */}
        {showSuccess && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-green-600 backdrop-blur-2xl">
             <div className="text-center text-white success-bounce">
                <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border-4 border-white/40 shadow-2xl rotate-12">
                   <PartyPopper size={48} className="text-yellow-400" />
                </div>
                <h2 className="text-4xl font-black mb-4 italic tracking-tight">تم الإرسال بنجاح</h2>
                <p className="text-lg opacity-90 max-w-xs mx-auto mb-10 font-bold leading-relaxed">شكراً لمساهمتك الوطنية. تم توثيق الحالة وحفظها في قاعدة بيانات الاستجابة السريعة.</p>
                <div className="bg-white text-green-700 px-10 py-4 rounded-3xl inline-flex items-center gap-3 font-black shadow-2xl">
                   <CheckCircle size={24} /> تم الحفظ بنجاح
                </div>
             </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      {/* Footer with Real WhatsApp Button */}
      <footer className="z-[1001] bg-slate-900 border-t border-white/5 p-4 text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <span className="text-green-500">HAKSORA</span>
          
          <button 
            onClick={openWhatsApp}
            className="w-10 h-10 whatsapp-real-color rounded-xl flex items-center justify-center shadow-xl border border-white/20 active:scale-90 transition-transform"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </button>

          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          <span>الاستجابة الميدانية</span>
        </div>
        <div className="opacity-20 text-[9px] mt-1 tracking-widest">© 2026 JILIT INFRASTRUCTURE SYSTEM</div>
      </footer>

    </div>
  );
};

export default App;
