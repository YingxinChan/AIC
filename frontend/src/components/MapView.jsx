import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const activityIcon = new L.Icon({
  iconUrl: new URL(
    "leaflet-color-markers/img/marker-icon-red.png",
    import.meta.url
  ).href,
  shadowUrl: new URL(
    "leaflet-color-markers/img/marker-shadow.png",
    import.meta.url
  ).href,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const hotelIcon = new L.Icon({
  iconUrl: new URL(
    "leaflet-color-markers/img/marker-icon-blue.png",
    import.meta.url
  ).href,
  shadowUrl: new URL(
    "leaflet-color-markers/img/marker-shadow.png",
    import.meta.url
  ).href,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const WORLD_CENTER = [20, 0];
const WORLD_ZOOM = 2;
const CITY_ZOOM = 11;

export default function MapView({
  center,
  stops = [],
  routeStops = [],
  hotel = null,
  height = "h-64",
}) {

  console.log("hotel marker:", hotel)

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

      {/* Activity pins */}
      {stops.map((stop, index) => (
        <Marker
          key={index}
          position={stop.position}
          icon={activityIcon}
        >
          <Popup>{stop.label}</Popup>
        </Marker>
      ))}

      {/* Hotel pin */}
      {hotel && (
        <Marker
          position={hotel.position}
          icon={hotelIcon}
        >
          <Popup>{hotel.label}</Popup>
        </Marker>
      )}

      {stops.length > 1 && (
        <Polyline positions={routeStops.map((stop) => stop.position)}
        color="#6366f1"
        dashArray="10, 10"
        />
      )}
    </MapContainer>
  );
}