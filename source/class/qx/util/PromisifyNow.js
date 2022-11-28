qx.Class.define("qx.util.PromisifyNow", {
  statics: {
    /**
     * Resolves a value if necessary and calls the callback; if the value is not a
     * promise, the callback will be called immediately (and not asynchronously).
     *
     * This is useful when handling situations where there *may* be a promise, but
     * it is not desirable to always treat a value as a promise; for example, when
     * event handling if a value is treated as a promise then the callback is always
     * async and the caller has to know to treat it as such (and pass the promise
     * chain back).  It should be the caller's decision to create a promise and then
     * they know they have to track it; this code will only treat the value as a promise
     * if really necessary, preferring traditional synchronous code
     *
     * @param value {Object} the value to check
     * @param cb {Function} function to call, passed the resolved value
     * @returns whatever `cb` returns, or a promise if `value` is a promise
     */
    resolveNow(value, cb, cberr) {
      if (!cb) {
        cb = value => value;
      }
      if (qx.Promise.isPromise(value)) {
        let p = value.then(cb);
        if (cberr) {
          p = p.catch(cberr);
        }
        return p;
      } else if (cberr) {
        try {
          return cb(value);
        } catch (ex) {
          cberr(ex);
        }
      } else {
        return cb(value);
      }
    },

    /**
     * Performs forEach on the value, returning a promise only if one of the calls to the callback
     * returned a promise
     *
     * @param {Array|qx.data.Array} value
     * @param {Function} fn called on each element of the array
     * @param cb {Function} function to call, passed the resolved value
     * @param {Error} cberr called if there is an exception
     * @returns whatever `cb` returns, or a promise if `value` is a promise
     */
    forEachNow(value, fn, cb, cberr) {
      let promise = null;
      value.forEach(value => {
        if (promise) {
          promise = promise.then(() => fn(value));
        } else {
          let tmp = fn(value);
          if (qx.Promise.isPromise(tmp)) {
            promise = tmp;
          }
        }
      });
      return qx.util.PromisifyNow.resolveNow(promise, cb, cberr);
    },

    /**
     * Resolves all values in an array if necessary and calls the callback; if the value
     * is not a promise, the callback will be called immediately (and not asynchronously).
     *
     * This is useful when handling situations where there *may* be a promise, but
     * it is not desirable to always treat a value as a promise; for example, when
     * event handling if a value is treated as a promise then the callback is always
     * async and the caller has to know to treat it as such (and pass the promise
     * chain back).  It should be the caller's decision to create a promise and then
     * they know they have to track it; this code will only treat the value as a promise
     * if really necessary, preferring traditional synchronous code
     *
     * @param value {Object} the value to check
     * @param cb {Function} function to call, passed the resolved value
     * @returns whatever `cb` returns, or a promise if `value` is a promise
     */
    allNow(arr, cb, cberr) {
      if (arr.some(value => qx.Promise.isPromise(value)))
        return qx.util.PromisifyNow.chain(qx.Promise.all(arr), cb, cberr);
      return cb ? cb(arr) : arr;
    },

    /**
     * Resolves all values in a map of values if necessary and calls the callback; if the value
     * is not a promise, the callback will be called immediately (and not asynchronously).
     *
     * This is useful when handling situations where there *may* be a promise, but
     * it is not desirable to always treat a value as a promise; for example, when
     * event handling if a value is treated as a promise then the callback is always
     * async and the caller has to know to treat it as such (and pass the promise
     * chain back).  It should be the caller's decision to create a promise and then
     * they know they have to track it; this code will only treat the value as a promise
     * if really necessary, preferring traditional synchronous code
     *
     * @param value {Object} the value to check
     * @param cb {Function} function to call, passed the resolved value
     * @returns whatever `cb` returns, or a promise if `value` is a promise
     */
    allMapValuesNow(map, cb, cberr) {
      let arr = Object.values(map);
      if (arr.some(value => qx.Promise.isPromise(value))) {
        let promises = [];
        Object.keys(map).forEach(key => {
          let value = map[key];
          if (qx.Promise.isPromise(value)) {
            promises.push(
              qx.Promise.resolve(value).then(result => (map[key] = result))
            );
          }
        });
        return qx.util.PromisifyNow.chain(
          qx.Promise.all(promises).then(() => map),
          cb,
          cberr
        );
      }
      return cb ? cb(map) : map;
    },

    /**
     * Resolves all values in an array (if the value is a promise), and passes each to the
     * `fn` function; the result of the function is also resolved if it is a promise.  The
     * return values of the function are stored in a corresponding array and that array is
     * returned (via a promise if any of the values or function return values are promises).
     *
     * @param {Object[]} arr array to iterate
     * @param {Function} fn function to call for each value in teh array
     * @param {Function?} cberr function to call if there is an error
     * @returns {Object[]}
     */
    mapEachNow(arr, fn, cberr) {
      arr = qx.lang.Array.clone(arr);
      let index = 0;

      async function completeAsync() {
        for (; index < arr.length; index++) {
          let item = arr[index];
          item = await qx.Promise.resolve(item);
          let result = await fn(item);
          arr[index] = result;
        }
        return arr;
      }

      let promise = null;
      for (; index < arr.length; index++) {
        let item = arr[index];
        if (qx.Promise.isPromise(item)) {
          promise = completeAsync();
          break;
        }
        let result;
        try {
          result = fn(item);
        } catch (ex) {
          if (cberr) {
            return cberr(ex);
          } else {
            throw ex;
          }
        }
        if (qx.Promise.isPromise(result)) {
          promise = result
            .then(value => {
              arr[index] = value;
              index++;
              return completeAsync();
            })
            .then(completeAsync);
          break;
        }
        arr[index] = result;
      }

      if (promise && cberr) {
        promise = promise.catch(cberr);
      }

      return promise || arr;
    }
  }
});
