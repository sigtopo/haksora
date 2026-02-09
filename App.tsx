
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, X, Loader2, MapPin, Trash2, 
  Check, Camera, Map as MapIcon, RotateCcw, Search, Send, ArrowRight, User, Clock, Image as ImageIcon
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
const whatsappTeal = "#128C7E";
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
      map.flyTo([flyToLocation.lat, flyToLocation.lng], 18, { animate: true });
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
    const saved = localStorage.getItem('research_field_v2');
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
          setShowLocationOptions(false);
          setMapMode('VIEW');
          setIsFormOpen(true);
          getShortAddress(loc.lat, loc.lng);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRetakePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!pickedLocation || !selectedImage || loading) return;

    setLoading(true);
    setIsUploadingImage(true); // بدء دوران "أيقونة الرفع"
    
    try {
      const imageUrl = await uploadImageToCloudinary(selectedImage);
      
      const payload = {
        nom_douar: placeName,
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
      localStorage.setItem('research_field_v2', JSON.stringify(updated));
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
    setSelectedImage(null);
    setImagePreview(null);
    setShowLocationOptions(false);
    setSearchResults([]);
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#E5DDD5] text-[#111B21] overflow-hidden relative font-sans">
      {/* WhatsApp Style Header */}
      <header className="z-20 bg-[#075E54] p-3 pt-4 text-white flex items-center gap-4 shadow-md">
        {isFormOpen || showLocationOptions || mapMode === 'PICK_LOCATION' ? (
          <button onClick={resetForm} className="p-1 active:bg-white/10 rounded-full"><ArrowRight size={24} /></button>
        ) : (
          <div className="bg-[#128C7E] p-2 rounded-full"><MapIcon size={20} /></div>
        )}
        <div className="flex-1">
          <h1 className="text-[17px] font-bold leading-tight">توثيق الميدان</h1>
          <p className="text-[11px] opacity-80">نظام الرصد المتكامل</p>
        </div>
        {!isFormOpen && !showLocationOptions && mapMode === 'VIEW' && (
          <div className="flex gap-4 px-2">
            <button onClick={() => {if(confirm("مسح السجل؟")) { setReports([]); localStorage.removeItem('research_field_v2'); }}}><Trash2 size={20} /></button>
          </div>
        )}
      </header>

      <main className="flex-1 relative">
        <MapContainer 
          center={[31.7917, -7.0926]} 
          zoom={6} 
          zoomControl={false} 
          className="h-full w-full" 
          ref={mapRef}
        >
          {/* خلفية جوجل قمر صناعي */}
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
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

        {/* WhatsApp-like Search in Pick Location Mode */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="absolute top-4 inset-x-3 z-[1000] space-y-1">
            <div className="bg-white rounded-xl shadow-md flex items-center px-4 py-2 border border-gray-200">
              <Search size={18} className="text-[#075E54] ml-2" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleOSMSearch()}
                placeholder="ابحث عن مكان..." 
                className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder-gray-400 py-1"
              />
              {isGeocoding && <Loader2 size={16} className="animate-spin text-[#075E54]" />}
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100 max-h-52 overflow-y-auto">
                {searchResults.map((res, i) => (
                  <div key={i} onClick={() => {
                    const loc = { lat: parseFloat(res.lat), lng: parseFloat(res.lon) };
                    handleLocationSelected(loc);
                  }} className="p-3 border-b border-gray-50 hover:bg-gray-50 text-[13px] text-right cursor-pointer flex justify-between items-center">
                    <span className="text-gray-400"><MapPin size={14} /></span>
                    <div>
                      <p className="font-bold text-gray-800">{res.display_name.split(',')[0]}</p>
                      <p className="text-[10px] text-gray-400 truncate w-60">{res.display_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Crosshair (Red indicator) */}
        {mapMode === 'PICK_LOCATION' && (
          <div className="map-crosshair scale-75">
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
              className="bg-[#25D366] text-white py-3 px-12 rounded-full font-bold shadow-xl active:scale-95 flex items-center gap-2"
            >
              تأكيد الموقع
            </button>
          </div>
        )}

        {/* Action Button (WhatsApp Camera) */}
        {!showLocationOptions && !isFormOpen && mapMode === 'VIEW' && (
          <button 
            onClick={() => setShowLocationOptions(true)}
            className="absolute bottom-8 right-6 z-[1000] bg-[#25D366] text-white p-4 rounded-full shadow-lg active:scale-90 transition-all border-4 border-white/10"
          >
            <Camera size={28} />
          </button>
        )}

        {/* Location Picker Options (Bottom Sheet Style) */}
        {showLocationOptions && (
          <div className="absolute inset-0 z-[1100] bg-black/30 backdrop-blur-[1px] animate-in fade-in flex flex-col justify-end">
            <div className="bg-white rounded-t-[24px] p-6 pb-12 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-2"></div>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-gray-800">إرسال الموقع</h3>
                <button onClick={() => setShowLocationOptions(false)} className="p-1"><X size={22} className="text-gray-400" /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleGetCurrentLocation(true)}
                  className="flex flex-col items-center gap-3 p-5 bg-[#F8F9FA] rounded-2xl active:bg-gray-100 transition-colors"
                >
                  <div className="bg-[#008069] text-white p-4 rounded-full"><Navigation size={24} /></div>
                  <span className="text-[13px] font-bold text-gray-700">موقعي الحالي</span>
                </button>
                <button 
                  onClick={() => { setMapMode('PICK_LOCATION'); setShowLocationOptions(false); }}
                  className="flex flex-col items-center gap-3 p-5 bg-[#F8F9FA] rounded-2xl active:bg-gray-100 transition-colors"
                >
                  <div className="bg-[#128C7E] text-white p-4 rounded-full"><MapPin size={24} /></div>
                  <span className="text-[13px] font-bold text-gray-700">تحديد يدوي</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Submission Form (WhatsApp Interface) */}
        {isFormOpen && (
          <div className="absolute inset-0 z-[1200] bg-[#E5DDD5] flex flex-col animate-in slide-in-from-left duration-200">
            <header className="bg-[#075E54] p-3 pt-4 text-white flex items-center gap-4 shadow-sm">
              <button onClick={resetForm}><ArrowRight size={24} /></button>
              <h2 className="text-[17px] font-bold">توثيق الموقع</h2>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Info Card */}
              <div className="bg-white p-4 rounded-xl shadow-sm space-y-3 border-r-[4px] border-[#25D366]">
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock size={14} />
                  <span className="text-[11px] font-bold">{formatDateTime()}</span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-[#008069] font-bold px-1 uppercase tracking-wider">اسم الدوار / المكان</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute right-3 top-3.5 text-[#25D366]" />
                    <input 
                      type="text" 
                      value={placeName} 
                      onChange={(e) => setPlaceName(e.target.value)}
                      className="w-full bg-[#F0F2F5] p-3 pr-10 rounded-xl text-[14px] font-bold outline-none border-none focus:ring-1 focus:ring-[#25D366]/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-400 bg-gray-50 p-2 rounded-lg">
                  <span className="font-bold">الإحداثيات:</span>
                  <span className="font-mono text-[#075E54]">{pickedLocation?.lat.toFixed(6)}, {pickedLocation?.lng.toFixed(6)}</span>
                </div>
              </div>

              {/* Photo Upload Area - WhatsApp Style with Spinner */}
              <div 
                onClick={() => !imagePreview && !isUploadingImage && fileInputRef.current?.click()}
                className={`relative w-full aspect-[4/3] rounded-2xl shadow-sm flex items-center justify-center overflow-hidden transition-all bg-white border-2 border-dashed ${imagePreview ? 'border-solid border-white p-0' : 'border-gray-200'}`}
              >
                {imagePreview ? (
                  <div className="relative w-full h-full group">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    
                    {/* طبقة دوران احترافية (WhatsApp Style Loader) */}
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="relative flex items-center justify-center">
                          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <div className="absolute text-white font-bold text-[10px] animate-pulse">جاري الرفع</div>
                        </div>
                      </div>
                    )}
                    
                    {!isUploadingImage && (
                      <button onClick={handleRetakePhoto} className="absolute bottom-3 right-3 bg-red-500 text-white p-3 rounded-full shadow-xl active:scale-90"><RotateCcw size={18} /></button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center px-6">
                    <div className="bg-[#DCF8C6] p-6 rounded-full text-[#075E54]"><Camera size={44} /></div>
                    <div>
                      <p className="font-bold text-gray-700 text-[15px]">صورة الأثر الميداني</p>
                      <p className="text-[11px] text-gray-400 mt-1">التقط صورة واضحة لتوثيق الحالة</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageChange} />
            </div>

            {/* Bottom Send Button */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-200">
              <button 
                onClick={handleSubmit}
                disabled={loading || !selectedImage || !placeName}
                className="w-full bg-[#25D366] text-white py-4 rounded-full font-bold shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-200 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                <span className="text-[16px]">{loading ? 'جاري المعالجة...' : 'إرسال التقرير النهائي'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
