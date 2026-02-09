
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Send, Clock, 
  RefreshCw, Upload, AlertCircle, CheckCircle, ChevronRight, ImagePlus, ChevronDown, 
  Map as MapIcon, Globe, Heart, PartyPopper, Navigation, MessageCircle, Search
} from 'lucide-react';
import { Report, GeoLocation, MapMode } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

const REGIONS = [
  { id: 1, name: "طنجة - تطوان - الحسيمة", center: [35.4, -5.5], zoom: 9, color: "bg-blue-500" },
  { id: 2, name: "الشرق", center: [34.0, -2.5], zoom: 8, color: "bg-emerald-500" },
  { id: 3, name: "فاس - مكناس", center: [33.8, -4.5], zoom: 9, color: "bg-amber-500" },
  { id: 4, name: "الرباط - سلا - القنيطرة", center: [34.0, -6.3], zoom: 10, color: "bg-indigo-500" },
  { id: 5, name: "بني ملال - خنيفرة", center: [32.5, -6.2], zoom: 9, color: "bg-lime-500" },
  { id: 6, name: "الدار البيضاء - سطات", center: [33.3, -7.5], zoom: 10, color: "bg-rose-500" },
  { id: 7, name: "مراكش - آسفي", center: [31.6, -8.3], zoom: 9, color: "bg-orange-500" },
  { id: 8, name: "درعة - تافيلالت", center: [31.3, -4.5], zoom: 8, color: "bg-cyan-500" },
  { id: 9, name: "سوس - ماسة", center: [30.2, -8.8], zoom: 9, color: "bg-purple-500" },
  { id: 10, name: "كلميم - واد نون", center: [28.5, -10.5], zoom: 8, color: "bg-teal-500" },
  { id: 11, name: "العيون - الساقية الحمراء", center: [26.5, -12.5], zoom: 8, color: "bg-red-500" },
  { id: 12, name: "الداخلة - وادي الذهب", center: [23.5, -14.8], zoom: 8, color: "bg-pink-500" },
];

const reportIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="pulse-marker"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const pickingIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 20px rgba(239, 68, 68, 0.8);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
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

  // Search logic
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('haksora_reports_v1');
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
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const getFullAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        setPlaceName(data.display_name);
      } else {
        setPlaceName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch { 
      setPlaceName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); 
    }
  };

  const handleMapClick = (loc: GeoLocation) => {
    if (mapMode === 'PICK' || !selectedImage) {
      setPickedLocation(loc);
      setMapTarget({ center: [loc.lat, loc.lng], zoom: 17 });
      if (selectedImage) {
        setMapMode('VIEW');
        getFullAddress(loc.lat, loc.lng);
        setIsFormOpen(true);
      } else {
        setShowLocationPicker(false);
        fileInputRef.current?.click();
      }
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
          if (pickedLocation) {
            getFullAddress(pickedLocation.lat, pickedLocation.lng);
            setIsFormOpen(true);
          } else {
            setShowLocationPicker(true);
          }
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
        setLoading(false);
        setShowLocationPicker(false);
        setMapMode('VIEW');
        if (selectedImage) {
          getFullAddress(loc.lat, loc.lng);
          setIsFormOpen(true);
        } else {
          fileInputRef.current?.click();
        }
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const selectRegion = (region: any) => {
    setMapTarget({ center: region.center as [number, number], zoom: region.zoom });
    setShowRegionPicker(false);
  };

  const selectSearchResult = (result: any) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setMapTarget({ center: [loc.lat, loc.lng], zoom: 17 });
    setPickedLocation(loc);
    setShowRegionPicker(false);
    setSearchResults([]);
    setSearchQuery("");
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
      localStorage.setItem('haksora_reports_v1', JSON.stringify(updated));
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
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden relative">
      
      {/* Dynamic Moroccan Header */}
      <header className="z-[2000] bg-gradient-to-r from-red-600 to-green-600 text-white px-5 py-4 flex items-center justify-between shadow-2xl border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-2xl border border-white/30 backdrop-blur-sm shadow-inner">
            <Camera size={24} className="text-white drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-[20px] font-black tracking-tight leading-none italic flex items-baseline gap-2">
              Haksora <span className="text-[16px] not-italic font-bold">هاك صورة</span>
            </h1>
            <p className="text-[8px] text-white/80 uppercase font-black tracking-[0.2em]">الاستجابة الميدانية السريعة</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowRegionPicker(true)}
             className="p-3 bg-white/20 rounded-2xl hover:bg-white/30 transition-all border border-white/30"
           >
             <Globe size={20} />
           </button>
           <div className="relative">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="bg-white text-green-700 hover:bg-slate-50 px-5 py-2.5 rounded-2xl flex items-center gap-2 shadow-xl transition-all active:scale-95 border-2 border-green-500/20"
              >
                <ImagePlus size={18} />
                <span className="text-xs font-black">رصد</span>
              </button>
              
              {showAddMenu && (
                <div className="absolute left-0 mt-3 w-48 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden animate-slide-up z-[3000]">
                  <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="w-full px-6 py-4 text-right text-slate-800 hover:bg-red-50 flex items-center gap-3 border-b border-slate-100">
                    <Camera size={20} className="text-red-600" />
                    <span className="text-sm font-bold">التقاط صورة</span>
                  </button>
                  <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} className="w-full px-6 py-4 text-right text-slate-800 hover:bg-green-50 flex items-center gap-3">
                    <Upload size={20} className="text-green-600" />
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
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
          <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
          <MapController flyTo={mapTarget} onMapClick={handleMapClick} />
          
          {pickedLocation && !isFormOpen && (
            <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickingIcon} />
          )}

          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right bg-white rounded-2xl shadow-xl border border-slate-100 min-w-[120px]">
                  <p className="font-bold text-[10px] text-slate-800 leading-tight mb-1">{r.place_name}</p>
                  <p className="text-[8px] text-slate-400 font-medium">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Controls */}
        <div className="absolute bottom-24 inset-x-0 flex justify-between px-6 z-[2000] pointer-events-none">
          <button onClick={openWhatsApp} className="pointer-events-auto w-16 h-16 whatsapp-bg text-white rounded-full flex items-center justify-center shadow-2xl fab-shadow animate-bounce active:scale-90 transition-transform border-4 border-white/20">
            <MessageCircle size={34} fill="white" />
          </button>
          
          <button onClick={useMyPosition} className="pointer-events-auto w-16 h-16 bg-white/95 backdrop-blur-md text-green-600 rounded-full flex items-center justify-center shadow-2xl fab-shadow active:scale-90 transition-transform border-4 border-white/20">
            <Navigation size={28} className="fill-green-50" />
          </button>
        </div>

        {/* Region Picker with Tree Style Colors & Search */}
        {showRegionPicker && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] w-full max-w-[480px] shadow-2xl overflow-hidden border-2 border-white/30 animate-slide-up flex flex-col max-h-[90vh]">
              <div className="p-8 text-center bg-gradient-to-br from-green-600 to-emerald-700 text-white relative flex-shrink-0">
                <button onClick={() => setShowRegionPicker(false)} className="absolute top-6 left-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/40 shadow-xl animate-pulse">
                  <Globe size={40} />
                </div>
                <h2 className="text-2xl font-black mb-1">اختر الجهة المستهدفة</h2>
                <p className="text-sm opacity-90 font-medium">حدد منطقتك أو ابحث عن مكان محدد</p>
                
                {/* Search Bar */}
                <div className="mt-6 relative">
                   <div className="bg-white rounded-2xl flex items-center px-4 py-3 shadow-2xl border border-white/40">
                      <Search size={20} className="text-green-600 flex-shrink-0" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="ابحث عن مدينة، قرية، أو شارع..." 
                        className="w-full bg-transparent outline-none px-3 text-slate-800 font-bold placeholder:text-slate-400 text-sm"
                      />
                      {isSearching && <Loader2 size={18} className="animate-spin text-green-600" />}
                   </div>
                   
                   {/* Search Results Dropdown */}
                   {searchResults.length > 0 && (
                     <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 text-right animate-slide-up">
                        {searchResults.map((res, i) => (
                          <button 
                            key={i} 
                            onClick={() => selectSearchResult(res)}
                            className="w-full px-5 py-3 hover:bg-green-50 flex items-center gap-3 border-b last:border-0 border-slate-50 transition-all"
                          >
                             <MapPin size={16} className="text-red-500 flex-shrink-0" />
                             <span className="text-[11px] font-bold text-slate-700 truncate">{res.display_name}</span>
                          </button>
                        ))}
                     </div>
                   )}
                </div>
              </div>

              <div className="p-6 overflow-y-auto no-scrollbar grid grid-cols-2 gap-3 flex-grow">
                {REGIONS.map(reg => (
                  <button 
                    key={reg.id} 
                    onClick={() => selectRegion(reg)} 
                    className={`${reg.color} p-5 rounded-[2rem] text-right text-white font-black text-[12px] shadow-lg active:scale-95 transition-all hover:brightness-110 hover:shadow-xl border-2 border-white/20 relative group overflow-hidden`}
                  >
                    <span className="relative z-10 drop-shadow-md">{reg.name}</span>
                    <Globe size={40} className="absolute -bottom-4 -left-4 text-white/10 group-hover:scale-125 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Location Selector (Transparent & Red X) */}
        {showLocationPicker && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-10 w-full max-w-[380px] shadow-2xl text-center border border-white/30 animate-slide-up relative">
              <button 
                onClick={resetForm} 
                className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform border-4 border-white/50"
              >
                <X size={40} strokeWidth={3} />
              </button>

              <div className="mb-6 mt-8 flex justify-center">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl rotate-3">
                  <img src={imagePreview!} className="w-full h-full object-cover" />
                </div>
              </div>
              
              <h3 className="text-xl font-black text-white mb-6 drop-shadow-md">أين تقع هذه المنطقة؟</h3>
              
              <div className="space-y-4">
                 <button onClick={useMyPosition} className="w-full p-5 bg-green-600 text-white rounded-3xl flex items-center justify-center gap-4 font-black shadow-xl active:scale-95 transition-all border-2 border-white/20">
                    <Navigation size={22} /> موقعي الحالي (GPS)
                 </button>
                 <button 
                    onClick={() => { setShowLocationPicker(false); setMapMode('PICK'); }} 
                    className="w-full p-5 bg-white/80 text-slate-800 rounded-3xl flex items-center justify-center gap-4 font-black active:scale-95 transition-all border-2 border-white/30"
                 >
                    <MapIcon size={22} className="text-orange-500" /> اختيار من الخريطة
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Final Confirmation Form (Transparent) */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[3800] flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
            <div className="bg-white/50 backdrop-blur-3xl rounded-t-[3.5rem] sm:rounded-[3.5rem] w-full max-w-[460px] shadow-2xl overflow-hidden animate-slide-up border-t border-white/40 border-x border-white/20">
              <div className="px-8 py-6 border-b border-white/20 flex justify-between items-center bg-white/10">
                 <div className="flex items-center gap-3">
                    <AlertCircle size={22} className="text-red-400" />
                    <h3 className="font-black text-white text-sm">صورة لمنطقة متضررة تستوجب التدخل</h3>
                 </div>
                 <button onClick={resetForm} className="p-2 text-white/50 hover:text-red-500"><X size={28}/></button>
              </div>

              <div className="p-8 max-h-[65vh] overflow-y-auto no-scrollbar">
                <div className="relative aspect-video rounded-[2.5rem] overflow-hidden mb-8 border-4 border-white shadow-2xl bg-slate-900 group">
                   {imagePreview && <img src={imagePreview} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
                   <button onClick={() => changeImageInputRef.current?.click()} className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-lg text-[10px] font-black border border-white/20 flex items-center gap-2 active:scale-95 transition-all"><RefreshCw size={14}/> تغيير الصورة</button>
                </div>

                <div className="space-y-6 text-right">
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/70 font-black uppercase tracking-widest px-1">الموقع الموثق</label>
                    <div className="bg-black/20 p-5 rounded-3xl border border-white/10 flex items-start gap-4">
                       <MapPin size={20} className="text-red-400 mt-1 flex-shrink-0" />
                       <div className="text-[12px] font-black text-white break-words w-full text-right leading-relaxed">
                          {placeName || "جاري استرجاع العنوان..."}
                       </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/70 font-black uppercase tracking-widest px-1">تفاصيل حول الصورة :</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} 
                      className="w-full bg-black/20 p-5 rounded-3xl border border-white/10 text-sm font-bold text-white placeholder:text-white/20 outline-none resize-none focus:border-green-500/50 transition-all" 
                      placeholder="انزلاق ، انقطاع طريق ، انجراف ؟ حفرة خطيرة (اختياري)" 
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 pt-0">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white py-6 rounded-[2rem] font-black shadow-2xl active:scale-95 disabled:bg-slate-700 flex flex-col items-center justify-center gap-1 transition-all text-base border-t border-white/20"
                  >
                    <span>رفع الصورة من أجل التدخل العاجل للصيانة</span>
                    <span className="text-[10px] opacity-70 font-normal">إرسال نداء الإغاثة</span>
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Style Sending Widget */}
        {loading && isMinimized && (
          <div className="fixed inset-x-0 bottom-10 z-[4000] flex justify-center items-center pointer-events-none px-6">
            <button 
              onClick={() => setIsMinimized(false)}
              className="pointer-events-auto bg-white/20 backdrop-blur-2xl px-8 py-5 rounded-[2.5rem] shadow-2xl border border-white/20 flex items-center gap-5 group animate-in slide-in-from-bottom-10"
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="4" className="text-green-500 animate-[dash_2s_ease-in-out_infinite]" strokeDasharray="182" strokeDashoffset="100" />
                </svg>
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-2xl animate-pulse">
                  <img src={imagePreview!} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-white leading-none">جاري رفع الرصد...</p>
                <p className="text-[10px] text-green-200 opacity-80 mt-2 font-bold uppercase tracking-wider">اضغط للتوسيع أو التعديل</p>
              </div>
              <Loader2 size={18} className="animate-spin text-white/50" />
            </button>
          </div>
        )}

        {/* Success Congratulations */}
        {showSuccess && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-gradient-to-tr from-green-700 to-blue-800 backdrop-blur-2xl">
             <div className="text-center text-white success-bounce">
                <div className="w-28 h-28 bg-white/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border-4 border-white/40 shadow-2xl rotate-12">
                   <PartyPopper size={56} className="text-yellow-400 drop-shadow-xl" />
                </div>
                <h2 className="text-4xl font-black mb-4 tracking-tight italic">شكراً جزيلاً!</h2>
                <p className="text-lg opacity-90 max-w-xs mx-auto mb-10 font-bold leading-relaxed">تم توثيق البلاغ بنجاح. مساهمتك الميدانية هي الخطوة الأولى لإنقاذ الأرواح في المناطق المتضررة.</p>
                <div className="bg-white text-green-700 px-10 py-4 rounded-3xl inline-flex items-center gap-3 font-black shadow-2xl border-b-4 border-green-100">
                   <CheckCircle size={24} /> تم الحفظ في قاعدة البيانات
                </div>
             </div>
          </div>
        )}

        {/* Hidden Inputs */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      <footer className="z-[1001] bg-slate-900 border-t border-white/5 p-5 text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] flex items-center flex-col gap-2">
        <div className="flex items-center gap-4">
          <span className="text-green-500">HAKSORA</span>
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          <span>الاستجابة الميدانية</span>
        </div>
        <div className="opacity-40 text-[9px]">Copyright Jilit 2026 © جميع الحقوق محفوظة</div>
      </footer>

      <style>{`
        @keyframes dash {
          0% { stroke-dashoffset: 182; }
          50% { stroke-dashoffset: 45; }
          100% { stroke-dashoffset: 182; }
        }
        .fab-shadow {
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  );
};

export default App;
