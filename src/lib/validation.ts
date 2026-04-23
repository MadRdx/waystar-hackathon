export function luhnIsValid(cardNumber: string) {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function routingNumberIsValid(routingNumber: string) {
  const digits = routingNumber.replace(/\D/g, "");
  if (digits.length !== 9) {
    return false;
  }

  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const checksum = digits
    .split("")
    .reduce((sum, char, index) => sum + Number(char) * weights[index], 0);

  return checksum % 10 === 0;
}

export function expiryIsValid(expiryMonth: number, expiryYear: number) {
  if (expiryMonth < 1 || expiryMonth > 12) {
    return false;
  }

  const current = new Date();
  const normalizedYear = expiryYear > 100 ? expiryYear : 2000 + expiryYear;
  return (
    normalizedYear > current.getFullYear() ||
    (normalizedYear === current.getFullYear() && expiryMonth >= current.getMonth() + 1)
  );
}

export function glCodeIsValid(value: string) {
  return /^[A-Z0-9-]{2,20}$/.test(value.trim().toUpperCase());
}
