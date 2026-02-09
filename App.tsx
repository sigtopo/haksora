
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Loader2, MapPin, Camera, RefreshCw, Upload, AlertCircle, 
  CheckCircle, ImagePlus, Globe, PartyPopper, Navigation, 
  Map as MapIcon, Plus, ChevronLeft
} from 'lucide-react';
import { Report, GeoLocation } from './types';
import { uploadReportToServer, uploadImageToCloudinary } from './services/serverService';

const reportIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div class="pulse-marker"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const pickingIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
           <div style="position: absolute; width: 4px; height: 24px; background: #ef4444; border-radius: 2px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></div>
           <div style="position: absolute; width: 24px; height: 4px; background: #ef4444; border-radius: 2px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></div>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
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
  const [showInitialModal, setShowInitialModal] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mapMode, setMapMode] = useState<'VIEW' | 'PICK'>('VIEW');
  
  const [placeName, setPlaceName] = useState("");
  const [dangerLevel, setDangerLevel] = useState(""); 
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('haksora_reports_v6');
    if (saved) setReports(JSON.parse(saved));
  }, []);

  const getFullAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ar' }
      });
      const data = await response.json();
      setPlaceName(data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch { setPlaceName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); }
  };

  const handleMapClick = (loc: GeoLocation) => {
    setPickedLocation(loc);
    if (mapMode === 'PICK') {
      setMapMode('VIEW');
      getFullAddress(loc.lat, loc.lng);
      setIsFormOpen(true);
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
          if (!pickedLocation) {
            setShowLocationPicker(true);
          } else {
            getFullAddress(pickedLocation.lat, pickedLocation.lng);
            setIsFormOpen(true);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const centerOnMeOnly = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapTarget({ center: [pos.coords.latitude, pos.coords.longitude], zoom: 18 });
        setLoading(false);
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const useMyPositionForReport = () => {
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
        getFullAddress(loc.lat, loc.lng);
        setIsFormOpen(true);
      },
      () => { setLoading(false); alert("يرجى تفعيل الـ GPS"); },
      { enableHighAccuracy: true }
    );
  };

  const startReportAtPickedLocation = () => {
    if (!pickedLocation) return;
    setShowAddMenu(true);
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
      localStorage.setItem('haksora_reports_v6', JSON.stringify(updated));
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

  return (
    <div className={`flex flex-col h-screen w-screen bg-slate-100 overflow-hidden relative ${mapMode === 'PICK' ? 'map-pick-mode' : ''}`}>
      
      {/* Premium Indigo Header */}
      <header className="z-[2000] bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-6 py-4 flex items-center justify-between shadow-2xl border-b border-white/10">
        <div className="flex items-center">
          <h1 className="text-[26px] font-black italic tracking-tighter flex items-center gap-2 select-none">
            <span className="text-white drop-shadow-md">HakSora</span>
            <span className="text-red-500 not-italic text-[19px] font-bold drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">هاك صورة</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 shadow-inner">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)} 
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all ${showAddMenu ? 'bg-red-600 text-white shadow-xl' : 'bg-white text-slate-900 shadow-lg active:scale-95'}`}
              >
                {showAddMenu ? <X size={16} /> : <ImagePlus size={16} />}
                <span>رصد سريع</span>
              </button>
           </div>
        </div>
      </header>

      {/* Main Map Content */}
      <main className="flex-1 relative">
        <MapContainer center={[31.7917, -7.0926]} zoom={6} zoomControl={false} maxZoom={20} className="h-full w-full">
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
            attribution="Google Maps Satellite" 
            maxZoom={20}
          />
          <MapController flyTo={mapTarget} onMapClick={handleMapClick} />
          
          {pickedLocation && (
            <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickingIcon} />
          )}

          {reports.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={reportIcon}>
              <Popup className="custom-popup">
                <div className="p-3 text-right bg-white rounded-2xl shadow-xl border border-slate-100 min-w-[120px]">
                  <p className="font-bold text-[10px] text-slate-800 mb-1 leading-tight">{r.place_name}</p>
                  <p className="text-[8px] text-slate-400">{r.timestamp}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Locate Me Button */}
        <button 
          onClick={centerOnMeOnly} 
          className="absolute top-6 right-6 z-[1001] w-14 h-14 bg-white text-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl active:scale-90 transition-transform border border-slate-100"
        >
          <Navigation size={26} className="fill-indigo-50" />
        </button>

        {/* Startup Welcome Modal */}
        {showInitialModal && (
          <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
             <div className="bg-white rounded-[3.5rem] w-full max-w-[500px] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/20 animate-in zoom-in-95 duration-300 relative">
                
                {/* Close Button */}
                <button 
                  onClick={() => setShowInitialModal(false)}
                  className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-colors z-[5001]"
                >
                  <X size={32} />
                </button>

                <div className="p-10 text-center bg-slate-50 border-b border-slate-100">
                   <h2 className="text-[32px] font-black italic tracking-tighter mb-6">
                     <span className="text-slate-800">HakSora</span> <span className="text-red-600 not-italic">هاك صورة</span>
                   </h2>
                   
                   <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100/50 mb-8 shadow-inner">
                      <p className="text-slate-700 font-bold text-[16px] leading-relaxed text-right">
                        هذه المنصة كتسمح بتوثيق المناطق المتضررة أو المهددة بالخطر، وتسهّل على الجهات المعنية التدخل والصيانة، مع تنبيه الساكنة للأماكن الخطِرة.
                      </p>
                   </div>
                   
                   <p className="text-slate-400 font-black text-[13px] uppercase tracking-widest mb-8">انقر للمتابعة</p>
                   
                   <button 
                    onClick={() => setShowInitialModal(false)}
                    className="w-full bg-gradient-to-r from-indigo-700 to-indigo-900 text-white py-6 rounded-[2rem] font-black shadow-[0_15px_30px_rgba(67,56,202,0.3)] active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
                   >
                     متابعة إلى الخريطة
                     <ChevronLeft size={20} />
                   </button>
                </div>
                
                <div className="p-8 text-center bg-slate-50/50 border-t border-slate-100">
                   <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">منصة الرصد الميدانية التشاركية الرقمية</span>
                </div>
             </div>
          </div>
        )}

        {/* Action Menu (Camera/Upload) */}
        {showAddMenu && (
          <div className="fixed inset-0 z-[4500] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
             <div className="text-center w-full max-w-[320px]">
                <button onClick={() => setShowAddMenu(false)} className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors"><X size={40} /></button>
                <div className="grid grid-cols-1 gap-6">
                   <button 
                    onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                    className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 active:scale-90 transition-transform group"
                   >
                     <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                        <Camera size={36} />
                     </div>
                     <span className="font-black text-lg text-slate-800">التقاط صورة</span>
                   </button>
                   <button 
                    onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                    className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 active:scale-90 transition-transform group"
                   >
                     <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Upload size={36} />
                     </div>
                     <span className="font-black text-lg text-slate-800">رفع من الجهاز</span>
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Confirm Point Button */}
        {pickedLocation && !isFormOpen && !showLocationPicker && !showAddMenu && !showInitialModal && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] w-full px-6 flex justify-center">
            <button 
              onClick={startReportAtPickedLocation}
              className="bg-white/95 backdrop-blur-xl px-10 py-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white flex items-center gap-4 animate-in slide-in-from-bottom-10 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                <Plus size={24} />
              </div>
              <div className="text-right">
                <h4 className="text-[14px] font-black text-slate-800">رصد هذا الموقع</h4>
                <p className="text-[10px] font-bold text-slate-500">انقر هنا للبدء أو غير المكان بالضغط على الخريطة</p>
              </div>
            </button>
          </div>
        )}

        {/* Location Verification Modal */}
        {showLocationPicker && (
          <div className="fixed inset-0 z-[4600] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-[420px] shadow-2xl text-center border border-slate-100 animate-slide-up relative">
              <button onClick={resetForm} className="absolute -top-6 right-1/2 translate-x-1/2 bg-red-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"><X size={28} strokeWidth={3} /></button>
              <div className="mb-8 mt-4 flex justify-center">
                <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl rotate-3 bg-slate-100">
                  <img src={imagePreview!} className="w-full h-full object-cover" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-10">تأكيد مكان الرصد</h3>
              <div className="space-y-4">
                 <button onClick={useMyPositionForReport} className="w-full p-7 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center gap-4 font-black shadow-xl active:scale-95 transition-all">
                    <Navigation size={24} /> موقعي الحالي (GPS)
                 </button>
                 <button onClick={() => { setShowLocationPicker(false); setMapMode('PICK'); }} className="w-full p-7 bg-slate-50 text-slate-800 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-center gap-4 font-black active:scale-95 transition-all">
                    <MapIcon size={24} className="text-orange-500" /> سأحدد الموقع على الخريطة
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Report Form */}
        {isFormOpen && !isMinimized && (
          <div className="fixed inset-0 z-[4700] flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
            <div className="bg-white rounded-t-[3.5rem] sm:rounded-[3.5rem] w-full max-w-[480px] shadow-2xl overflow-hidden animate-slide-up">
              <div className="px-10 py-7 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <AlertCircle size={24} className="text-red-500" />
                    <h3 className="font-black text-slate-800 text-base">توثيق الحالة الميدانية</h3>
                 </div>
                 <button onClick={resetForm} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={32}/></button>
              </div>
              <div className="p-10 max-h-[60vh] overflow-y-auto no-scrollbar text-right">
                <div className="relative aspect-video rounded-[3rem] overflow-hidden mb-10 border-4 border-slate-50 shadow-2xl bg-slate-900">
                   {imagePreview && <img src={imagePreview} className="w-full h-full object-cover" />}
                   <button onClick={() => changeImageInputRef.current?.click()} className="absolute bottom-6 right-6 bg-black/70 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-xl text-[11px] font-black flex items-center gap-2"><RefreshCw size={16}/> تغيير الصورة</button>
                </div>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] text-slate-400 font-black uppercase px-2 tracking-widest">إحداثيات الموقع</label>
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-start gap-4">
                       <MapPin size={22} className="text-red-500 mt-1 flex-shrink-0" />
                       <div className="text-[13px] font-bold text-slate-700 leading-relaxed">{placeName}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] text-slate-400 font-black uppercase px-2 tracking-widest">وصف موجز للمشكلة :</label>
                    <textarea rows={2} value={dangerLevel} onChange={(e) => setDangerLevel(e.target.value)} className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-sm font-bold text-slate-800 outline-none resize-none focus:border-indigo-500 focus:bg-white transition-all" placeholder="مثال: حفرة خطيرة، انزلاق تربة..." />
                  </div>
                </div>
              </div>
              <div className="p-10 pt-0">
                 <button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-indigo-700 to-indigo-900 text-white py-7 rounded-[2.5rem] font-black shadow-[0_15px_30px_rgba(67,56,202,0.3)] active:scale-95 disabled:grayscale transition-all text-lg">
                    إرسال البلاغ الآن
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Success Feedback */}
        {showSuccess && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-indigo-900/90 backdrop-blur-3xl">
             <div className="text-center text-white success-bounce">
                <div className="w-28 h-28 bg-white/20 rounded-[3rem] flex items-center justify-center mx-auto mb-10 border-4 border-white/30 shadow-2xl rotate-12">
                   <PartyPopper size={56} className="text-yellow-300" />
                </div>
                <h2 className="text-4xl font-black mb-6 italic tracking-tight text-white text-center">تم الإرسال بنجاح</h2>
                <div className="bg-white text-indigo-900 px-12 py-5 rounded-[2.5rem] inline-flex items-center gap-4 font-black shadow-2xl text-xl">
                   <CheckCircle size={30} className="text-green-500" /> شكراً لمساهمتك الوطنية
                </div>
             </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
        <input ref={changeImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
      </main>

      {/* Modern Compact Minimalist Footer */}
      <footer className="z-[1001] bg-white border-t border-slate-100 p-5 text-center flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          <span className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">HakSora Platform</span>
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
          <span className="text-slate-500 text-[10px] font-bold">المملكة المغربية الشريفة</span>
        </div>
      </footer>

    </div>
  );
};

export default App;
