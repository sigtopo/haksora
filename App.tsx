
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, Target, PartyPopper, 
  RefreshCw, Upload, Image as ImageLucide, LocateFixed, Map as MapIcon
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

const googleUserIcon = L.divIcon({
  className: 'user-marker-container',
  html: '<div class="google-style-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const reportMarkerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #25D366; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
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
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<GeoLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    const saved = localStorage.getItem('research_field_v9');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  // Countdown timer logic
  useEffect(() => {
    let timer: any;
    if (loading && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && loading) {
      // Keep it at 0 until server finishes
    }
    return () => clearInterval(timer);
  }, [loading, countdown]);

  // Instant Search Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 1) handleOSMSearch();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const formatDateTime = () => {
    const now = new Date();
    return now.toLocaleString('ar-MA', { 
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getShortAddress = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address;
        const short = addr.road || addr.suburb || addr.village || addr.city || "نقطة مختارة";
        setPlaceName(`توثيق: ${short}`);
      }
    } catch (error) { setPlaceName(`موقع مجهول`); }
    finally { setIsGeocoding(false); }
  };

  const handleGetCurrentLocation = (triggerPicker = true) => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLoading(false);
        if (triggerPicker) {
          setPickedLocation(loc);
          setFlyToTarget(loc);
          setShowImagePicker(true);
          getShortAddress(loc.lat, loc.lng);
        } else {
          setFlyToTarget(loc);
        }
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationSelected = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setFlyToTarget(loc);
    setMapMode('VIEW');
    setSearchResults([]);
    
    if (!selectedImage) {
      setShowImagePicker(true);
      getShortAddress(loc.lat, loc.lng);
    } else {
      setIsFormOpen(true);
      getShortAddress(loc.lat, loc.lng);
    }
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setShowImagePicker(false);
        setIsFormOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;
    
    setLoading(true);
    setIsUploadingImage(true);
    setIsMinimized(true); // Hide main form and show mini indicator
    setCountdown(8); // Reset countdown

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
        timestamp: formatDateTime(),
        place_name: placeName,
        imageUrl: imageUrl,
      };
      const allReports = [newReport, ...reports];
      setReports(allReports);
      localStorage.setItem('research_field_v9', JSON.stringify(allReports));
      resetForm();
      triggerCelebration();
    } catch (error) { 
      alert("فشل الإرسال"); 
      setIsMinimized(false); 
    }
    finally { 
      setLoading(false); 
      setIsUploadingImage(false); 
      setIsMinimized(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setShowImagePicker(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPlaceName("");
    setDangerLevel("");
    setSelectedImage(null);
    setImagePreview(null);
    setSearchResults([]);
    setSearchQuery("");
    setIsMinimized(false);
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#111B21] overflow-hidden relative font-sans">
      
      {/* Celebration Message */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in">
          <PartyPopper size={100} className="text-[#25D366] mb-6 animate-bounce" />
          <h2 className="text-white text-3xl font-bold mb-2">تهانينا!</h2>
          <p className="text-white/80 text-xl text-center px-4">لقد سجلت مساهمتك بنجاح</p>
        </div>
      )}

      {/* Mini Progress Indicator (Top Center) */}
      {isMinimized && loading && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1300] bg-[#075E54] text-white px-5 py-2 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 animate-bounce"
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin" />
            <span className="absolute text-[9px] font-bold">{countdown}</span>
          </div>
          <span className="text-xs font-bold">جاري الإرسال...</span>
        </button>
      )}

      {/* Modern Header */}
      <header className="z-[1001] bg-[#075E54] p-3 flex items-center justify-between text-white shadow-2xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-[#25D366] p-1.5 rounded-lg shadow-lg">
             <ImageLucide size={18} className="text-white"/>
          </div>
          <h1 className="text-[15px] font-bold tracking-tight">هـــاك صورة</h1>
        </div>
        
        <div className="flex-1 max-w-[200px] mx-3 relative">
           <div className="bg-white/10 rounded-full flex items-center px-4 py-2 border border-white/10 transition-all focus-within:bg-white/20">
              <Search size={14} className="text-white/30 ml-2" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث هنا..." 
                className="bg-transparent outline-none text-[12px] text-white placeholder-white/20 w-full"
              />
           </div>
           {searchResults.length > 0 && (
             <div className="absolute top-12 right-0 left-0 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto border border-gray-100 z-[2000] animate-in slide-in-from-top-2">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => handleLocationSelected({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) })} 
                    className="p-4 border-b border-gray-50 text-[13px] text-right cursor-pointer hover:bg-gray-100 flex justify-between items-center text-gray-700">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="font-bold truncate">{res.display_name.split(',')[0]}</span>
                  </div>
                ))}
             </div>
           )}
        </div>

        <button onClick={() => setMapMode(mapMode === 'VIEW' ? 'PICK_LOCATION' : 'VIEW')} 
          className={`p-2 rounded-full transition-all ${mapMode === 'PICK_LOCATION' ? 'bg-[#25D366] rotate-90' : 'bg-white/10 opacity-70'}`}>
            <LocateFixed size={20}/>
        </button>
      </header>

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full" ref={mapRef}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          <MapController mode={mapMode} flyToLocation={flyToTarget} onLocationPick={handleLocationSelected} />
          {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={googleUserIcon} />}
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportMarkerIcon}>
              <Popup className="custom-popup" minWidth={220}>
                <div className="bg-white overflow-hidden text-right p-3">
                  <p className="font-bold text-[12px] text-gray-800 leading-snug mb-1">{r.place_name}</p>
                  <p className="text-[10px] text-gray-400 border-t pt-1 mt-1">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Professional OpenLayers-Style FAB (My Location) */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => handleGetCurrentLocation(false)} 
              className="bg-white p-3 rounded-full shadow-2xl text-[#4285F4] border border-gray-100 active:scale-90 transition-transform">
              <LocateFixed size={22} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Collapsible Tool Bar (Centered group + Toggle Right) */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute bottom-16 inset-x-0 z-[1001] flex items-center justify-center">
             <div className="relative w-full max-w-[420px] px-4 flex items-center justify-center">
                <div className={`flex items-center gap-2 bg-white rounded-full shadow-2xl px-5 py-2.5 min-h-[56px] border border-gray-100 transition-all duration-500 overflow-hidden ${isCollapsed ? 'max-w-0 opacity-0 px-0' : 'max-w-full opacity-100'}`}>
                   <Keyboard size={18} className="text-gray-400 ml-2" />
                   <input 
                      type="text" value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      placeholder="أضف ملاحظة سريعة..." 
                      className="bg-transparent outline-none text-[15px] text-gray-700 w-32 flex-1"
                   />
                   <div className="flex items-center gap-4 text-gray-300 mr-2 border-r pr-4">
                      <button onClick={openGallery} className="active:text-[#4285F4]"><FileText size={22}/></button>
                      <button onClick={openCamera} className="active:text-[#4285F4]"><Camera size={22}/></button>
                   </div>
                </div>

                {/* Toggle button on the right edge */}
                <button 
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="absolute right-0 bg-[#075E54] text-white p-3.5 rounded-full shadow-2xl border-2 border-white/20 active:scale-95 transition-transform"
                >
                  {isCollapsed ? <ChevronLeft size={24}/> : <ChevronRight size={24}/>}
                </button>
             </div>
          </div>
        )}

        {/* Pick Image Overlay (Force choice) */}
        {showImagePicker && (
          <div className="absolute inset-0 z-[1100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="bg-white rounded-[40px] p-10 space-y-8 shadow-2xl w-full max-w-[360px] text-center">
              <div className="flex flex-col items-center gap-6">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 shadow-inner">
                    <ImageIcon size={40} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800 text-2xl">أضف صورة</h3>
                    <p className="text-[13px] text-gray-400 mt-2">يرجى اختيار وسيلة لالتقاط صورة التقرير</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <button onClick={openCamera} className="p-6 bg-blue-50 rounded-3xl active:bg-blue-100 flex flex-col items-center gap-3 transition-all border border-blue-100">
                  <Camera size={32} className="text-blue-600"/>
                  <span className="text-[13px] font-bold text-blue-800">كاميرا</span>
                </button>
                <button onClick={openGallery} className="p-6 bg-green-50 rounded-3xl active:bg-green-100 flex flex-col items-center gap-3 transition-all border border-green-100">
                  <Upload size={32} className="text-green-600"/>
                  <span className="text-[13px] font-bold text-green-800">معرض</span>
                </button>
              </div>
              <button onClick={resetForm} className="text-gray-400 text-sm font-bold pt-2 underline uppercase tracking-widest">إلغاء</button>
            </div>
          </div>
        )}

        {/* Modern Transparent Preview Modal (Centered & Refined) */}
        {isFormOpen && !isMinimized && (
          <div className="absolute inset-0 z-[1200] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-modal rounded-[40px] w-full max-w-[340px] shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-300">
              
              {/* Header: DateTime & XY (Moved Top) */}
              <div className="p-5 pb-3 border-b border-black/5 bg-white/50">
                 <div className="flex justify-between items-center text-[10px] text-gray-500 px-1 mb-2">
                    <span className="font-mono bg-black/5 px-2 py-0.5 rounded-full">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                    <span className="font-bold flex items-center gap-1 text-[#075E54]"><MapPin size={10}/> الإحداثيات</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
                    <span className="text-gray-600 font-bold">{formatDateTime()}</span>
                    <span className="font-bold flex items-center gap-1"><Clock size={10}/> التوقيت</span>
                 </div>
              </div>

              <div className="p-6 flex flex-col items-center relative">
                {/* Circular image with edit icon */}
                <div className="relative mb-8">
                   <div className="w-28 h-28 rounded-full border-[5px] border-white shadow-2xl overflow-hidden relative bg-gray-100">
                      <img src={imagePreview!} className="w-full h-full object-cover" />
                   </div>
                   
                   {/* Refresh Icon (Change Image) */}
                   <button 
                    onClick={() => setShowImagePicker(true)}
                    className="absolute bottom-0 right-0 bg-white p-2.5 rounded-full shadow-2xl border border-gray-100 text-[#4285F4] active:scale-90 transition-all z-10"
                   >
                     <RefreshCw size={18}/>
                   </button>

                   {/* Progress Ring Simulation (Simplified) */}
                   <svg className="absolute -inset-2.5 w-32 h-32 pointer-events-none opacity-50">
                      <circle 
                        className="progress-ring__circle" 
                        stroke="#25D366" 
                        strokeWidth="3" 
                        strokeDasharray="301" 
                        strokeDashoffset="0"
                        fill="transparent" r="48" cx="64" cy="64"/>
                   </svg>
                </div>

                <div className="w-full space-y-4">
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/40">
                    <label className="text-[10px] text-[#075E54] font-bold block mb-1 text-right">الموقع</label>
                    <input 
                      type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-transparent p-0 rounded-lg text-[15px] font-bold outline-none text-right text-gray-800"
                    />
                  </div>
                  
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/40">
                    <label className="text-[10px] text-[#075E54] font-bold block mb-1 text-right">الملاحظات الميدانية</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-transparent p-0 rounded-lg text-[13px] font-medium outline-none text-right text-gray-700 resize-none"
                      placeholder="اكتب ملاحظات إضافية..."
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Send Button (Final) */}
              <div className="p-6 pt-0 space-y-2">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="w-full bg-[#25D366] text-white py-4 rounded-[24px] font-bold shadow-2xl active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-3 transition-all text-lg"
                  >
                    {loading ? <Loader2 size={24} className="animate-spin"/> : <Send size={24}/>}
                    <span>إرسال المساهمة</span>
                  </button>
                  <button onClick={resetForm} className="w-full py-2 text-gray-400 font-bold text-sm">تجاهل</button>
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
