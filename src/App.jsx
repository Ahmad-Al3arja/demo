import { useCallback, useEffect, useState, useRef } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Bell,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock,
  ListChecks,
  MapPin,
  Menu,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Repeat,
  Search,
  Smartphone,
  Split,
  Star,
  Target,
  User,
  X,
} from 'lucide-react';
import westBankGeoJson from './data/regions.json';
import './App.css';

const PICKUP = [31.5850, 35.1050];
const DESTINATION = [31.5400, 35.0900];
const DRIVER_START = [31.6000, 35.1150];

const DESTINATION_LABEL = 'Hebron Center';

const DRIVER = {
  name: 'Ahmad Alarja',
  vehicle: 'Toyota Camry',
  plate: '6-7742-95',
  rating: '4.9',
};

const PHASES = [
  { id: 'request', label: '1. Request' },
  { id: 'searching', label: '2. Search' },
  { id: 'matched', label: '3. Match' },
  { id: 'arriving', label: '4. Arrive' },
  { id: 'arrived', label: '5. Pickup' },
  { id: 'ongoing', label: '6. Ride' },
  { id: 'rating', label: '7. Rate' },
];

const RATING_TAGS_GOOD = [
  'Safe driving',
  'Clean car',
  'Polite driver',
  'On time',
  'Good comfort',
  'Best route',
];

const RATING_TAGS_LOW = [
  'Late arrival',
  'Car was not clean',
  'Uncomfortable driving',
  'Long route',
];

const worldOuterRing = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180],
];

const regionsData = westBankGeoJson;

function getRegionsMaskPolygons(geoJson) {
  if (!geoJson?.features) return [];
  const rings = [];
  geoJson.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((ring) => {
        rings.push(ring.map((coord) => [coord[1], coord[0]]));
      });
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          rings.push(ring.map((coord) => [coord[1], coord[0]]));
        });
      });
    }
  });
  return rings;
}

const invertedMaskPositions = [
  worldOuterRing,
  ...getRegionsMaskPolygons(regionsData),
];

function generateRoute(start, end, steps = 60) {
  const points = [];
  const [sLat, sLon] = start;
  const [eLat, eLon] = end;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const curveOffset = Math.sin(t * Math.PI) * 0.0015;
    const lat = sLat + (eLat - sLat) * t + curveOffset;
    const lon = sLon + (eLon - sLon) * t - curveOffset;
    points.push([lat, lon]);
  }
  return points;
}

const driverToPickupRoute = generateRoute(DRIVER_START, PICKUP, 50);
const pickupToDestRoute = generateRoute(PICKUP, DESTINATION, 80);

function getBearing(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const getCustomIcon = (type, rotation = 0) => {
  let htmlContent = '';
  let className = 'custom-map-marker ';

  if (type === 'pickup') {
    className += 'pickup';
    htmlContent = `<div style="width:28px;height:28px;background:#2563eb;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(37,99,235,0.6);"><div style="width:8px;height:8px;background:#fff;border-radius:50%;"></div></div>`;
  } else if (type === 'destination') {
    className += 'destination';
    htmlContent = `<div style="width:28px;height:28px;background:#000;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(0,0,0,0.6);"><div style="width:8px;height:8px;background:#fff;border-radius:50%;"></div></div>`;
  } else if (type === 'driver') {
    className += 'driver';
    htmlContent = `<div style="width:42px;height:42px;background:#000;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(0,0,0,0.4);transform:rotate(${rotation}deg);transition:transform .2s ease;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
    </div>`;
  }

  return L.divIcon({
    html: htmlContent,
    className,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const getDriverMaterialIcon = (type, rotation = 0) => {
  const config = {
    driver: { icon: 'local_taxi', color: '#ffffff', bg: '#000000', border: '#ffffff', size: 42 },
    pickup: { icon: 'place', color: '#2e7d32', bg: '#ffffff', border: '#ffffff', size: 34 },
    destination: { icon: 'flag', color: '#c62828', bg: '#ffffff', border: '#ffffff', size: 34 },
  }[type];

  return L.divIcon({
    html: `<div class="driver-material-marker ${type}" style="--marker-bg:${config.bg};--marker-color:${config.color};--marker-border:${config.border};--marker-size:${config.size}px;transform:rotate(${type === 'driver' ? rotation : 0}deg);">
      <span class="material-symbols-rounded">${config.icon}</span>
    </div>`,
    className: `driver-material-marker-wrap ${type}`,
    iconSize: [config.size, config.size],
    iconAnchor: [config.size / 2, config.size / 2],
  });
};

function MaterialIcon({ name, size = 20, fill = 0, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill}, 'wght' 600, 'GRAD' 0, 'opsz' ${size}` }}
    >
      {name}
    </span>
  );
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

function phaseStatusText(phase, eta, isDestinationSelected) {
  switch (phase) {
    case 'request':
      return isDestinationSelected
        ? 'Destination selected. The reference card is ready to find a taxi.'
        : 'Reference ride screen: Where to, search, and Find Taxi.';
    case 'searching':
      return 'Finding the closest taxi with the same monochrome flow.';
    case 'matched':
      return `Driver matched. Arrival in ${eta} min.`;
    case 'arriving':
      return `Taxi is coming to pickup. ${eta} min left.`;
    case 'arrived':
      return 'Taxi arrived at pickup.';
    case 'ongoing':
      return `Ride in progress to destination. ${eta} min left.`;
    case 'rating':
      return 'Trip complete. Rating screen follows the same clean style.';
    default:
      return '';
  }
}

export default function App() {
  const [phase, setPhase] = useState('request');
  const [phaseTick, setPhaseTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [viewMode, setViewMode] = useState('rider');
  const [navTab, setNavTab] = useState('ride');
  const [isDestinationSelected, setIsDestinationSelected] = useState(false);
  const [routeIndex, setRouteIndex] = useState(0);
  const [driverPos, setDriverPos] = useState(DRIVER_START);
  const [riderPos, setRiderPos] = useState(PICKUP);
  const [bearing, setBearing] = useState(45);
  const [eta, setEta] = useState(12);
  const [countdownSec, setCountdownSec] = useState(28);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [mapCenter, setMapCenter] = useState([31.588, 35.105]);
  const [mapZoom, setMapZoom] = useState(15);

  const goToPhase = useCallback((nextPhase, options = {}) => {
    const shouldPlay = Boolean(options.play);

    setPhase(nextPhase);
    setPhaseTick(0);
    setNavTab('ride');
    setIsPlaying(shouldPlay);

    if (nextPhase !== 'request') {
      setIsDestinationSelected(true);
    }

    if (nextPhase === 'request') {
      setDriverPos(DRIVER_START);
      setRiderPos(PICKUP);
      setRouteIndex(0);
      setEta(12);
      setCountdownSec(28);
      setMapCenter([31.588, 35.105]);
      setMapZoom(15);
      setIsDestinationSelected(false);
      setRating(0);
      setSelectedTags([]);
    }

    if (nextPhase === 'searching') {
      setDriverPos(DRIVER_START);
      setRiderPos(PICKUP);
      setRouteIndex(0);
      setCountdownSec(28);
      setEta(4);
      setMapCenter(PICKUP);
      setMapZoom(15);
    }

    if (nextPhase === 'matched') {
      setDriverPos(driverToPickupRoute[0]);
      setRiderPos(PICKUP);
      setRouteIndex(0);
      setEta(4);
      setMapCenter([31.592, 35.11]);
      setMapZoom(14);
    }

    if (nextPhase === 'arriving') {
      setDriverPos(driverToPickupRoute[0]);
      setRiderPos(PICKUP);
      setRouteIndex(0);
      setEta(12);
      setMapCenter(driverToPickupRoute[0]);
      setMapZoom(15);
    }

    if (nextPhase === 'arrived') {
      setDriverPos(PICKUP);
      setRiderPos(PICKUP);
      setRouteIndex(driverToPickupRoute.length - 1);
      setEta(0);
      setMapCenter(PICKUP);
      setMapZoom(16);
    }

    if (nextPhase === 'ongoing') {
      setDriverPos(pickupToDestRoute[0]);
      setRiderPos(pickupToDestRoute[0]);
      setRouteIndex(0);
      setEta(12);
      setMapCenter(pickupToDestRoute[0]);
      setMapZoom(14);
    }

    if (nextPhase === 'rating') {
      setDriverPos(DESTINATION);
      setRiderPos(DESTINATION);
      setRouteIndex(pickupToDestRoute.length - 1);
      setEta(0);
      setMapCenter(DESTINATION);
      setMapZoom(15);
      setRating(0);
      setSelectedTags([]);
    }
  }, []);

  const startSearching = useCallback(() => {
    setIsDestinationSelected(true);
    goToPhase('searching', { play: true });
  }, [goToPhase]);

  const repeatDemoFlow = useCallback(() => {
    goToPhase('request', { play: true });
    setTimeout(() => {
      startSearching();
    }, 600);
  }, [goToPhase, startSearching]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timer = setInterval(() => {
      if (phase === 'searching') {
        if (phaseTick >= 4) {
          goToPhase('matched', { play: true });
          return;
        }
        setCountdownSec((prev) => Math.max(prev - 1, 0));
        setPhaseTick((prev) => prev + 1);
        return;
      }

      if (phase === 'matched') {
        if (phaseTick >= 3) {
          goToPhase('arriving', { play: true });
          return;
        }
        setPhaseTick((prev) => prev + 1);
        return;
      }

      if (phase === 'arriving') {
        if (routeIndex < driverToPickupRoute.length - 1) {
          const nextIdx = routeIndex + 1;
          const curP = driverToPickupRoute[routeIndex];
          const nextP = driverToPickupRoute[nextIdx];
          setDriverPos(nextP);
          setBearing(getBearing(curP, nextP));
          setRouteIndex(nextIdx);
          setEta(Math.max(1, Math.round((driverToPickupRoute.length - nextIdx) / 5)));
          setMapCenter(nextP);
        } else {
          goToPhase('arrived', { play: true });
        }
        return;
      }

      if (phase === 'arrived') {
        if (phaseTick >= 4) {
          goToPhase('ongoing', { play: true });
          return;
        }
        setPhaseTick((prev) => prev + 1);
        return;
      }

      if (phase === 'ongoing') {
        if (routeIndex < pickupToDestRoute.length - 1) {
          const nextIdx = routeIndex + 1;
          const curP = pickupToDestRoute[routeIndex];
          const nextP = pickupToDestRoute[nextIdx];
          setDriverPos(nextP);
          setRiderPos(nextP);
          setBearing(getBearing(curP, nextP));
          setRouteIndex(nextIdx);
          setEta(Math.max(1, Math.round((pickupToDestRoute.length - nextIdx) / 6)));
          setMapCenter(nextP);
        } else {
          goToPhase('rating', { play: true });
        }
        return;
      }

      if (phase === 'rating') {
        if (phaseTick === 0) {
          setRating(5);
          setSelectedTags(['Safe driving', 'Clean car']);
        }
        if (phaseTick >= 4) {
          repeatDemoFlow();
          return;
        }
        setPhaseTick((prev) => prev + 1);
        return;
      }
    }, Math.max(140, 620 / simSpeed));

    return () => clearInterval(timer);
  }, [goToPhase, isPlaying, phase, phaseTick, repeatDemoFlow, routeIndex, simSpeed]);

  const startTrip = () => {
    goToPhase('ongoing', { play: true });
  };

  const resetFlow = () => {
    goToPhase('request');
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (phase === 'request') {
      startSearching();
      return;
    }

    if (phase === 'rating') return;
    setIsPlaying(true);
  };

  const centerOnRider = () => {
    setMapCenter(phase === 'ongoing' ? riderPos : PICKUP);
    setMapZoom(16);
  };

  const visibleDestination = isDestinationSelected || phase !== 'request';
  const showMapCar = ['request', 'matched', 'arriving', 'arrived', 'ongoing'].includes(phase);
  const mapCarPos = phase === 'request' ? pickupToDestRoute[48] : driverPos;
  const showBottomNav = false;
  const activeTags = rating >= 4 ? RATING_TAGS_GOOD : RATING_TAGS_LOW;

  const toggleTag = (tag) => {
    setSelectedTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  };

  return (
    <div className="app-container" dir="ltr">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">M</div>
          <div>
            <h1 className="brand-title">Mwasalati - reference ride simulation</h1>
            <span className="brand-subtitle">Monochrome phone mockup based on the provided design</span>
          </div>
        </div>

        <div className="status-badge">
          <div className={`status-dot ${phase}`} />
          <span>{phaseStatusText(phase, eta, isDestinationSelected)}</span>
        </div>

        <div className="toolbar-group">
          <button
            className={`btn-secondary ${viewMode === 'rider' ? 'active' : ''}`}
            onClick={() => setViewMode('rider')}
          >
            <Smartphone size={16} />
            Rider phone
          </button>
          <button
            className={`btn-secondary ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            <Split size={16} />
            Rider + driver
          </button>
        </div>
      </header>

      <section className="sim-toolbar">
        <div className="toolbar-group">
          <button className="btn-primary" onClick={handlePlayPause} disabled={phase === 'rating'}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'Pause' : phase === 'request' ? 'Run flow' : 'Continue'}
          </button>

          <button className="btn-secondary" onClick={resetFlow} title="Restart simulation">
            <RotateCcw size={16} />
            Reset
          </button>

          <button className="btn-primary success" onClick={repeatDemoFlow} title="Repeat the entire ride flow demo">
            <Repeat size={16} />
            Repeat Flow
          </button>

          <div className="phase-stepper">
            <span className="stepper-label">Speed:</span>
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                className={`speed-chip ${simSpeed === speed ? 'active' : ''}`}
                onClick={() => setSimSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="phase-stepper direct-phase-stepper">
          <span className="stepper-label">Jump:</span>
          {PHASES.map((item) => (
            <button
              key={item.id}
              className={`phase-step ${phase === item.id ? 'active' : ''}`}
              onClick={() => goToPhase(item.id, { play: ['searching', 'matched', 'arriving', 'arrived', 'ongoing'].includes(item.id) })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <main className="main-content">
        <div className={`phone-frame rider-phone ${viewMode === 'rider' ? 'reference-tilt' : ''}`}>
          <div className="phone-screen rider-phone-screen">
            <div className="map-container reference-map">
              <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
                  subdomains={['a', 'b', 'c', 'd']}
                />
                <MapController center={mapCenter} zoom={mapZoom} />
                <Polygon
                  positions={invertedMaskPositions}
                  pathOptions={{
                    className: 'west-bank-mask rider-west-bank-mask',
                    color: '#0a0a0a',
                    fillColor: '#0a0a0a',
                    fillOpacity: 0.035,
                    fillRule: 'evenodd',
                    weight: 2.2,
                    opacity: 0.28,
                  }}
                />
                {phase !== 'rating' && <Marker position={PICKUP} icon={getCustomIcon('pickup')} />}
                {visibleDestination && phase !== 'rating' && <Marker position={DESTINATION} icon={getCustomIcon('destination')} />}
                {showMapCar && <Marker position={mapCarPos} icon={getCustomIcon('driver', bearing)} />}
                {phase === 'request' && (
                  <Polyline positions={pickupToDestRoute.slice(0, 55)} color="#0a0a0a" weight={5} opacity={0.95} />
                )}
                {['matched', 'arriving'].includes(phase) && (
                  <Polyline positions={driverToPickupRoute} color="#0a0a0a" weight={5} opacity={0.95} />
                )}
                {(visibleDestination || phase === 'ongoing') && phase !== 'rating' && (
                  <Polyline positions={pickupToDestRoute} color="#0a0a0a" weight={5} opacity={0.95} />
                )}
              </MapContainer>
            </div>

            <div className="phone-ui-overlay">
              <PhoneTopBar />

              {phase === 'request' && (
                <button className="floating-gps-btn" onClick={centerOnRider} title="Center map">
                  <Target size={22} color="#0a0a0a" strokeWidth={2.5} />
                </button>
              )}

              {phase === 'searching' && (
                <SearchingOverlay countdownSec={countdownSec} onCancel={resetFlow} />
              )}

              {phase === 'request' && (
                <BookingSheet
                  isDestinationSelected={isDestinationSelected}
                  onSelectDestination={() => setIsDestinationSelected(true)}
                  onCancel={() => setIsDestinationSelected(false)}
                  onRequest={startSearching}
                />
              )}

              {phase === 'matched' && (
                <MatchedDriverSheet eta={eta} onOpenRoute={() => setMapCenter(DRIVER_START)} />
              )}

              {['arriving', 'arrived', 'ongoing'].includes(phase) && (
                <ActiveRidePanel
                  phase={phase}
                  eta={eta}
                  routeProgress={phase === 'ongoing' ? routeIndex / pickupToDestRoute.length : routeIndex / driverToPickupRoute.length}
                  onOpenRoute={() => setMapCenter(phase === 'ongoing' ? DESTINATION : PICKUP)}
                />
              )}

              {phase === 'rating' && (
                <RatingOverlay
                  rating={rating}
                  onSetRating={(value) => {
                    const oldWasGood = rating >= 4;
                    const nextIsGood = value >= 4;
                    setRating(value);
                    if (rating > 0 && oldWasGood !== nextIsGood) {
                      setSelectedTags([]);
                    }
                  }}
                  tags={activeTags}
                  selectedTags={selectedTags}
                  onToggleTag={toggleTag}
                  onSkip={resetFlow}
                  onSubmit={resetFlow}
                />
              )}

              {showBottomNav && (
                <BottomNav navTab={navTab} onChange={setNavTab} />
              )}
            </div>
          </div>
        </div>

        {viewMode === 'split' && (
          <DriverPhone
            phase={phase}
            driverPos={driverPos}
            bearing={bearing}
            countdownSec={countdownSec}
            routeIndex={routeIndex}
            onAccept={() => goToPhase('arriving', { play: true })}
            onStartTrip={startTrip}
            onComplete={() => goToPhase('rating')}
            onReset={resetFlow}
          />
        )}
      </main>
    </div>
  );
}

function BookingSheet({ isDestinationSelected, onSelectDestination, onCancel, onRequest }) {
  return (
    <ReferenceBookingSheet
      isDestinationSelected={isDestinationSelected}
      onSelectDestination={onSelectDestination}
      onCancel={onCancel}
      onRequest={onRequest}
    />
  );
}

function PhoneTopBar() {
  return (
    <div className="phone-top-bar">
      <button title="Menu">
        <Menu size={22} strokeWidth={2.4} />
      </button>
      <strong>Mwasalati</strong>
      <button title="Notifications">
        <Bell size={21} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function ReferenceBookingSheet({ isDestinationSelected, onSelectDestination, onCancel, onRequest }) {
  return (
    <div className={`booking-sheet reference-booking-card ${isDestinationSelected ? 'expanded' : ''}`}>
      <h2>Where to?</h2>
      <DestinationFields selected={isDestinationSelected} onSelectDestination={onSelectDestination} />

      {isDestinationSelected && <TripEstimateCard />}

      <button className="find-taxi-btn" onClick={onRequest}>
        Find Taxi
      </button>

      {isDestinationSelected && (
        <button className="clear-destination-btn" onClick={onCancel}>
          Clear destination
        </button>
      )}
    </div>
  );
}

function DestinationFields({ selected, onSelectDestination }) {
  return <ReferenceDestinationFields selected={selected} onSelectDestination={onSelectDestination} />;
}

function ReferenceDestinationFields({ selected, onSelectDestination }) {
  return (
    <div className="reference-fields">
      <button className="reference-search" onClick={onSelectDestination}>
        <span>{selected ? DESTINATION_LABEL : 'search destination'}</span>
        <Search size={19} strokeWidth={2.1} />
      </button>

      <button className="reference-option current" onClick={onSelectDestination}>
        <span className="solid-dot" />
        <span>Current Location</span>
      </button>

      <button className="reference-option" onClick={onSelectDestination}>
        <MapPin size={18} strokeWidth={2.2} />
        <span>Choose on map</span>
      </button>
    </div>
  );
}

function TripEstimateCard() {
  return (
    <div className="trip-estimate-card reference-estimate">
      <span>Estimated ride</span>
      <strong>12 min</strong>
      <em>Route preview active</em>
    </div>
  );
}

function SearchingOverlay({ countdownSec, onCancel }) {
  return (
    <div className="searching-overlay reference-searching">
      <div className="searching-top-pill">
        <Target size={16} color="#0a0a0a" />
        <span>Finding taxis near you...</span>
      </div>

      <div className="searching-sheet reference-status-card">
        <h2>Finding taxi</h2>
        <div className="searching-progress">
          <div className="searching-progress-bar" />
        </div>
        <p>Matching you with a nearby Mwasalati driver.</p>
        <div className="searching-count">Match in {Math.max(countdownSec - 23, 0)}s</div>
        <button className="cancel-text-btn" onClick={onCancel}>
          Cancel request
        </button>
      </div>
    </div>
  );
}

function MatchedDriverSheet({ eta, onOpenRoute }) {
  return (
    <div className="booking-sheet matched-sheet reference-status-card">
      <DriverProfileHeader
        icon={<Clock size={18} />}
        title={`Driver arrives in ${eta} min`}
        subtitle="Your taxi accepted the request."
      />
      <DriverIdentityRow />
      <button className="outline-text-btn" onClick={onOpenRoute}>
        Open route
      </button>
    </div>
  );
}

function ActiveRidePanel({ phase, eta, routeProgress, onOpenRoute }) {
  return (
    <ReferenceActiveRidePanel
      phase={phase}
      eta={eta}
      routeProgress={routeProgress}
      onOpenRoute={onOpenRoute}
    />
  );
}

function ReferenceActiveRidePanel({ phase, eta, routeProgress, onOpenRoute }) {
  const isOngoing = phase === 'ongoing';
  const title = isOngoing ? 'Ride in progress' : 'Taxi is on the way';
  const subtitle = isOngoing
    ? `Heading to ${DESTINATION_LABEL}`
    : phase === 'arrived'
      ? 'Taxi arrived at pickup'
      : `Arrives in ${eta} min`;

  return (
    <div className="active-ride-panel reference-status-card">
      <button className="active-ride-heading">
        <span className="taxi-status-icon">
          {isOngoing ? <Car size={20} /> : <Navigation size={19} />}
        </span>
        <span className="active-title-block">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <ChevronDown size={22} />
      </button>

      <div className="active-divider" />
      <DriverIdentityRow compact />

      {phase === 'arrived' && (
        <div className="arrived-note">Ready to start the ride</div>
      )}

      {isOngoing && (
        <div className="ride-progress">
          <div style={{ width: `${Math.min(Math.max(routeProgress * 100, 8), 100)}%` }} />
        </div>
      )}

      <button className="outline-text-btn" onClick={onOpenRoute}>
        Open route
      </button>
    </div>
  );
}

function DriverProfileHeader({ icon, title, subtitle }) {
  return (
    <div className="driver-profile-header">
      <div className="taxi-status-icon">{icon}</div>
      <div className="driver-profile-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="plate-badge">{DRIVER.plate}</div>
    </div>
  );
}

function DriverIdentityRow({ compact = false }) {
  return (
    <div className={`driver-info-row ${compact ? 'compact' : ''}`}>
      <div className="driver-avatar">
        <User size={compact ? 20 : 24} />
      </div>
      <div className="driver-meta">
        <strong>{DRIVER.name}</strong>
        <span>
          <Star size={14} fill="#f59e0b" color="#f59e0b" />
          <b>{DRIVER.rating}</b>
          <em>{DRIVER.vehicle}</em>
        </span>
      </div>
      {compact && <div className="plate-badge">{DRIVER.plate}</div>}
    </div>
  );
}

function RatingOverlay({ rating, onSetRating, tags, selectedTags, onToggleTag, onSkip, onSubmit }) {
  return (
    <ReferenceRatingOverlay
      rating={rating}
      onSetRating={onSetRating}
      tags={tags}
      selectedTags={selectedTags}
      onToggleTag={onToggleTag}
      onSkip={onSkip}
      onSubmit={onSubmit}
    />
  );
}

function ReferenceRatingOverlay({ rating, onSetRating, tags, selectedTags, onToggleTag, onSkip, onSubmit }) {
  return (
    <div className="rating-screen reference-rating-screen">
      <div className="rating-close-row">
        <button className="rating-close" onClick={onSkip} title="Close">
          <X size={20} />
        </button>
      </div>

      <div className="rating-success">
        <CheckCircle2 size={50} />
      </div>
      <h2>You arrived safely</h2>

      <div className="rating-driver-avatar">
        <User size={32} />
      </div>
      <p className="rating-question">How was your ride with {DRIVER.name}?</p>

      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} onClick={() => onSetRating(value)}>
            <Star
              size={42}
              fill={rating >= value ? '#0a0a0a' : 'none'}
              color={rating >= value ? '#0a0a0a' : '#dddddd'}
            />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <div className="rating-tags-wrap">
          <div className="rating-tags-title">{rating >= 4 ? 'What went well?' : 'What can improve?'}</div>
          <div className="rating-tags">
            {tags.map((tag) => (
              <button
                key={tag}
                className={selectedTags.includes(tag) ? 'selected' : ''}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rating-actions">
        <button className="btn-outlined" onClick={onSkip}>Skip</button>
        <button className="btn-primary" onClick={onSubmit} disabled={rating === 0}>Submit</button>
      </div>
    </div>
  );
}

function BottomNav({ navTab, onChange }) {
  return (
    <nav className="rider-bottom-nav">
      <button className={navTab === 'ride' ? 'active' : ''} onClick={() => onChange('ride')}>
        <Car size={24} fill={navTab === 'ride' ? '#000' : 'none'} />
        <span>Ride</span>
      </button>
      <button className={navTab === 'orders' ? 'active' : ''} onClick={() => onChange('orders')}>
        <ListChecks size={24} />
        <span>Orders</span>
      </button>
      <button className={navTab === 'account' ? 'active' : ''} onClick={() => onChange('account')}>
        <CircleUserRound size={24} />
        <span>Account</span>
      </button>
    </nav>
  );
}

function DriverPhone({ phase, driverPos, bearing, countdownSec, routeIndex, onAccept, onStartTrip, onComplete, onReset }) {
  const showPickupRoute = ['searching', 'matched', 'arriving', 'arrived'].includes(phase);
  const showDestinationMarker = ['searching', 'matched', 'arriving', 'arrived', 'ongoing'].includes(phase);
  const tripProgress = Math.min(Math.max((routeIndex / pickupToDestRoute.length) * 100, 8), 100);

  return (
    <div className="phone-frame driver-phone">
      <div className="phone-screen driver-phone-screen">
        <div className="map-container driver-reference-map">
          <MapContainer center={driverPos} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c', 'd']}
            />
            <MapController center={driverPos} zoom={15} />
            <Polygon
              positions={invertedMaskPositions}
              pathOptions={{
                className: 'west-bank-mask driver-west-bank-mask',
                color: '#0a0a0a',
                fillColor: '#0a0a0a',
                fillOpacity: 0.035,
                fillRule: 'evenodd',
                weight: 2.2,
                opacity: 0.28,
              }}
            />
            <Marker position={driverPos} icon={getDriverMaterialIcon('driver', bearing)} />
            {showPickupRoute && <Marker position={PICKUP} icon={getDriverMaterialIcon('pickup')} />}
            {showDestinationMarker && <Marker position={DESTINATION} icon={getDriverMaterialIcon('destination')} />}
            {showPickupRoute && <Polyline positions={driverToPickupRoute} color="#0a0a0a" weight={5} opacity={0.95} />}
            {phase === 'ongoing' && <Polyline positions={pickupToDestRoute} color="#0a0a0a" weight={5} opacity={0.95} />}
          </MapContainer>
        </div>

        <div className="phone-ui-overlay">
          <div className="driver-top-status">
            <span className="online-dot" />
            <strong>Captain Status: Online</strong>
            <em>Available for requests</em>
          </div>

          {phase === 'request' && (
            <div className="driver-bottom-sheet driver-idle-sheet">
              <div className="modal-handle" />
              <div className="driver-waiting">
                <span><MaterialIcon name="hourglass_top" size={22} /></span>
                <div>
                  <strong>Waiting for requests...</strong>
                  <small>High demand in your area right now</small>
                </div>
              </div>
            </div>
          )}

          {phase === 'searching' && (
            <div className="driver-bottom-sheet driver-incoming-sheet">
              <div className="modal-handle" />
              <h3 className="driver-sheet-title">New Ride Request</h3>
              <div className="driver-countdown">
                <span>Accept within {countdownSec}s</span>
                <div className="driver-countdown-track">
                  <div style={{ width: ((countdownSec / 28) * 100) + '%' }} />
                </div>
              </div>
              <div className="driver-request-card driver-incoming-card">
                <div className="driver-card-row"><MaterialIcon name="person" size={20} className="driver-card-icon" /> <span>Ahmad Alarja</span></div>
                <div className="driver-card-row"><MaterialIcon name="trip_origin" size={20} className="driver-card-icon" /> <span>Pickup: Current Location</span></div>
                <div className="driver-card-row"><MaterialIcon name="flag" size={20} className="driver-card-icon" /> <span>Dropoff: Hebron Center</span></div>
              </div>
              <div className="driver-actions">
                <button className="btn-outlined" onClick={onReset}>Decline</button>
                <button className="btn-primary" onClick={onAccept}>Accept</button>
              </div>
            </div>
          )}

          {['matched', 'arriving', 'arrived'].includes(phase) && (
            <div className="driver-bottom-sheet driver-job-sheet">
              <div className="modal-handle" />
              <StepHeader activeStep={phase === 'arrived' ? 2 : 1} title={phase === 'arrived' ? '2. Arrived at pickup' : '1. Heading to pickup'} />
              <div className="driver-step-card">
                <p>Status: {phase === 'arrived' ? 'Waiting for rider' : 'Driving to pickup'}</p>
                <p>Pickup: Current Location</p>
                <p>Dropoff: Hebron Center</p>
              </div>
              <button className="btn-primary full-width" onClick={onStartTrip}>
                <MaterialIcon name="play_arrow" size={18} />
                Start Trip (Ride)
              </button>
            </div>
          )}

          {phase === 'ongoing' && (
            <div className="driver-bottom-sheet driver-job-sheet">
              <div className="modal-handle" />
              <StepHeader activeStep={3} title="3. Heading to destination" />
              <div className="driver-step-card">
                <p>Status: On trip to destination</p>
                <p>Dropoff: Hebron Center</p>
              </div>
              <div className="ride-progress driver-progress">
                <div style={{ width: tripProgress + '%' }} />
              </div>
              <button className="btn-primary success full-width" onClick={onComplete}>
                <MaterialIcon name="check_circle" size={18} />
                Complete Trip
              </button>
            </div>
          )}

          {phase === 'rating' && (
            <div className="driver-bottom-sheet driver-rating-sheet">
              <div className="modal-handle" />
              <StepHeader activeStep={4} title="4. Trip Completed" />
              <h3 className="driver-sheet-title">Trip Completed Successfully</h3>
              <p className="driver-rating-note">Excellent rating from rider</p>
              <div className="driver-rating-stars">
                {[1, 2, 3, 4, 5].map((value) => (
                  <MaterialIcon key={value} name="star" size={30} fill={1} />
                ))}
              </div>
              <button className="btn-primary full-width" onClick={onReset}>Waiting for requests</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ activeStep, title }) {
  return (
    <div className="step-header-container">
      <strong>{title}</strong>
      <div className="step-bars">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className={`step-bar ${step < activeStep ? 'done' : ''} ${step === activeStep ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
