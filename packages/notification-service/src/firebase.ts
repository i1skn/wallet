import { CURRENCIES, CURRENCY_ENUM } from '@celo/utils'
import { DataSnapshot } from '@firebase/database-types'
import * as admin from 'firebase-admin'
import i18next from 'i18next'
import { Currencies, MAX_BLOCKS_TO_WAIT } from './blockscout/transfers'
import {
  ENVIRONMENT,
  NOTIFICATIONS_DISABLED,
  NOTIFICATIONS_TTL_MS,
  NotificationTypes,
} from './config'

const NOTIFICATIONS_TAG = 'NOTIFICATIONS/'

let database: admin.database.Database
let registrationsRef: admin.database.Reference
let lastBlockRef: admin.database.Reference
let pendingRequestsRef: admin.database.Reference
let knownAddressesRef: admin.database.Reference

export interface Registrations {
  [address: string]:
    | {
        fcmToken: string
        language?: string
      }
    | undefined
    | null
}

export enum PaymentRequestStatuses {
  REQUESTED = 'REQUESTED',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

interface PaymentRequest {
  amount: string
  timestamp: string
  requesterE164Number: string
  requesterAddress: string
  requesteeAddress: string
  currency: Currencies
  comment: string
  status: PaymentRequestStatuses
  notified: boolean
  type: NotificationTypes.PAYMENT_REQUESTED
}

interface PendingRequests {
  [uid: string]: PaymentRequest
}

interface ExchangeRateObject {
  exchangeRate: string
  timestamp: number // timestamp in milliseconds
}

export interface KnownAddressInfo {
  name: string
  imageUrl?: string
  isCeloRewardSender?: boolean
}

export interface AddressToDisplayNameType {
  [address: string]: KnownAddressInfo | undefined
}

let registrations: Registrations = {}
let lastBlockNotified: number = -1

const pendingRequests: PendingRequests = {}
let celoRewardsSenders: string[] = []

export function _setTestRegistrations(testRegistrations: Registrations) {
  registrations = testRegistrations
}

export function updateCeloRewardsSenderAddresses(knownAddressesInfo: AddressToDisplayNameType) {
  celoRewardsSenders = Object.entries(knownAddressesInfo)
    .filter(([_, value]) => value?.isCeloRewardSender)
    .map(([key, _]) => key)
}

function paymentObjectToNotification(po: PaymentRequest): { [key: string]: string } {
  return {
    amount: po.amount,
    timestamp: po.timestamp,
    requesterE164Number: po.requesterE164Number,
    requesterAddress: po.requesterAddress,
    requesteeAddress: po.requesteeAddress,
    currency: po.currency,
    comment: po.comment,
    status: po.status,
    type: po.type,
  }
}

function firebaseFetchError(nodeKey: string) {
  return (errorObject: any) => {
    console.error(`${nodeKey} data read failed:`, errorObject.code)
  }
}

export function initializeDb() {
  database = admin.database()
  registrationsRef = database.ref('/registrations')
  lastBlockRef = database.ref('/lastBlockNotified')
  pendingRequestsRef = database.ref('/pendingRequests')
  knownAddressesRef = database.ref('/addressesExtraInfo')

  function addOrUpdateRegistration(snapshot: DataSnapshot) {
    const registration = (snapshot && snapshot.val()) || {}
    console.debug('New or updated registration:', snapshot.key, registration)
    if (snapshot.key) {
      registrations[snapshot.key] = registration
    }
  }
  registrationsRef.on('child_added', addOrUpdateRegistration, firebaseFetchError('registration'))
  registrationsRef.on('child_changed', addOrUpdateRegistration, firebaseFetchError('registration'))

  lastBlockRef.on(
    'value',
    (snapshot) => {
      const lastBlock = (snapshot && snapshot.val()) || 0
      console.debug('Latest block data updated: ', lastBlock)
      if (lastBlockNotified < 0) {
        // On the transfers file, we query using |lastBlockNotified - MAX_BLOCKS_TO_WAIT|, which would resolve to the current time.
        // This means that any block previous to |lastBlock| which hasn't been notified never will be.
        // If we just set |lastBlockNotified| to |lastBlock| we would risk sending duplicate notifications to all transfers made in
        // the last |MAX_BLOCKS_TO_WAIT| blocks.
        // To make sure all notifications are always sent, we'd have to store processed blocks on Firebase to persist the cache
        // between deploys.
        lastBlockNotified = lastBlock + MAX_BLOCKS_TO_WAIT
      } else if (lastBlock > lastBlockNotified) {
        lastBlockNotified = lastBlock
      }
    },
    (errorObject: any) => {
      console.error('Latest block data read failed:', errorObject.code)
    }
  )

  function addOrUpdatePendingRequest(snapshot: DataSnapshot) {
    const pendingRequest = (snapshot && snapshot.val()) || {}
    console.debug('New or updated pending request:', snapshot.key, pendingRequest)
    if (snapshot.key) {
      pendingRequests[snapshot.key] = pendingRequest
    }
  }
  pendingRequestsRef.on(
    'child_added',
    addOrUpdatePendingRequest,
    firebaseFetchError('pendingRequests')
  )
  pendingRequestsRef.on(
    'child_changed',
    addOrUpdatePendingRequest,
    firebaseFetchError('pendingRequests')
  )

  knownAddressesRef.on(
    'value',
    (snapshot) => {
      const knownAddressesInfo: AddressToDisplayNameType = (snapshot && snapshot.val()) || {}
      updateCeloRewardsSenderAddresses(knownAddressesInfo)
      console.debug('Latest known addresses updated: ', celoRewardsSenders)
    },
    (errorObject: any) => {
      console.error('Known addresses data read failed:', errorObject.code)
    }
  )
}

export function getTokenFromAddress(address: string) {
  return registrations[address]?.fcmToken ?? null
}

export function getTranslatorForAddress(address: string) {
  const registration = registrations[address]
  const language = registration && registration.language
  // Language is set and i18next has the proper config
  if (language) {
    console.info(`Language resolved as ${language} for user address ${address}`)
    return i18next.getFixedT(language)
  }
  // If language is not supported falls back to env.DEFAULT_LOCALE
  console.info(`Users ${address} language is not set, valid or supported`)
  return i18next.t.bind(i18next)
}

export function getLastBlockNotified() {
  return lastBlockNotified
}

export function getPendingRequests() {
  return pendingRequests
}

export function setPaymentRequestNotified(uid: string): Promise<void> {
  if (ENVIRONMENT === 'local') {
    return Promise.resolve()
  }
  return database.ref(`/pendingRequests/${uid}`).update({ notified: true })
}

export function writeExchangeRatePair(
  takerToken: CURRENCY_ENUM,
  makerToken: CURRENCY_ENUM,
  exchangeRate: string,
  timestamp: number
) {
  if (ENVIRONMENT === 'local') {
    return
  }
  const pair = `${CURRENCIES[takerToken].code}/${CURRENCIES[makerToken].code}`
  const exchangeRateRecord: ExchangeRateObject = {
    exchangeRate,
    timestamp,
  }
  database.ref(`/exchangeRates/${pair}`).push(exchangeRateRecord)
  console.debug(`Recorded exchange rate for ${pair}`, exchangeRateRecord)
}

export function setLastBlockNotified(newBlock: number): Promise<void> | undefined {
  if (newBlock <= lastBlockNotified) {
    console.debug('Block number less than latest, skipping latestBlock update.')
    return
  }

  console.debug('Updating last block notified to:', newBlock)
  // Although firebase will keep our local lastBlockNotified in sync with the DB,
  // we set it here ourselves to avoid race condition where we check for notifications
  // again before it syncs
  lastBlockNotified = newBlock
  if (ENVIRONMENT === 'local') {
    return
  }
  return lastBlockRef.set(newBlock)
}

function notificationTitleAndBody(senderAddress: string, currency: Currencies) {
  const isCeloReward = celoRewardsSenders.indexOf(senderAddress) >= 0
  if (isCeloReward) {
    return {
      title: 'rewardReceivedTitle',
      body: 'paymentReceivedBody',
    }
  }
  return {
    [Currencies.DOLLAR]: {
      title: 'paymentReceivedTitle',
      body: 'paymentReceivedBody',
    },
    [Currencies.GOLD]: {
      title: 'celoReceivedTitle',
      body: 'celoReceivedBody',
    },
  }[currency]
}

export async function sendPaymentNotification(
  senderAddress: string,
  recipientAddress: string,
  amount: string,
  currency: Currencies,
  blockNumber: number,
  data: { [key: string]: string }
) {
  console.info(NOTIFICATIONS_TAG, 'Block delay: ', lastBlockNotified - blockNumber)
  const t = getTranslatorForAddress(recipientAddress)
  data.type = NotificationTypes.PAYMENT_RECEIVED
  const { title, body } = notificationTitleAndBody(senderAddress, currency)
  return sendNotification(
    t(title),
    t(body, {
      amount,
      currency: t(currency, { count: parseInt(amount, 10) }),
    }),
    recipientAddress,
    data
  )
}

export async function requestedPaymentNotification(uid: string, data: PaymentRequest) {
  const { requesteeAddress, amount, currency } = data
  const t = getTranslatorForAddress(requesteeAddress)

  data.type = NotificationTypes.PAYMENT_REQUESTED
  return sendNotification(
    t('paymentRequestedTitle'),
    t('paymentRequestedBody', {
      amount,
      currency: t(currency, { count: parseInt(amount, 10) }),
    }),
    requesteeAddress,
    { uid, ...paymentObjectToNotification(data) }
  )
}

export async function sendNotification(
  title: string,
  body: string,
  address: string,
  data: { [key: string]: string }
) {
  const token = getTokenFromAddress(address)
  if (!token) {
    console.info('FCM token missing for address:', address)
    return
  }

  // https://firebase.google.com/docs/cloud-messaging/concept-options#setting-the-priority-of-a-message
  const message: admin.messaging.Message = {
    notification: {
      title,
      body,
    },
    android: {
      ttl: NOTIFICATIONS_TTL_MS,
      priority: 'normal',
      notification: {
        icon: 'ic_stat_rings',
        color: '#42D689',
      },
    },
    data,
    token,
  }

  try {
    console.info(NOTIFICATIONS_TAG, 'Sending notification to:', address)
    const response = await admin.messaging().send(message, NOTIFICATIONS_DISABLED)
    console.info('Successfully sent notification for :', address, response)
  } catch (error) {
    console.error('Error sending notification:', address, error)
  }
}
