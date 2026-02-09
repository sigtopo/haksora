
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, Target, PartyPopper, 
  RefreshCw, Upload, Image as ImageLucide, LocateFixed, Map as MapIcon, Layers
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
  html: `<div style="background-color: #25D366; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
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
    const saved = localStorage.getItem('research_field_v10');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  // Countdown timer logic during sending
  useEffect(() => {
    let timer: any;
    if (loading && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading, countdown]);

  // Instant Search Logic (Triggered on typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 0) handleOSMSearch();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const triggerCelebration = () => {
    setShowCelebration(true);
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#25D366'];
    for (let i = 0; i < 80; i++) {
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
        const short = addr.road || addr.suburb || addr.village || addr.city || "نقطة رصد";
        setPlaceName(`توثيق: ${short}`);
      }
    } catch (error) { setPlaceName(`موقع غير محدد`); }
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
    setIsMinimized(true); // Hide main preview, show top mini icon
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
        timestamp: formatDateTime(),
        place_name: placeName,
        imageUrl: imageUrl,
      };
      setReports((prev) => [newReport, ...prev]);
      resetForm();
      triggerCelebration();
    } catch (error) { 
      alert("فشل الإرسال، حاول مجدداً"); 
      setIsMinimized(false); 
    }
    finally { 
      setLoading(false); 
      setIsUploadingImage(false); 
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

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#111B21] overflow-hidden relative font-sans">
      
      {/* Celebration Message */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in">
          <PartyPopper size={100} className="text-[#25D366] mb-6 animate-bounce" />
          <h2 className="text-white text-3xl font-bold mb-2">تهانينا!</h2>
          <p className="text-white/80 text-xl text-center px-4">تم تسجيل مساهمتك الميدانية</p>
        </div>
      )}

      {/* Mini Progress Indicator (Top Center) */}
      {isMinimized && loading && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1300] bg-[#075E54] text-white px-6 py-2.5 rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-3 animate-in slide-in-from-top-4"
        >
          <div className="relative w-8 h-8 flex items-center justify-center bg-black/20 rounded-full">
            <Loader2 size={20} className="animate-spin text-[#25D366]" />
            <span className="absolute text-[11px] font-bold text-white">{countdown}</span>
          </div>
          <span className="text-[13px] font-bold">جاري الإرسال...</span>
        </button>
      )}

      {/* Modern Header */}
      <header className="z-[1001] bg-[#075E54] p-3 flex items-center justify-between text-white shadow-2xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-[#25D366] p-1.5 rounded-lg">
             <ImageLucide size={18} className="text-white"/>
          </div>
          <h1 className="text-[16px] font-bold tracking-tight">هـــاك صورة</h1>
        </div>
        
        <div className="flex-1 max-w-[200px] mx-2 relative">
           <div className="bg-white/10 rounded-full flex items-center px-4 py-2 border border-white/10 transition-all focus-within:bg-white/20">
              <Search size={14} className="text-white/30 ml-2" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث..." 
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
          className={`p-2 rounded-full transition-all ${mapMode === 'PICK_LOCATION' ? 'bg-[#25D366] text-white' : 'bg-white/10 opacity-70'}`}>
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

        {/* Expressive Selection Marker */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
             <div className="crosshair-pin">
                <MapPin size={48} className="text-red-500 fill-red-500/20" />
             </div>
             <div className="w-4 h-4 rounded-full border-2 border-white bg-red-500 absolute bottom-[-2px]"></div>
          </div>
        )}

        {/* Professional OpenLayer-Style FAB (Right side margin) */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => handleGetCurrentLocation(false)} 
              className="bg-white p-3.5 rounded-full shadow-2xl text-[#4285F4] border border-gray-100 active:scale-90 transition-transform">
              <Layers size={24} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Centered Quick Note & Toolbar + Right Margin Toggle */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute bottom-12 inset-x-0 z-[1001] flex items-center justify-center pointer-events-none">
             <div className="w-full max-w-[420px] px-6 flex items-center justify-center relative pointer-events-auto">
                {/* Note Input (Centered) */}
                <div className={`flex items-center gap-3 bg-white rounded-full shadow-2xl px-5 py-3 min-h-[60px] border border-gray-100 transition-all duration-500 overflow-hidden ${isCollapsed ? 'max-w-0 opacity-0 px-0' : 'max-w-full opacity-100 flex-1'}`}>
                   <Keyboard size={18} className="text-gray-400 ml-1" />
                   <input 
                      type="text" value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      placeholder="أضف ملاحظة سريعة..." 
                      className="bg-transparent outline-none text-[15px] text-gray-700 w-full"
                   />
                   <div className="flex items-center gap-4 text-gray-300 mr-2 border-r pr-4">
                      <button onClick={() => fileInputRef.current?.click()} className="active:text-[#4285F4]"><FileText size={22}/></button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="active:text-[#4285F4]"><Camera size={22}/></button>
                   </div>
                </div>

                {/* Toggle Button (On the right edge margin) */}
                <button 
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="absolute right-0 bg-[#075E54] text-white p-4 rounded-full shadow-2xl border-2 border-white/20 active:scale-95 transition-transform"
                >
                  {isCollapsed ? <ChevronLeft size={24}/> : <ChevronRight size={24}/>}
                </button>
             </div>
          </div>
        )}

        {/* Pick Image Overlay */}
        {showImagePicker && (
          <div className="absolute inset-0 z-[1100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="bg-white rounded-[40px] p-10 space-y-8 shadow-2xl w-full max-w-[360px] text-center">
              <div className="flex flex-col items-center gap-6">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <ImageIcon size={40} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800 text-2xl">توثيق الصورة</h3>
                    <p className="text-[13px] text-gray-400 mt-2">يرجى اختيار وسيلة لإضافة الصورة للتقرير</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }} className="p-6 bg-blue-50 rounded-3xl active:bg-blue-100 flex flex-col items-center gap-3 border border-blue-100">
                  <Camera size={32} className="text-blue-600"/>
                  <span className="text-[13px] font-bold text-blue-800">كاميرا</span>
                </button>
                <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }} className="p-6 bg-green-50 rounded-3xl active:bg-green-100 flex flex-col items-center gap-3 border border-green-100">
                  <Upload size={32} className="text-green-600"/>
                  <span className="text-[13px] font-bold text-green-800">معرض</span>
                </button>
              </div>
              <button onClick={resetForm} className="text-gray-400 text-sm font-bold pt-2 underline uppercase">إلغاء</button>
            </div>
          </div>
        )}

        {/* Refined Send Modal (Transparent/Centered) */}
        {isFormOpen && !isMinimized && (
          <div className="absolute inset-0 z-[1200] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-modal rounded-[40px] w-full max-w-[340px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              
              {/* Top: DateTime & Coordinates (Moved up) */}
              <div className="p-5 bg-white/40 border-b border-black/5">
                 <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2">
                    <span className="font-mono bg-black/5 px-2 py-0.5 rounded-full text-[#075E54]">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                    <span className="font-bold">الإحداثيات</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] text-gray-500">
                    <span className="font-bold">{formatDateTime()}</span>
                    <span className="font-bold">التوقيت</span>
                 </div>
              </div>

              <div className="p-8 flex flex-col items-center">
                {/* Circular image (No Colored Ring) with Refresh icon */}
                <div className="relative mb-8">
                   <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-xl overflow-hidden bg-gray-100">
                      <img src={imagePreview!} className="w-full h-full object-cover" />
                   </div>
                   <button 
                    onClick={() => setShowImagePicker(true)}
                    className="absolute bottom-0 right-1 bg-[#4285F4] text-white p-2.5 rounded-full shadow-2xl border-2 border-white active:scale-90 transition-all z-10"
                   >
                     <RefreshCw size={20}/>
                   </button>
                </div>

                <div className="w-full space-y-4">
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/30 text-right">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">المكان المكتشف</label>
                    <input 
                      type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-transparent p-0 text-[15px] font-bold outline-none text-gray-800"
                    />
                  </div>
                  
                  <div className="bg-black/5 p-4 rounded-3xl border border-white/30 text-right">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">الملاحظات</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-transparent p-0 text-[13px] font-medium outline-none text-gray-700 resize-none"
                      placeholder="أضف أي ملاحظات..."
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Send Button (Requested location) */}
              <div className="p-6 pt-0 flex flex-col gap-3">
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="w-full bg-[#25D366] text-white py-4 rounded-[28px] font-bold shadow-2xl active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-3 transition-all text-lg"
                  >
                    {loading ? <Loader2 size={24} className="animate-spin"/> : <Send size={24}/>}
                    <span>إرسال المساهمة</span>
                  </button>
                  <button onClick={resetForm} className="py-2 text-gray-400 font-bold text-xs">تجاهل</button>
              </div>
            </div>
          </div>
        )}
        
        <input 
          ref={fileInputRef} 
          type="file" 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageChange} 
        />
      </main>
    </div>
  );
};

export default App;
