import firebase, { ReactNativeFirebase } from '@react-native-firebase/app'
import '@react-native-firebase/auth'
import { FirebaseDatabaseTypes } from '@react-native-firebase/database'
import '@react-native-firebase/messaging'
// We can't combine the 2 imports otherwise it only imports the type and fails at runtime
// tslint:disable-next-line: no-duplicate-imports
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import { eventChannel, EventChannel } from 'redux-saga'
import { call, select, spawn, take } from 'redux-saga/effects'
import { currentLanguageSelector } from 'src/app/reducers'
import { FIREBASE_ENABLED } from 'src/config'
import { handleNotification } from 'src/firebase/notifications'
import { NotificationReceiveState } from 'src/notifications/types'
import Logger from 'src/utils/Logger'
import { Awaited } from 'src/utils/typescript'

const TAG = 'firebase/firebase'

interface NotificationChannelEvent {
  message: FirebaseMessagingTypes.RemoteMessage
  stateType: NotificationReceiveState
}

// only exported for testing
export function* watchFirebaseNotificationChannel(channel: EventChannel<NotificationChannelEvent>) {
  try {
    Logger.debug(`${TAG}/watchFirebaseNotificationChannel`, 'Started channel watching')
    while (true) {
      const event: NotificationChannelEvent = yield take(channel)
      if (!event) {
        Logger.debug(`${TAG}/watchFirebaseNotificationChannel`, 'Data in channel was empty')
        continue
      }
      Logger.debug(
        `${TAG}/watchFirebaseNotificationChannel`,
        'Notification received in the channel'
      )
      yield call(handleNotification, event.message, event.stateType)
    }
  } catch (error) {
    Logger.error(
      `${TAG}/watchFirebaseNotificationChannel`,
      'Error proccesing notification channel event',
      error
    )
  } finally {
    Logger.debug(`${TAG}/watchFirebaseNotificationChannel`, 'Notification channel terminated')
  }
}

export const initializeAuth = async (app: ReactNativeFirebase.Module, address: string) => {
  Logger.info(TAG, 'Initializing Firebase auth')
  const user = await app.auth().signInAnonymously()
  if (!user) {
    throw new Error('No Firebase user specified')
  }

  const userRef = app.database().ref('users')
  // Save some user data in DB if it's not there yet
  await userRef.child(user.user.uid).transaction((userData: { address?: string }) => {
    if (userData == null) {
      return { address }
    } else if (userData.address !== undefined && userData.address !== address) {
      // This shouldn't happen! If this is thrown it means the firebase user is reused
      // with different addresses (which we don't want) or the db was incorrectly changed remotely!
      Logger.debug("User address in the db doesn't match persisted address - updating address")
      return {
        address,
      }
    }
  })
  Logger.info(TAG, 'Firebase Auth initialized successfully')
}

export const firebaseSignOut = async (app: ReactNativeFirebase.FirebaseApp) => {
  await app.auth().signOut()
}

export function* initializeCloudMessaging(app: ReactNativeFirebase.Module, address: string) {
  Logger.info(TAG, 'Initializing Firebase Cloud Messaging')

  // this call needs to include context: https://github.com/redux-saga/redux-saga/issues/27
  // Manual type checking because yield calls can't infer return type yet :'(
  const authStatus: Awaited<ReturnType<
    FirebaseMessagingTypes.Module['hasPermission']
  >> = yield call([app.messaging(), 'hasPermission'])
  Logger.info(TAG, 'Current messaging authorization status', authStatus.toString())
  if (authStatus === firebase.messaging.AuthorizationStatus.NOT_DETERMINED) {
    try {
      yield call([app.messaging(), 'requestPermission'])
    } catch (error) {
      Logger.error(TAG, 'User has rejected messaging permissions', error)
      throw error
    }
  }

  // `registerDeviceForRemoteMessages` must be called before calling `getToken`
  // Note: `registerDeviceForRemoteMessages` is really only required for iOS and is a no-op on Android
  yield call([app.messaging(), 'registerDeviceForRemoteMessages'])
  const fcmToken = yield call([app.messaging(), 'getToken'])
  if (fcmToken) {
    yield call(registerTokenToDb, app, address, fcmToken)
    // First time setting the fcmToken also set the language selection
    const language = yield select(currentLanguageSelector)
    yield call(setUserLanguage, address, language)
  }

  app.messaging().onTokenRefresh(async (token) => {
    Logger.info(TAG, 'Cloud Messaging token refreshed')
    await registerTokenToDb(app, address, token)
  })

  // Listen for notification messages while the app is open
  const channelOnNotification: EventChannel<NotificationChannelEvent> = eventChannel((emitter) => {
    const unsubscribe = () => {
      Logger.info(TAG, 'Notification channel closed, resetting callbacks. This is likely an error.')
      app.messaging().onMessage(() => null)
      app.messaging().onNotificationOpenedApp(() => null)
    }

    app.messaging().onMessage((message) => {
      Logger.info(TAG, 'Notification received while open')
      emitter({
        message,
        stateType: NotificationReceiveState.APP_ALREADY_OPEN,
      })
    })

    app.messaging().onNotificationOpenedApp((message) => {
      Logger.info(TAG, 'App opened via a notification')
      emitter({
        message,
        stateType: NotificationReceiveState.APP_FOREGROUNDED,
      })
    })
    return unsubscribe
  })
  yield spawn(watchFirebaseNotificationChannel, channelOnNotification)

  // Manual type checking because yield calls can't infer return type yet :'(
  const initialNotification: Awaited<ReturnType<
    FirebaseMessagingTypes.Module['getInitialNotification']
  >> = yield call([app.messaging(), 'getInitialNotification'])
  if (initialNotification) {
    Logger.info(TAG, 'App opened fresh via a notification', JSON.stringify(initialNotification))
    yield call(handleNotification, initialNotification, NotificationReceiveState.APP_OPENED_FRESH)
  }
}

export const registerTokenToDb = async (
  app: ReactNativeFirebase.Module,
  address: string,
  fcmToken: string
) => {
  try {
    Logger.info(TAG, 'Registering Firebase client FCM token')
    const regRef = app.database().ref('registrations')
    // TODO(Rossy) add support for multiple tokens per address
    await regRef.child(address).update({ fcmToken })
    Logger.info(TAG, 'Firebase FCM token registered successfully', fcmToken)
  } catch (error) {
    Logger.error(TAG, 'Failed to register Firebase FCM token', error)
    throw error
  }
}

const VALUE_CHANGE_HOOK = 'value'

/*
Get the Version deprecation information.
Firebase DB Format:
  (New) Add minVersion child to versions category with a string of the mininum version as string
*/
export function appVersionDeprecationChannel() {
  if (!FIREBASE_ENABLED) {
    return null
  }

  const errorCallback = (error: Error) => {
    Logger.warn(TAG, error.toString())
  }

  return eventChannel((emit: any) => {
    const emitter = (snapshot: FirebaseDatabaseTypes.DataSnapshot) => {
      const minVersion = snapshot.val().minVersion
      emit(minVersion)
    }

    const onValueChange = firebase
      .database()
      .ref('versions')
      .on(VALUE_CHANGE_HOOK, emitter, errorCallback)

    const cancel = () => {
      firebase
        .database()
        .ref('versions')
        .off(VALUE_CHANGE_HOOK, onValueChange)
    }

    return cancel
  })
}

export function appRemoteFeatureFlagChannel() {
  if (!FIREBASE_ENABLED) {
    return null
  }

  const errorCallback = (error: Error) => {
    Logger.warn(TAG, error.toString())
  }

  return eventChannel((emit: any) => {
    const emitter = (snapshot: FirebaseDatabaseTypes.DataSnapshot) => {
      const flags = snapshot.val()
      Logger.debug(`Updated feature flags: ${JSON.stringify(flags)}`)
      emit({
        kotaniEnabled: flags?.kotaniEnabled || false,
        pontoEnabled: flags?.pontoEnabled || false,
        bitfyUrl: flags?.bitfyUrl ?? null,
        flowBtcUrl: flags?.flowBtcUrl ?? null,
        hideVerification: flags?.hideVerification ?? false,
        celoEducationUri: flags?.celoEducationUri ?? null,
        shortVerificationCodesEnabled: flags?.shortVerificationCodesEnabled ?? false,
        inviteRewardsEnabled: flags?.inviteRewardsEnabled ?? false,
        inviteRewardCusd: flags?.inviteRewardCusd ?? 1,
        inviteRewardWeeklyLimit: flags?.inviteRewardCusd ?? 5,
      })
    }

    const onValueChange = firebase
      .database()
      .ref('versions/flags')
      .on(VALUE_CHANGE_HOOK, emitter, errorCallback)

    const cancel = () => {
      firebase
        .database()
        .ref('versions/flags')
        .off(VALUE_CHANGE_HOOK, onValueChange)
    }

    return cancel
  })
}

export async function knownAddressesChannel() {
  return simpleReadChannel('addressesExtraInfo')
}

export async function notificationsChannel() {
  return simpleReadChannel('notificationsV2')
}

export async function cUsdDailyLimitChannel(address: string) {
  return simpleReadChannel(`registrations/${address}/dailyLimitCusd`)
}

export async function providerTxHashesChannel(address: string) {
  return simpleReadChannel(`registrations/${address}/txHashes`)
}

function simpleReadChannel(key: string) {
  if (!FIREBASE_ENABLED) {
    return null
  }

  const errorCallback = (error: Error) => {
    Logger.warn(TAG, error.toString())
  }

  return eventChannel((emit: any) => {
    const emitter = (snapshot: FirebaseDatabaseTypes.DataSnapshot) => {
      const value = snapshot.val()
      Logger.debug(`Got value from Firebase for key ${key}: ${JSON.stringify(value)}`)
      emit(value || {})
    }

    const onValueChange = firebase
      .database()
      .ref(key)
      .on(VALUE_CHANGE_HOOK, emitter, errorCallback)

    const cancel = () => {
      firebase
        .database()
        .ref(key)
        .off(VALUE_CHANGE_HOOK, onValueChange)
    }

    return cancel
  })
}

export async function setUserLanguage(address: string, language: string) {
  try {
    Logger.info(TAG, `Setting language selection for user ${address}`)
    const regRef = firebase.database().ref('registrations')
    await regRef.child(address).update({ language })

    Logger.info(TAG, 'User Language synced successfully', language)
  } catch (error) {
    Logger.error(TAG, 'Failed to sync user language selection', error)
    throw error
  }
}
