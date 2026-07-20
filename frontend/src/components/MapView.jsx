import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const WORLD_CENTER = [20, 0]
const WORLD_ZOOM = 2
const CITY_ZOOM = 11

export default function MapView({ center, height = 'h-64' }) {
  // If center is provided and it's an array, use it; otherwise default
  const position = Array.isArray(center) ? center : WORLD_CENTER;

  return (
    <MapContainer
      key={position.join(',')}
      center={position}
      zoom={Array.isArray(center) ? CITY_ZOOM : WORLD_ZOOM}
      className={`${height} w-full rounded-lg`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  )
}