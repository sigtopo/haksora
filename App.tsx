
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
// Fix: Added Clock to the imports from lucide-react
import { 
  Navigation, X, Loader2, MapPin, Trash2, 
  Check, Camera, Map as MapIcon, RotateCcw, Plus, Search, ExternalLink, Send, ArrowRight, User, Clock
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

const whatsappGreen = "#00A884";

const monumentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${whatsappGreen}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const MapController: React.FC<{ 
  mode: MapMode; 
  onLocationPick: (loc: GeoLocation) => void;
  flyToLocation: GeoLocation | null;
}> = ({ mode, onLocationPick, flyToLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (flyToLocation) {
      map.flyTo([flyToLocation.lat, flyToLocation.lng], 17, { animate: true });
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
  const [loading, setLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<GeoLocation | null>(null);
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<GeoLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('field_research_data_v1');
    if (saved) setReports(JSON.parse(saved));
    handleGetCurrentLocation(false);
  }, []);

  const formatDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };

  const getShortAddress = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      if (data && data.display_name) {
        // محاكاة نظام جوجل (اسم المكان + كود المنطقة التقريبي)
        const addr = data.address;
        const short = addr.road || addr.suburb || addr.village || addr.city || "موقع غير مسمى";
        const district = addr.county || addr.state || "";
        const pseudoPlusCode = Math.random().toString(36).substring(2, 6).toUpperCase() + "+" + Math.random().toString(36).substring(2, 4).toUpperCase();
        setPlaceName(`${pseudoPlusCode} نواحي ${short} ${district}`);
      }
    } catch (error) {
      setPlaceName(`موقع: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
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
          setShowLocationOptions(false);
          setMapMode('VIEW');
          setIsFormOpen(true);
          getShortAddress(loc.lat, loc.lng);
        }
      },
      (err) => {
        setLoading(false);
        alert("يرجى تفعيل نظام تحديد المواقع (GPS)");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleLocationSelected = (loc: GeoLocation) => {
    setPickedLocation(loc);
    setFlyToTarget(loc);
    setMapMode('VIEW');
    setIsFormOpen(true);
    setShowLocationOptions(false);
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
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    handleLocationSelected(loc);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Fix: Implemented handleRetakePhoto to reset image state and trigger file input again
  const handleRetakePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;

    setLoading(true);
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      const mapsLink = `https://www.google.com/maps?q=${pickedLocation.lat},${pickedLocation.lng}`;
      
      const payload = {
        place_name: placeName,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        lien_maps: mapsLink,
        lien_image: imageUrl // يرسل الرابط كنص فقط كما هو مطلوب
      };

      await uploadReportToServer(payload);

      const newReport: Report = {
        id: Date.now().toString(),
        location: pickedLocation,
        timestamp: formatDateTime(),
        place_name: placeName,
        imageUrl: imageUrl,
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('field_research_data_v1', JSON.stringify(updated));
      resetForm();
    } catch (error) {
      alert("حدث خطأ أثناء الإرسال");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setPickedLocation(null);
    setMapMode('VIEW');
    setPlaceName("");
    setSelectedImage(null);
    setImagePreview(null);
    setShowLocationOptions(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F0F2F5] text-[#111B21] overflow-hidden relative">
      {/* Header WhatsApp Style */}
      <header className="z-20 bg-[#008069] p-4 text-white flex items-center gap-4 shadow-sm">
        {isFormOpen || showLocationOptions ? (
          <button onClick={resetForm} className="p-1"><ArrowRight size={24} /></button>
        ) : (
          <div className="bg-white/20 p-2 rounded-full"><MapIcon size={20} /></div>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">التوثيق الميداني</h1>
          <p className="text-[11px] opacity-80">نظام البحث وتحديد المآثر</p>
        </div>
        {!isFormOpen && !showLocationOptions && (
          <button onClick={() => {if(confirm("مسح السجل؟")) { setReports([]); localStorage.removeItem('field_research_data_v1'); }}} className="p-2"><Trash2 size={20} /></button>
        )}
      </header>

      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} className="h-full w-full" ref={mapRef}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController mode={mapMode} flyToLocation={flyToTarget} onLocationPick={handleLocationSelected} />
          {userLocation && <Circle center={[userLocation.lat, userLocation.lng]} radius={30} pathOptions={{ color: whatsappGreen, fillColor: whatsappGreen, fillOpacity: 0.1 }} />}
          
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={monumentIcon}>
              <Popup className="custom-popup" minWidth={240}>
                <div className="bg-white overflow-hidden rounded-xl">
                  {r.imageUrl && <img src={r.imageUrl} className="w-full h-32 object-cover" />}
                  <div className="p-3 space-y-2 text-right">
                    <p className="font-bold text-sm text-gray-800">{r.place_name}</p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{r.timestamp}</span>
                      <a href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`} target="_blank" className="text-[#00A884] font-bold">خرائط جوجل</a>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Search Overlay in Manual Mode */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute top-4 inset-x-4 z-[1000] space-y-2">
            <div className="bg-white rounded-full shadow-lg flex items-center px-4 py-2 border border-gray-100">
              <Search size={20} className="text-gray-400" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleOSMSearch()}
                placeholder="بحث في خيارات OSM..." 
                className="flex-1 px-3 py-1 outline-none text-sm"
              />
              {isGeocoding && <Loader2 size={16} className="animate-spin text-[#00A884]" />}
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 max-h-60 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => handleSelectSearchResult(res)} className="p-3 border-b last:border-0 hover:bg-gray-50 text-sm cursor-pointer">
                    <p className="font-bold text-gray-800">{res.display_name.split(',')[0]}</p>
                    <p className="text-[10px] text-gray-500 truncate">{res.display_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Crosshair when picking */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair">
            <div className="map-crosshair-vertical"></div>
            <div className="map-crosshair-horizontal"></div>
            <div className="map-crosshair-center"></div>
          </div>
        )}

        {/* Confirm Selection for Manual */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute bottom-10 inset-x-0 flex justify-center z-[1000]">
            <button 
              onClick={() => {
                if(mapRef.current) {
                  const center = mapRef.current.getCenter();
                  handleLocationSelected({ lat: center.lat, lng: center.lng });
                }
              }}
              className="bg-[#00A884] text-white py-4 px-10 rounded-full font-bold shadow-2xl active:scale-95 flex items-center gap-2"
            >
              <Check size={24} />
              تأكيد هذا الموقع
            </button>
          </div>
        )}

        {/* Main Action Floating Button */}
        {!showLocationOptions && !isFormOpen && mapMode === 'VIEW' && (
          <button 
            onClick={() => setShowLocationOptions(true)}
            className="absolute bottom-8 right-8 z-[1000] bg-[#00A884] text-white p-5 rounded-full shadow-2xl active:scale-95 transition-all"
          >
            <Camera size={28} />
          </button>
        )}

        {/* Location Options Modal (WhatsApp Style) */}
        {showLocationOptions && (
          <div className="absolute inset-0 z-[1100] flex flex-col justify-end bg-black/40 animate-in fade-in">
            <div className="bg-white rounded-t-[30px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-gray-800">تحديد موقع الأثر</h3>
                <button onClick={() => setShowLocationOptions(false)} className="p-2"><X size={24} /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleGetCurrentLocation(true)}
                  className="flex flex-col items-center gap-3 p-6 bg-[#F0F2F5] rounded-3xl active:scale-95 transition-all border border-gray-100"
                >
                  <div className="bg-[#00A884] text-white p-4 rounded-2xl shadow-lg"><Navigation size={28} /></div>
                  <span className="font-bold text-sm">موقعي الحالي</span>
                </button>
                <button 
                  onClick={() => { setMapMode('PICK_LOCATION'); setShowLocationOptions(false); }}
                  className="flex flex-col items-center gap-3 p-6 bg-[#F0F2F5] rounded-3xl active:scale-95 transition-all border border-gray-100"
                >
                  <div className="bg-gray-800 text-white p-4 rounded-2xl shadow-lg"><MapPin size={28} /></div>
                  <span className="font-bold text-sm">تحديد يدوي</span>
                </button>
              </div>
              <div className="h-4"></div>
            </div>
          </div>
        )}

        {/* Form Overlay (WhatsApp Style) */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-[#F0F2F5] flex flex-col animate-in slide-in-from-left">
            <header className="bg-[#008069] p-4 text-white flex items-center gap-4">
              <button onClick={resetForm}><ArrowRight size={24} /></button>
              <h2 className="text-lg font-bold">توثيق جديد</h2>
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-gray-500 border-b pb-2">
                  <Clock size={16} />
                  <span className="text-xs font-bold">{formatDateTime()}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] text-gray-400 font-bold px-1">اسم الموقع (تلقائي)</label>
                  <div className="relative">
                    <User size={18} className="absolute right-3 top-3.5 text-[#00A884]" />
                    <input 
                      type="text" 
                      value={placeName} 
                      onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-[#F0F2F5] p-3 pr-10 rounded-xl text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center text-[10px] text-gray-400">
                  <span>الإحداثيات XY:</span>
                  <span className="font-mono text-[#00A884] font-bold">
                    {pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}
                  </span>
                </div>
              </div>

              {/* Photo Area */}
              <div 
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                className={`w-full aspect-square rounded-[32px] border-4 border-dashed flex items-center justify-center overflow-hidden transition-all bg-white ${imagePreview ? 'border-solid border-[#00A884]' : 'border-gray-200'}`}
              >
                {imagePreview ? (
                  <div className="relative w-full h-full">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    <button onClick={handleRetakePhoto} className="absolute bottom-4 right-4 bg-red-500 text-white p-3 rounded-full shadow-xl"><RotateCcw size={20} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-[#E7FCE3] p-6 rounded-full text-[#00A884]"><Camera size={48} /></div>
                    <p className="font-bold text-gray-400">التقط صورة للأثر</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageChange} />
            </div>

            <div className="p-6 bg-white shadow-t-lg">
              <button 
                onClick={handleSubmit}
                disabled={loading || !selectedImage || !placeName}
                className="w-full bg-[#00A884] text-white py-4 rounded-full font-bold shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-200"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                <span>إرسال البيانات</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
