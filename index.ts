interface FlattenOptions {
  delimiter?: string | undefined;
  safe?: boolean | undefined;
  maxDepth?: number | undefined;
  transformKey?: ((key: string) => string) | undefined;
}

interface UnflattenOptions {
  delimiter?: string | undefined;
  object?: boolean | undefined;
  overwrite?: boolean | undefined;
  transformKey?: ((key: string) => string) | undefined;
}

interface anyObject {
  [x: string]: any;
}

function isBuffer(obj: any) {
  return (
    obj &&
    obj.constructor &&
    typeof obj.constructor.isBuffer === "function" &&
    obj.constructor.isBuffer(obj)
  );
}

function keyIdentity(key: string) {
  return key;
}

// function flatten(target: object, opts: FlattenOptions = {}): object {}

function flatten(target: anyObject, opts: FlattenOptions = {}): anyObject {
  const delimiter = opts.delimiter || ".";
  const maxDepth = opts.maxDepth || 0;
  const transformKey = opts.transformKey || keyIdentity;
  const output: anyObject = {};

  function step(object: anyObject, prev: string, inputCurrentDepth: number) {
    const currentDepth = inputCurrentDepth || 1;
    Object.keys(object).forEach(function (key) {
      const value = object[key];
      const isarray = opts.safe && Array.isArray(value);
      const type = Object.prototype.toString.call(value);
      const isbuffer = isBuffer(value);
      const isobject = type === "[object Object]" || type === "[object Array]";

      const newKey = prev
        ? prev + delimiter + transformKey(key)
        : transformKey(key);

      if (
        !isarray &&
        !isbuffer &&
        isobject &&
        Object.keys(value).length &&
        (!maxDepth || currentDepth < maxDepth)
      ) {
        return step(value, newKey, currentDepth + 1);
      }

      output[newKey] = value;
    });
  }

  step(target, "", 1);

  return output;
}

function unflatten(target: anyObject, opts: UnflattenOptions = {}): anyObject {
  const delimiter = opts.delimiter || ".";
  const overwrite = opts.overwrite || false;
  const transformKey = opts.transformKey || keyIdentity;
  const result: anyObject = {};

  const isbuffer = isBuffer(target);
  if (
    isbuffer ||
    Object.prototype.toString.call(target) !== "[object Object]"
  ) {
    return target;
  }

  function addKeys(keyPrefix: string, recipient: {}, target: anyObject) {
    return Object.keys(target).reduce(function (
      result: anyObject,
      key: string
    ) {
      result[keyPrefix + delimiter + key] = target[key];

      return result;
    },
    recipient);
  }

  function isEmpty(val: string | any[]) {
    const type = Object.prototype.toString.call(val);
    const isArray = type === "[object Array]";
    const isObject = type === "[object Object]";

    if (!val) {
      return true;
    } else if (isArray) {
      return !val.length;
    } else if (isObject) {
      return !Object.keys(val).length;
    }
  }

  const transformTarget = Object.keys(target).reduce(function (
    result: anyObject,
    key: string
  ) {
    const type = Object.prototype.toString.call(target[key]);
    const isObject = type === "[object Object]" || type === "[object Array]";
    if (!isObject || isEmpty(target[key])) {
      result[key] = target[key];
      return result;
    } else {
      return addKeys(key, result, flatten(target[key], opts));
    }
  },
  {});

  Object.keys(transformTarget).forEach(function (key: string) {
    const split: string[] = key.split(delimiter).map(transformKey);
    let key1: string = split.shift() as string;
    let key2: string = split[0];
    let recipient = result;

    while (key2 !== undefined) {
      if (key1 === "__proto__") {
        return;
      }

      const type = Object.prototype.toString.call(recipient[key1]);
      const isobject = type === "[object Object]" || type === "[object Array]";

      // do not write over falsey, non-undefined values if overwrite is false
      if (!overwrite && !isobject && typeof recipient[key1] !== "undefined") {
        return;
      }

      if ((overwrite && !isobject) || (!overwrite && recipient[key1] == null)) {
        recipient[key1] = !isNaN(Number(key2)) && !opts.object ? [] : {};
      }

      recipient = recipient[key1];
      if (split.length > 0) {
        key1 = split.shift() as string;
        key2 = split[0];
      }
    }

    // unflatten again for 'messy objects'
    recipient[key1] = unflatten(transformTarget[key], opts);
  });

  return result;
}

export { flatten, unflatten };
