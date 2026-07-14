package expo.modules.location.taskConsumers

import android.app.PendingIntent
import android.app.job.JobParameters
import android.app.job.JobService
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import expo.modules.interfaces.taskManager.TaskConsumer
import expo.modules.interfaces.taskManager.TaskConsumerInterface
import expo.modules.interfaces.taskManager.TaskInterface
import expo.modules.interfaces.taskManager.TaskManagerUtilsInterface

/**
 * F-Droid build: geofencing requires Google Play Services and is unavailable.
 */
class GeofencingTaskConsumer(context: Context, taskManagerUtils: TaskManagerUtilsInterface?) :
  TaskConsumer(context, taskManagerUtils), TaskConsumerInterface {
  private var mTask: TaskInterface? = null

  override fun taskType(): String = "geofencing"

  override fun didRegister(task: TaskInterface) {
    mTask = task
    Log.w(TAG, "Geofencing is unavailable without Google Play Services (F-Droid build)")
  }

  override fun didUnregister() {
    mTask = null
  }

  override fun setOptions(options: Map<String, Any>) {
    super.setOptions(options)
  }

  override fun didReceiveBroadcast(intent: Intent) {
    Log.w(TAG, "Ignoring geofencing broadcast in F-Droid build")
  }

  override fun didExecuteJob(jobService: JobService, params: JobParameters): Boolean {
    jobService.jobFinished(params, false)
    return false
  }

  companion object {
    private const val TAG = "GeofencingTaskConsumer"
  }
}
