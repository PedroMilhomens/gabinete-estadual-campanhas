const recoveryMarkerKey = 'demolay-password-recovery'

export function markPasswordRecovery() {
  try {
    window.sessionStorage.setItem(recoveryMarkerKey, 'true')
  } catch (error) {
    console.error('Could not save the password recovery session marker.', error)
  }
}

export function clearPasswordRecovery() {
  try {
    window.sessionStorage.removeItem(recoveryMarkerKey)
  } catch (error) {
    console.error('Could not clear the password recovery session marker.', error)
  }
}

export function hasPasswordRecoveryMarker() {
  try {
    return window.sessionStorage.getItem(recoveryMarkerKey) === 'true'
  } catch (error) {
    console.error('Could not read the password recovery session marker.', error)
    return false
  }
}
