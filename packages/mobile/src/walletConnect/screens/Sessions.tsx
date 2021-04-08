import colors from '@celo/react-components/styles/colors'
import fontStyles from '@celo/react-components/styles/fonts'
import variables from '@celo/react-components/styles/variables'
import { AppMetadata, SessionTypes } from '@walletconnect/types'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, Text, View } from 'react-native'
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler'
import { useDispatch, useSelector } from 'react-redux'
import Dialog from 'src/components/Dialog'
import i18n, { Namespaces } from 'src/i18n'
import { headerWithBackButton } from 'src/navigator/Headers'
import { navigate } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import { TopBarTextButton } from 'src/navigator/TopBarButton'
import { closeSession as closeSessionAction } from 'src/walletConnect/actions'
import { selectSessions } from 'src/walletConnect/selectors'

const App = ({ metadata, onPress }: { metadata: AppMetadata; onPress: () => void }) => {
  const icon = metadata.icons[0] || `${metadata.url}/favicon.ico`
  const { t } = useTranslation(Namespaces.walletConnect)

  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingBottom: 24 }}
      >
        <Image source={{ uri: icon }} height={40} width={40} style={{ height: 40, width: 40 }} />
        <View
          style={{
            paddingLeft: 12,
          }}
        >
          <Text
            style={{
              ...fontStyles.regular,
              color: colors.dark,
            }}
          >
            {metadata.name}
          </Text>
          <Text
            style={{
              ...fontStyles.small,
              color: colors.gray4,
            }}
          >
            {t('tapToDisconnect')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function WalletConnectSessionsScreen() {
  const { t } = useTranslation(Namespaces.walletConnect)
  const { sessions } = useSelector(selectSessions)
  const [highlighted, setHighlighted] = useState<SessionTypes.Settled | null>(null)
  const dispatch = useDispatch()

  const closeModal = () => {
    setHighlighted(null)
  }

  const openModal = (session: SessionTypes.Settled) => () => {
    setHighlighted(session)
  }

  const closeSession = () => {
    if (!highlighted) {
      return
    }

    dispatch(closeSessionAction(highlighted))
    closeModal()
  }

  return (
    <ScrollView testID="WalletConnectSessionsView">
      <View style={styles.container}>
        <Text style={styles.title}>{t('sessionsTitle')}</Text>
        <Text style={styles.subTitle}>{t('sessionsSubTitle')}</Text>
      </View>

      <View style={[styles.container, { paddingVertical: 24 }]}>
        <Dialog
          title={t('disconnectTitle', { appName: highlighted?.peer.metadata.name })}
          actionPress={closeSession}
          actionText={t('disconnect')}
          secondaryActionText={t('cancel')}
          secondaryActionPress={closeModal}
          isVisible={!!highlighted}
        >
          {t('disconnectBody', { appName: highlighted?.peer.metadata.name })}
        </Dialog>

        <View style={{ display: 'flex' }}>
          {sessions.map((s) => {
            return <App key={s.topic} metadata={s.peer.metadata} onPress={openModal(s)} />
          })}
        </View>
      </View>
    </ScrollView>
  )
}

function HeaderRight() {
  const onPress = () =>
    navigate(Screens.QRNavigator, {
      screen: Screens.QRScanner,
    })

  return <TopBarTextButton title={i18n.t('global:scan')} testID="ScanButton" onPress={onPress} />
}

WalletConnectSessionsScreen.navigationOptions = () => {
  return {
    ...headerWithBackButton,
    headerRight: HeaderRight,
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: variables.contentPadding,
  },
  title: {
    ...fontStyles.h2,
    marginTop: 16,
  },
  subTitle: {
    ...fontStyles.regular,
    color: colors.dark,
    paddingVertical: 16,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: 12,
  },
})

export default WalletConnectSessionsScreen
