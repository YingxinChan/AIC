import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const WORLD_CENTER = [20, 0]
const WORLD_ZOOM = 2
const CITY_ZOOM = 11

// stops: [{ position: [lat, lng], label }] — one Marker per stop.
// routeStops: [[lat, lng], ...] — Polyline connecting them in order.
// hotel: { position: [lat, lng], label } | null — a distinct marker.
//
// `key={center...}` only remounts the map on a `center` change, not on
// `stops`/`routeStops` — re-editing one activity's location shouldn't blow
// away the user's current pan/zoom, just move or add the one pin.
export default function MapView({ center, height = 'h-64', stops = [], routeStops = [], hotel = null }) {
  return (
    <MapContainer
      key={center ? center.join(',') : 'world'}
      center={center || WORLD_CENTER}
      zoom={center ? CITY_ZOOM : WORLD_ZOOM}
      className={`${height} w-full rounded-lg`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {stops.map((stop, index) => (
        <Marker key={index} position={stop.position}>
          <Popup>{stop.label}</Popup>
        </Marker>
      ))}

      {hotel && (
        <Marker position={hotel.position}>
          <Popup>{hotel.label}</Popup>
        </Marker>
      )}

      {routeStops.length > 1 && (
        <Polyline positions={routeStops} color="#4f46e5" />
      )}
    </MapContainer>
  )
}
