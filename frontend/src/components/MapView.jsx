import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url
  ).href,
  iconUrl: new URL(
    "leaflet/dist/images/marker-icon.png",
    import.meta.url
  ).href,
  shadowUrl: new URL(
    "leaflet/dist/images/marker-shadow.png",
    import.meta.url
  ).href,
});

const WORLD_CENTER = [20, 0];
const WORLD_ZOOM = 2;
const CITY_ZOOM = 11;

export default function MapView({
  center,
  stops = [],
  height = "h-64",
}) {
  return (
    <MapContainer
      key={center ? center.join(",") : "world"}
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

      {stops.length > 1 && (
        <Polyline positions={stops.map((stop) => stop.position)} />
      )}
    </MapContainer>
  );
}