
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, Target, PartyPopper, 
  Edit3, RefreshCw, Upload, Image as ImageLucide
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
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('research_field_v8');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  // Instant Search Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 1) handleOSMSearch();
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const triggerCelebration = () => {
    setShowCelebration(true);
    const colors = ['#f2d74e', '#95c3de', '#ff9a91', '#25D366', '#4285F4'];
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
        const short = addr.road || addr.suburb || addr.village || addr.city || "موقع محدد";
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
      setReports([newReport, ...reports]);
      localStorage.setItem('research_field_v8', JSON.stringify([newReport, ...reports]));
      resetForm();
      triggerCelebration();
    } catch (error) { alert("فشل الإرسال"); }
    finally { setLoading(false); setIsUploadingImage(false); }
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
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in">
          <PartyPopper size={100} className="text-[#25D366] mb-6 animate-bounce" />
          <h2 className="text-white text-3xl font-bold mb-2">تهانينا!</h2>
          <p className="text-white/80 text-xl">لقد سجلت مساهمتك بنجاح</p>
        </div>
      )}

      {/* Modern Header */}
      <header className="z-[1001] bg-[#075E54] p-3 flex items-center justify-between text-white shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-[#25D366] p-1.5 rounded-lg shadow-inner">
             <ImageLucide size={20} className="text-white"/>
          </div>
          <h1 className="text-[17px] font-bold tracking-tight">هـــاك صورة</h1>
        </div>
        <div className="flex-1 max-w-[200px] mx-2 relative">
           <div className="bg-white/10 rounded-full flex items-center px-4 py-2 border border-white/5 transition-all focus-within:bg-white/20">
              <Search size={16} className="text-white/40 ml-2" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مكان..." 
                className="bg-transparent outline-none text-[13px] text-white placeholder-white/30 w-full"
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
          className={`p-2.5 rounded-full transition-colors ${mapMode === 'PICK_LOCATION' ? 'bg-[#25D366] text-white' : 'bg-white/10 text-white'}`}>
            <Target size={20}/>
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
                  <p className="text-[10px] text-gray-400 border-t pt-1">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* My Location FAB */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute top-6 right-6 z-[1000]">
            <button onClick={() => handleGetCurrentLocation(false)} 
              className="bg-white p-3.5 rounded-full shadow-2xl text-[#075E54] border border-gray-100 active:scale-90 transition-transform">
              <Target size={24} />
            </button>
          </div>
        )}

        {/* Collapsible Tool Bar (Centered) */}
        {!isFormOpen && !showImagePicker && (
          <div className="absolute bottom-16 inset-x-0 z-[1001] flex flex-col items-center">
             <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 bg-white rounded-full shadow-2xl px-5 py-2.5 min-h-[56px] border border-gray-100 transition-all duration-500 overflow-hidden ${isCollapsed ? 'max-w-0 opacity-0 px-0' : 'max-w-[350px] opacity-100'}`}>
                   <Keyboard size={18} className="text-gray-400 ml-2" />
                   <input 
                      type="text" value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      placeholder="أضف ملاحظات سريعة..." 
                      className="bg-transparent outline-none text-[15px] text-gray-700 w-44"
                   />
                   <div className="flex items-center gap-4 text-gray-300 mr-2 border-r pr-4">
                      <button onClick={openGallery} className="active:text-blue-500 transition-colors"><FileText size={22}/></button>
                      <button onClick={openCamera} className="active:text-blue-500 transition-colors"><Camera size={22}/></button>
                   </div>
                </div>
                <button 
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="bg-[#075E54] text-white p-3.5 rounded-full shadow-2xl border-2 border-white/20 active:scale-95 transition-transform"
                >
                  {isCollapsed ? <ChevronLeft size={24}/> : <ChevronRight size={24}/>}
                </button>
             </div>
          </div>
        )}

        {/* Pick Image Overlay (Force choice after place selection) */}
        {showImagePicker && (
          <div className="absolute inset-0 z-[1100] bg-black/50 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="bg-white rounded-[40px] p-10 space-y-8 shadow-2xl w-full max-w-[360px] text-center">
              <div className="flex flex-col items-center gap-6">
                 <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 shadow-inner">
                    <ImageIcon size={48} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800 text-2xl">أضف صورة للتقرير</h3>
                    <p className="text-[13px] text-gray-400 mt-2">يرجى التقاط صورة أو رفع واحدة من المعرض</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <button onClick={openCamera} className="p-6 bg-blue-50 rounded-3xl active:bg-blue-100 flex flex-col items-center gap-3 transition-all border border-blue-100 group">
                  <Camera size={32} className="text-blue-600 group-active:scale-90 transition-transform"/>
                  <span className="text-[13px] font-bold text-blue-800">كاميرا</span>
                </button>
                <button onClick={openGallery} className="p-6 bg-green-50 rounded-3xl active:bg-green-100 flex flex-col items-center gap-3 transition-all border border-green-100 group">
                  <Upload size={32} className="text-green-600 group-active:scale-90 transition-transform"/>
                  <span className="text-[13px] font-bold text-green-800">معرض</span>
                </button>
              </div>
              <button onClick={resetForm} className="text-gray-400 text-sm font-bold pt-2 underline uppercase tracking-widest">إلغاء العملية</button>
            </div>
          </div>
        )}

        {/* Modern Transparent Preview Modal */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-modal rounded-[40px] w-full max-w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300">
              
              {/* Header: DateTime & XY */}
              <div className="p-5 pb-2 text-center border-b border-black/5">
                 <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#075E54] mb-1">
                    <Clock size={12}/>
                    <span>{formatDateTime()}</span>
                 </div>
                 <div className="text-[10px] text-gray-500 font-mono">
                    GPS: {pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}
                 </div>
              </div>

              <div className="p-6 flex flex-col items-center">
                {/* Circular image with edit icon */}
                <div className="relative mb-8 group">
                   <div className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden relative">
                      <img src={imagePreview!} className="w-full h-full object-cover" />
                      {isUploadingImage && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="animate-spin text-white" size={28}/>
                        </div>
                      )}
                   </div>
                   {/* Change Image Trigger */}
                   <button 
                    onClick={() => setShowImagePicker(true)}
                    className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-xl border border-gray-100 text-blue-500 active:scale-90 transition-transform"
                   >
                     <RefreshCw size={18}/>
                   </button>
                   {/* Progress Ring Simulation */}
                   <svg className="absolute -inset-2 w-32 h-32 pointer-events-none">
                      <circle 
                        className="progress-ring__circle" 
                        stroke={isUploadingImage ? "#3b82f6" : "#25D366"} 
                        strokeWidth="3" 
                        strokeDasharray="301" 
                        strokeDashoffset={isUploadingImage ? "150" : "0"}
                        fill="transparent" r="48" cx="64" cy="64"/>
                   </svg>
                </div>

                <div className="w-full space-y-4">
                  <div className="bg-black/5 p-3.5 rounded-2xl border border-white/20">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1 text-right">الموقع المكتشف</label>
                    <input 
                      type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-transparent p-0 rounded-lg text-[15px] font-bold outline-none text-right text-gray-800"
                    />
                  </div>
                  
                  <div className="bg-black/5 p-3.5 rounded-2xl border border-white/20">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1 text-right">ملاحظات التقرير</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-transparent p-0 rounded-lg text-[13px] font-medium outline-none text-right text-gray-700 resize-none"
                      placeholder="أدخل أي ملاحظات ميدانية إضافية..."
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Send Button */}
              <div className="p-6 pt-0 flex gap-3">
                 <button onClick={resetForm} className="flex-1 py-4 text-gray-400 font-bold text-sm">إلغاء</button>
                 <button 
                    onClick={handleSubmit} disabled={loading}
                    className="flex-[2] bg-[#25D366] text-white py-4 rounded-3xl font-bold shadow-2xl active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-3 transition-all"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                    <span className="text-[17px]">إرسال المساهمة</span>
                  </button>
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
