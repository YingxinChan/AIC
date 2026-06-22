import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const LONDON = [51.5074, -0.1278]

export default function MapView({ height = 'h-64' }) {
  return (
    <MapContainer center={LONDON} zoom={13} className={`${height} w-full rounded-lg`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  )
}
