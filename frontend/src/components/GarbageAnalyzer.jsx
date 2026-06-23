import { useState } from 'react';

export default function GarbageAnalyzer() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);

  // Get user's current location
  const getLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    });
  };

  // Handle image capture/upload
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Analyze garbage
  const handleAnalyze = async () => {
    if (!image || !location) {
      alert('Please capture an image and enable location access');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Remove 'data:image/jpeg;base64,' prefix
      const base64 = image.split(',')[1];

      const response = await fetch('/api/analyze-garbage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        alert(`Error: ${data.error || 'Analysis failed'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>🗑️ Garbage Detector</h1>

      {/* Location button */}
      <button onClick={getLocation} style={{ marginBottom: '10px' }}>
        📍 Get My Location
      </button>
      {location && <p>Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>}

      {/* Image input */}
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleImageChange}
        style={{ display: 'block', marginBottom: '10px' }}
      />

      {/* Preview */}
      {image && (
        <div style={{ marginBottom: '10px' }}>
          <img src={image} alt="preview" style={{ maxWidth: '100%', maxHeight: '300px' }} />
        </div>
      )}

      {/* Analyze button */}
      <button 
        onClick={handleAnalyze} 
        disabled={!image || !location || loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '⏳ Analyzing...' : '🔍 Analyze Image'}
      </button>

      {/* Results */}
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
          {result.success ? (
            <>
              <h3>{result.message}</h3>
              {result.garbageReport && (
                <div>
                  <p><strong>Type:</strong> {result.garbageReport.analysis.garbageType}</p>
                  <p><strong>Severity:</strong> {result.garbageReport.analysis.severity}</p>
                  <p><strong>Confidence:</strong> {result.garbageReport.analysis.confidence}%</p>
                  <p><strong>Description:</strong> {result.garbageReport.analysis.description}</p>
                  <p style={{ color: 'green', fontWeight: 'bold' }}>✅ Task assigned to workers!</p>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'red' }}>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
