import { activityMatchesFocus } from './experienceCount.js'

export type ScheduleActivity = {
  time: string
  title: string
  location: string
  category: string
  cost: number
  durationMinutes: number
}

export type ScheduleDay = {
  dayNumber: number
  title: string
  summary: string
  imageSearchQuery?: string
  activities: ScheduleActivity[]
}

function isLogistics(activity: ScheduleActivity) {
  return (
    activity.category === 'logistics' ||
    /check[- ]?in|arrival|border|crossing|transfer|orientation|logistics/i.test(`${activity.category} ${activity.title}`)
  )
}

function defaultExperience(pick: string, destination: string, time = '11:30'): ScheduleActivity {
  return {
    time,
    title: pick,
    location: destination,
    category: 'experience',
    cost: 24,
    durationMinutes: 120,
  }
}

export function normalizeItineraryDays(days: ScheduleDay[], focusActivities: string[], destination: string, pace: string) {
  const maxSchedule = pace === 'slow' ? 2 : 3

  return days.map((day, index) => {
    const dayNumber = day.dayNumber || index + 1

    if (focusActivities.length === 0) {
      const logistics = day.activities.filter(isLogistics).slice(0, 1)
      const rest = day.activities.filter((activity) => !isLogistics(activity)).slice(0, Math.max(0, maxSchedule - logistics.length))
      return { ...day, dayNumber, activities: [...logistics, ...rest] }
    }

    const pick =
      focusActivities.length === 1 ? (index === 0 ? focusActivities[0] : undefined) : focusActivities[index]

    if (focusActivities.length === 1 && index > 0) {
      const depart = day.activities.find((activity) => /depart|return|cross|singapore/i.test(activity.title))
      return {
        ...day,
        dayNumber,
        activities: depart ? [depart] : day.activities.filter(isLogistics).slice(0, 1),
      }
    }

    const logistics = day.activities.filter(isLogistics).slice(0, 1)
    const food = pick ? day.activities.filter((activity) => activity.category === 'food').slice(0, 1) : []
    const experience = pick
      ? [
          day.activities.find((activity) => activityMatchesFocus(activity.title, pick)) ??
            defaultExperience(pick, destination),
        ]
      : []

    return { ...day, dayNumber, activities: [...logistics, ...experience, ...food] }
  })
}
