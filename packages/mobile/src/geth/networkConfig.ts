import { Address } from '@celo/base'
import { OdisUtils } from '@celo/identity'
import {
  BIDALI_URL_ALFAJORES,
  BIDALI_URL_MAINNET,
  DEFAULT_SYNC_MODE,
  DEFAULT_TESTNET,
  FORNO_ENABLED_INITIALLY,
  GETH_USE_FULL_NODE_DISCOVERY,
  GETH_USE_STATIC_NODES,
  RAMP_API_KEY,
  RECAPTCHA_SITE_KEY_ALFAJORES,
  RECAPTCHA_SITE_KEY_MAINNET,
  TRANSAK_API_KEY,
} from 'src/config'
import { GethSyncMode } from 'src/geth/consts'
import Logger from 'src/utils/Logger'

export enum Testnets {
  alfajores = 'alfajores',
  mainnet = 'mainnet',
}

interface NetworkConfig {
  nodeDir: string
  syncMode: GethSyncMode
  initiallyForno: boolean
  blockchainApiUrl: string
  odisUrl: string // Phone Number Privacy service url
  odisPubKey: string
  signMoonpayUrl: string
  rampWidgetUrl: string
  rampApiKey: string
  transakWidgetUrl: string
  transakApiKey: string
  useDiscovery: boolean
  useStaticNodes: boolean
  komenciUrl: string
  allowedMtwImplementations: string[]
  currentMtwImplementationAddress: string
  recaptchaSiteKey: string
  bidaliUrl: string
  CIP8AuthorizerUrl: string
  CIP8MetadataUrl: string
}

const signMoonpayUrlStaging =
  'https://us-central1-celo-testnet-production.cloudfunctions.net/signMoonpayStaging'
const signMoonpayUrlProd =
  'https://us-central1-celo-mobile-mainnet.cloudfunctions.net/signMoonpayProd'

const rampWidgetStaging = 'https://ri-widget-staging.firebaseapp.com'
const rampWidgetProd = 'https://buy.ramp.network'

const transakWidgetProd = 'https://global.transak.com'
const transakWidgetStaging = 'https://staging-global.transak.com'

const KOMENCI_URL_MAINNET = 'https://mainnet-komenci.azurefd.net'
const KOMENCI_URL_STAGING = 'https://staging-komenci.azurefd.net'

const ALLOWED_MTW_IMPLEMENTATIONS_MAINNET: Address[] = [
  '0x6511FB5DBfe95859d8759AdAd5503D656E2555d7',
]
const ALLOWED_MTW_IMPLEMENTATIONS_STAGING: Address[] = [
  '0x5C9a6E3c3E862eD306E2E3348EBC8b8310A99e5A',
  '0x88a2b9B8387A1823D821E406b4e951337fa1D46D',
]

const CURRENT_MTW_IMPLEMENTATION_ADDRESS_MAINNET: Address =
  '0x6511FB5DBfe95859d8759AdAd5503D656E2555d7'
const CURRENT_MTW_IMPLEMENTATION_ADDRESS_STAGING: Address =
  '0x5C9a6E3c3E862eD306E2E3348EBC8b8310A99e5A'

const CIP8_AUTHORIZER_URL_ALFAJORES = 'https://alfajores-stokado.celo-testnet.org/api/authorize'
const CIP8_METADATA_URL_ALFAJORES = 'https://alfajores-stokado-data.celo-testnet.org'
const CIP8_AUTHORIZER_URL_MAINNET = 'https://rc1-stokado.celo-testnet.org/api/authorize'
const CIP8_METADATA_URL_MAINNET = 'https://rc1-stokado-data.celo-testnet.org'

const networkConfigs: { [testnet: string]: NetworkConfig } = {
  [Testnets.alfajores]: {
    nodeDir: `.${Testnets.alfajores}`,
    syncMode: DEFAULT_SYNC_MODE,
    initiallyForno: FORNO_ENABLED_INITIALLY,
    blockchainApiUrl: 'https://blockchain-api-dot-celo-mobile-alfajores.appspot.com/',
    odisUrl: OdisUtils.Query.ODIS_ALFAJORES_CONTEXT.odisUrl,
    odisPubKey: OdisUtils.Query.ODIS_ALFAJORES_CONTEXT.odisPubKey,
    signMoonpayUrl: signMoonpayUrlStaging,
    rampWidgetUrl: rampWidgetStaging,
    rampApiKey: RAMP_API_KEY,
    transakWidgetUrl: transakWidgetStaging,
    transakApiKey: TRANSAK_API_KEY,
    useDiscovery: GETH_USE_FULL_NODE_DISCOVERY,
    useStaticNodes: GETH_USE_STATIC_NODES,
    komenciUrl: KOMENCI_URL_STAGING,
    allowedMtwImplementations: ALLOWED_MTW_IMPLEMENTATIONS_STAGING,
    currentMtwImplementationAddress: CURRENT_MTW_IMPLEMENTATION_ADDRESS_STAGING,
    recaptchaSiteKey: RECAPTCHA_SITE_KEY_ALFAJORES,
    bidaliUrl: BIDALI_URL_ALFAJORES,
    CIP8AuthorizerUrl: CIP8_AUTHORIZER_URL_ALFAJORES,
    CIP8MetadataUrl: CIP8_METADATA_URL_ALFAJORES,
  },
  [Testnets.mainnet]: {
    nodeDir: `.${Testnets.mainnet}`,
    syncMode: DEFAULT_SYNC_MODE,
    initiallyForno: FORNO_ENABLED_INITIALLY,
    blockchainApiUrl: 'https://blockchain-api-dot-celo-mobile-mainnet.appspot.com/',
    odisUrl: OdisUtils.Query.ODIS_MAINNET_CONTEXT.odisUrl,
    odisPubKey: OdisUtils.Query.ODIS_MAINNET_CONTEXT.odisPubKey,
    signMoonpayUrl: signMoonpayUrlProd,
    rampWidgetUrl: rampWidgetProd,
    rampApiKey: RAMP_API_KEY,
    transakWidgetUrl: transakWidgetProd,
    transakApiKey: TRANSAK_API_KEY,
    useDiscovery: GETH_USE_FULL_NODE_DISCOVERY,
    useStaticNodes: GETH_USE_STATIC_NODES,
    komenciUrl: KOMENCI_URL_MAINNET,
    allowedMtwImplementations: ALLOWED_MTW_IMPLEMENTATIONS_MAINNET,
    currentMtwImplementationAddress: CURRENT_MTW_IMPLEMENTATION_ADDRESS_MAINNET,
    recaptchaSiteKey: RECAPTCHA_SITE_KEY_MAINNET,
    bidaliUrl: BIDALI_URL_MAINNET,
    CIP8AuthorizerUrl: CIP8_AUTHORIZER_URL_MAINNET,
    CIP8MetadataUrl: CIP8_METADATA_URL_MAINNET,
  },
}

Logger.info('Connecting to testnet: ', DEFAULT_TESTNET)

export default networkConfigs[DEFAULT_TESTNET]
