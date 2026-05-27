type ActivityLike = {
  title: string
  category: string
}

export function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function activityMatchesFocus(title: string, focus: string) {
  const activity = normalizeMatchText(title)
  const pick = normalizeMatchText(focus)
  if (!activity || !pick) return false
  return activity.includes(pick) || pick.includes(activity)
}

export function tripExperienceCount(focusActivities: string[], days: Array<{ activities: ActivityLike[] }>) {
  if (focusActivities.length > 0) return focusActivities.length
  return days.reduce((sum, day) => sum + dayExperienceCount(0, [], day.activities), 0)
}

export function dayExperienceCount(dayNumber: number, focusActivities: string[], activities: ActivityLike[]) {
  if (focusActivities.length > 0) {
    const matched = activities.filter(
      (activity) =>
        activity.category !== 'logistics' &&
        focusActivities.some((focus) => activityMatchesFocus(activity.title, focus)),
    )
    if (matched.length > 0) return matched.length

    if (focusActivities.length === 1) {
      return dayNumber === 1 ? 1 : 0
    }

    const pick = focusActivities[dayNumber - 1]
    return pick ? 1 : 0
  }

  return activities.filter((activity) => activity.category !== 'logistics').length
}

export function experienceCountLabel(count: number) {
  return `${count} ${count === 1 ? 'experience' : 'experiences'}`
}
