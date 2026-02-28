import { useState, useRef } from 'react';
import { Camera, UserPlus, Trash2, Check, MapPin } from 'lucide-react';
import { assemblies } from '../data/assemblies';
import { supabase } from '../lib/supabase';
import { submitViaProxy, compressImageToDataUrl } from '../lib/api';

interface Person {
  name: string;
  mobile: string;
  image?: File | null;
  imagePreview?: string;
}

interface LocationInfo {
  placeName: string;
  city: string;
  state: string;
}

function waitForGoogleMaps(): Promise<NonNullable<Window['google']>> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.google?.maps) {
      resolve(window.google!);
      return;
    }
    const check = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(check);
        resolve(window.google!);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      if (!window.google?.maps) {
        reject(new Error('GEOCODE_FAILED'));
      }
    }, 15000);
  });
}

const GEOLOCATION_PERMISSION_DENIED = 1;

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_NOT_SUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err: GeolocationPositionError) => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<LocationInfo> {
  const google = await waitForGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { location: { lat, lng } },
      (
        results: Array<{
          formatted_address?: string;
          address_components: Array<{ long_name: string; types: string[] }>;
        }> | null,
        status: string
      ) => {
        if (status !== 'OK' || !results?.[0]) {
          reject(new Error('GEOCODE_FAILED'));
          return;
        }
        const addr = results[0];
        let city = '';
        let state = '';
        for (const c of addr.address_components) {
          if (c.types.includes('locality')) city = c.long_name;
          if (c.types.includes('administrative_area_level_1')) state = c.long_name;
        }
        const placeName =
          addr.formatted_address || addr.address_components[0]?.long_name || 'Current location';
        resolve({ placeName, city, state });
      }
    );
  });
}

export default function UserForm() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [assembly, setAssembly] = useState('');
  const [totalPeople, setTotalPeople] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [personName, setPersonName] = useState('');
  const [personMobile, setPersonMobile] = useState('');
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [personImagePreview, setPersonImagePreview] = useState('');
  const [vehicleImage, setVehicleImage] = useState<File | null>(null);
  const [vehicleImagePreview, setVehicleImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const personImageInputRef = useRef<HTMLInputElement>(null);

  const addPerson = () => {
    if (personName.trim() && personMobile.trim()) {
      setPeople([...people, {
        name: personName,
        mobile: personMobile,
        image: personImage || undefined,
        imagePreview: personImagePreview || ''
      }]);
      setPersonName('');
      setPersonMobile('');
      setPersonImage(null);
      setPersonImagePreview('');
    }
  };

  const removePerson = (index: number) => {
    setPeople(people.filter((_, i) => i !== index));
  };

  const handlePersonImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPersonImage(file);
      setPersonImagePreview(URL.createObjectURL(file));
    }
  };

  const handleVehicleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVehicleImage(file);
      setVehicleImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocationError(null);
    setLocation(null);

    try {
      let locationInfo: LocationInfo | null = null;
      let coords: { lat: number; lng: number } | null = null;
      try {
        coords = await getCurrentPosition();
        try {
          locationInfo = await reverseGeocode(coords.lat, coords.lng);
          setLocation(locationInfo);
        } catch (geocodeErr) {
          setLocationError('Address could not be fetched. Saving coordinates only.');
          setLocation({
            placeName: `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`,
            city: '',
            state: ''
          });
        }
      } catch (locErr) {
        const isPermissionDenied =
          typeof locErr === 'object' &&
          locErr !== null &&
          'code' in locErr &&
          (locErr as GeolocationPositionError).code === GEOLOCATION_PERMISSION_DENIED;
        if (isPermissionDenied) {
          setLocationError('Location access denied. Please allow location for this site.');
          alert('Please allow location access in your browser settings and try again.');
          return;
        }
        setLocationError('Location unavailable. Submitting without location.');
      }

      const locationPlaceName = locationInfo?.placeName ?? (coords ? `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}` : null);
      const locationCity = locationInfo?.city ?? null;
      const locationState = locationInfo?.state ?? null;
      const latitude = coords?.lat ?? null;
      const longitude = coords?.lng ?? null;

      const isProd = import.meta.env.PROD;
      let submitted = false;

      if (isProd) {
        try {
          const vehicleImageDataUrl = vehicleImage ? await compressImageToDataUrl(vehicleImage) : undefined;
          const peopleWithImages = await Promise.all(
            people.map(async (p) => ({
              name: p.name,
              mobile: p.mobile,
              imageDataUrl: p.image ? await compressImageToDataUrl(p.image) : undefined
            }))
          );
          await submitViaProxy({
            name,
            mobile_number: mobile,
            assembly_name: assembly,
            total_people: parseInt(totalPeople),
            vehicle_number: vehicleNumber,
            location_place_name: locationPlaceName,
            location_city: locationCity,
            location_state: locationState,
            latitude,
            longitude,
            people: peopleWithImages,
            vehicleImageDataUrl
          });
          submitted = true;
        } catch (proxyErr) {
          console.warn('Proxy failed, trying direct Supabase', proxyErr);
        }
      }

      if (!submitted) {
        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .insert({
            name,
            mobile_number: mobile,
            assembly_name: assembly,
            total_people: parseInt(totalPeople),
            vehicle_number: vehicleNumber,
            location_place_name: locationPlaceName,
            location_city: locationCity,
            location_state: locationState,
            latitude,
            longitude
          })
          .select()
          .single();

        if (submissionError) throw submissionError;

        if (people.length > 0) {
          const peopleData = await Promise.all(
            people.map(async (p) => ({
              submission_id: submission.id,
              name: p.name,
              mobile_number: p.mobile,
              image_url: p.image ? await compressImageToDataUrl(p.image) : null
            }))
          );
          const { error: peopleError } = await supabase.from('people').insert(peopleData);
          if (peopleError) throw peopleError;
        }

        if (vehicleImage) {
          const vehicleDataUrl = await compressImageToDataUrl(vehicleImage);
          await supabase.from('images').insert({
            submission_id: submission.id,
            image_type: 'vehicle',
            image_url: vehicleDataUrl
          });
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setName('');
        setMobile('');
        setAssembly('');
        setTotalPeople('');
        setVehicleNumber('');
        setPeople([]);
        setVehicleImage(null);
        setVehicleImagePreview('');
        setPersonImage(null);
        setPersonImagePreview('');
        setLocation(null);
        setLocationError(null);
      }, 2000);
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      setLocationError(null);
      let msg = 'Unknown error';
      if (error instanceof Error) msg = error.message;
      else if (error && typeof error === 'object' && 'message' in error) msg = String((error as { message: unknown }).message);
      else if (error && typeof error === 'object' && 'error' in error) msg = String((error as { error: unknown }).error);
      else if (typeof error === 'string') msg = error;
      const isNetwork = msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('413');
      alert(
        isNetwork
          ? 'Network error or image too large. Try fewer/smaller images or WiFi.'
          : `Error: ${msg.slice(0, 120)}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
          <p className="text-gray-600">Your submission has been recorded successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Visitor Entry Form</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter mobile number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Name</label>
              <select
                required
                value={assembly}
                onChange={(e) => setAssembly(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Assembly</option>
                {assemblies.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total People</label>
              <input
                type="number"
                required
                min="0"
                value={totalPeople}
                onChange={(e) => setTotalPeople(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter number of people"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter vehicle number"
              />
            </div>

            {isSubmitting && !location && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <MapPin className="w-4 h-4 animate-pulse" />
                Fetching your current location...
              </div>
            )}
            {location && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                  <MapPin className="w-4 h-4" />
                  Auto-detected location
                </div>
                <p className="text-gray-700"><span className="font-medium">Place:</span> {location.placeName}</p>
                <p className="text-gray-700"><span className="font-medium">City:</span> {location.city || '—'}</p>
                <p className="text-gray-700"><span className="font-medium">State:</span> {location.state || '—'}</p>
              </div>
            )}
            {locationError && (
              <p className="text-red-600 text-sm">{locationError}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Image</label>
              <input
                ref={vehicleInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleVehicleImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => vehicleInputRef.current?.click()}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Capture Vehicle Image
              </button>
              {vehicleImagePreview && (
                <div className="mt-3 relative">
                  <img src={vehicleImagePreview} alt="Vehicle" className="w-full h-48 object-cover rounded-lg" />
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add People (Name, Mobile, Photo)</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Person name"
                />
                <input
                  type="tel"
                  value={personMobile}
                  onChange={(e) => setPersonMobile(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Person mobile number"
                />
                <input
                  ref={personImageInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePersonImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => personImageInputRef.current?.click()}
                  className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  {personImagePreview ? 'Change Photo' : 'Capture Photo'}
                </button>
                {personImagePreview && (
                  <div className="relative inline-block">
                    <img src={personImagePreview} alt="Person" className="w-20 h-20 object-cover rounded-lg border" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={addPerson}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Person
                </button>
              </div>

              {people.length > 0 && (
                <div className="mt-3 space-y-2">
                  {people.map((person, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      {person.imagePreview ? (
                        <img src={person.imagePreview} alt={person.name} className="w-12 h-12 object-cover rounded-full border" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs">No photo</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{person.name}</p>
                        <p className="text-sm text-gray-600">{person.mobile}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePerson(index)}
                        className="text-red-500 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
