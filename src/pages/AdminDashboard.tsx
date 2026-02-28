import { useState, useEffect } from 'react';
import { Download, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchSubmissionsViaProxy } from '../lib/api';

interface Person {
  id: string;
  name: string;
  mobile_number: string;
  image_url?: string | null;
}

interface Image {
  id: string;
  image_type: string;
  image_url: string;
}

interface Submission {
  id: string;
  name: string;
  mobile_number: string;
  assembly_name: string;
  total_people: number;
  vehicle_number: string;
  created_at: string;
  location_place_name?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  people?: Person[];
  images?: Image[];
}

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      let list: Submission[] = [];
      if (import.meta.env.PROD) {
        try {
          const data = await fetchSubmissionsViaProxy();
          list = (data || []) as Submission[];
        } catch (proxyErr) {
          console.warn('Proxy failed, using direct Supabase', proxyErr);
        }
      }
      if (list.length === 0) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('submissions')
          .select('*')
          .order('created_at', { ascending: false });

        if (submissionsError) throw submissionsError;

        list = await Promise.all(
          (submissionsData || []).map(async (submission) => {
            const { data: people } = await supabase
              .from('people')
              .select('*')
              .eq('submission_id', submission.id);
            const { data: images } = await supabase
              .from('images')
              .select('*')
              .eq('submission_id', submission.id);
            return {
              ...submission,
              people: people || [],
              images: images || []
            };
          })
        );
      }
      setSubmissions(list);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 text-center">Admin Dashboard</h1>
          <p className="text-center text-gray-600 mt-2">Total Submissions: {submissions.length}</p>
        </div>

        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(submission.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{submission.name}</h3>
                    <p className="text-sm text-gray-600">{submission.assembly_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(submission.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    {expandedId === submission.id ? (
                      <ChevronUp className="w-6 h-6 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                </div>
              </div>

              {expandedId === submission.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Basic Information</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Name:</span> {submission.name}</p>
                        <p><span className="font-medium">Mobile:</span> {submission.mobile_number}</p>
                        <p><span className="font-medium">Assembly:</span> {submission.assembly_name}</p>
                        <p><span className="font-medium">Total People:</span> {submission.total_people}</p>
                        <p><span className="font-medium">Vehicle Number:</span> {submission.vehicle_number}</p>
                        {(submission.location_place_name || submission.location_city || submission.location_state || submission.latitude != null || submission.longitude != null) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-medium text-gray-700 mb-1">Location (auto-detected)</p>
                            {submission.location_place_name && <p><span className="font-medium">Place:</span> {submission.location_place_name}</p>}
                            {submission.location_city && <p><span className="font-medium">City:</span> {submission.location_city}</p>}
                            {submission.location_state && <p><span className="font-medium">State:</span> {submission.location_state}</p>}
                            {(submission.latitude != null || submission.longitude != null) && (
                              <p><span className="font-medium">Coordinates:</span> {submission.latitude?.toFixed(6)}, {submission.longitude?.toFixed(6)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {submission.people && submission.people.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">People Details</h4>
                        <div className="space-y-2">
                          {submission.people.map((person) => (
                            <div key={person.id} className="flex items-center gap-3 bg-white p-2 rounded border border-gray-200">
                              {person.image_url ? (
                                <img src={person.image_url} alt={person.name} className="w-12 h-12 object-cover rounded-full border" />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">No photo</div>
                              )}
                              <div>
                                <p className="font-medium text-sm">{person.name}</p>
                                <p className="text-xs text-gray-600">{person.mobile_number}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {submission.images && submission.images.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Images</h4>

                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-600 mb-2">Vehicle Images</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {submission.images
                            .filter(img => img.image_type === 'vehicle')
                            .map((img) => (
                              <div key={img.id} className="relative group">
                                <img
                                  src={img.image_url}
                                  alt="Vehicle"
                                  className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setSelectedImage(img.image_url)}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadImage(img.image_url, `vehicle_${submission.id}.jpg`);
                                  }}
                                  className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>

                      {submission.images.filter(img => img.image_type === 'person').length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-2">People Images</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {submission.images
                              .filter(img => img.image_type === 'person')
                              .map((img, index) => (
                                <div key={img.id} className="relative group">
                                  <img
                                    src={img.image_url}
                                    alt={`Person ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setSelectedImage(img.image_url)}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadImage(img.image_url, `person_${submission.id}_${index}.jpg`);
                                    }}
                                    className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {submissions.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No submissions yet.</p>
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
