
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Check, Camera, RotateCcw, Search, Send, ArrowRight, Clock, ImageIcon, 
  Keyboard, FileText, ChevronRight, ChevronLeft, LocateFixed, Target
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

const whatsappGreen = "#008069";
const whatsappLightGreen = "#25D366";

const userIcon = L.divIcon({
  className: 'user-marker-container',
  html: '<div class="user-location-pulse"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const monumentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${whatsappLightGreen}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
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
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('research_field_v6');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  const formatDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
        setPlaceName(`${Math.random().toString(36).substring(2, 6).toUpperCase()} نواحي ${short}`);
      }
    } catch (error) {
      setPlaceName(`موقع مجهول`);
    } finally {
      setIsGeocoding(false);
    }
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
      () => { setLoading(false); alert("GPS OFF"); },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationSelected = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setFlyToTarget(loc);
    setMapMode('VIEW');
    setIsFormOpen(true);
    setShowLocationSelection(false);
    getShortAddress(loc.lat, loc.lng);
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
        setShowLocationSelection(true); 
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
      localStorage.setItem('research_field_v6', JSON.stringify(updated));
      resetForm();
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

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#111B21] overflow-hidden relative font-sans">
      
      {/* Small Header */}
      <header className="z-[1001] bg-[#075E54] p-2 flex items-center justify-between text-white shadow-lg">
        <div className="flex items-center gap-2">
          {isFormOpen ? <button onClick={resetForm}><ArrowRight size={20}/></button> : <ImageIcon size={18} className="text-[#25D366]"/>}
          <h1 className="text-[14px] font-bold">هـــاك صورة</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setMapMode(mapMode === 'VIEW' ? 'PICK_LOCATION' : 'VIEW')} className="p-1 active:scale-90">
            <Search size={18} className={mapMode === 'PICK_LOCATION' ? 'text-[#25D366]' : ''}/>
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full" ref={mapRef}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
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

        {/* OSM Search Overlay */}
        {mapMode === 'PICK_LOCATION' && !isFormOpen && (
          <div className="absolute top-4 inset-x-3 z-[1000]">
            <div className="bg-white rounded-full shadow-lg flex items-center px-4 py-2 border border-gray-100 h-10">
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleOSMSearch()}
                placeholder="ابحث عن مكان..." 
                className="flex-1 bg-transparent outline-none text-[13px] text-gray-700"
              />
              {isGeocoding && <Loader2 size={14} className="animate-spin text-[#075E54] ml-2" />}
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white mt-2 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => handleLocationSelected({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) })} 
                    className="p-3 border-b border-gray-50 text-[12px] text-right cursor-pointer hover:bg-gray-50">
                    <p className="font-bold">{res.display_name.split(',')[0]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map Center Marker */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
            <div className="map-crosshair-vertical"></div>
            <div className="map-crosshair-horizontal"></div>
            <div className="map-crosshair-center"></div>
          </div>
        )}

        {/* Professional Location Icons */}
        {!isFormOpen && !showLocationSelection && mapMode === 'VIEW' && (
          <div className="absolute top-16 right-3 z-[1000] flex flex-col gap-2">
            <button onClick={() => handleGetCurrentLocation(false)} 
              className="bg-white p-2 rounded-full shadow-lg text-[#075E54] border border-gray-100 active:bg-gray-100">
              <Target size={18} />
            </button>
          </div>
        )}

        {/* WhatsApp-Style Bottom Bar with Collapse */}
        {!isFormOpen && !showLocationSelection && (
          <div className={`absolute bottom-12 z-[1001] transition-all duration-300 flex items-center gap-2 ${isCollapsed ? 'right-[-250px]' : 'right-3 left-3'}`}>
            <div className={`flex-1 bg-white rounded-full shadow-lg flex items-center px-4 py-2 min-h-[50px] transition-opacity ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <Keyboard size={18} className="text-gray-400 ml-2" />
              <input 
                type="text" value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                placeholder="Type a message" 
                className="flex-1 bg-transparent outline-none text-[15px] text-gray-600 py-1"
              />
              <div className="flex items-center gap-3 text-gray-400 mr-2">
                <button onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}><FileText size={20}/></button>
                <button onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}><Camera size={20}/></button>
              </div>
            </div>
            
            <button onClick={() => setIsCollapsed(!isCollapsed)} 
              className="bg-[#008069] text-white p-3 rounded-full shadow-lg active:scale-90 flex items-center justify-center">
              {isCollapsed ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
            </button>
          </div>
        )}

        {/* Pick Location Button (Manual) */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute bottom-24 inset-x-0 flex justify-center z-[1000]">
            <button onClick={() => mapRef.current && handleLocationSelected({ lat: mapRef.current.getCenter().lat, lng: mapRef.current.getCenter().lng })}
              className="bg-[#25D366] text-white py-2.5 px-10 rounded-full font-bold shadow-xl border border-white/20 active:scale-95 text-sm">
              تثبيت هنا
            </button>
          </div>
        )}

        {/* Compact Center Selection Overlay */}
        {showLocationSelection && (
          <div className="absolute inset-0 z-[1100] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-6">
            <div className="bg-white/95 rounded-[28px] p-6 space-y-6 shadow-2xl max-w-[300px] text-center">
              <div className="flex flex-col items-center gap-4">
                 <img src={imagePreview!} className="w-20 h-20 rounded-full object-cover border-2 border-[#25D366] shadow-md" />
                 <p className="font-bold text-gray-800 text-sm">أين تم الالتقاط؟</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleGetCurrentLocation(true)} className="p-3 bg-gray-50 rounded-xl active:bg-gray-100 flex flex-col items-center gap-1">
                  <LocateFixed size={18} className="text-[#008069]"/>
                  <span className="text-[10px] font-bold">موقعي</span>
                </button>
                <button onClick={() => { setMapMode('PICK_LOCATION'); setShowLocationSelection(false); }} className="p-3 bg-gray-50 rounded-xl active:bg-gray-100 flex flex-col items-center gap-1">
                  <MapPin size={18} className="text-[#128C7E]"/>
                  <span className="text-[10px] font-bold">الخريطة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Small Transparent Report Modal */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-black/10 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="bg-white/90 rounded-[30px] w-full max-w-[320px] shadow-2xl overflow-hidden border border-white/50 animate-in zoom-in-95 duration-200">
              
              <div className="bg-[#075E54] p-3 flex justify-between items-center text-white">
                <button onClick={resetForm}><X size={18}/></button>
                <h3 className="text-xs font-bold">معاينة وإرسال</h3>
                <button 
                  onClick={handleSubmit} disabled={loading}
                  className="bg-[#25D366] px-3 py-1 rounded-full text-[11px] font-bold shadow-md active:scale-95 disabled:bg-gray-400 flex items-center gap-1"
                >
                  {loading ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                  إرسال
                </button>
              </div>

              <div className="p-5 flex flex-col items-center gap-4">
                <div className="relative w-20 h-20 rounded-full border-4 border-[#25D366] shadow-inner overflow-hidden">
                  <img src={imagePreview!} className="w-full h-full object-cover" />
                  {isUploadingImage && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-white" size={20}/>
                    </div>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <div className="text-right">
                    <label className="text-[9px] text-[#008069] font-bold">اسم المكان</label>
                    <input 
                      type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-[#F0F2F5]/50 p-2 rounded-lg text-[13px] font-bold outline-none text-right"
                    />
                  </div>
                  <div className="text-right">
                    <label className="text-[9px] text-[#008069] font-bold">الملاحظات (Danger)</label>
                    <textarea 
                      rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)}
                      className="w-full bg-[#F0F2F5]/50 p-2 rounded-lg text-[12px] font-medium outline-none text-right resize-none"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[8px] text-gray-400 bg-gray-50 p-2 rounded-lg">
                    <span className="font-mono">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                    <span className="font-bold">الإحداثيات</span>
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
