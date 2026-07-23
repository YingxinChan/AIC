# Ticket: Edit Trip Details (Hotel, Dates, Flights)

**What it's for:** Let users edit an existing trip's hotel, dates, or flights. Destination stays locked — not editable, ever (if it's wrong, delete the trip and create a new one). Editing any of these three triggers itinerary regeneration, since the AI prompt bakes hotel address (routing anchor) and flight times (day-1/last-day scheduling) directly into generation — there's no way to patch an existing itinerary in place.

Depends on two tickets already drafted: *Hotel Search Typeahead* (reuses the `HotelSearchInput` component here) and *Always Show Hotel Section* (this ticket adds the actual Edit button on top of that empty state).

`trip.origin` already exists as a real column now (migration already applied to the shared database, populated on new trips) — this was a blocker for the flight-edit part, it's resolved, nothing to do there.

**Interaction pattern:** Hotel and dates edit open in a small modal, no page navigation — no modal component exists in this codebase yet, so this ticket adds one. Flight edit ("Change Flights") navigates to a page, reusing the existing `FlightSelectPage` flow adapted to work on a saved trip instead of only the creation draft. Confirmation before any save uses native `window.confirm(...)`, same convention as the delete-trip ticket.

---

## Backend

### 1. New schema — `backend/schemas/trips.py`

```python
class UpdateTripRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    hotel_address: str | None = None
```

Partial update, all fields optional. Destination and origin are deliberately excluded — this endpoint never touches them.

### 2. New service function — `backend/services/trips_service.py`

Same ownership-check + setattr + `_trip_dict()` pattern as the existing `select_flight`:

```python
async def update_trip_details(
    db: AsyncSession,
    trip_id: int,
    user_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    hotel_address: str | None = None,
) -> dict:
    trip = await _get_owned_trip(db, trip_id, user_id)
    if start_date is not None:
        trip.start_date = start_date
    if end_date is not None:
        trip.end_date = end_date
    if hotel_address is not None:
        trip.hotel_address = hotel_address
    await db.commit()
    await db.refresh(trip)
    return _trip_dict(trip)
```

### 3. New route — `backend/routers/trips.py`

Add alongside the existing routes (`GET /`, `POST /`, `GET /{trip_id}`, `DELETE /{trip_id}`, `PATCH /{trip_id}/flight`):

```python
@router.patch("/{trip_id}")
async def update_trip(
    trip_id: int,
    body: UpdateTripRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await trips_service.update_trip_details(
        db, trip_id, current_user["id"],
        body.start_date, body.end_date, body.hotel_address,
    )
    return await generate_itinerary(trip_id, db, current_user["id"])
```

Returns the regenerated itinerary directly so the frontend doesn't need two round-trips.

### 4. Modify the existing flight route so it regenerates too

The existing `PATCH /{trip_id}/flight` route currently just calls `select_flight` and returns. Add the same regeneration call:

```python
@router.patch("/{trip_id}/flight")
async def select_flight(
    trip_id: int,
    body: SelectFlightRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await trips_service.select_flight(
        db, trip_id, current_user["id"], body.leg, body.flight_number, body.airline, body.time, body.other_time
    )
    return await generate_itinerary(trip_id, db, current_user["id"])
```

### 5. Edge case

If `generate_itinerary` raises after the trip fields already saved successfully, don't roll back those field changes — that data is legitimately saved. Let it propagate as a 500; the frontend needs to treat "save succeeded, regeneration failed" as its own case, not a total failure.

---

## Frontend

### 1. New shared component — `frontend/src/components/Modal.jsx`

```jsx
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

Add a colocated `Modal.test.jsx` (matches this folder's existing convention). Cover: doesn't render when `open` is false; renders `title` and `children` when open; clicking the backdrop calls `onClose`; clicking inside the content does not call `onClose`.

### 2. New API function — `frontend/src/features/trips/tripsApi.js`

```js
export const updateTrip = (id, data) => api.patch(`/api/trips/${id}`, data).then(r => r.data)
```

### 3. Hotel edit — in `ItineraryPage.jsx`

Builds on the empty-state block from the "Always Show Hotel Section" ticket. New local state and handler:

```jsx
const [hotelModalOpen, setHotelModalOpen] = useState(false)
const [hotelDraft, setHotelDraft] = useState('')
const [savingTrip, setSavingTrip] = useState(false)

const openHotelModal = () => {
  setHotelDraft(trip.hotel_address || '')
  setHotelModalOpen(true)
}

const handleSaveHotel = async () => {
  if (!window.confirm('Changing your hotel will regenerate your itinerary — continue?')) return
  setSavingTrip(true)
  try {
    const updatedTrip = await updateTrip(tripId, { hotel_address: hotelDraft })
    setTrip(updatedTrip)
    const freshItinerary = await getItinerary(tripId)
    if (freshItinerary?.days) setItinerary(freshItinerary)
    setHotelModalOpen(false)
  } catch (err) {
    setItineraryNotice('Hotel saved, but regenerating the itinerary failed — try Regenerate Itinerary below.')
  }
  setSavingTrip(false)
}
```

Button next to the Hotel heading, and the modal itself:

```jsx
<button type="button" onClick={openHotelModal} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
  {trip.hotel_address ? 'Edit' : 'Add Hotel'}
</button>

<Modal open={hotelModalOpen} onClose={() => setHotelModalOpen(false)} title="Hotel">
  <HotelSearchInput
    value={hotelDraft}
    onChange={setHotelDraft}
    cityContext={destination}
    placeholder="e.g. Park Hyatt Tokyo"
  />
  <button
    type="button"
    onClick={handleSaveHotel}
    disabled={savingTrip}
    className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
  >
    {savingTrip ? 'Saving...' : 'Save'}
  </button>
</Modal>
```

### 4. Dates edit — same page, same pattern

Same `Modal`, a second set of local state (`datesModalOpen`, `startDraft`, `endDraft`), two `type="date"` inputs matching the styling already used in `NewTripPage.jsx`. Save calls `updateTrip(tripId, { start_date: startDraft, end_date: endDraft })`, same save/error handling shape as the hotel one — don't diverge the two. Client-side validation before allowing submit: end date must be after start date. Add the Edit entry point near the dates line in the Hero Header section.

### 5. Flight edit — adapting `FlightSelectPage.jsx`

New route in `App.jsx`, alongside the existing one:

```jsx
<Route path="/trips/:tripId/flights/:leg" element={<FlightSelectPage />} />
```

`FlightSelectPage.jsx` needs to branch on whether `tripId` is present:

```jsx
const { leg, tripId } = useParams()
const isEditMode = Boolean(tripId)
const { draft, updateDraft } = useTripDraft()
const [trip, setTrip] = useState(null)

useEffect(() => {
  if (isEditMode) {
    getTrip(tripId).then(setTrip)
  }
}, [tripId])

const origin = isEditMode ? trip?.origin : draft.origin
const destination = isEditMode ? trip?.destination : draft.destination
const date = isEditMode
  ? (isOutbound ? trip?.start_date : trip?.end_date)
  : (isOutbound ? draft.startDate : draft.endDate)
// No prior flight-number filter exists to carry over in edit mode.
// Search unfiltered, same as draft.flightNumber being blank today.
const flightNumber = isEditMode ? '' : draft.flightNumber
```

Guard the search effect so it doesn't fire until `trip` has loaded in edit mode. `handleSelect` branches the same way — edit mode calls the real API and goes straight back to the trip page, no chaining into the other leg:

```jsx
const handleSelect = async (flight) => {
  if (isEditMode) {
    await selectFlight(tripId, {
      leg: direction,
      flight_number: flight.flight_number,
      airline: flight.airline,
      time: isOutbound ? flight.arrival_time : flight.departure_time,
      other_time: isOutbound ? flight.departure_time : flight.arrival_time,
    })
    navigate(`/trips/${tripId}`)
    return
  }
  if (isOutbound) {
    updateDraft({ outboundFlight: flight })
    navigate('/trips/new/flights/return')
  } else {
    updateDraft({ returnFlight: flight })
    navigate('/trips/new')
  }
}
```

The "Back to Edit Trip" link at the top (currently hardcoded to `/trips/new`) needs the same branch — in edit mode it links back to `/trips/{tripId}` instead. On `ItineraryPage.jsx`'s Flight Information section, add "Change Flight" links per leg, navigating to `/trips/{tripId}/flights/outbound` or `/trips/{tripId}/flights/return`. No extra confirm dialog needed before navigating there — the backend regenerates automatically once a new flight's actually selected, same as everywhere else in this ticket.

---

## Out of scope — don't build these

- Editing destination (permanently locked).
- Editing individual itinerary days/activities directly (separate future ticket).
- A single combined "Edit Trip" form covering all three — deliberately three separate entry points instead.
- Full accessibility/focus-trapping on the `Modal`.

---

## Tests

**New `Modal.test.jsx`** — as described above.

**`ItineraryPage.test.jsx`** (existing file, add cases) — mock `updateTrip` alongside the existing `tripsApi` mock. Cover: Edit/Add Hotel opens the modal pre-filled correctly; confirming save calls `updateTrip` and the page reflects the new value; declining confirm never calls `updateTrip`; a rejected `updateTrip` shows the "regenerating failed" message instead of crashing; the same four cases mirrored for dates; invalid date range disables Save and never calls `updateTrip`.

**`FlightSelectPage.test.jsx`** (existing file, add cases) — mock `getTrip` and `selectFlight` alongside the existing `searchFlights` mock. Cover: rendering at a `tripId` route fetches the trip and searches using its `origin`/`destination`/dates, not the draft; selecting a flight in this mode calls `selectFlight` and navigates to `/trips/{tripId}`, not the return-leg route; the existing draft-based tests still pass unmodified.
