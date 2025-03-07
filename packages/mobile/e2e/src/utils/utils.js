const childProcess = require('child_process')

function exec(command, options = { cwd: process.cwd() }) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, { ...options }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout
        err.stderr = stderr
        reject(err)
        return
      }

      resolve({ stdout, stderr })
    })
  })
}
export const DEFAULT_PIN = '112233'

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export function timeout(asyncFunc, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError('Timeout after ' + ms + ' ms'))
    }, ms)

    asyncFunc()
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer)
      })
  })
}

export async function skipTo(nextScreen) {
  const testID = `ButtonSkipTo${nextScreen}`
  try {
    await waitFor(element(by.id(testID)))
      .toBeVisible()
      .withTimeout(1000)
    await element(by.id(testID)).tap()
  } catch (error) {
    throw error
  }
}

export async function enterPinUi() {
  await expect(element(by.id(`digit1`))).toBeVisible()

  for (const digit of DEFAULT_PIN) {
    //await expect(element(by.text(digit))).toBeVisible()
    await element(by.id(`digit${digit}`)).tap()
  }
}

export async function enterPinUiIfNecessary() {
  if (await isElementVisible('digit1')) {
    await enterPinUi()
  }
}

export async function inputNumberKeypad(amount) {
  const amountStr = '' + amount
  for (const digit of amountStr) {
    await element(by.id(`digit${digit}`)).tap()
  }
}

export async function isElementVisible(elementId) {
  try {
    await expect(element(by.id(elementId))).toBeVisible()
    return true
  } catch (e) {
    return false
  }
}

export async function waitForElementId(elementId) {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .withTimeout(10000)
}

export function quote(s) {
  // on ios the command line uses double quotes around the string
  // while on android it does not, so we add it
  return device.getPlatform() === 'ios' ? s : `"${s}"`
}
