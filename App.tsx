
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, Target, PartyPopper, 
  RefreshCw, Upload, Image as ImageLucide, LocateFixed, Layers, AlertTriangle,
  Navigation
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

const googleBlinkingIcon = L.divIcon({
  className: 'blinking-dot-container',
  html: '<div class="blinking-dot"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const reportMarkerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #25D366; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
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
      map.setView([flyToLocation.lat, flyToLocation.lng], 18, { animate: true });
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
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<GeoLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [countdown, setCountdown] = useState(8);
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('research_field_v12');
    if (saved) setReports(JSON.parse(saved));
    updateGPSLocation();
  }, []);

  useEffect(() => {
    let timer: any;
    if (loading && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [loading, countdown]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 0) handleOSMSearch();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const updateGPSLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.warn("GPS Access Denied"),
      { enableHighAccuracy: true }
    );
  };

  const handleOSMSearch = async () => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (error) { console.error(error); }
  };

  const triggerCelebration = () => {
    setShowCelebration(true);
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#25D366'];
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (Math.random() * 2 + 1) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
    setTimeout(() => setShowCelebration(false), 4000);
  };

  const getShortAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address;
        const short = addr.road || addr.suburb || addr.village || addr.city || "نقطة رصد";
        setPlaceName(`توثيق: ${short}`);
      }
    } catch (error) { setPlaceName(`موقع غير محدد`); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setShowWelcome(false);
        setShowLocationOptions(true); // Show location options after image selection
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
        setFlyToTarget(loc);
        setShowLocationOptions(false);
        setIsFormOpen(true);
        getShortAddress(loc.lat, loc.lng);
        setLoading(false);
      },
      () => { setLoading(false); alert("GPS Error"); },
      { enableHighAccuracy: true }
    );
  };

  const useOnMap = () => {
    setShowLocationOptions(false);
    setMapMode('PICK_LOCATION');
  };

  const handleLocationPickedOnMap = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setFlyToTarget(loc);
    setMapMode('VIEW');
    setIsFormOpen(true);
    getShortAddress(loc.lat, loc.lng);
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;
    setLoading(true);
    setIsUploadingImage(true);
    setIsMinimized(true);
    setCountdown(8);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      await uploadReportToServer({
        nom_douar: placeName,
        danger_level: dangerLevel || "بدون ملاحظات",
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
      setReports((prev) => [newReport, ...prev]);
      resetForm();
      triggerCelebration();
    } catch (error) { alert("فشل الإرسال"); setIsMinimized(false); }
    finally { setLoading(false); setIsUploadingImage(false); }
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
    setSearchResults([]);
    setSearchQuery("");
    setIsMinimized(false);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#111B21] overflow-hidden relative font-sans">
      
      {/* Celebration Message */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in">
          <PartyPopper size={100} className="text-[#25D366] mb-6 animate-bounce" />
          <h2 className="text-white text-3xl font-bold mb-2 text-center">تم التوثيق!</h2>
          <p className="text-white/80 text-xl text-center px-4">نشكرك على مساهمتك الميدانية</p>
        </div>
      )}

      {/* Mini Progress Indicator */}
      {isMinimized && loading && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1300] bg-[#075E54] text-white px-6 py-2.5 rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-3 animate-in slide-in-from-top-4"
        >
          <div className="relative w-8 h-8 flex items-center justify-center bg-black/20 rounded-full">
            <Loader2 size={18} className="animate-spin text-[#25D366]" />
            <span className="absolute text-[10px] font-bold text-white">{countdown}</span>
          </div>
          <span className="text-[13px] font-bold">جاري الرفع...</span>
        </button>
      )}

      {/* Welcome & Initial Choice Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-6 bg-black/70 backdrop-blur-lg animate-in fade-in">
          <div className="bg-white rounded-[40px] p-10 w-full max-w-[380px] text-center shadow-2xl border border-white/10">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">منطقة متضررة؟</h2>
            <p className="text-gray-400 text-sm mb-8">يرجى توثيق المنطقة بإضافة صورة جغرافية للمساهمة في الرصد الميداني.</p>
            <div className="space-y-4">
              <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                className="w-full bg-[#075E54] text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all">
                <Camera size={24}/> التقاط صورة
              </button>
              <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                className="w-full bg-blue-50 text-blue-700 py-4 rounded-3xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Upload size={24}/> رفع من المعرض
              </button>
              <button onClick={() => setShowWelcome(false)} className="w-full py-2 text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">عرض الخريطة فقط</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Choice Modal (Triggered after image) */}
      {showLocationOptions && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-white rounded-[44px] p-10 w-full max-w-[360px] text-center shadow-2xl border border-white/20">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden mx-auto mb-6 bg-gray-100">
               <img src={imagePreview!} className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-6">أين التقطت هذه الصورة؟</h3>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={useMyPosition} className="p-6 bg-blue-50 rounded-3xl active:bg-blue-100 flex flex-col items-center gap-3 border border-blue-100 transition-all text-blue-700 font-bold">
                  <Target size={32}/>
                  <span className="text-[13px]">موقعي الحالي</span>
               </button>
               <button onClick={useOnMap} className="p-6 bg-green-50 rounded-3xl active:bg-green-100 flex flex-col items-center gap-3 border border-green-100 transition-all text-green-700 font-bold">
                  <MapPin size={32}/>
                  <span className="text-[13px]">على الخريطة</span>
               </button>
            </div>
            <button onClick={resetForm} className="mt-8 text-gray-400 text-xs font-bold underline">إلغاء العملية</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="z-[1001] bg-[#075E54] p-3 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-2">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight size={26} className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`}/>
           </button>
           <h1 className="text-[17px] font-bold tracking-tight pr-1">هـــاك صورة</h1>
        </div>
        <div className="flex-1 max-w-[200px] mx-2 relative">
           <div className="bg-white/10 rounded-full flex items-center px-4 py-2 border border-white/10">
              <Search size={14} className="text-white/30 ml-2" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث..." className="bg-transparent outline-none text-[12px] text-white w-full"/>
           </div>
           {searchResults.length > 0 && (
             <div className="absolute top-12 right-0 left-0 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto border border-gray-100 z-[2000]">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => handleLocationPickedOnMap({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) })} 
                    className="p-4 border-b border-gray-50 text-[13px] text-right cursor-pointer hover:bg-gray-100 flex justify-between items-center text-gray-700">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="font-bold truncate">{res.display_name.split(',')[0]}</span>
                  </div>
                ))}
             </div>
           )}
        </div>
        <button onClick={() => setMapMode(mapMode === 'VIEW' ? 'PICK_LOCATION' : 'VIEW')} 
          className={`p-2 rounded-full transition-all ${mapMode === 'PICK_LOCATION' ? 'bg-[#25D366] shadow-lg scale-110' : 'bg-white/10 opacity-70'}`}>
            <LocateFixed size={20}/>
        </button>
      </header>

      <main className="flex-1 relative flex">
        {/* Professional Sidebar (Left) */}
        <div className={`z-[1100] bg-white h-full shadow-[10px_0_30px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col border-r border-gray-100 ${isSidebarOpen ? 'w-80' : 'w-0'}`}>
           <div className="p-6 flex flex-col gap-8 flex-1 overflow-y-auto min-w-[320px]">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-bold text-gray-800">أدوات الميدان</h3>
                 <button onClick={() => setIsSidebarOpen(false)} className="text-gray-300 hover:text-red-500 transition-colors"><X/></button>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">ملاحظة سريعة</label>
                 <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 focus-within:border-blue-400 transition-all">
                    <textarea value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} placeholder="أدخل تفاصيل إضافية هنا..." rows={3} className="w-full bg-transparent outline-none text-sm resize-none text-gray-700"/>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => fileInputRef.current?.click()} className="p-6 bg-blue-50 rounded-3xl flex flex-col items-center gap-3 text-blue-600 hover:bg-blue-100 transition-all">
                    <ImageIcon size={28}/> <span className="text-[11px] font-bold">رفع صورة</span>
                 </button>
                 <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="p-6 bg-green-50 rounded-3xl flex flex-col items-center gap-3 text-green-600 hover:bg-green-100 transition-all">
                    <Camera size={28}/> <span className="text-[11px] font-bold">كاميرا</span>
                 </button>
              </div>
           </div>
           <div className="p-6 border-t text-[10px] text-gray-400 text-center flex items-center justify-center gap-2">
              <Navigation size={12}/> نظام الرصد الجغرافي الموحد
           </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full" ref={mapRef}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
            <MapController mode={mapMode} flyToLocation={flyToTarget} onLocationPick={handleLocationPickedOnMap} />
            {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={googleBlinkingIcon} />}
            {reports.map((r) => (
              <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportMarkerIcon}>
                <Popup className="custom-popup" minWidth={220}>
                  <div className="bg-white p-3 text-right">
                    <p className="font-bold text-[12px] text-gray-800 leading-snug">{r.place_name}</p>
                    <p className="text-[10px] text-gray-400 mt-2 border-t pt-1">{r.timestamp}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Expressive Crosshair (Visible in PICK_LOCATION mode) */}
          {mapMode === 'PICK_LOCATION' && (
            <div className="map-crosshair">
               <div className="crosshair-pin">
                  <MapPin size={54} className="text-blue-600 fill-blue-600/10" />
               </div>
               <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg absolute bottom-[-4px]"></div>
            </div>
          )}

          {/* My Location FAB (Google Like) */}
          {!isFormOpen && !showWelcome && (
            <div className="absolute top-4 right-4 z-[1000]">
              <button onClick={() => { updateGPSLocation(); if(userLocation) setFlyToTarget(userLocation); }} 
                className="bg-white p-3.5 rounded-full shadow-2xl text-blue-600 active:text-blue-800 border border-gray-100 transition-all">
                <LocateFixed size={22} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {isFormOpen && !isMinimized && (
          <div className="absolute inset-0 z-[1300] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-modal rounded-[48px] w-full max-w-[340px] shadow-2xl overflow-hidden border border-white/40">
              <div className="p-6 bg-white/40 border-b border-black/5">
                 <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2">
                    <span className="font-mono bg-white/60 px-2 py-0.5 rounded-full text-[#075E54]">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                    <span className="font-bold">الإحداثيات</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] text-gray-500 px-1">
                    <span className="font-bold">{new Date().toLocaleTimeString('ar-MA')}</span>
                    <span className="font-bold">التوقيت</span>
                 </div>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="relative mb-8">
                   <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-2xl overflow-hidden bg-gray-100">
                      <img src={imagePreview!} className="w-full h-full object-cover" />
                   </div>
                   <button onClick={() => setShowLocationOptions(true)} className="absolute bottom-0 right-1 bg-blue-600 text-white p-2.5 rounded-full shadow-2xl border-2 border-white z-10"><RefreshCw size={20}/></button>
                </div>
                <div className="w-full space-y-4">
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/30 text-right">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">الموقع المكتشف</label>
                    <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} className="w-full bg-transparent p-0 text-[15px] font-bold outline-none text-gray-800"/>
                  </div>
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/30 text-right">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">الملاحظات</label>
                    <textarea rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} className="w-full bg-transparent p-0 text-[13px] font-medium outline-none text-gray-700 resize-none" placeholder="أدخل تفاصيل..."/>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-0 flex flex-col gap-3">
                 <button onClick={handleSubmit} disabled={loading} className="w-full bg-[#25D366] text-white py-4 rounded-[30px] font-bold shadow-2xl flex items-center justify-center gap-3 transition-all text-lg">
                    {loading ? <Loader2 size={24} className="animate-spin"/> : <Send size={24}/>} <span>إرسال المساهمة</span>
                 </button>
                 <button onClick={resetForm} className="py-2 text-gray-400 font-bold text-xs">تجاهل</button>
              </div>
            </div>
          </div>
        )}
        
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
      </main>
    </div>
  );
};

export default App;
