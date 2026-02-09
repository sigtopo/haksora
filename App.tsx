
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Check, Camera, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, Target, PartyPopper, ChevronDown, ChevronUp
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

const userIcon = L.divIcon({
  className: 'user-marker-container',
  html: '<div class="user-location-pulse"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const monumentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #25D366; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
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
      map.setView([flyToLocation.lat, flyToLocation.lng], 18, { animate: false });
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
  const [showLocationSelection, setShowLocationSelection] = useState(false);
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
    const saved = localStorage.getItem('research_field_v7');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  const triggerCelebration = () => {
    setShowCelebration(true);
    // Create DOM confetti
    const count = 100;
    const container = document.body;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.backgroundColor = ['#f2d74e', '#95c3de', '#ff9a91', '#25D366', '#2196F3'][Math.floor(Math.random() * 5)];
      el.style.animationDuration = (Math.random() * 2 + 1) + 's';
      el.style.opacity = Math.random().toString();
      container.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
    setTimeout(() => setShowCelebration(false), 4000);
  };

  const formatDateTime = () => {
    const now = new Date();
    return `${now.toLocaleDateString('ar-MA')} | ${now.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}`;
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
        const short = addr.road || addr.suburb || addr.village || addr.city || "نواحي غير معروفة";
        setPlaceName(`توثيق ميداني - ${short}`);
      }
    } catch (error) { setPlaceName(`موقع مجهول`); }
    finally { setIsGeocoding(false); }
  };

  const handleGetCurrentLocation = (openForm = true) => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLoading(false);
        if (openForm) {
          setPickedLocation(loc);
          setFlyToTarget(loc);
          setShowLocationSelection(false);
          setMapMode('VIEW');
          setIsFormOpen(true);
          getShortAddress(loc.lat, loc.lng);
        } else {
          setFlyToTarget(loc);
        }
      },
      () => { setLoading(false); alert("GPS غير مفعل"); },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationSelected = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setFlyToTarget(loc);
    setMapMode('VIEW');
    setShowLocationSelection(false);
    
    // Logic change: If we pick a location but have no image, force image selection
    if (!selectedImage) {
      alert("يرجى اختيار صورة أولاً لإتمام التقرير");
      openGallery();
    } else {
      setIsFormOpen(true);
      getShortAddress(loc.lat, loc.lng);
    }
  };

  const handleOSMSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (error) { console.error(error); }
    finally { setIsGeocoding(false); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        // If we picked an image and already have a location (from search or map), open form
        if (pickedLocation) {
          setIsFormOpen(true);
          getShortAddress(pickedLocation.lat, pickedLocation.lng);
        } else {
          setShowLocationSelection(true); 
        }
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
      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('research_field_v7', JSON.stringify(updated));
      resetForm();
      triggerCelebration();
    } catch (error) { alert("خطأ في الإرسال"); }
    finally { setLoading(false); setIsUploadingImage(false); }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPlaceName("");
    setDangerLevel("");
    setSelectedImage(null);
    setImagePreview(null);
    setShowLocationSelection(false);
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
      
      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <PartyPopper size={80} className="text-[#25D366] mb-4 animate-bounce" />
          <h2 className="text-white text-2xl font-bold">تهانينا!</h2>
          <p className="text-white/80 text-lg">لقد سجلت مساهمتك بنجاح</p>
        </div>
      )}

      {/* Modern Compact Header */}
      <header className="z-[1001] bg-[#075E54]/95 backdrop-blur-md p-2 flex items-center justify-between text-white border-b border-white/10 shadow-xl">
        <div className="flex items-center gap-2 pr-2">
          {isFormOpen ? <button onClick={resetForm}><ArrowRight size={22}/></button> : <ImageIcon size={20} className="text-[#25D366]"/>}
          <h1 className="text-[15px] font-bold tracking-tight">هـــاك صورة</h1>
        </div>
        <div className="flex-1 max-w-[180px] mx-4">
           <div className="bg-white/10 rounded-full flex items-center px-3 py-1.5 border border-white/5">
              <Search size={14} className="text-white/40 ml-2" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleOSMSearch()}
                placeholder="ابحث هنا..." 
                className="bg-transparent outline-none text-[12px] text-white placeholder-white/30 w-full"
              />
           </div>
        </div>
        <button onClick={() => setMapMode(mapMode === 'VIEW' ? 'PICK_LOCATION' : 'VIEW')} className="p-2 active:scale-90 bg-white/10 rounded-full">
            <MapPin size={18} className={mapMode === 'PICK_LOCATION' ? 'text-[#25D366]' : 'text-white'}/>
        </button>
      </header>

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full" ref={mapRef}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
          <MapController mode={mapMode} flyToLocation={flyToTarget} onLocationPick={handleLocationSelected} />
          {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={monumentIcon}>
              <Popup className="custom-popup" minWidth={200}>
                <div className="bg-white overflow-hidden text-right p-2">
                  <p className="font-bold text-[11px] leading-tight">{r.place_name}</p>
                  <p className="text-[9px] text-gray-500">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && mapMode === 'PICK_LOCATION' && !isFormOpen && (
          <div className="absolute top-2 inset-x-4 z-[1000] bg-white rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto border border-gray-100">
            {searchResults.map((res, i) => (
              <div key={i} onClick={() => handleLocationSelected({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) })} 
                className="p-4 border-b border-gray-50 text-[13px] text-right cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                <MapPin size={14} className="text-gray-300" />
                <p className="font-bold text-gray-700 truncate">{res.display_name.split(',')[0]}</p>
              </div>
            ))}
          </div>
        )}

        {/* My Location FAB */}
        {!isFormOpen && !showLocationSelection && (
          <div className="absolute top-4 right-4 z-[1000]">
            <button onClick={() => handleGetCurrentLocation(false)} 
              className="bg-white p-3 rounded-full shadow-2xl text-[#075E54] border border-gray-100 active:scale-95 transition-transform">
              <Target size={20} />
            </button>
          </div>
        )}

        {/* Centered WhatsApp-Style Input Bar (Raised & Collapsible) */}
        {!isFormOpen && !showLocationSelection && (
          <div className={`absolute bottom-16 inset-x-0 z-[1001] flex flex-col items-center transition-all duration-300`}>
            {/* Toggle Button */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="mb-3 bg-[#075E54] text-white p-2 rounded-full shadow-lg border-2 border-white/20 active:scale-90"
            >
              {isCollapsed ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
            
            <div className={`flex items-center gap-2 w-[90%] max-w-[400px] transition-all duration-300 ${isCollapsed ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
              <div className="flex-1 bg-white rounded-full shadow-2xl flex items-center px-4 py-2 min-h-[52px] border border-gray-100">
                <Keyboard size={18} className="text-gray-400 ml-2" />
                <input 
                  type="text" value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                  placeholder="اكتب ملاحظة..." 
                  className="flex-1 bg-transparent outline-none text-[15px] text-gray-700 py-1"
                />
                <div className="flex items-center gap-3 text-gray-300 mr-2 border-r pr-3">
                  <button onClick={openGallery} className="active:text-[#075E54]"><FileText size={22}/></button>
                  <button onClick={openCamera} className="active:text-[#075E54]"><Camera size={22}/></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enlarge Location Selection Window */}
        {showLocationSelection && (
          <div className="absolute inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="bg-white rounded-[36px] p-8 space-y-8 shadow-2xl w-full max-w-[340px] text-center">
              <div className="flex flex-col items-center gap-5">
                 <div className="w-24 h-24 rounded-full border-4 border-[#25D366] shadow-xl overflow-hidden relative">
                    <img src={imagePreview!} className="w-full h-full object-cover" />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-800 text-xl">أين التقطت الصورة؟</h3>
                    <p className="text-[12px] text-gray-400 mt-1">تحديد الإحداثيات ضروري لإتمام التقرير</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleGetCurrentLocation(true)} className="p-5 bg-gray-50 rounded-2xl active:bg-gray-100 flex flex-col items-center gap-2 transition-colors">
                  <Target size={24} className="text-[#008069]"/>
                  <span className="text-[12px] font-bold">موقعي الآن</span>
                </button>
                <button onClick={() => { setMapMode('PICK_LOCATION'); setShowLocationSelection(false); }} className="p-5 bg-gray-50 rounded-2xl active:bg-gray-100 flex flex-col items-center gap-2 transition-colors">
                  <MapPin size={24} className="text-[#128C7E]"/>
                  <span className="text-[12px] font-bold">من الخريطة</span>
                </button>
              </div>
              <button onClick={resetForm} className="text-gray-300 text-xs font-bold pt-2 underline uppercase tracking-widest">إلغاء</button>
            </div>
          </div>
        )}

        {/* Small Transparent Preview Modal (Centered & Refined) */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white/95 rounded-[32px] w-full max-w-[320px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Header with Send button at top */}
              <div className="bg-[#075E54] p-4 flex justify-between items-center text-white">
                <button onClick={resetForm} className="bg-white/10 p-2 rounded-full"><X size={18}/></button>
                <h3 className="text-sm font-bold">مراجعة البيانات</h3>
                <button 
                  onClick={handleSubmit} disabled={loading}
                  className="bg-[#25D366] px-4 py-1.5 rounded-full text-[13px] font-bold shadow-lg active:scale-95 disabled:bg-gray-400 flex items-center gap-2 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                  إرسال
                </button>
              </div>

              <div className="p-6 flex flex-col items-center">
                {/* Circular image with simulated progress ring */}
                <div className="relative mb-6">
                  <svg className="w-24 h-24 progress-ring">
                    <circle 
                      className="progress-ring__circle" 
                      stroke="#25D366" 
                      strokeWidth="4" 
                      strokeDasharray="301.59" 
                      strokeDashoffset={isUploadingImage ? "100" : "0"}
                      fill="transparent" 
                      r="48" 
                      cx="48" 
                      cy="48"/>
                  </svg>
                  <div className="absolute inset-2 rounded-full overflow-hidden border-2 border-white shadow-lg">
                    <img src={imagePreview!} className="w-full h-full object-cover" />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="animate-spin text-white" size={24}/>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-4 text-right">
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <label className="text-[10px] text-[#008069] font-bold block mb-1">تحديد الموقع</label>
                    <input 
                      type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-transparent p-1 rounded-lg text-[14px] font-bold outline-none text-gray-700"
                    />
                  </div>
                  
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <label className="text-[10px] text-[#008069] font-bold block mb-1">الملاحظات</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-transparent p-1 rounded-lg text-[13px] font-medium outline-none text-gray-600 resize-none"
                      placeholder="اكتب ملاحظات إضافية..."
                    />
                  </div>

                  <div className="flex flex-col gap-1 px-2">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span className="font-mono text-[#075E54]">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                      <span className="font-bold flex items-center gap-1"><MapPin size={10}/> الإحداثيات</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-100 pt-1 mt-1">
                      <span className="text-gray-500">{formatDateTime()}</span>
                      <span className="font-bold flex items-center gap-1"><Clock size={10}/> التوقيت</span>
                    </div>
                  </div>
                </div>
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
