
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, X, Loader2, MapPin, Trash2, 
  Check, Camera, Map as MapIcon, RotateCcw, Search, Send, ArrowRight, Clock, Image as ImageIcon, Keyboard, FileText
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

const monumentIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${whatsappLightGreen}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>`,
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
      map.flyTo([flyToLocation.lat, flyToLocation.lng], 18, { animate: false });
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
  
  // Form States
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('research_field_v5');
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
        const addr = data.address;
        const short = addr.road || addr.suburb || addr.village || addr.city || "نواحي غير معروفة";
        const district = addr.county || addr.state || "";
        const pseudoPlusCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        setPlaceName(`${pseudoPlusCode}+WC7 نواحي ${short} ${district}`);
      }
    } catch (error) {
      setPlaceName(`XQ3M+WC7 نواحي غير محددة`);
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
      () => {
        setLoading(false);
        alert("يرجى تفعيل GPS");
      },
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
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeocoding(false);
    }
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
      
      const payload = {
        nom_douar: placeName,
        danger_level: dangerLevel || "بدون ملاحظات",
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lng,
        image_url: imageUrl
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
      localStorage.setItem('research_field_v5', JSON.stringify(updated));
      resetForm();
    } catch (error) {
      alert("حدث خطأ أثناء الإرسال");
    } finally {
      setLoading(false);
      setIsUploadingImage(false);
    }
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
    <div className="flex flex-col h-screen w-screen bg-[#E5DDD5] text-[#111B21] overflow-hidden relative font-sans">
      
      <main className="flex-1 relative">
        <MapContainer 
          center={[31.7917, -7.0926]} 
          zoom={6} 
          zoomControl={false} 
          className="h-full w-full" 
          ref={mapRef}
        >
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
            attribution="&copy; Google Maps" 
          />
          <MapController mode={mapMode} flyToLocation={flyToTarget} onLocationPick={handleLocationSelected} />
          
          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={monumentIcon}>
              <Popup className="custom-popup" minWidth={220}>
                <div className="bg-white overflow-hidden">
                  {r.imageUrl && <img src={r.imageUrl} className="w-full h-24 object-cover" />}
                  <div className="p-2 text-right">
                    <p className="font-bold text-[12px] text-gray-800 leading-tight">{r.place_name}</p>
                    <p className="text-[9px] text-gray-500 mt-1">{r.timestamp}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* WhatsApp-Style Search at TOP during Pick Location */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute top-4 inset-x-3 z-[1000]">
            <div className="bg-white rounded-full shadow-lg flex items-center px-4 py-2 min-h-[48px] border border-gray-100">
              <Search size={20} className="text-[#075E54] ml-3" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleOSMSearch()}
                placeholder="البحث في خيارات OSM..." 
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-700"
              />
              <button onClick={() => setMapMode('VIEW')} className="text-gray-400 p-1"><X size={20} /></button>
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white mt-2 rounded-2xl shadow-xl overflow-hidden border border-gray-100 max-h-52 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => {
                    const loc = { lat: parseFloat(res.lat), lng: parseFloat(res.lon) };
                    handleLocationSelected(loc);
                  }} className="p-4 border-b border-gray-50 hover:bg-gray-50 text-[13px] text-right cursor-pointer flex justify-between items-center">
                    <MapPin size={16} className="text-gray-300" />
                    <div className="flex-1 mr-3">
                      <p className="font-bold text-gray-700">{res.display_name.split(',')[0]}</p>
                      <p className="text-[10px] text-gray-400 truncate w-48">{res.display_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Crosshair */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair scale-75 opacity-80">
            <div className="map-crosshair-vertical"></div>
            <div className="map-crosshair-horizontal"></div>
            <div className="map-crosshair-center"></div>
          </div>
        )}

        {/* Manual Confirm Button */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute bottom-32 inset-x-0 flex justify-center z-[1000]">
            <button 
              onClick={() => {
                if(mapRef.current) {
                  const center = mapRef.current.getCenter();
                  handleLocationSelected({ lat: center.lat, lng: center.lng });
                }
              }}
              className="bg-[#25D366] text-white py-3 px-14 rounded-full font-bold shadow-xl flex items-center gap-2 border-2 border-white/20"
            >
              تأكيد الموقع
            </button>
          </div>
        )}

        {/* Floating Buttons: My Location & Delete History */}
        {!isFormOpen && !showLocationSelection && mapMode === 'VIEW' && (
           <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-3">
              <button 
                onClick={() => handleGetCurrentLocation(false)} 
                className="bg-white p-3 rounded-full shadow-lg text-[#075E54] active:scale-90"
              >
                <Navigation size={22} />
              </button>
              <button 
                onClick={() => {if(confirm("مسح السجل؟")) { setReports([]); localStorage.removeItem('research_field_v5'); }}} 
                className="bg-white p-3 rounded-full shadow-lg text-red-500 active:scale-90"
              >
                <Trash2 size={22} />
              </button>
           </div>
        )}

        {/* WhatsApp Bottom Input Bar - Raised for mobile visibility */}
        {!isFormOpen && !showLocationSelection && (
          <div className="absolute bottom-10 inset-x-3 z-[1001] flex items-center gap-2 transition-all">
            <div className="flex-1 bg-white rounded-full shadow-lg flex items-center px-4 py-2 min-h-[54px]">
              <Keyboard size={20} className="text-gray-400 ml-3" />
              <input 
                type="text" 
                value={dangerLevel}
                onChange={(e) => setDangerLevel(e.target.value)}
                placeholder="Type a message" 
                className="flex-1 bg-transparent border-none outline-none text-[16px] text-gray-600 placeholder-gray-400 py-1"
              />
              <div className="flex items-center gap-4 text-gray-400 mr-2">
                <button onClick={openGallery} className="active:text-[#075E54]">
                  <FileText size={22} />
                </button>
                <button onClick={openCamera} className="active:text-[#075E54]">
                  <Camera size={22} />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setMapMode(mapMode === 'VIEW' ? 'PICK_LOCATION' : 'VIEW')}
              className="bg-[#008069] text-white p-3.5 rounded-full shadow-lg active:scale-90"
            >
              <MapPin size={24} />
            </button>
          </div>
        )}

        {/* Location Selection Logic (Centered Overlay) */}
        {showLocationSelection && (
          <div className="absolute inset-0 z-[1100] bg-black/20 flex items-center justify-center p-6">
            <div className="bg-white rounded-[32px] p-8 space-y-8 shadow-2xl border border-white/50 max-w-[340px] text-center">
              <div className="flex flex-col items-center gap-4">
                 <img src={imagePreview!} className="w-24 h-24 rounded-2xl object-cover border-4 border-[#25D366] shadow-lg" />
                 <div>
                    <h3 className="font-bold text-gray-800 text-lg">توطين التقرير</h3>
                    <p className="text-[11px] text-gray-400">اختر طريقة تحديد الموقع الجغرافي</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleGetCurrentLocation(true)}
                  className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl active:bg-gray-100 border border-gray-100"
                >
                  <div className="bg-[#008069] text-white p-3 rounded-full shadow-md"><Navigation size={20} /></div>
                  <span className="text-[12px] font-bold text-gray-700">موقعي الآن</span>
                </button>
                <button 
                  onClick={() => { setMapMode('PICK_LOCATION'); setShowLocationSelection(false); setSearchQuery(""); }}
                  className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl active:bg-gray-100 border border-gray-100"
                >
                  <div className="bg-[#128C7E] text-white p-3 rounded-full shadow-md"><MapPin size={20} /></div>
                  <span className="text-[12px] font-bold text-gray-700">تحديد يدوي</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Submission Form */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-[#E5DDD5] flex flex-col">
            <header className="bg-[#075E54] p-4 text-white flex items-center gap-4 shadow-sm">
              <button onClick={resetForm}><ArrowRight size={24} /></button>
              <h2 className="text-[17px] font-bold">معاينة التقرير</h2>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="relative w-full aspect-[4/3] rounded-[24px] shadow-lg overflow-hidden bg-white">
                {imagePreview && (
                  <div className="relative w-full h-full">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                          <ImageIcon className="text-white opacity-40" size={30} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4 border-r-[5px] border-[#25D366]">
                <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold">
                  <Clock size={14} /> {formatDateTime()}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-[#008069] font-bold px-1 uppercase tracking-widest">المكان</label>
                  <input 
                    type="text" 
                    value={placeName} 
                    onChange={(e) => setPlaceName(e.target.value)}
                    className="w-full bg-[#F0F2F5] p-3 rounded-xl text-[14px] font-bold outline-none border-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#008069] font-bold px-1 uppercase tracking-widest">مستوى الخطر / الملاحظات</label>
                  <input 
                    type="text" 
                    value={dangerLevel} 
                    onChange={(e) => setDangerLevel(e.target.value)}
                    placeholder="أدخل الملاحظات هنا..."
                    className="w-full bg-[#F0F2F5] p-3 rounded-xl text-[14px] font-medium text-gray-700 outline-none border-none min-h-[44px]"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-400 bg-gray-50/80 p-3 rounded-xl">
                  <span className="font-bold flex items-center gap-1 text-[#075E54]"><Navigation size={12} /> XY:</span>
                  <span className="font-mono">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/90 border-t border-gray-100">
              <button 
                onClick={handleSubmit}
                disabled={loading || !selectedImage}
                className="w-full bg-[#25D366] text-white py-4 rounded-full font-bold shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-100"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
                <span className="text-[17px]">إرسال التقرير النهائي</span>
              </button>
            </div>
          </div>
        )}
        
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
      </main>
    </div>
  );
};

export default App;
