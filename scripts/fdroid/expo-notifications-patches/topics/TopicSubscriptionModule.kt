package expo.modules.notifications.topics

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TOPIC_SUBSCRIBE_FAIL_CODE = "E_TOPIC_SUBSCRIBE_FAILED"
private const val TOPIC_UNSUBSCRIBE_FAIL_CODE = "E_TOPIC_UNSUBSCRIBE_FAILED"

/** F-Droid stub: FCM topic subscriptions are unavailable without Firebase. */
class TopicSubscriptionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTopicSubscriptionModule")

    AsyncFunction("subscribeToTopicAsync") { topic: String, promise: Promise ->
      promise.reject(
        TOPIC_SUBSCRIBE_FAIL_CODE,
        "Topic subscriptions are not available in this build (F-Droid).",
        null
      )
    }

    AsyncFunction("unsubscribeFromTopicAsync") { topic: String, promise: Promise ->
      promise.reject(
        TOPIC_UNSUBSCRIBE_FAIL_CODE,
        "Topic subscriptions are not available in this build (F-Droid).",
        null
      )
    }
  }
}
