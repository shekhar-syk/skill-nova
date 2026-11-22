import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
} from 'lucide-react';
import { Button, Card } from './DesignSystem.jsx';
import { api } from '../services/api.js';

const SKILLNOVA_CAMPUSES = [
  {
    id: 'blr',
    name: 'SKILLNOVA Bengaluru Innovation Campus',
    city: 'Bengaluru',
    address: 'Level 7, Prestige Tech Park, Outer Ring Road, Bengaluru 560103',
    programs: 'AI & Data Science, Full Stack Engineering, Cloud & DevOps',
    position: { lat: 12.9352, lng: 77.6945 },
  },
  {
    id: 'hyd',
    name: 'SKILLNOVA Hyderabad Engineering Studio',
    city: 'Hyderabad',
    address: 'HITEC City Tech Corridor, Madhapur, Hyderabad 500081',
    programs: 'Java Microservices, Distributed Systems, Cybersecurity',
    position: { lat: 17.4435, lng: 78.3772 },
  },
  {
    id: 'pune',
    name: 'SKILLNOVA Pune EV & Embedded Lab',
    city: 'Pune',
    address: 'Hinjewadi Phase II Innovation Hub, Pune 411057',
    programs: 'Electric Vehicle Systems, Embedded C & Robotics, IoT',
    position: { lat: 18.5913, lng: 73.7389 },
  },
  {
    id: 'ncr',
    name: 'SKILLNOVA Delhi NCR Cloud Hub',
    city: 'Gurugram',
    address: 'Cyber City Tower B, DLF Phase II, Gurugram 122002',
    programs: 'Cloud Architecture, Kubernetes, Generative AI Engineering',
    position: { lat: 28.495, lng: 77.0895 },
  },
];

const QUICK_MAP_QUERIES = [
  'Best coworking spaces and tech study cafes near Prestige Tech Park Bengaluru',
  'Metro stations and bus transit hubs near HITEC City Hyderabad',
  'Software engineering parks and EV R&D centers in Hinjewadi Pune',
];

function RouteLayer({ origin, destination, travelMode, onRouteSummary, onRouteError }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [polylines, setPolylines] = useState([]);

  useEffect(() => {
    if (!map || !routesLib || !origin || !destination) {
      setPolylines([]);
      return undefined;
    }

    let cancelled = false;

    async function compute() {
      try {
        const result = await routesLib.Route.computeRoutes({
          origin,
          destination,
          travelMode,
          fields: ['path', 'legs', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled) return;
        const primaryRoute = result?.routes?.[0];
        if (!primaryRoute) {
          onRouteError('No drivable or transit route could be found between your location and this campus.');
          return;
        }

        const nextLines = primaryRoute.createPolylines({
          polylineOptions: {
            strokeColor: '#6D28D9',
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });
        nextLines.forEach((line) => line.setMap(map));
        setPolylines(nextLines);

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distKm = primaryRoute.distanceMeters
          ? (primaryRoute.distanceMeters / 1000).toFixed(1)
          : null;
        const durMins = primaryRoute.durationMillis
          ? Math.max(1, Math.round(primaryRoute.durationMillis / 60000))
          : null;

        onRouteSummary({ distanceKm: distKm, durationMins: durMins, travelMode });
      } catch (err) {
        if (cancelled) return;
        const msg = String(err?.message || err || '');
        if (/429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota/i.test(msg)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteError(
          msg.includes('ZERO_RESULTS')
            ? 'No route available for the selected travel mode between these points.'
            : 'Unable to calculate route with current map quota or location permissions.'
        );
      }
    }

    compute();

    return () => {
      cancelled = true;
    };
  }, [map, routesLib, origin, destination, travelMode]);

  useEffect(() => {
    return () => {
      polylines.forEach((line) => line.setMap(null));
    };
  }, [polylines]);

  return null;
}

export default function CampusMapHub() {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const hasMapsKey = Boolean(mapsApiKey && !mapsApiKey.includes('your_'));

  const [selectedCampus, setSelectedCampus] = useState(SKILLNOVA_CAMPUSES[0]);
  const [infoCampusId, setInfoCampusId] = useState(SKILLNOVA_CAMPUSES[0].id);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [userCoords, setUserCoords] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [locating, setLocating] = useState(false);

  // Maps-Grounded AI Place Explorer
  const [mapQuery, setMapQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [placesResult, setPlacesResult] = useState(null);

  const requestUserLocation = (alsoComputeRoute = false) => {
    if (!navigator.geolocation) {
      setRouteError('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    setRouteError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setUserCoords(coords);
        if (alsoComputeRoute) {
          setRouteSummary(null);
          setRouteOrigin(coords);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        setRouteError('Location permission denied. Allow browser geolocation or pick another campus origin.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleCampusClick = (campus) => {
    setSelectedCampus(campus);
    setInfoCampusId(campus.id);
    setRouteError('');
    if (routeOrigin) {
      setRouteSummary(null);
    }
  };

  const runMapsGroundedSearch = async (e, overrideQuery = null) => {
    if (e) e.preventDefault();
    const q = (overrideQuery || mapQuery).trim();
    if (!q || searchingPlaces) return;

    setMapQuery(q);
    setSearchingPlaces(true);
    setPlacesError('');

    try {
      const res = await api.post('/ai/maps-grounding', {
        prompt: q,
        lat: userCoords?.lat ?? selectedCampus?.position?.lat ?? null,
        lng: userCoords?.lng ?? selectedCampus?.position?.lng ?? null,
      });
      setPlacesResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to query Google Maps Grounding assistant.';
      if (err.response?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setPlacesError(msg);
    } finally {
      setSearchingPlaces(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Campus Switcher Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SKILLNOVA_CAMPUSES.map((campus) => {
          const active = selectedCampus?.id === campus.id;
          return (
            <button
              key={campus.id}
              type="button"
              onClick={() => handleCampusClick(campus)}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0A0F24] text-white border-violet-500 shadow-sm'
                  : 'bg-white text-slate-900 border-slate-200 hover:border-violet-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-violet-500 font-semibold">
                  {campus.city}
                </span>
                <MapPin className={`w-4 h-4 ${active ? 'text-violet-400' : 'text-slate-400'}`} />
              </div>
              <p className="font-display text-sm font-bold mt-1.5 leading-snug">{campus.name}</p>
              <p className={`text-xs mt-1 line-clamp-2 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                {campus.programs}
              </p>
            </button>
          );
        })}
      </div>

      {/* Interactive Map + Maps Grounded Discovery Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Interactive Campus & Route Explorer
                </h3>
                <p className="text-xs text-slate-500">
                  Select a campus pin and compute directions using the Google Maps Routes API.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value)}
                  aria-label="Travel mode"
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                >
                  <option value="DRIVING">Driving</option>
                  <option value="TRANSIT">Transit</option>
                  <option value="WALKING">Walking</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => requestUserLocation(true)}
                  loading={locating}
                >
                  <Navigation className="w-3.5 h-3.5" /> Route from My Location
                </Button>
                {routeOrigin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRouteOrigin(null);
                      setRouteSummary(null);
                      setRouteError('');
                    }}
                  >
                    Clear Route
                  </Button>
                )}
              </div>
            </div>

            {routeSummary && (
              <div className="px-3.5 py-2.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-950 flex flex-wrap items-center gap-4">
                <span className="font-semibold flex items-center gap-1.5">
                  <RouteIcon className="w-3.5 h-3.5 text-violet-700" />
                  Route to {selectedCampus.city} Campus ({routeSummary.travelMode})
                </span>
                {routeSummary.distanceKm && (
                  <span className="font-mono font-semibold tabular-nums">
                    {routeSummary.distanceKm} km
                  </span>
                )}
                {routeSummary.durationMins && (
                  <span className="font-mono font-semibold tabular-nums">
                    ~{routeSummary.durationMins} min
                  </span>
                )}
              </div>
            )}

            {routeError && (
              <div className="px-3.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {routeError}
              </div>
            )}

            {hasMapsKey ? (
              <div className="w-full h-[460px] lg:h-[520px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <APIProvider apiKey={mapsApiKey} language="en" region="IN">
                  <Map
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={{ lat: 19.5, lng: 77.2 }}
                    defaultZoom={5}
                    gestureHandling="greedy"
                    className="w-full h-full"
                  >
                    {SKILLNOVA_CAMPUSES.map((campus) => (
                      <AdvancedMarker
                        key={campus.id}
                        position={campus.position}
                        title={campus.name}
                        onClick={() => handleCampusClick(campus)}
                      >
                        <Pin
                          background={selectedCampus?.id === campus.id ? '#6D28D9' : '#0A0F24'}
                          borderColor="#FFFFFF"
                          glyphColor="#FFFFFF"
                        />
                      </AdvancedMarker>
                    ))}

                    {userCoords && (
                      <AdvancedMarker position={userCoords} title="Your Current Location">
                        <Pin background="#059669" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                      </AdvancedMarker>
                    )}

                    {infoCampusId && (() => {
                      const infoCampus = SKILLNOVA_CAMPUSES.find((c) => c.id === infoCampusId);
                      if (!infoCampus) return null;
                      return (
                        <InfoWindow
                          position={infoCampus.position}
                          onCloseClick={() => setInfoCampusId(null)}
                        >
                          <div className="max-w-xs p-1 text-slate-900">
                            <p className="font-bold text-sm">{infoCampus.name}</p>
                            <p className="text-xs text-slate-600 mt-1">{infoCampus.address}</p>
                            <p className="text-[11px] text-violet-700 font-medium mt-1.5">
                              Tracks: {infoCampus.programs}
                            </p>
                          </div>
                        </InfoWindow>
                      );
                    })()}

                    {routeOrigin && selectedCampus && (
                      <RouteLayer
                        origin={routeOrigin}
                        destination={selectedCampus.position}
                        travelMode={travelMode}
                        onRouteSummary={(s) => {
                          setRouteSummary(s);
                          setRouteError('');
                        }}
                        onRouteError={(msg) => setRouteError(msg)}
                      />
                    )}
                  </Map>
                </APIProvider>
              </div>
            ) : (
              <div className="w-full h-[380px] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Compass className="w-10 h-10 text-slate-400 mb-3" />
                <p className="font-display text-base font-bold text-slate-900">
                  Google Maps Key Required for Interactive Map View
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  Configure <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in your environment configuration to render live interactive campus maps and driving/transit routes.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Google Maps Grounding Assistant */}
        <div className="lg:col-span-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-violet-700">
                  Campus Neighborhood Discovery
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  Nearby Tech Hubs & Study Discovery
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Discover transit stations, study cafes, coworking spaces, and tech corridors around{' '}
                  <span className="font-semibold text-slate-800">{selectedCampus.city}</span> or your current location.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestUserLocation(false)}
                title="Use my current browser location"
                className="p-2 rounded-lg border border-slate-200 hover:border-violet-400 text-slate-600 hover:text-violet-700 shrink-0 cursor-pointer"
              >
                <LocateFixed className="w-4 h-4" />
              </button>
            </div>

            {userCoords && (
              <p className="font-mono text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                Using your GPS context: {userCoords.lat}, {userCoords.lng}
              </p>
            )}

            <form onSubmit={runMapsGroundedSearch} className="flex gap-2">
              <input
                type="text"
                value={mapQuery}
                onChange={(e) => setMapQuery(e.target.value)}
                placeholder={`Ask about places near ${selectedCampus.city}...`}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-violet-600"
              />
              <Button type="submit" loading={searchingPlaces} disabled={!mapQuery.trim()}>
                <Search className="w-4 h-4" /> Explore
              </Button>
            </form>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_MAP_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => runMapsGroundedSearch(null, q)}
                  className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-violet-50 hover:text-violet-800 text-slate-700 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            {placesError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {placesError}
              </div>
            )}

            {placesResult && (
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[260px] overflow-y-auto pr-1">
                  {placesResult.text}
                </div>

                {Array.isArray(placesResult.sources) && placesResult.sources.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">
                      Verified Google Maps Places ({placesResult.sources.length})
                    </p>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {placesResult.sources.map((src, idx) => (
                        <div
                          key={src.uri || idx}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1.5"
                          >
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {Array.isArray(src.reviewSnippets) && src.reviewSnippets.length > 0 && (
                            <div className="mt-1.5 space-y-1 pl-5">
                              {src.reviewSnippets.map((snippet, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={snippet.uri || src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[11px] text-slate-600 hover:text-violet-700 underline"
                                >
                                  Review{snippet.authorName ? ` by ${snippet.authorName}` : ''} on Google Maps
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
