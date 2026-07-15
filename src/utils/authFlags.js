export let manualLogin = false;

export function setManualLogin(value) {
  manualLogin = value;
}

export function consumeManualLogin() {
  const value = manualLogin;
  manualLogin = false;
  return value;
}
