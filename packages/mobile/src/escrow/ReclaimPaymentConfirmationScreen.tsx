import ReviewFrame from '@celo/react-components/components/ReviewFrame'
import ReviewHeader from '@celo/react-components/components/ReviewHeader'
import colors from '@celo/react-components/styles/colors'
import { CURRENCY_ENUM } from '@celo/utils/lib/currencies'
import { StackScreenProps } from '@react-navigation/stack'
import * as React from 'react'
import { WithTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { connect } from 'react-redux'
import { showError } from 'src/alert/actions'
import { EscrowEvents } from 'src/analytics/Events'
import ValoraAnalytics from 'src/analytics/ValoraAnalytics'
import { ErrorMessages } from 'src/app/ErrorMessages'
import { reclaimEscrowPayment, reclaimEscrowPaymentCancel } from 'src/escrow/actions'
import ReclaimPaymentConfirmationCard from 'src/escrow/ReclaimPaymentConfirmationCard'
import { FeeType } from 'src/fees/actions'
import CalculateFee, { CalculateFeeChildren } from 'src/fees/CalculateFee'
import { getFeeInTokens } from 'src/fees/selectors'
import { Namespaces, withTranslation } from 'src/i18n'
import { navigateBack } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import { StackParamList } from 'src/navigator/types'
import { RootState } from 'src/redux/reducers'
import { isAppConnected } from 'src/redux/selectors'
import DisconnectBanner from 'src/shared/DisconnectBanner'
import { divideByWei } from 'src/utils/formatting'
import Logger from 'src/utils/Logger'
import { currentAccountSelector } from 'src/web3/selectors'

const TAG = 'escrow/ReclaimPaymentConfirmationScreen'

interface StateProps {
  isReclaiming: boolean
  e164PhoneNumber: string | null
  account: string | null
  dollarBalance: string
  celoBalance: string
  appConnected: boolean
}

interface DispatchProps {
  reclaimPayment: typeof reclaimEscrowPayment
  reclaimEscrowPaymentCancel: typeof reclaimEscrowPaymentCancel
  showError: typeof showError
}

type ScreenProps = StackScreenProps<StackParamList, Screens.ReclaimPaymentConfirmationScreen>

const mapDispatchToProps = {
  reclaimPayment: reclaimEscrowPayment,
  reclaimEscrowPaymentCancel,
  showError,
}

const mapStateToProps = (state: RootState): StateProps => {
  return {
    isReclaiming: state.escrow.isReclaiming,
    e164PhoneNumber: state.account.e164PhoneNumber,
    account: currentAccountSelector(state),
    dollarBalance: state.stableToken.balance || '0',
    celoBalance: state.goldToken.balance || '0',
    appConnected: isAppConnected(state),
  }
}

type Props = DispatchProps & StateProps & WithTranslation & ScreenProps

class ReclaimPaymentConfirmationScreen extends React.Component<Props> {
  componentDidMount() {
    this.props.navigation.addListener('beforeRemove', () => {
      if (this.props.isReclaiming) {
        this.props.reclaimEscrowPaymentCancel()
        ValoraAnalytics.track(EscrowEvents.escrow_reclaim_cancel)
      }
    })
  }

  getReclaimPaymentInput() {
    const reclaimPaymentInput = this.props.route.params.reclaimPaymentInput
    if (!reclaimPaymentInput) {
      throw new Error('Reclaim payment input missing')
    }
    return reclaimPaymentInput
  }

  onConfirm = async () => {
    const escrowedPayment = this.getReclaimPaymentInput()
    ValoraAnalytics.track(EscrowEvents.escrow_reclaim_confirm)
    const address = this.props.account
    if (!address) {
      throw new Error("Can't reclaim funds without a valid account")
    }

    try {
      this.props.reclaimPayment(escrowedPayment.paymentID)
    } catch (error) {
      Logger.error(TAG, 'Reclaiming escrowed payment failed, show error message', error)
      this.props.showError(ErrorMessages.RECLAIMING_ESCROWED_PAYMENT_FAILED)
      return
    }
  }

  onCancel = () => {
    navigateBack()
  }

  renderHeader = () => {
    const { t } = this.props
    const title = t('reclaimPayment')
    return <ReviewHeader title={title} />
  }

  renderFooter = () => {
    return this.props.isReclaiming ? (
      <ActivityIndicator size="large" color={colors.greenBrand} />
    ) : null
  }

  renderWithAsyncFee: CalculateFeeChildren = (asyncFee) => {
    const { t, isReclaiming, appConnected, dollarBalance, celoBalance } = this.props
    const payment = this.getReclaimPaymentInput()
    const fee = getFeeInTokens(asyncFee.result?.fee)
    // TODO: Although this is configured to display fees in CELO, the currency and fee is not yet
    // plumbed through the rest of the system to ensure it actually pays for the fees in CELO if
    // selected.
    const feeCurrency = asyncFee.result?.currency
    const convertedAmount = divideByWei(payment.amount.valueOf())
    const userHasEnough = fee?.isLessThanOrEqualTo(
      feeCurrency === CURRENCY_ENUM.DOLLAR ? dollarBalance : celoBalance
    )

    return (
      <SafeAreaView style={styles.container}>
        <DisconnectBanner />
        <ReviewFrame
          HeaderComponent={this.renderHeader}
          FooterComponent={this.renderFooter}
          confirmButton={{
            action: this.onConfirm,
            text: t('global:confirm'),
            disabled:
              isReclaiming ||
              !userHasEnough ||
              !appConnected ||
              asyncFee.loading ||
              !!asyncFee.error,
          }}
          modifyButton={{ action: this.onCancel, text: t('cancel'), disabled: isReclaiming }}
        >
          <ReclaimPaymentConfirmationCard
            recipientPhone={payment.recipientPhone}
            recipientContact={
              undefined /* TODO get recipient contact details from recipient cache*/
            }
            amount={convertedAmount}
            currency={CURRENCY_ENUM.DOLLAR} // User can only request in Dollars
            feeInfo={asyncFee.result}
            isLoadingFee={asyncFee.loading}
            feeError={asyncFee.error}
          />
        </ReviewFrame>
      </SafeAreaView>
    )
  }

  render() {
    const { account } = this.props
    if (!account) {
      throw Error('Account is required')
    }

    const payment = this.getReclaimPaymentInput()

    return (
      // Note: intentionally passing a new child func here otherwise
      // it doesn't re-render on state change since CalculateFee is a pure component
      <CalculateFee
        feeType={FeeType.RECLAIM_ESCROW}
        account={account}
        paymentID={payment.paymentID}
      >
        {(asyncFee) => this.renderWithAsyncFee(asyncFee)}
      </CalculateFee>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
})

export default connect<StateProps, DispatchProps, {}, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation<Props>(Namespaces.sendFlow7)(ReclaimPaymentConfirmationScreen))
