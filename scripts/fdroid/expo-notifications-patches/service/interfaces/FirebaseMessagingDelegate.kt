package expo.modules.notifications.service.interfaces

import expo.modules.notifications.service.NotificationsService

/**
 * F-Droid stub interface: remote push messages are unavailable without Firebase.
 */
interface FirebaseMessagingDelegate {
  fun onNewToken(token: String)

  fun onMessageReceived(remoteMessage: Any)

  fun onDeletedMessages()
}
