package expo.modules.location.taskConsumers

import android.app.PendingIntent
import android.app.job.JobParameters
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PersistableBundle
import android.util.Log
import expo.modules.core.arguments.MapArguments
import expo.modules.core.arguments.ReadableArguments
import expo.modules.core.interfaces.LifecycleEventListener
import expo.modules.interfaces.taskManager.TaskConsumer
import expo.modules.interfaces.taskManager.TaskConsumerInterface
import expo.modules.interfaces.taskManager.TaskExecutionCallback
import expo.modules.interfaces.taskManager.TaskInterface
import expo.modules.interfaces.taskManager.TaskManagerUtilsInterface
import expo.modules.location.AppForegroundedSingleton
import expo.modules.location.LocationHelpers
import expo.modules.location.records.LocationOptions
import expo.modules.location.records.LocationResponse
import expo.modules.location.services.LocationTaskService
import expo.modules.location.services.LocationTaskService.ServiceBinder
import kotlin.math.abs

/**
 * F-Droid build: uses Android LocationManager instead of Google Play Services.
 */
class LocationTaskConsumer(context: Context, taskManagerUtils: TaskManagerUtilsInterface?) :
  TaskConsumer(context, taskManagerUtils), TaskConsumerInterface, LifecycleEventListener {
  private var mTask: TaskInterface? = null
  private var mPendingIntent: PendingIntent? = null
  private var mService: LocationTaskService? = null
  private var mLocationParams: expo.modules.location.LocationParams? = null
  private var mLastReportedLocation: Location? = null
  private var mDeferredDistance = 0.0
  private val mDeferredLocations: MutableList<Location> = ArrayList()

  private var mIsHostPaused = false

  override fun taskType(): String = "location"

  override fun didRegister(task: TaskInterface) {
    mTask = task
    startLocationUpdates()
    maybeStartForegroundService()
  }

  override fun didUnregister() {
    stopLocationUpdates()
    stopForegroundService()
    mTask = null
    mPendingIntent = null
    mLocationParams = null
  }

  override fun setOptions(options: Map<String, Any>) {
    super.setOptions(options)
    stopLocationUpdates()
    startLocationUpdates()
    maybeStartForegroundService()
  }

  override fun didReceiveBroadcast(intent: Intent) {
    mTask ?: return
    val locations = extractLocations(intent)
    if (locations.isNotEmpty()) {
      handleLocationUpdate(locations)
      return
    }

    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
    try {
      val provider = mLocationParams?.let { LocationHelpers.chooseProvider(locationManager, it) } ?: return
      locationManager.getLastKnownLocation(provider)?.let { handleLocationUpdate(listOf(it)) }
    } catch (e: SecurityException) {
      Log.e(TAG, "Cannot get last location: ${e.message}")
    }
  }

  private fun extractLocations(intent: Intent): List<Location> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableArrayExtra(LocationManager.KEY_LOCATIONS, Location::class.java)?.let {
        return it.filterNotNull()
      }
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableArrayExtra(LocationManager.KEY_LOCATIONS)?.let { array ->
        return array.mapNotNull { it as? Location }
      }
    }
    return emptyList()
  }

  private fun handleLocationUpdate(locations: List<Location>) {
    if (locations.isEmpty()) return
    if (!mIsHostPaused) {
      reportLocationsImmediately(locations)
      return
    }
    deferLocations(locations)
    maybeReportDeferredLocations()
  }

  override fun didExecuteJob(jobService: JobService, params: JobParameters): Boolean {
    val data = taskManagerUtils.extractDataFromJobParams(params)
    val locationBundles = ArrayList<Bundle>()
    for (persistableLocationBundle in data) {
      val locationBundle = Bundle()
      val coordsBundle = Bundle()
      if (persistableLocationBundle != null) {
        coordsBundle.putAll(persistableLocationBundle.getPersistableBundle("coords"))
        locationBundle.putAll(persistableLocationBundle)
        locationBundle.putBundle("coords", coordsBundle)
        locationBundles.add(locationBundle)
      }
    }
    executeTaskWithLocationBundles(locationBundles) { jobService.jobFinished(params, false) }
    return true
  }

  private fun startLocationUpdates() {
    val context = context ?: run {
      Log.w(TAG, "The context has been abandoned")
      return
    }
    if (!LocationHelpers.isAnyProviderAvailable(context)) {
      Log.w(TAG, "There is no location provider available")
      return
    }
    val task = mTask ?: run {
      Log.w(TAG, "Could not find a location task for the location update")
      return
    }
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
    mLocationParams = LocationHelpers.prepareLocationParams(LocationOptions(task.options))
    mPendingIntent = preparePendingIntent()

    val params = mLocationParams ?: return
    val intent = mPendingIntent ?: return
    val provider = LocationHelpers.chooseProvider(locationManager, params) ?: return

    try {
      locationManager.requestLocationUpdates(
        provider,
        params.interval,
        params.distance,
        intent
      )
    } catch (e: SecurityException) {
      Log.w(TAG, "Location request has been rejected.", e)
    }
  }

  private fun stopLocationUpdates() {
    val context = context ?: return
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
    mPendingIntent?.let {
      locationManager.removeUpdates(it)
      it.cancel()
    }
  }

  private fun maybeStartForegroundService() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    if (!AppForegroundedSingleton.isForegrounded) {
      Log.w(TAG, "Foreground location task cannot be started while the app is in the background!")
      return
    }
    val task = mTask ?: run {
      Log.w(TAG, "Location task is null")
      return
    }
    val options: ReadableArguments = MapArguments(task.options)
    val useForegroundService = shouldUseForegroundService(task.options)

    if (mService != null && !useForegroundService) {
      stopForegroundService()
      return
    }
    if (!useForegroundService) {
      return
    }
    if (mService == null) {
      val serviceIntent = Intent(context, LocationTaskService::class.java)
      val extras = Bundle()
      val serviceOptions = options.getArguments(FOREGROUND_SERVICE_KEY).toBundle()
      extras.putString("appId", task.appScopeKey)
      extras.putString("taskName", task.name)
      extras.putBoolean("killService", serviceOptions.getBoolean("killServiceOnDestroy", false))
      serviceIntent.putExtras(extras)
      context.startForegroundService(serviceIntent)
      context.bindService(
        serviceIntent,
        object : ServiceConnection {
          override fun onServiceConnected(name: ComponentName, service: IBinder) {
            mService = (service as? ServiceBinder)?.service
            mService?.let {
              it.setParentContext(context)
              it.startForeground(serviceOptions)
            }
          }

          override fun onServiceDisconnected(name: ComponentName) {
            mService?.stop()
            mService = null
          }
        },
        Context.BIND_AUTO_CREATE
      )
    } else {
      mService?.startForeground(options.getArguments(FOREGROUND_SERVICE_KEY).toBundle())
    }
  }

  private fun stopForegroundService() {
    mService?.stop()
  }

  private fun reportLocationsImmediately(locations: List<Location>) {
    if (locations.isEmpty()) return
    val context = context.applicationContext
    val data: MutableList<PersistableBundle> = ArrayList()
    var lastReported: Location? = null
    for (location in locations) {
      val timestamp = location.time
      if (timestamp > sLastTimestamp) {
        val bundle = LocationResponse(location).toBundle(PersistableBundle::class.java)
        data.add(bundle)
        sLastTimestamp = timestamp
        lastReported = location
      }
    }
    if (data.isNotEmpty()) {
      mLastReportedLocation = lastReported
      taskManagerUtils.scheduleJob(context, mTask, data)
    }
  }

  private fun deferLocations(locations: List<Location>) {
    val size = mDeferredLocations.size
    var lastLocation = if (size > 0) mDeferredLocations[size - 1] else mLastReportedLocation
    for (location in locations) {
      if (lastLocation != null) {
        mDeferredDistance += abs(location.distanceTo(lastLocation)).toDouble()
      }
      lastLocation = location
    }
    mDeferredLocations.addAll(locations)
  }

  private fun maybeReportDeferredLocations() {
    if (!shouldReportDeferredLocations()) {
      return
    }
    val context = context.applicationContext
    val data: MutableList<PersistableBundle> = ArrayList()
    for (location in mDeferredLocations) {
      val timestamp = location.time
      if (timestamp > sLastTimestamp) {
        val bundle = LocationResponse(location).toBundle(PersistableBundle::class.java)
        data.add(bundle)
        sLastTimestamp = timestamp
      }
    }
    if (data.isNotEmpty()) {
      mLastReportedLocation = mDeferredLocations[mDeferredLocations.size - 1]
      mDeferredDistance = 0.0
      mDeferredLocations.clear()
      taskManagerUtils.scheduleJob(context, mTask, data)
    }
  }

  private fun shouldReportDeferredLocations(): Boolean {
    val task = mTask ?: return false
    if (mDeferredLocations.isEmpty()) {
      return false
    }
    if (!mIsHostPaused) {
      return true
    }
    val oldestLocation = mLastReportedLocation ?: mDeferredLocations[0]
    val newestLocation = mDeferredLocations[mDeferredLocations.size - 1]
    val distance = (task.options["deferredUpdatesDistance"] as? Number)?.toDouble() ?: 0.0
    val interval = (task.options["deferredUpdatesInterval"] as? Number)?.toLong() ?: 0L
    return newestLocation.time - oldestLocation.time >= interval && mDeferredDistance >= distance
  }

  private fun preparePendingIntent(): PendingIntent =
    taskManagerUtils.createTaskIntent(context, mTask)

  private fun executeTaskWithLocationBundles(locationBundles: ArrayList<Bundle>, callback: TaskExecutionCallback) {
    if (locationBundles.isNotEmpty() && mTask != null) {
      val data = Bundle()
      data.putParcelableArrayList("locations", locationBundles)
      mTask?.execute(data, null, callback)
    } else {
      callback.onFinished(null)
    }
  }

  override fun onHostResume() {
    mIsHostPaused = false
    maybeReportDeferredLocations()
  }

  override fun onHostPause() {
    mIsHostPaused = true
  }

  override fun onHostDestroy() {
    mIsHostPaused = true
  }

  companion object {
    private const val TAG = "LocationTaskConsumer"
    private const val FOREGROUND_SERVICE_KEY = "foregroundService"
    private var sLastTimestamp: Long = 0

    fun shouldUseForegroundService(options: Map<String?, Any?>): Boolean =
      options.containsKey(FOREGROUND_SERVICE_KEY)
  }
}
