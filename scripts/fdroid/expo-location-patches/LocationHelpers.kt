package expo.modules.location

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.location.records.LocationLastKnownOptions
import expo.modules.location.records.LocationOptions
import expo.modules.location.records.LocationResponse
import expo.modules.location.records.PermissionRequestResponse
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class LocationHelpers {
  companion object {
    internal fun isLocationValid(location: Location?, options: LocationLastKnownOptions): Boolean {
      if (location == null) {
        return false
      }
      val maxAge = options.maxAge ?: Double.MAX_VALUE
      val requiredAccuracy = options.requiredAccuracy ?: Double.MAX_VALUE
      val timeDiff = (System.currentTimeMillis() - location.time).toDouble()
      return timeDiff <= maxAge && location.accuracy <= requiredAccuracy
    }

    fun hasNetworkProviderEnabled(context: Context?): Boolean {
      if (context == null) {
        return false
      }
      val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      return locationManager != null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    internal fun prepareLocationParams(options: LocationOptions): LocationParams {
      val accuracy = options.accuracy
      val locationParams = buildLocationParamsForAccuracy(accuracy)

      options.timeInterval?.let {
        locationParams.interval = it
      }
      options.distanceInterval?.let {
        locationParams.distance = it.toFloat()
      }

      return locationParams
    }

    fun requestSingleLocation(context: Context, params: LocationParams, promise: Promise) {
      val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      if (locationManager == null) {
        promise.reject(CurrentLocationIsUnavailableException())
        return
      }

      val provider = chooseProvider(locationManager, params)
      if (provider == null) {
        promise.reject(CurrentLocationIsUnavailableException())
        return
      }

      try {
        val lastKnown = locationManager.getLastKnownLocation(provider)
        if (lastKnown != null) {
          promise.resolve(LocationResponse(lastKnown))
          return
        }

        val handler = Handler(Looper.getMainLooper())
        val listener = object : LocationListener {
          override fun onLocationChanged(location: Location) {
            locationManager.removeUpdates(this)
            promise.resolve(LocationResponse(location))
          }

          override fun onProviderDisabled(provider: String) {
            locationManager.removeUpdates(this)
            promise.reject(CurrentLocationIsUnavailableException())
          }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          locationManager.getCurrentLocation(
            provider,
            null,
            context.mainExecutor
          ) { location ->
            if (location != null) {
              promise.resolve(LocationResponse(location))
            } else {
              locationManager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
              handler.postDelayed({
                locationManager.removeUpdates(listener)
                promise.reject(CurrentLocationIsUnavailableException())
              }, params.interval.coerceAtLeast(10_000L))
            }
          }
        } else {
          @Suppress("DEPRECATION")
          locationManager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
          handler.postDelayed({
            locationManager.removeUpdates(listener)
            promise.reject(CurrentLocationIsUnavailableException())
          }, params.interval.coerceAtLeast(10_000L))
        }
      } catch (e: SecurityException) {
        promise.reject(LocationRequestRejectedException(e))
      }
    }

    fun requestContinuousUpdates(
      locationModule: LocationModule,
      params: LocationParams,
      watchId: Int,
      promise: Promise
    ) {
      locationModule.requestLocationUpdates(
        params,
        watchId,
        object : LocationRequestCallbacks {
          override fun onLocationChanged(location: Location) {
            locationModule.sendLocationResponse(watchId, LocationResponse(location))
          }

          override fun onRequestSuccess() {
            promise.resolve(null)
          }

          override fun onRequestFailed(cause: CodedException) {
            promise.reject(cause)
          }
        }
      )
    }

    internal fun chooseProvider(locationManager: LocationManager, params: LocationParams): String? {
      val gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
      val networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
      return when (params.accuracy) {
        LocationAccuracy.LOWEST, LocationAccuracy.LOW ->
          when {
            networkEnabled -> LocationManager.NETWORK_PROVIDER
            gpsEnabled -> LocationManager.GPS_PROVIDER
            else -> null
          }
        else ->
          when {
            gpsEnabled -> LocationManager.GPS_PROVIDER
            networkEnabled -> LocationManager.NETWORK_PROVIDER
            else -> null
          }
      }
    }

    private fun buildLocationParamsForAccuracy(accuracy: Int): LocationParams {
      return when (accuracy) {
        LocationModule.ACCURACY_LOWEST -> LocationParams(accuracy = LocationAccuracy.LOWEST, distance = 3000f, interval = 10000)
        LocationModule.ACCURACY_LOW -> LocationParams(accuracy = LocationAccuracy.LOW, distance = 1000f, interval = 5000)
        LocationModule.ACCURACY_BALANCED -> LocationParams(accuracy = LocationAccuracy.MEDIUM, distance = 100f, interval = 3000)
        LocationModule.ACCURACY_HIGH -> LocationParams(accuracy = LocationAccuracy.HIGH, distance = 50f, interval = 2000)
        LocationModule.ACCURACY_HIGHEST -> LocationParams(accuracy = LocationAccuracy.HIGH, distance = 25f, interval = 1000)
        LocationModule.ACCURACY_BEST_FOR_NAVIGATION -> LocationParams(accuracy = LocationAccuracy.HIGH, distance = 0f, interval = 500)
        else -> LocationParams(accuracy = LocationAccuracy.MEDIUM, distance = 100f, interval = 3000)
      }
    }

    fun isAnyProviderAvailable(context: Context?): Boolean {
      val locationManager = context?.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        ?: return false
      return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    internal suspend fun getPermissionsWithPermissionsManager(
      contextPermissions: Permissions,
      vararg permissionStrings: String
    ): PermissionRequestResponse {
      return suspendCoroutine { continuation ->
        Permissions.getPermissionsWithPermissionsManager(
          contextPermissions,
          object : Promise {
            override fun resolve(value: Any?) {
              val result = value as? Bundle
                ?: throw ConversionException(Any::class.java, Bundle::class.java, "value returned by the permission promise is not a Bundle")
              continuation.resume(PermissionRequestResponse(result))
            }

            override fun reject(code: String?, message: String?, cause: Throwable?) {
              continuation.resumeWithException(CodedException(code, message, cause))
            }
          },
          *permissionStrings
        )
      }
    }

    internal suspend fun askForPermissionsWithPermissionsManager(
      contextPermissions: Permissions,
      vararg permissionStrings: String
    ): Bundle {
      return suspendCoroutine {
        Permissions.askForPermissionsWithPermissionsManager(
          contextPermissions,
          object : Promise {
            override fun resolve(value: Any?) {
              it.resume(
                value as? Bundle
                  ?: throw ConversionException(Any::class.java, Bundle::class.java, "value returned by the permission promise is not a Bundle")
              )
            }

            override fun reject(code: String?, message: String?, cause: Throwable?) {
              it.resumeWithException(CodedException(code, message, cause))
            }
          },
          *permissionStrings
        )
      }
    }
  }
}

object AppForegroundedSingleton {
  var isForegrounded = false
}
