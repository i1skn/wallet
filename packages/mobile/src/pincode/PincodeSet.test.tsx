import * as React from 'react'
import { fireEvent, flushMicrotasksQueue, render } from 'react-native-testing-library'
import { Provider } from 'react-redux'
import { navigateClearingStack, navigateHome } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import PincodeSet from 'src/pincode/PincodeSet'
import { createMockStore, getMockStackScreenProps } from 'test/utils'

const mockPin = '112233'

describe('Pincode', () => {
  const mockDispatch = jest.fn()
  let dispatchSpy: any
  beforeAll(() => {
    dispatchSpy = jest
      .spyOn(getMockStackScreenProps(Screens.PincodeSet).navigation, 'dispatch')
      .mockImplementation(mockDispatch)
  })

  afterAll(() => dispatchSpy.mockRestore())

  it('renders correctly', () => {
    const mockScreenProps = getMockStackScreenProps(Screens.PincodeSet)
    const mockStore = createMockStore()

    const { toJSON } = render(
      <Provider store={mockStore}>
        <PincodeSet {...mockScreenProps} />
      </Provider>
    )

    // initial render shows pin enter screen
    expect(toJSON()).toMatchSnapshot()
  })

  it('navigates to the VerificationEducationScreen screen after successfully verifying', async () => {
    const mockScreenProps = getMockStackScreenProps(Screens.PincodeSet, { komenciAvailable: true })
    const mockStore = createMockStore({
      app: {
        hideVerification: false,
      },
    })

    const { getByTestId, rerender } = render(
      <Provider store={mockStore}>
        <PincodeSet {...mockScreenProps} />
      </Provider>
    )

    // Create pin
    mockPin.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()
    expect(mockScreenProps.navigation.setParams).toBeCalledWith({ isVerifying: true })

    rerender(
      <Provider store={mockStore}>
        <PincodeSet
          {...getMockStackScreenProps(Screens.PincodeSet, {
            isVerifying: true,
            komenciAvailable: true,
          })}
        />
      </Provider>
    )

    // Verify pin
    mockPin.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()

    expect(navigateClearingStack).toBeCalledWith(Screens.VerificationEducationScreen)
  })

  it('navigates home if Komenci is unavailable or verification is disabled', async () => {
    const mockScreenProps = getMockStackScreenProps(Screens.PincodeSet, { komenciAvailable: false })
    const mockStore = createMockStore({
      app: {
        hideVerification: true,
      },
    })

    const { getByTestId, rerender } = render(
      <Provider store={mockStore}>
        <PincodeSet {...mockScreenProps} />
      </Provider>
    )

    // Create pin
    mockPin.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()
    expect(mockScreenProps.navigation.setParams).toBeCalledWith({ isVerifying: true })

    rerender(
      <Provider store={mockStore}>
        <PincodeSet {...getMockStackScreenProps(Screens.PincodeSet, { isVerifying: true })} />
      </Provider>
    )

    // Verify pin
    mockPin.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()

    expect(navigateHome).toBeCalled()
  })

  it("displays an error text when the pins don't match", async () => {
    const mockScreenProps = getMockStackScreenProps(Screens.PincodeSet)
    const mockStore = createMockStore()

    const { getByTestId, getByText, rerender } = render(
      <Provider store={mockStore}>
        <PincodeSet {...mockScreenProps} />
      </Provider>
    )

    // Create pin
    mockPin.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()
    expect(mockScreenProps.navigation.setParams).toBeCalledWith({ isVerifying: true })

    rerender(
      <Provider store={mockStore}>
        <PincodeSet {...getMockStackScreenProps(Screens.PincodeSet, { isVerifying: true })} />
      </Provider>
    )

    // Verify with incorrect pin
    '555555'.split('').forEach((number) => fireEvent.press(getByTestId(`digit${number}`)))
    jest.runAllTimers()
    await flushMicrotasksQueue()
    expect(getByText('pincodeSet.pinsDontMatch')).toBeDefined()
  })
})
