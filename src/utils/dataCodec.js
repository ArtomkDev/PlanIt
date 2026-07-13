const STORAGE_PREFIX = "PZ1:";
const URI_SAFE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
const baseReverseDic = Object.create(null);

const getBaseValue = (alphabet, character) => {
  if (!baseReverseDic[alphabet]) {
    baseReverseDic[alphabet] = Object.create(null);
    for (let i = 0; i < alphabet.length; i += 1) {
      baseReverseDic[alphabet][alphabet.charAt(i)] = i;
    }
  }
  return baseReverseDic[alphabet][character];
};

const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);

const compress = (input, bitsPerChar, getCharFromInt) => {
  if (input == null) return "";

  let value;
  const dictionary = Object.create(null);
  const dictionaryToCreate = Object.create(null);
  let c = "";
  let wc = "";
  let w = "";
  let enlargeIn = 2;
  let dictSize = 3;
  let numBits = 2;
  const data = [];
  let dataValue = 0;
  let dataPosition = 0;

  const writeBit = (bit) => {
    dataValue = (dataValue << 1) | bit;
    if (dataPosition === bitsPerChar - 1) {
      dataPosition = 0;
      data.push(getCharFromInt(dataValue));
      dataValue = 0;
    } else {
      dataPosition += 1;
    }
  };

  const writeValue = (bitCount, nextValue) => {
    value = nextValue;
    for (let i = 0; i < bitCount; i += 1) {
      writeBit(value & 1);
      value >>= 1;
    }
  };

  const bumpWidth = () => {
    enlargeIn -= 1;
    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }
  };

  for (let ii = 0; ii < input.length; ii += 1) {
    c = input.charAt(ii);
    if (!hasOwn(dictionary, c)) {
      dictionary[c] = dictSize;
      dictSize += 1;
      dictionaryToCreate[c] = true;
    }

    wc = w + c;
    if (hasOwn(dictionary, wc)) {
      w = wc;
    } else {
      if (hasOwn(dictionaryToCreate, w)) {
        if (w.charCodeAt(0) < 256) {
          writeValue(numBits, 0);
          writeValue(8, w.charCodeAt(0));
        } else {
          writeValue(numBits, 1);
          writeValue(16, w.charCodeAt(0));
        }
        bumpWidth();
        delete dictionaryToCreate[w];
      } else {
        writeValue(numBits, dictionary[w]);
      }

      bumpWidth();
      dictionary[wc] = dictSize;
      dictSize += 1;
      w = String(c);
    }
  }

  if (w !== "") {
    if (hasOwn(dictionaryToCreate, w)) {
      if (w.charCodeAt(0) < 256) {
        writeValue(numBits, 0);
        writeValue(8, w.charCodeAt(0));
      } else {
        writeValue(numBits, 1);
        writeValue(16, w.charCodeAt(0));
      }
      bumpWidth();
      delete dictionaryToCreate[w];
    } else {
      writeValue(numBits, dictionary[w]);
    }
    bumpWidth();
  }

  writeValue(numBits, 2);

  while (true) {
    dataValue <<= 1;
    if (dataPosition === bitsPerChar - 1) {
      data.push(getCharFromInt(dataValue));
      break;
    }
    dataPosition += 1;
  }

  return data.join("");
};

const decompress = (length, resetValue, getNextValue) => {
  const dictionary = [];
  let next;
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = "";
  const result = [];
  let i;
  let w;
  let bits;
  let resb;
  let maxpower;
  let power;
  let c;
  const data = { val: getNextValue(0), position: resetValue, index: 1 };

  const readBits = (bitCount) => {
    bits = 0;
    maxpower = Math.pow(2, bitCount);
    power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index);
        data.index += 1;
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  };

  for (i = 0; i < 3; i += 1) {
    dictionary[i] = i;
  }

  next = readBits(2);
  switch (next) {
    case 0:
      c = String.fromCharCode(readBits(8));
      break;
    case 1:
      c = String.fromCharCode(readBits(16));
      break;
    case 2:
      return "";
    default:
      return null;
  }

  dictionary[3] = c;
  w = c;
  result.push(c);

  while (true) {
    if (data.index > length) return "";

    c = readBits(numBits);
    switch (c) {
      case 0:
        dictionary[dictSize] = String.fromCharCode(readBits(8));
        c = dictSize;
        dictSize += 1;
        enlargeIn -= 1;
        break;
      case 1:
        dictionary[dictSize] = String.fromCharCode(readBits(16));
        c = dictSize;
        dictSize += 1;
        enlargeIn -= 1;
        break;
      case 2:
        return result.join("");
      default:
        break;
    }

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }

    if (dictionary[c] !== undefined) {
      entry = dictionary[c];
    } else if (c === dictSize) {
      entry = w + w.charAt(0);
    } else {
      return null;
    }

    result.push(entry);
    dictionary[dictSize] = w + entry.charAt(0);
    dictSize += 1;
    enlargeIn -= 1;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }
  }
};

const compressToUriSafe = (input) => (
  compress(input, 6, (value) => URI_SAFE_ALPHABET.charAt(value))
);

const decompressFromUriSafe = (input) => {
  if (input == null) return "";
  if (input === "") return null;
  const normalized = String(input).replace(/ /g, "+");
  return decompress(normalized.length, 32, (index) => getBaseValue(URI_SAFE_ALPHABET, normalized.charAt(index)));
};

export const isEncodedStorageValue = (value) => (
  typeof value === "string" && value.startsWith(STORAGE_PREFIX)
);

export const encodeStorageValue = (value) => {
  const json = JSON.stringify(value ?? null);
  return `${STORAGE_PREFIX}${compressToUriSafe(json)}`;
};

export const decodeStorageValue = (rawValue, fallback = null) => {
  if (rawValue === undefined || rawValue === null) return fallback;

  try {
    if (isEncodedStorageValue(rawValue)) {
      const decompressed = decompressFromUriSafe(rawValue.slice(STORAGE_PREFIX.length));
      return decompressed ? JSON.parse(decompressed) : fallback;
    }

    if (typeof rawValue === "string") {
      return JSON.parse(rawValue);
    }

    return rawValue;
  } catch (error) {
    console.warn("Failed to decode stored data", error);
    return fallback;
  }
};

export const encodedStoragePrefix = STORAGE_PREFIX;
