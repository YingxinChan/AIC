import { useState } from 'react'
import { updateActivity, createActivity, deleteActivity } from './itineraryApi'
import { splitTimeSlot, joinTimeSlot } from '../../lib/timeSlot'

// All activity-level CRUD for the itinerary page — editing an existing
// activity, adding a new one, and deleting one (with confirmation). Kept as
// one hook since all three share the same `itinerary` they read/write via
// setItinerary, and moving them together is what keeps e.g. handleSaveActivity
// and handleCreateActivity consistent with each other.
export function useActivityEditing({ tripId, setItinerary, toast, setItineraryNotice, selectedDate, tripStartDate }) {
  const [editActivityModalOpen, setEditActivityModalOpen] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState(null)
  const [activityDayDraft, setActivityDayDraft] = useState('')
  const [activityStartDraft, setActivityStartDraft] = useState('')
  const [activityEndDraft, setActivityEndDraft] = useState('')
  const [activityNameDraft, setActivityNameDraft] = useState('')
  const [activityLocationDraft, setActivityLocationDraft] = useState('')
  // {label, lat, lon} once the user picks a place, or null if the location
  // hasn't been touched this session — only sent in the patch when set, so
  // an untouched location never gets re-saved with stale/absent coordinates.
  const [activityLatLngDraft, setActivityLatLngDraft] = useState(null)
  const [activityFixedDraft, setActivityFixedDraft] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)
  // Activity pending a delete confirmation, or null.
  const [activityPendingDelete, setActivityPendingDelete] = useState(null)

  const [addActivityModalOpen, setAddActivityModalOpen] = useState(false)
  const [newActivityDayDraft, setNewActivityDayDraft] = useState('')
  const [newActivityStartDraft, setNewActivityStartDraft] = useState('')
  const [newActivityEndDraft, setNewActivityEndDraft] = useState('')
  const [newActivityNameDraft, setNewActivityNameDraft] = useState('')
  const [newActivityLocationDraft, setNewActivityLocationDraft] = useState('')
  // Same {label, lat, lon}-only-on-selection contract as activityLatLngDraft
  // above — the backend requires lat/lng on create, so Save stays disabled
  // until this is actually set (see the disabled check on the Add button).
  const [newActivityLatLngDraft, setNewActivityLatLngDraft] = useState(null)
  const [newActivityTypeDraft, setNewActivityTypeDraft] = useState('outdoor')
  const [newActivityFixedDraft, setNewActivityFixedDraft] = useState(false)
  const [savingNewActivity, setSavingNewActivity] = useState(false)

  const openEditActivityModal = (activity) => {
    setEditingActivityId(activity.id)
    setActivityDayDraft(activity.day_date)
    const [start, end] = splitTimeSlot(activity.time_slot)
    setActivityStartDraft(start)
    setActivityEndDraft(end)
    setActivityNameDraft(activity.is_swapped ? activity.alternate_name : activity.name)
    setActivityLocationDraft(activity.is_swapped ? activity.alternate_location : activity.location)
    setActivityLatLngDraft({ lat: activity.lat, lon: activity.lng })
    setActivityFixedDraft(activity.is_fixed)
    setEditActivityModalOpen(true)
  }

  const handleSaveActivity = async () => {
    setSavingActivity(true)
    try {
      const updated = await updateActivity(tripId, editingActivityId, {
        day_date: activityDayDraft,
        time_slot: joinTimeSlot(activityStartDraft, activityEndDraft),
        name: activityNameDraft,
        location: activityLocationDraft,
        lat: activityLatLngDraft.lat,
        lng: activityLatLngDraft.lon,
        is_fixed: activityFixedDraft,
      })
      setItinerary(updated)
      setEditActivityModalOpen(false)
      toast.show('Activity updated')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Saving this activity failed — try again.')
    }
    setSavingActivity(false)
  }

  const openAddActivityModal = () => {
    setNewActivityDayDraft(selectedDate || tripStartDate || '')
    setNewActivityStartDraft('')
    setNewActivityEndDraft('')
    setNewActivityNameDraft('')
    setNewActivityLocationDraft('')
    setNewActivityLatLngDraft(null)
    setNewActivityTypeDraft('outdoor')
    setNewActivityFixedDraft(false)
    setAddActivityModalOpen(true)
  }

  const newActivityInvalid =
    !newActivityDayDraft || !newActivityStartDraft || !newActivityEndDraft ||
    !newActivityNameDraft.trim() || !newActivityLatLngDraft

  const handleCreateActivity = async () => {
    setSavingNewActivity(true)
    try {
      const updated = await createActivity(tripId, {
        day_date: newActivityDayDraft,
        time_slot: joinTimeSlot(newActivityStartDraft, newActivityEndDraft),
        name: newActivityNameDraft,
        location: newActivityLocationDraft,
        lat: newActivityLatLngDraft.lat,
        lng: newActivityLatLngDraft.lon,
        type: newActivityTypeDraft,
        is_fixed: newActivityFixedDraft,
      })
      setItinerary(updated)
      setAddActivityModalOpen(false)
      toast.show('Activity added')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Adding this activity failed — try again.')
    }
    setSavingNewActivity(false)
  }

  const handleConfirmDeleteActivity = async () => {
    const activity = activityPendingDelete
    setActivityPendingDelete(null)
    try {
      const updated = await deleteActivity(tripId, activity.id)
      setItinerary(updated.days ? updated : { days: [] })
      toast.show('Activity removed')
    } catch (err) {
      setItineraryNotice(err.response?.data?.detail || 'Removing this activity failed — try again.')
    }
  }

  return {
    editActivityModalOpen, setEditActivityModalOpen,
    activityDayDraft, setActivityDayDraft,
    activityStartDraft, setActivityStartDraft,
    activityEndDraft, setActivityEndDraft,
    activityNameDraft, setActivityNameDraft,
    activityLocationDraft, setActivityLocationDraft,
    activityLatLngDraft, setActivityLatLngDraft,
    activityFixedDraft, setActivityFixedDraft,
    savingActivity,
    activityPendingDelete, setActivityPendingDelete,
    openEditActivityModal,
    handleSaveActivity,

    addActivityModalOpen, setAddActivityModalOpen,
    newActivityDayDraft, setNewActivityDayDraft,
    newActivityStartDraft, setNewActivityStartDraft,
    newActivityEndDraft, setNewActivityEndDraft,
    newActivityNameDraft, setNewActivityNameDraft,
    newActivityLocationDraft, setNewActivityLocationDraft,
    newActivityLatLngDraft, setNewActivityLatLngDraft,
    newActivityTypeDraft, setNewActivityTypeDraft,
    newActivityFixedDraft, setNewActivityFixedDraft,
    savingNewActivity,
    openAddActivityModal,
    newActivityInvalid,
    handleCreateActivity,

    handleConfirmDeleteActivity,
  }
}
