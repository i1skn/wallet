import ListItem from '@celo/react-components/components/ListItem'
import colors from '@celo/react-components/styles/colors'
import fontStyles from '@celo/react-components/styles/fonts'
import variables from '@celo/react-components/styles/variables'
import { getRegionCodeFromCountryCode } from '@celo/utils/lib/phoneNumbers'
import { RouteProp } from '@react-navigation/native'
import { StackScreenProps } from '@react-navigation/stack'
import React, { useLayoutEffect, useState } from 'react'
import { useAsync } from 'react-async-hook'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useDispatch } from 'react-redux'
import { defaultCountryCodeSelector } from 'src/account/selectors'
import { FiatExchangeEvents } from 'src/analytics/Events'
import ValoraAnalytics from 'src/analytics/ValoraAnalytics'
import BackButton from 'src/components/BackButton'
import Dialog from 'src/components/Dialog'
import { CurrencyCode } from 'src/config'
import { selectProvider } from 'src/fiatExchanges/actions'
import { PaymentMethod } from 'src/fiatExchanges/FiatExchangeOptions'
import { CicoProviderNames, providersDisplayInfo } from 'src/fiatExchanges/reducer'
import {
  fetchLocationFromIpAddress,
  getProviderAvailability,
  openMoonpay,
  openRamp,
  openSimplex,
  openTransak,
  sortProviders,
  UserLocation,
} from 'src/fiatExchanges/utils'
import { CURRENCY_ENUM } from 'src/geth/consts'
import i18n, { Namespaces } from 'src/i18n'
import LinkArrow from 'src/icons/LinkArrow'
import QuestionIcon from 'src/icons/QuestionIcon'
import { LocalCurrencyCode } from 'src/localCurrency/consts'
import { getLocalCurrencyCode } from 'src/localCurrency/selectors'
import { emptyHeader } from 'src/navigator/Headers'
import { Screens } from 'src/navigator/Screens'
import { TopBarIconButton } from 'src/navigator/TopBarButton'
import { StackParamList } from 'src/navigator/types'
import useSelector from 'src/redux/useSelector'
import { currentAccountSelector } from 'src/web3/selectors'
import {
  CicoService,
  MoonpayService,
  SimplexService,
  TransakService,
} from 'src/fiatExchanges/services'
import CurrencyDisplay from 'src/components/CurrencyDisplay'

type Props = StackScreenProps<StackParamList, Screens.ProviderOptionsScreen>

ProviderOptionsScreen.navigationOptions = ({
  route,
}: {
  route: RouteProp<StackParamList, Screens.ProviderOptionsScreen>
}) => {
  const eventName = route.params?.isCashIn
    ? FiatExchangeEvents.cico_add_funds_select_provider_back
    : FiatExchangeEvents.cico_cash_out_select_provider_back

  return {
    ...emptyHeader,
    headerLeft: () => <BackButton eventName={eventName} />,
    headerTitle: i18n.t(`fiatExchangeFlow:${route.params?.isCashIn ? 'addFunds' : 'cashOut'}`),
  }
}
export interface CicoProvider {
  id: CicoProviderNames
  restricted: boolean
  icon: string
  iconColor?: string
  paymentMethods: PaymentMethod[]
  image?: React.ReactNode
  onSelected: () => void
  service?: CicoService
}

const FALLBACK_CURRENCY = LocalCurrencyCode.USD

const simplexService = SimplexService.getInstance()
const transakService = TransakService.getInstance()
const moonpayService = MoonpayService.getInstance()

function ProviderOptionsScreen({ route, navigation }: Props) {
  const [showingExplanation, setShowExplanation] = useState(false)
  const onDismissExplanation = () => {
    setShowExplanation(false)
    ValoraAnalytics.track(FiatExchangeEvents.cico_add_funds_select_provider_info_cancel)
  }
  const [providerFees, setProviderFees] = useState({} as any)

  const { t } = useTranslation(Namespaces.fiatExchangeFlow)
  const countryCallingCode = useSelector(defaultCountryCodeSelector)
  const account = useSelector(currentAccountSelector)
  const localCurrency = useSelector(getLocalCurrencyCode)
  const isCashIn = route.params?.isCashIn ?? true

  const { paymentMethod } = route.params
  const selectedCurrency = {
    [CURRENCY_ENUM.GOLD]: CurrencyCode.CELO,
    [CURRENCY_ENUM.DOLLAR]: CurrencyCode.CUSD,
  }[route.params.currency || CURRENCY_ENUM.DOLLAR]

  const dispatch = useDispatch()

  useLayoutEffect(() => {
    const showExplanation = () => {
      setShowExplanation(true)
      ValoraAnalytics.track(FiatExchangeEvents.cico_add_funds_select_provider_info)
    }

    navigation.setOptions({
      headerRightContainerStyle: { paddingRight: 16 },
      headerRight: () => (
        <TopBarIconButton
          icon={<QuestionIcon color={colors.greenUI} />}
          onPress={showExplanation}
        />
      ),
    })
  }, [])

  const asyncUserLocation = useAsync(async () => {
    try {
      const { alpha2, state } = await fetchLocationFromIpAddress()
      if (!alpha2) {
        throw Error('Could not determine country from IP address')
      }

      return { country: alpha2, state }
    } catch (error) {
      const alpha2 = countryCallingCode ? getRegionCodeFromCountryCode(countryCallingCode) : null
      return { country: alpha2, state: null }
    }
  }, [])

  const userLocation: UserLocation | undefined = asyncUserLocation.result

  const {
    MOONPAY_RESTRICTED,
    SIMPLEX_RESTRICTED,
    RAMP_RESTRICTED,
    TRANSAK_RESTRICTED,
  } = getProviderAvailability(userLocation)

  const providers: {
    cashOut: CicoProvider[]
    cashIn: CicoProvider[]
  } = {
    cashOut: [],
    cashIn: [
      {
        id: CicoProviderNames.Moonpay,
        paymentMethods: [PaymentMethod.CARD, PaymentMethod.BANK],
        restricted: MOONPAY_RESTRICTED,
        icon:
          'https://firebasestorage.googleapis.com/v0/b/celo-mobile-mainnet.appspot.com/o/images%2Fmoonpay.png?alt=media&token=3617af49-7762-414d-a4d0-df05fbc49b97',
        iconColor: 'rgba(0, 0, 0, 0.07)',
        onSelected: () =>
          openMoonpay(route.params.amount, localCurrency || FALLBACK_CURRENCY, selectedCurrency),
        service: moonpayService,
      },
      {
        id: CicoProviderNames.Simplex,
        paymentMethods: [PaymentMethod.CARD],
        restricted: SIMPLEX_RESTRICTED,
        icon:
          'https://firebasestorage.googleapis.com/v0/b/celo-mobile-mainnet.appspot.com/o/images%2Fsimplex.jpg?alt=media&token=6037b2f9-9d76-4076-b29e-b7e0de0b3f34',
        iconColor: 'rgba(96, 169, 64, 0.07)',
        onSelected: () => openSimplex(account),
        service: simplexService,
      },
      {
        id: CicoProviderNames.Ramp,
        paymentMethods: [PaymentMethod.CARD, PaymentMethod.BANK],
        restricted: RAMP_RESTRICTED,
        icon:
          'https://firebasestorage.googleapis.com/v0/b/celo-mobile-mainnet.appspot.com/o/images%2Framp.png?alt=media&token=548ab5b9-7b03-49a2-a196-198f45958852',
        iconColor: 'rgba(2, 194, 108, 0.07)',
        onSelected: () =>
          openRamp(route.params.amount, localCurrency || FALLBACK_CURRENCY, selectedCurrency),
      },
      {
        id: CicoProviderNames.Transak,
        paymentMethods: [PaymentMethod.CARD, PaymentMethod.BANK],
        restricted: TRANSAK_RESTRICTED,
        onSelected: () =>
          openTransak(route.params.amount, localCurrency || FALLBACK_CURRENCY, selectedCurrency),
        service: transakService,
      },
    ].sort(sortProviders),
  }

  const selectedProviders = providers[isCashIn ? 'cashIn' : 'cashOut']

  React.useEffect(() => {
    const fees = selectedProviders
      .filter(({ restricted }) => !restricted)
      .map(async ({ id, service }) => [
        id,
        (
          await service
            ?.getFees?.(selectedCurrency, localCurrency, route.params.amount)
            .catch(() => ({ fee: undefined }))
        )?.fee,
      ])
    setTimeout(async () => console.log(await Promise.all(fees)), 1000)
    Promise.all(fees)
      .then((list) => list.reduce((acc, [name, fee]) => ({ ...acc, [name as string]: fee }), {}))
      .then((feesValues) => setProviderFees(feesValues))
  }, [
    route.params.amount,
    localCurrency,
    selectedCurrency,
    ...selectedProviders.map(({ id }) => id),
  ])

  const providerOnPress = (provider: CicoProvider) => () => {
    ValoraAnalytics.track(FiatExchangeEvents.provider_chosen, {
      isCashIn,
      provider: provider.id,
    })
    dispatch(selectProvider(provider.id))
    provider.onSelected()
  }

  return !userLocation ? (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.greenBrand} />
    </View>
  ) : (
    <ScrollView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <Text style={styles.pleaseSelectProvider}>{t('pleaseSelectProvider')}</Text>
        <View style={styles.providersContainer}>
          {selectedProviders.map((provider) => (
            <ListItem key={provider.id} onPress={providerOnPress(provider)}>
              <View style={styles.providerListItem} testID={`Provider/${provider.id}`}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: provider.iconColor || colors.gray1 },
                  ]}
                >
                  <Image
                    source={{ uri: provider.icon }}
                    style={styles.iconImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.option}>
                  <View>
                    <Text style={styles.optionTitle}>{providersDisplayInfo[provider.id].name}</Text>
                    {!provider.restricted && !provider.paymentMethods.includes(paymentMethod) ? (
                      <Text style={styles.restrictedText}>
                        {t('unsupportedPaymentMethod', {
                          paymentMethod:
                            paymentMethod === PaymentMethod.BANK
                              ? 'bank account'
                              : 'debit or credit card',
                        })}
                      </Text>
                    ) : (
                      <Text style={styles.optionFeesData}>Fee: $3.99 or 4.5%</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.optionTitle}>
                      {providerFees[provider.id] ? (
                        <CurrencyDisplay
                          amount={{
                            value: 0,
                            localAmount: {
                              value: providerFees[provider.id],
                              currencyCode: localCurrency,
                              exchangeRate: 1,
                            },
                            currencyCode: localCurrency,
                          }}
                          hideSymbol={false}
                          showLocalAmount={true}
                          hideSign={true}
                          showExplicitPositiveSign={false}
                          style={[styles.optionTitle]}
                        />
                      ) : (
                        '-'
                      )}{' '}
                      fee
                    </Text>
                  </View>
                  {/*
=======
          {providers[isCashIn ? 'cashIn' : 'cashOut'].map((provider) => (
            <ListItem key={provider.id} onPress={providerOnPress(provider)}>
              <View style={styles.providerListItem} testID={`Provider/${provider.id}`}>
                <View style={styles.providerTextContainer}>
                  <Text style={styles.optionTitle}>{providersDisplayInfo[provider.id].name}</Text>
                  {provider.restricted && (
                    <Text style={styles.restrictedText}>{t('restrictedRegion')}</Text>
                  )}
                  {!provider.restricted && !provider.paymentMethods.includes(paymentMethod) && (
                    <Text style={styles.restrictedText}>
                      {t('unsupportedPaymentMethod', {
                        paymentMethod:
                          paymentMethod === PaymentMethod.BANK
                            ? 'bank account'
                            : 'debit or credit card',
                      })}
                    </Text>
                  )}
>>>>>>> main
*/}
                </View>
              </View>
            </ListItem>
          ))}
        </View>
        <Dialog
          title={t('explanationModal.title')}
          isVisible={showingExplanation}
          actionText={t('global:dismiss')}
          actionPress={onDismissExplanation}
        >
          {t('explanationModal.body')}
        </Dialog>
      </SafeAreaView>
    </ScrollView>
  )
}

export default ProviderOptionsScreen

const styles = StyleSheet.create({
  container: {
    paddingVertical: variables.contentPadding,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    marginRight: variables.contentPadding,
  },
  pleaseSelectProvider: {
    ...fontStyles.regular,
    marginBottom: variables.contentPadding,
    paddingLeft: variables.contentPadding,
  },
  iconContainer: {
    height: 48,
    width: 48,
    borderRadius: 48 / 2,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconImage: {
    height: 28,
    width: 28,
  },
  provider: {
    marginVertical: 24,
  },
  providersContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  separator: {
    height: 1,
    width: '100%',
    backgroundColor: colors.gray2,
  },
  providerListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerTextContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  restrictedText: {
    ...fontStyles.small,
    color: colors.gray4,
  },
  optionTitle: {
    ...fontStyles.regular500,
  },
  optionFeesData: {
    ...fontStyles.small,
    color: colors.gray4,
    marginTop: 4,
  },
  option: {
    display: 'flex',
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingLeft: 8,
  },
})
