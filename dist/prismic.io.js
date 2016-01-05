(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":9,"isarray":4}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Moved Temporarily",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Time-out",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Large",
  "415": "Unsupported Media Type",
  "416": "Requested Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Time-out",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],6:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})

},{"../../is-buffer/index.js":11}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],8:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":30}],9:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],10:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],11:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],12:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],13:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn) {
  var args = new Array(arguments.length - 1);
  var i = 0;
  while (i < args.length) {
    args[i++] = arguments[i];
  }
  process.nextTick(function afterTick() {
    fn.apply(null, args);
  });
}

}).call(this,require('_process'))

},{"_process":14}],14:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],15:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.0 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],17:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],18:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":16,"./encode":17}],19:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":20}],20:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/



/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

},{"./_stream_readable":22,"./_stream_writable":24,"core-util-is":6,"inherits":10,"process-nextick-args":13}],21:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":23,"core-util-is":6,"inherits":10}],22:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events');

/*<replacement>*/
var EElistenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/



/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function')
    this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}


// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (ret !== null)
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      processNextTick(emitReadable_, stream);
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    processNextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      if (state.pipesCount === 1 &&
          state.pipes[0] === dest &&
          src.listenerCount('data') === 1 &&
          !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];


  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }; }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};


// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else if (list.length === 1)
      ret = list[0];
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))

},{"./_stream_duplex":20,"_process":14,"buffer":3,"core-util-is":6,"events":7,"inherits":10,"isarray":12,"process-nextick-args":13,"string_decoder/":34,"util":2}],23:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function')
      this._transform = options.transform;

    if (typeof options.flush === 'function')
      this._flush = options.flush;
  }

  this.once('prefinish', function() {
    if (typeof this._flush === 'function')
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":20,"core-util-is":6,"inherits":10}],24:[function(require,module,exports){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function (){try {
Object.defineProperty(WritableState.prototype, 'buffer', {
  get: internalUtil.deprecate(function() {
    return this.getBuffer();
  }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});
}catch(_){}}());


var Duplex;
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function')
      this._write = options.write;

    if (typeof options.writev === 'function')
      this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  if (state.ended)
    writeAfterEnd(this, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.bufferedRequest)
      clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string')
    encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
.indexOf((encoding + '').toLowerCase()) > -1))
    throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync)
    processNextTick(cb, er);
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      processNextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var buffer = [];
    var cbs = [];
    while (entry) {
      cbs.push(entry.callback);
      buffer.push(entry);
      entry = entry.next;
    }

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    state.lastBufferedRequest = null;
    doWrite(stream, state, true, state.length, buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null)
      state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined)
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(state) {
  return (state.ending &&
          state.length === 0 &&
          state.bufferedRequest === null &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      processNextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./_stream_duplex":20,"buffer":3,"core-util-is":6,"events":7,"inherits":10,"process-nextick-args":13,"util-deprecate":37}],25:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":21}],26:[function(require,module,exports){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":20,"./lib/_stream_passthrough.js":21,"./lib/_stream_readable.js":22,"./lib/_stream_transform.js":23,"./lib/_stream_writable.js":24}],27:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":23}],28:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":24}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":7,"inherits":10,"readable-stream/duplex.js":19,"readable-stream/passthrough.js":25,"readable-stream/readable.js":26,"readable-stream/transform.js":27,"readable-stream/writable.js":28}],30:[function(require,module,exports){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	var protocol = opts.protocol || ''
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
},{"./lib/request":32,"builtin-status-codes":5,"url":35,"xtend":38}],31:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

var xhr = new global.XMLHttpRequest()
// If location.host is empty, e.g. if this page/worker was loaded
// from a Blob, then use example.com to avoid an error
xhr.open('GET', global.location.host ? '/' : 'https://example.com')

function checkTypeSupport (type) {
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

exports.arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer')
// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')
exports.overrideMimeType = isFunction(xhr.overrideMimeType)
exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
  return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],32:[function(require,module,exports){
(function (process,global,Buffer){
// var Base64 = require('Base64')
var capability = require('./capability')
var inherits = require('inherits')
var response = require('./response')
var stream = require('stream')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary) {
	if (capability.fetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	Object.keys(opts.headers).forEach(function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (unsafeHeaders.indexOf(lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var self = this
	return self._headers[name.toLowerCase()].value
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body
	if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return buffer.toArrayBuffer()
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	if (self._mode === 'fetch') {
		var headers = Object.keys(headersObj).map(function (name) {
			return [headersObj[name].name, headersObj[name].value]
		})

		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headers,
			body: body,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		Object.keys(headersObj).forEach(function (name) {
			xhr.setRequestHeader(headersObj[name].name, headersObj[name].value)
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable. Even though the spec says it should
 * be available in readyState 3, accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		return (xhr.status !== null)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"./capability":31,"./response":33,"_process":14,"buffer":3,"inherits":10,"stream":29}],33:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var stream = require('stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.statusCode = response.status
		self.statusMessage = response.statusText
		// backwards compatible version of for (<item> of <iterable>):
		// for (var <item>,_i,_it = <iterable>[Symbol.iterator](); <item> = (_i = _it.next()).value,!_i.done;)
		for (var header, _i, _it = response.headers[Symbol.iterator](); header = (_i = _it.next()).value, !_i.done;) {
			self.headers[header[0].toLowerCase()] = header[1]
			self.rawHeaders.push(header[0], header[1])
		}

		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		headers.forEach(function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (self.headers[key] !== undefined)
					self.headers[key] += ', ' + matches[2]
				else
					self.headers[key] = matches[2]
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"./capability":31,"_process":14,"buffer":3,"inherits":10,"stream":29}],34:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":3}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":36,"punycode":15,"querystring":18}],36:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],37:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],38:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],39:[function(require,module,exports){
module.exports={
  "name": "prismic.io",
  "description": "JavaScript development kit for prismic.io",
  "license": "Apache-2.0",
  "url": "https://github.com/prismicio/javascript-kit",
  "keywords": [
    "prismic",
    "prismic.io",
    "cms",
    "content",
    "api"
  ],
  "version": "2.0.0",
  "devDependencies": {
    "babel-preset-es2015": "^6.3.13",
    "babelify": "^7.2.0",
    "browserify": "^12.0.1",
    "chai": "*",
    "codeclimate-test-reporter": "~0.0.4",
    "gulp": "~3.9.0",
    "gulp-gh-pages": "~0.5.0",
    "gulp-gist": "~1.0.3",
    "gulp-jsdoc": "~0.1.4",
    "gulp-sourcemaps": "^1.6.0",
    "gulp-uglify": "~1.2.0",
    "gulp-util": "~3.0.6",
    "mocha": "*",
    "source-map-support": "^0.4.0",
    "vinyl-buffer": "^1.0.0",
    "vinyl-source-stream": "^1.1.0"
  },
  "repository": {
    "type": "git",
    "url": "http://github.com/prismicio/javascript-kit.git"
  },
  "main": "src/api.js",
  "scripts": {
    "test": "mocha",
    "lint": "eslint src"
  }
}

},{}],40:[function(require,module,exports){
(function (global){
"use strict";

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

var experiments = require('./experiments'),
    Predicates = require('./predicates'),
    Utils = require('./utils'),
    Fragments = require('./fragments'),
    ApiCache = require('./cache.js'),
    documents = require('./documents');

var Document = documents.Document,
    Experiments = experiments.Experiments;

/**
 * Initialisation of the API object.
 * This is for internal use, from outside this kit, you should call Prismic.Api()
 * @private
 */
function Api(url, accessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
  this.url = url + (accessToken ? (url.indexOf('?') > -1 ? '&' : '?') + 'access_token=' + accessToken : '');
  this.accessToken = accessToken;
  this.apiCache = maybeApiCache || globalCache();
  this.requestHandler = maybeRequestHandler || Utils.request();
  this.apiCacheKey = this.url + (this.accessToken ? '#' + this.accessToken : '');
  this.apiDataTTL = maybeApiDataTTL || 5;
  return this;
}

/**
 * The kit's main entry point; initialize your API like this: Prismic.Api(url, callback, accessToken, maybeRequestHandler)
 *
 * @global
 * @alias Api
 * @constructor
 * @param {string} url - The mandatory URL of the prismic.io API endpoint (like: https://lesbonneschoses.prismic.io/api)
 * @param {function} callback - Optional callback function that is called after the API was retrieved, which will be called with two parameters: a potential error object and the API object
 * @param {string} maybeAccessToken - The accessToken for an OAuth2 connection
 * @param {function} maybeRequestHandler - Environment specific HTTP request handling function
 * @param {object} maybeApiCache - A cache object with get/set functions for caching API responses
 * @param {int} maybeApiDataTTL - How long (in seconds) to cache data used by the client to make calls (e.g. refs). Defaults to 5 seconds
 * @returns {Api} - The Api object that can be manipulated
 */
function getApi(url, callback, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL) {
  var api = new Api(url, maybeAccessToken, maybeRequestHandler, maybeApiCache, maybeApiDataTTL);
  //Use cached api data if available
  api.get(function (err, data) {
    if (callback && err) {
      callback(err);
      return;
    }

    if (data) {
      api.data = data;
      api.bookmarks = data.bookmarks;
      api.experiments = new Experiments(data.experiments);
    }

    if (callback) {
      callback(null, api);
    }
  });

  return api;
}

Api.prototype = {

  // Predicates
  AT: "at",
  ANY: "any",
  SIMILAR: "similar",
  FULLTEXT: "fulltext",
  NUMBER: {
    GT: "number.gt",
    LT: "number.lt"
  },
  DATE: {
    // Other date operators are available: see the documentation.
    AFTER: "date.after",
    BEFORE: "date.before",
    BETWEEN: "date.between"
  },

  // Fragment: usable as the second element of a query array on most predicates (except SIMILAR).
  // You can also use "my.*" for your custom fields.
  DOCUMENT: {
    ID: "document.id",
    TYPE: "document.type",
    TAGS: "document.tags"
  },

  data: null,

  /**
   * Fetches data used to construct the api client, from cache if it's
   * present, otherwise from calling the prismic api endpoint (which is
   * then cached).
   *
   * @param {function} callback - Callback to receive the data
   */
  get: function get(callback) {
    var self = this;
    var cacheKey = this.apiCacheKey;

    this.apiCache.get(cacheKey, function (err, value) {
      if (err || value) {
        callback(err, value);
        return;
      }

      self.requestHandler(self.url, function (err, data, xhr, ttl) {
        if (err) {
          callback(err, null, xhr);
          return;
        }

        var parsed = self.parse(data);
        ttl = ttl || self.apiDataTTL;

        self.apiCache.set(cacheKey, parsed, ttl, function (err) {
          callback(err, parsed, xhr);
        });
      });
    });
  },

  /**
   * Cleans api data from the cache and fetches an up to date copy.
   *
   * @param {function} callback - Optional callback function that is called after the data has been refreshed
   */
  refresh: function refresh(callback) {
    var self = this;
    var cacheKey = this.apiCacheKey;

    this.apiCache.remove(cacheKey, function (err) {
      if (callback && err) {
        callback(err);return;
      }
      if (!callback && err) {
        throw err;
      }

      self.get(function (err, data) {
        if (callback && err) {
          callback(err);return;
        }
        if (!callback && err) {
          throw err;
        }

        self.data = data;
        self.bookmarks = data.bookmarks;
        self.experiments = new Experiments(data.experiments);

        if (callback) {
          callback();
        }
      });
    });
  },

  /**
   * Parses and returns the /api document.
   * This is for internal use, from outside this kit, you should call Prismic.Api()
   *
   * @param {string} data - The JSON document responded on the API's endpoint
   * @returns {Api} - The Api object that can be manipulated
   * @private
   */
  parse: function parse(data) {
    var refs,
        master,
        forms = {},
        form,
        types,
        tags,
        f,
        i;

    // Parse the forms
    for (i in data.forms) {
      if (data.forms.hasOwnProperty(i)) {
        f = data.forms[i];

        if (this.accessToken) {
          f.fields['access_token'] = {};
          f.fields['access_token']['type'] = 'string';
          f.fields['access_token']['default'] = this.accessToken;
        }

        form = new Form(f.name, f.fields, f.form_method, f.rel, f.enctype, f.action);

        forms[i] = form;
      }
    }

    refs = data.refs.map(function (r) {
      return new Ref(r.ref, r.label, r.isMasterRef, r.scheduledAt, r.id);
    }) || [];

    master = refs.filter(function (r) {
      return r.isMaster === true;
    });

    types = data.types;

    tags = data.tags;

    if (master.length === 0) {
      throw "No master ref.";
    }

    return {
      bookmarks: data.bookmarks || {},
      refs: refs,
      forms: forms,
      master: master[0],
      types: types,
      tags: tags,
      experiments: data.experiments,
      oauthInitiate: data['oauth_initiate'],
      oauthToken: data['oauth_token']
    };
  },

  /**
   * @deprecated use form() now
   * @param {string} formId - The id of a form, like "everything", or "products"
   * @returns {SearchForm} - the SearchForm that can be used.
   */
  forms: function forms(formId) {
    return this.form(formId);
  },

  /**
   * Returns a useable form from its id, as described in the RESTful description of the API.
   * For instance: api.form("everything") works on every repository (as "everything" exists by default)
   * You can then chain the calls: api.form("everything").query('[[:d = at(document.id, "UkL0gMuvzYUANCpf")]]').ref(ref).submit()
   *
   * @param {string} formId - The id of a form, like "everything", or "products"
   * @returns {SearchForm} - the SearchForm that can be used.
   */
  form: function form(formId) {
    var form = this.data.forms[formId];
    if (form) {
      return new SearchForm(this, form, {});
    }
    return null;
  },

  /**
   * The ID of the master ref on this prismic.io API.
   * Do not use like this: searchForm.ref(api.master()).
   * Instead, set your ref once in a variable, and call it when you need it; this will allow to change the ref you're viewing easily for your entire page.
   *
   * @returns {string}
   */
  master: function master() {
    return this.data.master.ref;
  },

  /**
   * Returns the ref ID for a given ref's label.
   * Do not use like this: searchForm.ref(api.ref("Future release label")).
   * Instead, set your ref once in a variable, and call it when you need it; this will allow to change the ref you're viewing easily for your entire page.
   *
   * @param {string} label - the ref's label
   * @returns {string}
   */
  ref: function ref(label) {
    for (var i = 0; i < this.data.refs.length; i++) {
      if (this.data.refs[i].label == label) {
        return this.data.refs[i].ref;
      }
    }
    return null;
  },

  /**
   * The current experiment, or null
   * @returns {Experiment}
   */
  currentExperiment: function currentExperiment() {
    return this.experiments.current();
  },

  /**
   * Query the repository
   * @param {string|array|Predicate} the query itself
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  query: function query(q, options, callback) {
    var form = this.form('everything');
    for (var key in options) {
      form = form.set(key, options[key]);
    }
    if (!options['ref']) {
      form = form.ref(this.master());
    }
    return form.query(q).submit(callback);
  },

  /**
   * Retrieve the document with the given id
   * @param {string} id
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByID: function getByID(id, options, callback) {
    return this.query(Predicates.at('document.id', id), options, function (err, response) {
      if (response && response.results.length > 0) {
        callback(err, response.results[0]);
      } else {
        callback(err, null);
      }
    });
  },

  /**
   * Retrieve multiple documents from an array of id
   * @param {array} ids
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByIDs: function getByIDs(ids, options, callback) {
    return this.query(['in', 'document.id', ids], options, callback);
  },

  /**
   * Retrieve the document with the given uid
   * @param {string} type the custom type of the document
   * @param {string} uid
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getByUID: function getByUID(type, uid, options, callback) {
    return this.query(Predicates.at('my.' + type + '.uid', uid), options, function (err, response) {
      if (response && response.results.length > 0) {
        callback(err, response.results[0]);
      } else {
        callback(err, null);
      }
    });
  },

  /**
   * Retrieve the document with the given uid
   * @param {string} type the custom type of the document
   * @param {string} uid
   * @param {object} additional parameters
   * @param {function} callback(err, response)
   */
  getBookmark: function getBookmark(bookmark, options, callback) {
    var id = this.bookmarks[bookmark];
    if (id) {
      this.getById(this.bookmarks[bookmark], options, callback);
    } else {
      callback(new Error("Error retrieving bookmarked id"));
    }
  },

  /**
   * Return the URL to display a given preview
   * @param {string} token as received from Prismic server to identify the content to preview
   * @param {function} linkResolver the link resolver to build URL for your site
   * @param {string} defaultUrl the URL to default to return if the preview doesn't correspond to a document
   *                (usually the home page of your site)
   * @param {function} callback to get the resulting URL
   */
  previewSession: function previewSession(token, linkResolver, defaultUrl, callback) {
    var api = this;
    var Predicates = Predicates;
    this.requestHandler(token, function (err, result, xhr) {
      if (err) {
        callback(err, defaultUrl, xhr);
        return;
      }
      try {
        var mainDocumentId = result.mainDocument;
        if (!mainDocumentId) {
          callback(null, defaultUrl, xhr);
        } else {
          api.form("everything").query(Predicates.at("document.id", mainDocumentId)).ref(token).submit(function (err, response) {
            if (err) {
              callback(err);
            }
            try {
              if (response.results.length === 0) {
                callback(null, defaultUrl, xhr);
              } else {
                callback(null, linkResolver(response.results[0]), xhr);
              }
            } catch (e) {
              callback(e);
            }
          });
        }
      } catch (e) {
        callback(e, defaultUrl, xhr);
      }
    });
  },

  /**
   * Fetch a URL corresponding to a query, and parse the response as a Response object
   */
  request: function request(url, callback) {
    var api = this;
    var cacheKey = url + (this.accessToken ? '#' + this.accessToken : '');
    var cache = this.apiCache;
    cache.get(cacheKey, function (err, value) {
      if (err || value) {
        callback(err, value);
        return;
      }
      api.requestHandler(url, function (err, documents, xhr, ttl) {
        if (err) {
          callback(err, null, xhr);
          return;
        }
        var results = documents.results.map(parseDoc);
        var response = new Response(documents.page, documents.results_per_page, documents.results_size, documents.total_results_size, documents.total_pages, documents.next_page, documents.prev_page, results || []);
        if (ttl) {
          cache.set(cacheKey, response, ttl, function (err) {
            callback(err, response);
          });
        } else {
          callback(null, response);
        }
      });
    });
  }

};

/**
 * Embodies a submittable RESTful form as described on the API endpoint (as per RESTful standards)
 * @constructor
 * @private
 */
function Form(name, fields, form_method, rel, enctype, action) {
  this.name = name;
  this.fields = fields;
  this.form_method = form_method;
  this.rel = rel;
  this.enctype = enctype;
  this.action = action;
}

Form.prototype = {};

/**
 * Parse json as a document
 *
 * @returns {Document}
 */
var parseDoc = function parseDoc(json) {
  var fragments = {};
  for (var field in json.data[json.type]) {
    fragments[json.type + '.' + field] = json.data[json.type][field];
  }

  var slugs = [];
  if (json.slugs !== undefined) {
    for (var i = 0; i < json.slugs.length; i++) {
      slugs.push(decodeURIComponent(json.slugs[i]));
    }
  }

  return new Document(json.id, json.uid || null, json.type, json.href, json.tags, slugs, fragments);
};

/**
 * Embodies a SearchForm object. To create SearchForm objects that are allowed in the API, please use the API.form() method.
 * @constructor
 * @global
 * @alias SearchForm
 */
function SearchForm(api, form, data) {
  this.api = api;
  this.form = form;
  this.data = data || {};

  for (var field in form.fields) {
    if (form.fields[field]['default']) {
      this.data[field] = [form.fields[field]['default']];
    }
  }
}

SearchForm.prototype = {

  /**
   * Set an API call parameter. This will only work if field is a valid field of the
   * RESTful form in the first place (as described in the /api document); otherwise,
   * an "Unknown field" error is thrown.
   * Please prefer using dedicated methods like query(), orderings(), ...
   *
   * @param {string} field - The name of the field to set
   * @param {string} value - The value that gets assigned
   * @returns {SearchForm} - The SearchForm itself
   */
  set: function set(field, value) {
    var fieldDesc = this.form.fields[field];
    if (!fieldDesc) throw new Error("Unknown field " + field);
    var values = this.data[field] || [];
    if (value === '' || value === undefined) {
      // we must compare value to null because we want to allow 0
      value = null;
    }
    if (fieldDesc.multiple) {
      if (value) values.push(value);
    } else {
      values = value && [value];
    }
    this.data[field] = values;
    return this;
  },

  /**
   * Sets a ref to query on for this SearchForm. This is a mandatory
   * method to call before calling submit(), and api.form('everything').submit()
   * will not work.
   *
   * @param {Ref} ref - The Ref object defining the ref to query
   * @returns {SearchForm} - The SearchForm itself
   */
  ref: function ref(_ref) {
    return this.set("ref", _ref);
  },

  /**
   * Sets a predicate-based query for this SearchForm. This is where you
   * paste what you compose in your prismic.io API browser.
   *
   * @example form.query(Prismic.Predicates.at("document.id", "foobar"))
   * @param {string|...array} query - Either a query as a string, or as many predicates as you want. See Prismic.Predicates.
   * @returns {SearchForm} - The SearchForm itself
   */
  query: function query(_query) {
    if (typeof _query === 'string') {
      return this.set("q", _query);
    } else {
      var predicates;
      if (_query.constructor === Array && _query.length > 0 && _query[0].constructor === Array) {
        predicates = _query;
      } else {
        predicates = [].slice.apply(arguments); // Convert to a real JS array
      }
      var stringQueries = [];
      predicates.forEach(function (predicate) {
        var firstArg = predicate[1].indexOf("my.") === 0 || predicate[1].indexOf("document") === 0 ? predicate[1] : '"' + predicate[1] + '"';
        stringQueries.push("[:d = " + predicate[0] + "(" + firstArg + (predicate.length > 2 ? ", " : "") + (function () {
          return predicate.slice(2).map(function (p) {
            if (typeof p === 'string') {
              return '"' + p + '"';
            } else if (Array.isArray(p)) {
              return "[" + p.map(function (e) {
                return '"' + e + '"';
              }).join(',') + "]";
            } else if (p instanceof Date) {
              return p.getTime();
            } else {
              return p;
            }
          }).join(',');
        })() + ")]");
      });
      return this.query("[" + stringQueries.join("") + "]");
    }
  },

  /**
   * Sets a page size to query for this SearchForm. This is an optional method.
   *
   * @param {number} size - The page size
   * @returns {SearchForm} - The SearchForm itself
   */
  pageSize: function pageSize(size) {
    return this.set("pageSize", size);
  },

  /**
   * Restrict the results document to the specified fields
   *
   * @param {string|array} fields - The list of fields, array or comma separated string
   * @returns {SearchForm} - The SearchForm itself
   */
  fetch: function fetch(fields) {
    if (fields instanceof Array) {
      fields = fields.join(",");
    }
    return this.set("fetch", fields);
  },

  /**
   * Include the requested fields in the DocumentLink instances in the result
   *
   * @param {string|array} fields - The list of fields, array or comma separated string
   * @returns {SearchForm} - The SearchForm itself
   */
  fetchLinks: function fetchLinks(fields) {
    if (fields instanceof Array) {
      fields = fields.join(",");
    }
    return this.set("fetchLinks", fields);
  },

  /**
   * Sets the page number to query for this SearchForm. This is an optional method.
   *
   * @param {number} p - The page number
   * @returns {SearchForm} - The SearchForm itself
   */
  page: function page(p) {
    return this.set("page", p);
  },

  /**
   * Sets the orderings to query for this SearchForm. This is an optional method.
   *
   * @param {array} orderings - Array of string: list of fields, optionally followed by space and desc. Example: ['my.product.price desc', 'my.product.date']
   * @returns {SearchForm} - The SearchForm itself
   */
  orderings: function orderings(_orderings) {
    if (typeof _orderings === 'string') {
      // Backward compatibility
      return this.set("orderings", _orderings);
    } else if (!_orderings) {
      // Noop
      return this;
    } else {
      // Normal usage
      return this.set("orderings", "[" + _orderings.join(",") + "]");
    }
  },

  /**
   * Submits the query, and calls the callback function.
   *
   * @param {function} callback - Optional callback function that is called after the query was made,
   * to which you may pass three parameters: a potential error (null if no problem),
   * a Response object (containing all the pagination specifics + the array of Docs),
   * and the XMLHttpRequest
   */
  submit: function submit(callback) {
    var url = this.form.action;

    if (this.data) {
      var sep = url.indexOf('?') > -1 ? '&' : '?';
      for (var key in this.data) {
        if (this.data.hasOwnProperty(key)) {
          var values = this.data[key];
          if (values) {
            for (var i = 0; i < values.length; i++) {
              url += sep + key + '=' + encodeURIComponent(values[i]);
              sep = '&';
            }
          }
        }
      }
    }

    this.api.request(url, callback);
  }
};

/**
 * Embodies the response of a SearchForm query as returned by the API.
 * It includes all the fields that are useful for pagination (page, total_pages, total_results_size, ...),
 * as well as the field "results", which is an array of {@link Document} objects, the documents themselves.
 *
 * @constructor
 * @global
 */
function Response(page, results_per_page, results_size, total_results_size, total_pages, next_page, prev_page, results) {
  /**
   * The current page
   * @type {number}
   */
  this.page = page;
  /**
   * The number of results per page
   * @type {number}
   */
  this.results_per_page = results_per_page;
  /**
   * The size of the current page
   * @type {number}
   */
  this.results_size = results_size;
  /**
   * The total size of results across all pages
   * @type {number}
   */
  this.total_results_size = total_results_size;
  /**
   * The total number of pages
   * @type {number}
   */
  this.total_pages = total_pages;
  /**
   * The URL of the next page in the API
   * @type {string}
   */
  this.next_page = next_page;
  /**
   * The URL of the previous page in the API
   * @type {string}
   */
  this.prev_page = prev_page;
  /**
   * Array of {@link Document} for the current page
   * @type {Array}
   */
  this.results = results;
}

/**
 * Embodies a prismic.io ref (a past or future point in time you can query)
 * @constructor
 * @global
 */
function Ref(ref, label, isMaster, scheduledAt, id) {
  /**
   * @field
   * @description the ID of the ref
   */
  this.ref = ref;
  /**
   * @field
   * @description the label of the ref
   */
  this.label = label;
  /**
   * @field
   * @description is true if the ref is the master ref
   */
  this.isMaster = isMaster;
  /**
   * @field
   * @description the scheduled date of the ref
   */
  this.scheduledAt = scheduledAt;
  /**
   * @field
   * @description the name of the ref
   */
  this.id = id;
}
Ref.prototype = {};

function globalCache() {
  var g;
  if ((typeof global === 'undefined' ? 'undefined' : _typeof(global)) == 'object') {
    g = global; // NodeJS
  } else {
      g = window; // browser
    }
  if (!g.prismicCache) {
    g.prismicCache = new ApiCache();
  }
  return g.prismicCache;
}

module.exports = {
  experimentCookie: "io.prismic.experiment",
  previewCookie: "io.prismic.preview",
  Api: Api,
  Experiments: Experiments,
  Predicates: Predicates,
  Fragments: Fragments,
  ApiCache: ApiCache,
  getApi: getApi,
  parseDoc: parseDoc
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./cache.js":42,"./documents":43,"./experiments":44,"./fragments":45,"./predicates":48,"./utils":49}],41:[function(require,module,exports){
'use strict';

require('./polyfill');

window.Prismic = require('./api');

},{"./api":40,"./polyfill":47}],42:[function(require,module,exports){

"use strict";

var LRUCache = require('./lru');

/**
 * Api cache
 */
function ApiCache(limit) {
  this.lru = new LRUCache(limit);
}

ApiCache.prototype = {

  get: function get(key, cb) {
    var maybeEntry = this.lru.get(key);
    if (maybeEntry && !this.isExpired(key)) {
      return cb(null, maybeEntry.data);
    }
    return cb();
  },

  set: function set(key, value, ttl, cb) {
    this.lru.remove(key);
    this.lru.put(key, {
      data: value,
      expiredIn: ttl ? Date.now() + ttl * 1000 : 0
    });

    return cb();
  },

  isExpired: function isExpired(key) {
    var entry = this.lru.get(key);
    if (entry) {
      return entry.expiredIn !== 0 && entry.expiredIn < Date.now();
    } else {
      return false;
    }
  },

  remove: function remove(key, cb) {
    this.lru.remove(key);
    return cb();
  },

  clear: function clear(cb) {
    this.lru.removeAll();
    return cb();
  }
};

module.exports = ApiCache;

},{"./lru":46}],43:[function(require,module,exports){
"use strict";

/**
 * Functions to access fragments: superclass for Document and Doc (from Group), not supposed to be created directly
 * @constructor
 */

function WithFragments() {}

WithFragments.prototype = {
  /**
   * Gets the fragment in the current Document object. Since you most likely know the type
   * of this fragment, it is advised that you use a dedicated method, like get StructuredText() or getDate(),
   * for instance.
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.author"
   * @returns {object} - The JavaScript Fragment object to manipulate
   */
  get: function get(name) {
    var frags = this._getFragments(name);
    return frags.length ? frags[0] : null;
  },

  /**
   * Builds an array of all the fragments in case they are multiple.
   *
   * @param {string} name - The name of the multiple fragment to get, with its type; for instance, "blog-post.author"
   * @returns {array} - An array of each JavaScript fragment object to manipulate.
   */
  getAll: function getAll(name) {
    return this._getFragments(name);
  },

  /**
   * Gets the image fragment in the current Document object, for further manipulation.
   *
   * @example document.getImage('blog-post.photo').asHtml(linkResolver)
   *
   * @param {string} fragment - The name of the fragment to get, with its type; for instance, "blog-post.photo"
   * @returns {ImageEl} - The Image object to manipulate
   */
  getImage: function getImage(fragment) {
    var Fragments = require('./fragments');
    var img = this.get(fragment);
    if (img instanceof Fragments.Image) {
      return img;
    }
    if (img instanceof Fragments.StructuredText) {
      // find first image in st.
      return img;
    }
    return null;
  },

  // Useful for obsolete multiples
  getAllImages: function getAllImages(fragment) {
    var Fragments = require('./fragments');
    var images = this.getAll(fragment);

    return images.map(function (image) {
      if (image instanceof Fragments.Image) {
        return image;
      }
      if (image instanceof Fragments.StructuredText) {
        throw new Error("Not done.");
      }
      return null;
    });
  },

  getFirstImage: function getFirstImage() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstImage = Object.keys(fragments).reduce(function (image, key) {
      if (image) {
        return image;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstImage === "function") {
          return element.getFirstImage();
        } else if (element instanceof Fragments.Image) {
          return element;
        } else return null;
      }
    }, null);
    return firstImage;
  },

  getFirstTitle: function getFirstTitle() {
    var Fragments = require('./fragments');
    var fragments = this.fragments;

    var firstTitle = Object.keys(fragments).reduce(function (st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstTitle === "function") {
          return element.getFirstTitle();
        } else if (element instanceof Fragments.StructuredText) {
          return element.getTitle();
        } else return null;
      }
    }, null);
    return firstTitle;
  },

  getFirstParagraph: function getFirstParagraph() {
    var fragments = this.fragments;

    var firstParagraph = Object.keys(fragments).reduce(function (st, key) {
      if (st) {
        return st;
      } else {
        var element = fragments[key];
        if (typeof element.getFirstParagraph === "function") {
          return element.getFirstParagraph();
        } else return null;
      }
    }, null);
    return firstParagraph;
  },

  /**
   * Gets the view within the image fragment in the current Document object, for further manipulation.
   *
   * @example document.getImageView('blog-post.photo', 'large').asHtml(linkResolver)
   *
   * @param {string} name- The name of the fragment to get, with its type; for instance, "blog-post.photo"
   * @returns {ImageView} view - The View object to manipulate
   */
  getImageView: function getImageView(name, view) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);
    if (fragment instanceof Fragments.Image) {
      return fragment.getView(view);
    }
    if (fragment instanceof Fragments.StructuredText) {
      for (var i = 0; i < fragment.blocks.length; i++) {
        if (fragment.blocks[i].type == 'image') {
          return fragment.blocks[i];
        }
      }
    }
    return null;
  },

  // Useful for obsolete multiples
  getAllImageViews: function getAllImageViews(name, view) {
    return this.getAllImages(name).map(function (image) {
      return image.getView(view);
    });
  },

  /**
   * Gets the timestamp fragment in the current Document object, for further manipulation.
   *
   * @example document.getDate('blog-post.publicationdate').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
   * @returns {Date} - The Date object to manipulate
   */
  getTimestamp: function getTimestamp(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Timestamp) {
      return fragment.value;
    }
  },

  /**
   * Gets the date fragment in the current Document object, for further manipulation.
   *
   * @example document.getDate('blog-post.publicationdate').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.publicationdate"
   * @returns {Date} - The Date object to manipulate
   */
  getDate: function getDate(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Date) {
      return fragment.value;
    }
  },

  /**
   * Gets a boolean value of the fragment in the current Document object, for further manipulation.
   * This works great with a Select fragment. The Select values that are considered true are (lowercased before matching): 'yes', 'on', and 'true'.
   *
   * @example if(document.getBoolean('blog-post.enableComments')) { ... }
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.enableComments"
   * @returns {boolean} - The boolean value of the fragment
   */
  getBoolean: function getBoolean(name) {
    var fragment = this.get(name);
    return fragment.value && (fragment.value.toLowerCase() == 'yes' || fragment.value.toLowerCase() == 'on' || fragment.value.toLowerCase() == 'true');
  },

  /**
   * Gets the text fragment in the current Document object, for further manipulation.
   * The method works with StructuredText fragments, Text fragments, Number fragments, Select fragments and Color fragments.
   *
   * @example document.getText('blog-post.label').asHtml(linkResolver).
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.label"
   * @param {string} after - a suffix that will be appended to the value
   * @returns {object} - either StructuredText, or Text, or Number, or Select, or Color.
   */
  getText: function getText(name, after) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.StructuredText) {
      return fragment.blocks.map(function (block) {
        if (block.text) {
          return block.text + (after ? after : '');
        }
      }).join('\n');
    }

    if (fragment instanceof Fragments.Text) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Number) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Select) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }

    if (fragment instanceof Fragments.Color) {
      if (fragment.value) {
        return fragment.value + (after ? after : '');
      }
    }
  },

  /**
   * Gets the StructuredText fragment in the current Document object, for further manipulation.
   * @example document.getStructuredText('blog-post.body').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.body"
   * @returns {StructuredText} - The StructuredText fragment to manipulate.
   */
  getStructuredText: function getStructuredText(name) {
    var fragment = this.get(name);

    if (fragment instanceof require('./fragments').StructuredText) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Link fragment in the current Document object, for further manipulation.
   * @example document.getLink('blog-post.link').url(resolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.link"
   * @returns {WebLink|DocumentLink|ImageLink} - The Link fragment to manipulate.
   */
  getLink: function getLink(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.WebLink || fragment instanceof Fragments.DocumentLink || fragment instanceof Fragments.ImageLink) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Number fragment in the current Document object, for further manipulation.
   * @example document.getNumber('product.price')
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.price"
   * @returns {number} - The number value of the fragment.
   */
  getNumber: function getNumber(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Number) {
      return fragment.value;
    }
    return null;
  },

  /**
   * Gets the Color fragment in the current Document object, for further manipulation.
   * @example document.getColor('product.color')
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.color"
   * @returns {string} - The string value of the Color fragment.
   */
  getColor: function getColor(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.Color) {
      return fragment.value;
    }
    return null;
  },

  /** Gets the GeoPoint fragment in the current Document object, for further manipulation.
   *
   * @example document.getGeoPoint('blog-post.location').asHtml(linkResolver)
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.location"
   * @returns {GeoPoint} - The GeoPoint object to manipulate
   */
  getGeoPoint: function getGeoPoint(name) {
    var Fragments = require('./fragments');
    var fragment = this.get(name);

    if (fragment instanceof Fragments.GeoPoint) {
      return fragment;
    }
    return null;
  },

  /**
   * Gets the Group fragment in the current Document object, for further manipulation.
   *
   * @example document.getGroup('product.gallery').asHtml(linkResolver).
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "product.gallery"
   * @returns {Group} - The Group fragment to manipulate.
   */
  getGroup: function getGroup(name) {
    var fragment = this.get(name);

    if (fragment instanceof require('./fragments').Group) {
      return fragment;
    }
    return null;
  },

  /**
   * Shortcut to get the HTML output of the fragment in the current document.
   * This is the same as writing document.get(fragment).asHtml(linkResolver);
   *
   * @param {string} name - The name of the fragment to get, with its type; for instance, "blog-post.body"
   * @param {function} linkResolver
   * @returns {string} - The HTML output
   */
  getHtml: function getHtml(name, linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function (doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var fragment = this.get(name);

    if (fragment && fragment.asHtml) {
      return fragment.asHtml(linkResolver);
    }
    return null;
  },

  /**
   * Transforms the whole document as an HTML output. Each fragment is separated by a &lt;section&gt; tag,
   * with the attribute data-field="nameoffragment"
   * Note that most of the time you will not use this method, but read fragment independently and generate
   * HTML output for {@link StructuredText} fragment with that class' asHtml method.
   *
   * @param {function} linkResolver
   * @returns {string} - The HTML output
   */
  asHtml: function asHtml(linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function (doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var htmls = [];
    for (var field in this.fragments) {
      var fragment = this.get(field);
      htmls.push(fragment && fragment.asHtml ? '<section data-field="' + field + '">' + fragment.asHtml(linkResolver) + '</section>' : '');
    }
    return htmls.join('');
  },

  /**
   * Turns the document into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText(linkResolver) {
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function (doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    var texts = [];
    for (var field in this.fragments) {
      var fragment = this.get(field);
      texts.push(fragment && fragment.asText ? fragment.asText(linkResolver) : '');
    }
    return texts.join('');
  },

  /**
   * Linked documents, as an array of {@link DocumentLink}
   * @returns {Array}
   */
  linkedDocuments: function linkedDocuments() {
    var i, j, link;
    var result = [];
    var Fragments = require('./fragments');
    for (var field in this.data) {
      var fragment = this.get(field);
      if (fragment instanceof Fragments.DocumentLink) {
        result.push(fragment);
      }
      if (fragment instanceof Fragments.StructuredText) {
        for (i = 0; i < fragment.blocks.length; i++) {
          var block = fragment.blocks[i];
          if (block.type == "image" && block.linkTo) {
            link = Fragments.initField(block.linkTo);
            if (link instanceof Fragments.DocumentLink) {
              result.push(link);
            }
          }
          var spans = block.spans || [];
          for (j = 0; j < spans.length; j++) {
            var span = spans[j];
            if (span.type == "hyperlink") {
              link = Fragments.initField(span.data);
              if (link instanceof Fragments.DocumentLink) {
                result.push(link);
              }
            }
          }
        }
      }
      if (fragment instanceof Fragments.Group) {
        for (i = 0; i < fragment.value.length; i++) {
          result = result.concat(fragment.value[i].linkedDocuments());
        }
      }
    }
    return result;
  },

  /**
   * An array of the fragments with the given fragment name.
   * The array is often a single-element array, expect when the fragment is a multiple fragment.
   * @private
   */
  _getFragments: function _getFragments(name) {
    if (!this.fragments || !this.fragments[name]) {
      return [];
    }

    if (Array.isArray(this.fragments[name])) {
      return this.fragments[name];
    } else {
      return [this.fragments[name]];
    }
  }

};

/**
 * Embodies a document as returned by the API.
 * Most useful fields: id, type, tags, slug, slugs
 * @constructor
 * @global
 * @alias Doc
 */
function Document(id, uid, type, href, tags, slugs, data) {
  /**
   * The ID of the document
   * @type {string}
   */
  this.id = id;
  /**
   * The User ID of the document, a human readable id
   * @type {string|null}
   */
  this.uid = uid;
  /**
   * The type of the document, corresponds to a document mask defined in the repository
   * @type {string}
   */
  this.type = type;
  /**
   * The URL of the document in the API
   * @type {string}
   */
  this.href = href;
  /**
   * The tags of the document
   * @type {array}
   */
  this.tags = tags;
  /**
   * The current slug of the document, "-" if none was provided
   * @type {string}
   */
  this.slug = slugs ? slugs[0] : "-";
  /**
   * All the slugs that were ever used by this document (including the current one, at the head)
   * @type {array}
   */
  this.slugs = slugs;
  /**
   * The original JSON data from the API
   */
  this.data = data;
  /**
   * Fragments, converted to business objects
   */
  this.fragments = require('./fragments').parseFragments(data);
}

Document.prototype = Object.create(WithFragments.prototype);

/**
 * Gets the SliceZone fragment in the current Document object, for further manipulation.
 *
 * @example document.getSliceZone('product.gallery').asHtml(linkResolver).
 *
 * @param {string} name - The name of the fragment to get, with its type; for instance, "product.gallery"
 * @returns {Group} - The SliceZone fragment to manipulate.
 */
Document.prototype.getSliceZone = function (name) {
  var fragment = this.get(name);

  if (fragment instanceof require('./fragments').SliceZone) {
    return fragment;
  }
  return null;
};

function GroupDoc(data) {
  /**
   * The original JSON data from the API
   */
  this.data = data;
  /**
   * Fragments, converted to business objects
   */
  this.fragments = require('./fragments').parseFragments(data);
}

GroupDoc.prototype = Object.create(WithFragments.prototype);

// -- Private helpers

function isFunction(f) {
  var getType = {};
  return f && getType.toString.call(f) === '[object Function]';
}

module.exports = {
  WithFragments: WithFragments,
  Document: Document,
  GroupDoc: GroupDoc
};

},{"./fragments":45}],44:[function(require,module,exports){

"use strict";

/**
 * A collection of experiments currently available
 * @param data the json data received from the Prismic API
 * @constructor
 */

function Experiments(data) {
  var drafts = [];
  var running = [];
  if (data) {
    data.drafts && data.drafts.forEach(function (exp) {
      drafts.push(new Experiment(exp));
    });
    data.running && data.running.forEach(function (exp) {
      running.push(new Experiment(exp));
    });
  }
  this.drafts = drafts;
  this.running = running;
}

Experiments.prototype.current = function () {
  return this.running.length > 0 ? this.running[0] : null;
};

/**
 * Get the current running experiment variation ref from a cookie content
 */
Experiments.prototype.refFromCookie = function (cookie) {
  if (!cookie || cookie.trim() === "") return null;
  var splitted = cookie.trim().split(" ");
  if (splitted.length < 2) return null;
  var expId = splitted[0];
  var varIndex = parseInt(splitted[1], 10);
  var exp = this.running.filter(function (exp) {
    return exp.googleId() == expId && exp.variations.length > varIndex;
  })[0];
  return exp ? exp.variations[varIndex].ref() : null;
};

function Experiment(data) {
  this.data = data;
  var variations = [];
  data.variations && data.variations.forEach(function (v) {
    variations.push(new Variation(v));
  });
  this.variations = variations;
}

Experiment.prototype.id = function () {
  return this.data.id;
};

Experiment.prototype.googleId = function () {
  return this.data.googleId;
};

Experiment.prototype.name = function () {
  return this.data.name;
};

function Variation(data) {
  this.data = data;
}

Variation.prototype.id = function () {
  return this.data.id;
};

Variation.prototype.ref = function () {
  return this.data.ref;
};

Variation.prototype.label = function () {
  return this.data.label;
};

module.exports = {
  Experiments: Experiments,
  Variation: Variation
};

},{}],45:[function(require,module,exports){
"use strict";

var documents = require('./documents');
var WithFragments = documents.WithFragments,
    GroupDoc = documents.GroupDoc;

/**
 * Embodies a plain text fragment (beware: not a structured text)
 * @constructor
 * @global
 * @alias Fragments:Text
 */
function Text(data) {
  this.value = data;
}
Text.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};
/**
 * Embodies a document link fragment (a link that is internal to a prismic.io repository)
 * @constructor
 * @global
 * @alias Fragments:DocumentLink
 */
function DocumentLink(data) {
  this.value = data;

  this.document = data.document;
  /**
   * @field
   * @description the linked document id
   */
  this.id = data.document.id;
  /**
   * @field
   * @description the linked document uid
   */
  this.uid = data.document.uid;
  /**
   * @field
   * @description the linked document tags
   */
  this.tags = data.document.tags;
  /**
   * @field
   * @description the linked document slug
   */
  this.slug = data.document.slug;
  /**
   * @field
   * @description the linked document type
   */
  this.type = data.document.type;

  var fragmentsData = {};
  if (data.document.data) {
    for (var field in data.document.data[data.document.type]) {
      fragmentsData[data.document.type + '.' + field] = data.document.data[data.document.type][field];
    }
  }
  /**
   * @field
   * @description the fragment list, if the fetchLinks parameter was used in at query time
   */
  this.fragments = parseFragments(fragmentsData);
  /**
   * @field
   * @description true if the link is broken, false otherwise
   */
  this.isBroken = data.isBroken;
}

DocumentLink.prototype = Object.create(WithFragments.prototype);

/**
 * Turns the fragment into a useable HTML version of it.
 * If the native HTML code doesn't suit your design, this function is meant to be overriden.
 *
 * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
 * @returns {string} - basic HTML code for the fragment
 */
DocumentLink.prototype.asHtml = function (ctx) {
  return "<a href=\"" + this.url(ctx) + "\">" + this.url(ctx) + "</a>";
};

/**
 * Returns the URL of the document link.
 *
 * @params {object} linkResolver - mandatory linkResolver function (please read prismic.io online documentation about this)
 * @returns {string} - the proper URL to use
 */
DocumentLink.prototype.url = function (linkResolver) {
  return linkResolver(this, this.isBroken);
};

/**
 * Turns the fragment into a useable text version of it.
 *
 * @returns {string} - basic text version of the fragment
 */
DocumentLink.prototype.asText = function (linkResolver) {
  return this.url(linkResolver);
};

/**
 * Embodies a web link fragment
 * @constructor
 * @global
 * @alias Fragments:WebLink
 */
function WebLink(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
WebLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\">" + this.url() + "</a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies a file link fragment
 * @constructor
 * @global
 * @alias Fragments:FileLink
 */
function FileLink(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
FileLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\">" + this.value.file.name + "</a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.file.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies an image link fragment
 * @constructor
 * @global
 * @alias Fragments:ImageLink
 */
function ImageLink(data) {
  /**
   *
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}
ImageLink.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<a href=\"" + this.url() + "\"><img src=\"" + this.url() + "\" alt=\"" + this.alt + "\"></a>";
  },
  /**
   * Returns the URL of the link.
   *
   * @returns {string} - the proper URL to use
   */
  url: function url() {
    return this.value.image.url;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.url();
  }
};

/**
 * Embodies a select fragment
 * @constructor
 * @global
 * @alias Fragments:Select
 */
function Select(data) {
  /**
   * @field
   * @description the text value of the fragment
   */
  this.value = data;
}
Select.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};

/**
 * Embodies a color fragment
 * @constructor
 * @global
 * @alias Fragments:Color
 */
function Color(data) {
  /**
   * @field
   * @description the text value of the fragment
   */
  this.value = data;
}
Color.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value;
  }
};

/**
 * Embodies a geopoint
 * @constructor
 * @global
 * @alias Fragments:GeoPoint
 */
function GeoPoint(data) {
  /**
   * @field
   * @description the latitude of the geo point
   */
  this.latitude = data.latitude;
  /**
   * @field
   * @description the longitude of the geo point
   */
  this.longitude = data.longitude;
}

GeoPoint.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return '<div class="geopoint"><span class="latitude">' + this.latitude + '</span><span class="longitude">' + this.longitude + '</span></div>';
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return '(' + this.latitude + "," + this.longitude + ')';
  }
};

/**
 * Embodies a Number fragment
 * @constructor
 * @global
 * @alias Fragments:Num
 */
function Num(data) {
  /**
   * @field
   * @description the integer value of the fragment
   */
  this.value = data;
}
Num.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<span>" + this.value + "</span>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies a Date fragment
 * @constructor
 * @global
 * @alias Fragments:Date
 */
function DateFragment(data) {
  /**
   * @field
   * @description the Date value of the fragment (as a regular JS Date object)
   */
  this.value = new Date(data);
}

DateFragment.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<time>" + this.value + "</time>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies a Timestamp fragment
 * @constructor
 * @global
 * @alias Fragments:Timestamp
 */
function Timestamp(data) {
  /**
   * @field
   * @description the Date value of the fragment (as a regular JS Date object)
   */
  // Adding ":" in the locale if needed, so JS considers it ISO8601-compliant
  var correctIso8601Date = data.length == 24 ? data.substring(0, 22) + ':' + data.substring(22, 24) : data;
  this.value = new Date(correctIso8601Date);
}

Timestamp.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<time>" + this.value + "</time>";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.toString();
  }
};

/**
 * Embodies an embed fragment
 * @constructor
 * @global
 * @alias Fragments:Embed
 */
function Embed(data) {
  /**
   * @field
   * @description the JSON object exactly as is returned in the "data" field of the JSON responses (see API documentation: https://developers.prismic.io/documentation/UjBe8bGIJ3EKtgBZ/api-documentation#json-responses)
   */
  this.value = data;
}

Embed.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return this.value.oembed.html;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies an Image fragment
 * @constructor
 * @global
 * @alias Fragments:ImageEl
 */
function ImageEl(main, views) {
  /**
   * @field
   * @description the main ImageView for this image
   */
  this.main = main;

  /**
   * @field
   * @description the url of the main ImageView for this image
   */
  this.url = main.url;

  /**
   * @field
   * @description an array of all the other ImageViews for this image
   */
  this.views = views || {};
}
ImageEl.prototype = {
  /**
   * Gets the view of the image, from its name
   *
   * @param {string} name - the name of the view to get
   * @returns {ImageView} - the proper view
   */
  getView: function getView(name) {
    if (name === "main") {
      return this.main;
    } else {
      return this.views[name];
    }
  },
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return this.main.asHtml();
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies an image view (an image in prismic.io can be defined with several different thumbnail sizes, each size is called a "view")
 * @constructor
 * @global
 * @alias Fragments:ImageView
 */
function ImageView(url, width, height, alt) {
  /**
   * @field
   * @description the URL of the ImageView (useable as it, in a <img> tag in HTML, for instance)
   */
  this.url = url;
  /**
   * @field
   * @description the width of the ImageView
   */
  this.width = width;
  /**
   * @field
   * @description the height of the ImageView
   */
  this.height = height;
  /**
   * @field
   * @description the alt text for the ImageView
   */
  this.alt = alt;
}
ImageView.prototype = {
  ratio: function ratio() {
    return this.width / this.height;
  },
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml() {
    return "<img src=\"" + this.url + "\" width=\"" + this.width + "\" height=\"" + this.height + "\" alt=\"" + this.alt + "\">";
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return "";
  }
};

/**
 * Embodies a fragment of type "Group" (which is a group of subfragments)
 * @constructor
 * @global
 * @alias Fragments:Group
 */
function Group(data) {
  this.value = [];
  for (var i = 0; i < data.length; i++) {
    this.value.push(new GroupDoc(data[i]));
  }
}
Group.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   * @params {function} linkResolver - linkResolver function (please read prismic.io online documentation about this)
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asHtml(linkResolver);
    }
    return output;
  },
  /**
   * Turns the Group fragment into an array in order to access its items (groups of fragments),
   * or to loop through them.
   * @params {object} ctx - mandatory ctx object, with a useable linkResolver function (please read prismic.io online documentation about this)
   * @returns {Array} - the array of groups, each group being a JSON object with subfragment name as keys, and subfragment as values
   */
  toArray: function toArray() {
    return this.value;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asText(linkResolver) + '\n';
    }
    return output;
  },

  getFirstImage: function getFirstImage() {
    return this.toArray().reduce(function (image, fragment) {
      if (image) return image;else {
        return fragment.getFirstImage();
      }
    }, null);
  },

  getFirstTitle: function getFirstTitle() {
    return this.toArray().reduce(function (st, fragment) {
      if (st) return st;else {
        return fragment.getFirstTitle();
      }
    }, null);
  },

  getFirstParagraph: function getFirstParagraph() {
    return this.toArray().reduce(function (st, fragment) {
      if (st) return st;else {
        return fragment.getFirstParagraph();
      }
    }, null);
  }
};

/**
 * Embodies a structured text fragment
 * @constructor
 * @global
 * @alias Fragments:StructuredText
 */
function StructuredText(blocks) {

  this.blocks = blocks;
}

StructuredText.prototype = {

  /**
   * @returns {object} the first heading block in the text
   */
  getTitle: function getTitle() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type.indexOf('heading') === 0) {
        return block;
      }
    }
    return null;
  },

  /**
   * @returns {object} the first block of type paragraph
   */
  getFirstParagraph: function getFirstParagraph() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'paragraph') {
        return block;
      }
    }
    return null;
  },

  /**
   * @returns {array} all paragraphs
   */
  getParagraphs: function getParagraphs() {
    var paragraphs = [];
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'paragraph') {
        paragraphs.push(block);
      }
    }
    return paragraphs;
  },

  /**
   * @returns {object} the nth paragraph
   */
  getParagraph: function getParagraph(n) {
    return this.getParagraphs()[n];
  },

  /**
   * @returns {object}
   */
  getFirstImage: function getFirstImage() {
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.type == 'image') {
        return new ImageView(block.url, block.dimensions.width, block.dimensions.height, block.alt);
      }
    }
    return null;
  },

  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   * @params {function} linkResolver - please read prismic.io online documentation about link resolvers
   * @params {function} htmlSerializer optional HTML serializer to customize the output
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver, htmlSerializer) {
    var blockGroups = [],
        blockGroup,
        block,
        html = [];
    if (!isFunction(linkResolver)) {
      // Backward compatibility with the old ctx argument
      var ctx = linkResolver;
      linkResolver = function (doc, isBroken) {
        return ctx.linkResolver(ctx, doc, isBroken);
      };
    }
    if (Array.isArray(this.blocks)) {

      for (var i = 0; i < this.blocks.length; i++) {
        block = this.blocks[i];

        // Resolve image links
        if (block.type == "image" && block.linkTo) {
          var link = initField(block.linkTo);
          block.linkUrl = link.url(linkResolver);
        }

        if (block.type !== "list-item" && block.type !== "o-list-item") {
          // it's not a type that groups
          blockGroups.push(block);
          blockGroup = null;
        } else if (!blockGroup || blockGroup.type != "group-" + block.type) {
          // it's a new type or no BlockGroup was set so far
          blockGroup = {
            type: "group-" + block.type,
            blocks: [block]
          };
          blockGroups.push(blockGroup);
        } else {
          // it's the same type as before, no touching blockGroup
          blockGroup.blocks.push(block);
        }
      }

      var blockContent = function blockContent(block) {
        var content = "";
        if (block.blocks) {
          block.blocks.forEach(function (block2) {
            content = content + serialize(block2, blockContent(block2), htmlSerializer);
          });
        } else {
          content = insertSpans(block.text, block.spans, linkResolver, htmlSerializer);
        }
        return content;
      };

      blockGroups.forEach(function (blockGroup) {
        html.push(serialize(blockGroup, blockContent(blockGroup), htmlSerializer));
      });
    }

    return html.join('');
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    var output = [];
    for (var i = 0; i < this.blocks.length; i++) {
      var block = this.blocks[i];
      if (block.text) {
        output.push(block.text);
      }
    }
    return output.join(' ');
  }

};

function htmlEscape(input) {
  return input && input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

/**
 * Parses a block that has spans, and inserts the proper HTML code.
 *
 * @param {string} text - the original text of the block
 * @param {object} spans - the spans as returned by the API
 * @param {object} linkResolver - the function to build links that may be in the fragment (please read prismic.io's online documentation about this)
 * @param {function} htmlSerializer - optional serializer
 * @returns {string} - the HTML output
 */
function insertSpans(text, spans, linkResolver, htmlSerializer) {
  if (!spans || !spans.length) {
    return htmlEscape(text);
  }

  var tagsStart = {};
  var tagsEnd = {};

  spans.forEach(function (span) {
    if (!tagsStart[span.start]) {
      tagsStart[span.start] = [];
    }
    if (!tagsEnd[span.end]) {
      tagsEnd[span.end] = [];
    }

    tagsStart[span.start].push(span);
    tagsEnd[span.end].unshift(span);
  });

  var c;
  var html = "";
  var stack = [];
  for (var pos = 0, len = text.length + 1; pos < len; pos++) {
    // Looping to length + 1 to catch closing tags
    if (tagsEnd[pos]) {
      tagsEnd[pos].forEach(function () {
        // Close a tag
        var tag = stack.pop();
        // Continue only if block contains content.
        if (typeof tag !== 'undefined') {
          var innerHtml = serialize(tag.span, tag.text, htmlSerializer);
          if (stack.length === 0) {
            // The tag was top level
            html += innerHtml;
          } else {
            // Add the content to the parent tag
            stack[stack.length - 1].text += innerHtml;
          }
        }
      });
    }
    if (tagsStart[pos]) {
      // Sort bigger tags first to ensure the right tag hierarchy
      tagsStart[pos].sort(function (a, b) {
        return b.end - b.start - (a.end - a.start);
      });
      tagsStart[pos].forEach(function (span) {
        // Open a tag
        var url = null;
        if (span.type == "hyperlink") {
          var fragment = initField(span.data);
          if (fragment) {
            url = fragment.url(linkResolver);
          } else {
            if (console && console.error) console.error('Impossible to convert span.data as a Fragment', span);
            return;
          }
          span.url = url;
        }
        var elt = {
          span: span,
          text: ""
        };
        stack.push(elt);
      });
    }
    if (pos < text.length) {
      c = text[pos];
      if (stack.length === 0) {
        // Top-level text
        html += htmlEscape(c);
      } else {
        // Inner text of a span
        stack[stack.length - 1].text += htmlEscape(c);
      }
    }
  }

  return html;
}

/**
 * Embodies a Slice fragment
 * @constructor
 * @global
 * @alias Fragments:Slice
 */
function Slice(sliceType, label, value) {
  this.sliceType = sliceType;
  this.label = label;
  this.value = value;
}

Slice.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var classes = ['slice'];
    if (this.label) classes.push(this.label);
    return '<div data-slicetype="' + this.sliceType + '" class="' + classes.join(' ') + '">' + this.value.asHtml(linkResolver) + '</div>';
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    return this.value.asText();
  },

  /**
   * Get the first Image in slice.
   * @returns {object}
   */
  getFirstImage: function getFirstImage() {
    var fragment = this.value;
    if (typeof fragment.getFirstImage === "function") {
      return fragment.getFirstImage();
    } else if (fragment instanceof ImageEl) {
      return fragment;
    } else return null;
  },

  getFirstTitle: function getFirstTitle() {
    var fragment = this.value;
    if (typeof fragment.getFirstTitle === "function") {
      return fragment.getFirstTitle();
    } else if (fragment instanceof StructuredText) {
      return fragment.getTitle();
    } else return null;
  },

  getFirstParagraph: function getFirstParagraph() {
    var fragment = this.value;
    if (typeof fragment.getFirstParagraph === "function") {
      return fragment.getFirstParagraph();
    } else return null;
  }
};

/**
 * Embodies a SliceZone fragment
 * @constructor
 * @global
 * @alias Fragments:SliceZone
 */
function SliceZone(data) {
  this.value = [];
  for (var i = 0; i < data.length; i++) {
    var sliceType = data[i]['slice_type'];
    var fragment = initField(data[i]['value']);
    var label = data[i]['slice_label'] || null;
    if (sliceType && fragment) {
      this.value.push(new Slice(sliceType, label, fragment));
    }
  }
  this.slices = this.value;
}

SliceZone.prototype = {
  /**
   * Turns the fragment into a useable HTML version of it.
   * If the native HTML code doesn't suit your design, this function is meant to be overriden.
   *
   * @returns {string} - basic HTML code for the fragment
   */
  asHtml: function asHtml(linkResolver) {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asHtml(linkResolver);
    }
    return output;
  },

  /**
   * Turns the fragment into a useable text version of it.
   *
   * @returns {string} - basic text version of the fragment
   */
  asText: function asText() {
    var output = "";
    for (var i = 0; i < this.value.length; i++) {
      output += this.value[i].asText() + '\n';
    }
    return output;
  },

  getFirstImage: function getFirstImage() {
    return this.value.reduce(function (image, slice) {
      if (image) return image;else {
        return slice.getFirstImage();
      }
    }, null);
  },

  getFirstTitle: function getFirstTitle() {
    return this.value.reduce(function (text, slice) {
      if (text) return text;else {
        return slice.getFirstTitle();
      }
    }, null);
  },

  getFirstParagraph: function getFirstParagraph() {
    return this.value.reduce(function (paragraph, slice) {
      if (paragraph) return paragraph;else {
        return slice.getFirstParagraph();
      }
    }, null);
  }
};

/**
 * From a fragment's name, casts it into the proper object type (like Prismic.Fragments.StructuredText)
 *
 * @private
 * @param {string} field - the fragment's name
 * @returns {object} - the object of the proper Fragments type.
 */
function initField(field) {

  var classForType = {
    "Color": Color,
    "Number": Num,
    "Date": DateFragment,
    "Timestamp": Timestamp,
    "Text": Text,
    "Embed": Embed,
    "GeoPoint": GeoPoint,
    "Select": Select,
    "StructuredText": StructuredText,
    "Link.document": DocumentLink,
    "Link.web": WebLink,
    "Link.file": FileLink,
    "Link.image": ImageLink,
    "Group": Group,
    "SliceZone": SliceZone
  };

  if (classForType[field.type]) {
    return new classForType[field.type](field.value);
  }

  if (field.type === "Image") {
    var img = field.value.main;
    var output = new ImageEl(new ImageView(img.url, img.dimensions.width, img.dimensions.height, img.alt), {});
    for (var name in field.value.views) {
      img = field.value.views[name];
      output.views[name] = new ImageView(img.url, img.dimensions.width, img.dimensions.height, img.alt);
    }
    return output;
  }

  if (console && console.log) console.log("Fragment type not supported: ", field.type);
  return null;
}

function parseFragments(json) {
  var result = {};
  for (var key in json) {
    if (json.hasOwnProperty(key)) {
      if (Array.isArray(json[key])) {
        result[key] = json[key].map(function (fragment) {
          return initField(fragment);
        });
      } else {
        result[key] = initField(json[key]);
      }
    }
  }
  return result;
}

function isFunction(f) {
  var getType = {};
  return f && getType.toString.call(f) === '[object Function]';
}

function serialize(element, content, htmlSerializer) {
  // Return the user customized output (if available)
  if (htmlSerializer) {
    var custom = htmlSerializer(element, content);
    if (custom) {
      return custom;
    }
  }

  // Fall back to the default HTML output
  var TAG_NAMES = {
    "heading1": "h1",
    "heading2": "h2",
    "heading3": "h3",
    "heading4": "h4",
    "heading5": "h5",
    "heading6": "h6",
    "paragraph": "p",
    "preformatted": "pre",
    "list-item": "li",
    "o-list-item": "li",
    "group-list-item": "ul",
    "group-o-list-item": "ol",
    "strong": "strong",
    "em": "em"
  };

  if (TAG_NAMES[element.type]) {
    var name = TAG_NAMES[element.type];
    var classCode = element.label ? ' class="' + element.label + '"' : '';
    return '<' + name + classCode + '>' + content + '</' + name + '>';
  }

  if (element.type == "image") {
    var label = element.label ? " " + element.label : "";
    var imgTag = '<img src="' + element.url + '" alt="' + element.alt + '">';
    return '<p class="block-img' + label + '">' + (element.linkUrl ? '<a href="' + element.linkUrl + '">' + imgTag + '</a>' : imgTag) + '</p>';
  }

  if (element.type == "embed") {
    return '<div data-oembed="' + element.embed_url + '" data-oembed-type="' + element.type + '" data-oembed-provider="' + element.provider_name + (element.label ? '" class="' + element.label : '') + '">' + element.oembed.html + "</div>";
  }

  if (element.type === 'hyperlink') {
    return '<a href="' + element.url + '">' + content + '</a>';
  }

  if (element.type === 'label') {
    return '<span class="' + element.data.label + '">' + content + '</span>';
  }

  return "<!-- Warning: " + element.type + " not implemented. Upgrade the Developer Kit. -->" + content;
}

module.exports = {
  Embed: Embed,
  Image: ImageEl,
  ImageView: ImageView,
  Text: Text,
  Number: Num,
  Date: DateFragment,
  Timestamp: Timestamp,
  Select: Select,
  Color: Color,
  StructuredText: StructuredText,
  WebLink: WebLink,
  DocumentLink: DocumentLink,
  ImageLink: ImageLink,
  FileLink: FileLink,
  Group: Group,
  GeoPoint: GeoPoint,
  Slice: Slice,
  SliceZone: SliceZone,
  initField: initField,
  parseFragments: parseFragments,
  insertSpans: insertSpans
};

},{"./documents":43}],46:[function(require,module,exports){
'use strict';

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * See README.md for details.
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */
function LRUCache(limit) {
  // Current size of the cache. (Read-only).
  this.size = 0;
  // Maximum number of items this cache can hold.
  this.limit = limit;
  this._keymap = {};
}

/**
 * Put <value> into the cache associated with <key>. Returns the entry which was
 * removed to make room for the new entry. Otherwise undefined is returned
 * (i.e. if there was enough room already).
 */
LRUCache.prototype.put = function (key, value) {
  var entry = { key: key, value: value };
  // Note: No protection agains replacing, and thus orphan entries. By design.
  this._keymap[key] = entry;
  if (this.tail) {
    // link previous tail to the new tail (entry)
    this.tail.newer = entry;
    entry.older = this.tail;
  } else {
    // we're first in -- yay
    this.head = entry;
  }
  // add new entry to the end of the linked list -- it's now the freshest entry.
  this.tail = entry;
  if (this.size === this.limit) {
    // we hit the limit -- remove the head
    return this.shift();
  } else {
    // increase the size counter
    this.size++;
  }
};

/**
 * Purge the least recently used (oldest) entry from the cache. Returns the
 * removed entry or undefined if the cache was empty.
 *
 * If you need to perform any form of finalization of purged items, this is a
 * good place to do it. Simply override/replace this function:
 *
 *   var c = new LRUCache(123);
 *   c.shift = function() {
 *     var entry = LRUCache.prototype.shift.call(this);
 *     doSomethingWith(entry);
 *     return entry;
 *   }
 */
LRUCache.prototype.shift = function () {
  // todo: handle special case when limit == 1
  var entry = this.head;
  if (entry) {
    if (this.head.newer) {
      this.head = this.head.newer;
      this.head.older = undefined;
    } else {
      this.head = undefined;
    }
    // Remove last strong reference to <entry> and remove links from the purged
    // entry being returned:
    entry.newer = entry.older = undefined;
    // delete is slow, but we need to do this to avoid uncontrollable growth:
    delete this._keymap[entry.key];
  }
  return entry;
};

/**
 * Get and register recent use of <key>. Returns the value associated with <key>
 * or undefined if not in cache.
 */
LRUCache.prototype.get = function (key, returnEntry) {
  // First, find our cache entry
  var entry = this._keymap[key];
  if (entry === undefined) return null; // Not cached. Sorry.
  // As <key> was found in the cache, register it as being requested recently
  if (entry === this.tail) {
    // Already the most recenlty used entry, so no need to update the list
    return returnEntry ? entry : entry.value;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) this.head = entry.newer;
    entry.newer.older = entry.older; // C <-- E.
  }
  if (entry.older) entry.older.newer = entry.newer; // C. --> E
  entry.newer = undefined; // D --x
  entry.older = this.tail; // D. --> E
  if (this.tail) this.tail.newer = entry; // E. <-- D
  this.tail = entry;
  return returnEntry ? entry : entry.value;
};

// ----------------------------------------------------------------------------
// Following code is optional and can be removed without breaking the core
// functionality.

/**
 * Check if <key> is in the cache without registering recent use. Feasible if
 * you do not want to chage the state of the cache, but only "peek" at it.
 * Returns the entry associated with <key> if found, or undefined if not found.
 */
LRUCache.prototype.find = function (key) {
  return this._keymap[key];
};

/**
 * Update the value of entry with <key>. Returns the old value, or undefined if
 * entry was not in the cache.
 */
LRUCache.prototype.set = function (key, value) {
  var oldvalue,
      entry = this.get(key, true);
  if (entry) {
    oldvalue = entry.value;
    entry.value = value;
  } else {
    oldvalue = this.put(key, value);
    if (oldvalue) oldvalue = oldvalue.value;
  }
  return oldvalue;
};

/**
 * Remove entry <key> from cache and return its value. Returns undefined if not
 * found.
 */
LRUCache.prototype.remove = function (key) {
  var entry = this._keymap[key];
  if (!entry) return null;
  delete this._keymap[entry.key]; // need to do delete unfortunately
  if (entry.newer && entry.older) {
    // relink the older entry with the newer entry
    entry.older.newer = entry.newer;
    entry.newer.older = entry.older;
  } else if (entry.newer) {
    // remove the link to us
    entry.newer.older = undefined;
    // link the newer entry to head
    this.head = entry.newer;
  } else if (entry.older) {
    // remove the link to us
    entry.older.newer = undefined;
    // link the newer entry to head
    this.tail = entry.older;
  } else {
    // if(entry.older === undefined && entry.newer === undefined) {
    this.head = this.tail = undefined;
  }

  this.size--;
  return entry.value;
};

/** Removes all entries */
LRUCache.prototype.removeAll = function () {
  // This should be safe, as we never expose strong refrences to the outside
  this.head = this.tail = undefined;
  this.size = 0;
  this._keymap = {};
};

/**
 * Return an array containing all keys of entries stored in the cache object, in
 * arbitrary order.
 */
if (typeof Object.keys === 'function') {
  LRUCache.prototype.keys = function () {
    return Object.keys(this._keymap);
  };
} else {
  LRUCache.prototype.keys = function () {
    var keys = [];
    for (var k in this._keymap) {
      keys.push(k);
    }return keys;
  };
}

/**
 * Call `fun` for each entry. Starting with the newest entry if `desc` is a true
 * value, otherwise starts with the oldest (head) enrty and moves towards the
 * tail.
 *
 * `fun` is called with 3 arguments in the context `context`:
 *   `fun.call(context, Object key, Object value, LRUCache self)`
 */
LRUCache.prototype.forEach = function (fun, context, desc) {
  var entry;
  if (context === true) {
    desc = true;context = undefined;
  } else if ((typeof context === 'undefined' ? 'undefined' : _typeof(context)) !== 'object') context = this;
  if (desc) {
    entry = this.tail;
    while (entry) {
      fun.call(context, entry.key, entry.value, this);
      entry = entry.older;
    }
  } else {
    entry = this.head;
    while (entry) {
      fun.call(context, entry.key, entry.value, this);
      entry = entry.newer;
    }
  }
};

/** Returns a JSON (array) representation */
LRUCache.prototype.toJSON = function () {
  var s = [],
      entry = this.head;
  while (entry) {
    s.push({ key: entry.key.toJSON(), value: entry.value.toJSON() });
    entry = entry.newer;
  }
  return s;
};

/** Returns a String representation */
LRUCache.prototype.toString = function () {
  var s = '',
      entry = this.head;
  while (entry) {
    s += String(entry.key) + ':' + entry.value;
    entry = entry.newer;
    if (entry) s += ' < ';
  }
  return s;
};

module.exports = LRUCache;

},{}],47:[function(require,module,exports){
'use strict';

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

(function () {

  if (typeof Object.create != 'function') {
    Object.create = (function () {
      var Object = function Object() {};
      return function (prototype) {
        if (arguments.length > 1) {
          throw Error('Second argument not supported');
        }
        if ((typeof prototype === 'undefined' ? 'undefined' : _typeof(prototype)) != 'object') {
          throw TypeError('Argument must be an object');
        }
        Object.prototype = prototype;
        var result = {};
        Object.prototype = null;
        return result;
      };
    })();
  }
})();

},{}],48:[function(require,module,exports){

"use strict";

/**
 * @global
 * @namespace
 * @alias Predicates
 */

module.exports = {

  /**
   * Build an "at" predicate: equality of a fragment to a value.
   *
   * @example Predicates.at("document.type", "article")
   * @param fragment {String}
   * @param value {String}
   * @returns {Array} an array corresponding to the predicate
   */
  at: function at(fragment, value) {
    return ["at", fragment, value];
  },

  /**
   * Build an "not" predicate: inequality of a fragment to a value.
   *
   * @example Predicates.not("document.type", "article")
   * @param fragment {String}
   * @param value {String}
   * @returns {Array} an array corresponding to the predicate
   */
  not: function not(fragment, value) {
    return ["not", fragment, value];
  },

  /**
   * Build a "missing" predicate: documents where the requested field is empty
   *
   * @example Predicates.missing("my.blog-post.author")
   * @param fragment {String}
   * @returns {Array} an array corresponding to the predicate
   */
  missing: function missing(fragment) {
    return ["missing", fragment];
  },

  /**
   * Build a "has" predicate: documents where the requested field is defined
   *
   * @example Predicates.has("my.blog-post.author")
   * @param fragment {String}
   * @returns {Array} an array corresponding to the predicate
   */
  has: function has(fragment) {
    return ["has", fragment];
  },

  /**
   * Build an "any" predicate: equality of a fragment to a value.
   *
   * @example Predicates.any("document.type", ["article", "blog-post"])
   * @param fragment {String}
   * @param values {Array}
   * @returns {Array} an array corresponding to the predicate
   */
  any: function any(fragment, values) {
    return ["any", fragment, values];
  },

  /**
   * Build an "in" predicate: equality of a fragment to a value.
   *
   * @example Predicates.in("my.product.price", [4, 5])
   * @param fragment {String}
   * @param values {Array}
   * @returns {Array} an array corresponding to the predicate
   */
  in: function _in(fragment, values) {
    return ["in", fragment, values];
  },

  /**
   * Build a "fulltext" predicate: fulltext search in a fragment.
   *
   * @example Predicates.fulltext("my.article.body", "sausage"])
   * @param fragment {String}
   * @param value {String} the term to search
   * @returns {Array} an array corresponding to the predicate
   */
  fulltext: function fulltext(fragment, value) {
    return ["fulltext", fragment, value];
  },

  /**
   * Build a "similar" predicate.
   *
   * @example Predicates.similar("UXasdFwe42D", 10)
   * @param documentId {String} the document id to retrieve similar documents to.
   * @param maxResults {Number} the maximum number of results to return
   * @returns {Array} an array corresponding to the predicate
   */
  similar: function similar(documentId, maxResults) {
    return ["similar", documentId, maxResults];
  },

  /**
   * Build a "number.gt" predicate: documents where the fragment field is greater than the given value.
   *
   * @example Predicates.gt("my.product.price", 10)
   * @param fragment {String} the name of the field - must be a number.
   * @param value {Number} the lower bound of the predicate
   * @returns {Array} an array corresponding to the predicate
   */
  gt: function gt(fragment, value) {
    return ["number.gt", fragment, value];
  },

  /**
   * Build a "number.lt" predicate: documents where the fragment field is lower than the given value.
   *
   * @example Predicates.lt("my.product.price", 20)
   * @param fragment {String} the name of the field - must be a number.
   * @param value {Number} the upper bound of the predicate
   * @returns {Array} an array corresponding to the predicate
   */
  lt: function lt(fragment, value) {
    return ["number.lt", fragment, value];
  },

  /**
   * Build a "number.inRange" predicate: combination of lt and gt.
   *
   * @example Predicates.inRange("my.product.price", 10, 20)
   * @param fragment {String} the name of the field - must be a number.
   * @param before {Number}
   * @param after {Number}
   * @returns {Array} an array corresponding to the predicate
   */
  inRange: function inRange(fragment, before, after) {
    return ["number.inRange", fragment, before, after];
  },

  /**
   * Build a "date.before" predicate: documents where the fragment field is before the given date.
   *
   * @example Predicates.dateBefore("my.product.releaseDate", new Date(2014, 6, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param before {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateBefore: function dateBefore(fragment, before) {
    return ["date.before", fragment, before];
  },

  /**
   * Build a "date.after" predicate: documents where the fragment field is after the given date.
   *
   * @example Predicates.dateAfter("my.product.releaseDate", new Date(2014, 1, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param after {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateAfter: function dateAfter(fragment, after) {
    return ["date.after", fragment, after];
  },

  /**
   * Build a "date.between" predicate: combination of dateBefore and dateAfter
   *
   * @example Predicates.dateBetween("my.product.releaseDate", new Date(2014, 1, 1), new Date(2014, 6, 1))
   * @param fragment {String} the name of the field - must be a date or timestamp field.
   * @param before {Date}
   * @param after {Date}
   * @returns {Array} an array corresponding to the predicate
   */
  dateBetween: function dateBetween(fragment, before, after) {
    return ["date.between", fragment, before, after];
  },

  /**
   *
   * @example Predicates.dayOfMonth("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonth: function dayOfMonth(fragment, day) {
    return ["date.day-of-month", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfMonthAfter("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonthAfter: function dayOfMonthAfter(fragment, day) {
    return ["date.day-of-month-after", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfMonthBefore("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number} between 1 and 31
   * @returns {Array}
   */
  dayOfMonthBefore: function dayOfMonthBefore(fragment, day) {
    return ["date.day-of-month-before", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeek("my.product.releaseDate", 14)
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeek: function dayOfWeek(fragment, day) {
    return ["date.day-of-week", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeekAfter("my.product.releaseDate", "Wednesday")
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeekAfter: function dayOfWeekAfter(fragment, day) {
    return ["date.day-of-week-after", fragment, day];
  },

  /**
   *
   * @example Predicates.dayOfWeekBefore("my.product.releaseDate", "Wednesday")
   * @param fragment
   * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
   * @returns {Array}
   */
  dayOfWeekBefore: function dayOfWeekBefore(fragment, day) {
    return ["date.day-of-week-before", fragment, day];
  },

  /**
   *
   * @example Predicates.month("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   */
  month: function month(fragment, _month) {
    return ["date.month", fragment, _month];
  },

  /**
   *
   * @example Predicates.monthBefore("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   */
  monthBefore: function monthBefore(fragment, month) {
    return ["date.month-before", fragment, month];
  },

  /**
   *
   * @example Predicates.monthAfter("my.product.releaseDate", "June")
   * @param fragment
   * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
   * @returns {Array}
   * @returns {Array}
   */
  monthAfter: function monthAfter(fragment, month) {
    return ["date.month-after", fragment, month];
  },

  /**
   *
   * @example Predicates.year("my.product.releaseDate", 2014)
   * @param fragment
   * @param year {Number}
   * @returns {Array}
   */
  year: function year(fragment, _year) {
    return ["date.year", fragment, _year];
  },

  /**
   *
   * @example Predicates.hour("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hour: function hour(fragment, _hour) {
    return ["date.hour", fragment, _hour];
  },

  /**
   *
   * @example Predicates.hourBefore("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hourBefore: function hourBefore(fragment, hour) {
    return ["date.hour-before", fragment, hour];
  },

  /**
   *
   * @example Predicates.hourAfter("my.product.releaseDate", 12)
   * @param fragment
   * @param hour {Number}
   * @returns {Array}
   */
  hourAfter: function hourAfter(fragment, hour) {
    return ["date.hour-after", fragment, hour];
  },

  /**
   *
   * @example Predicates.near("my.store.location", 48.8768767, 2.3338802, 10)
   * @param fragment
   * @param latitude {Number}
   * @param longitude {Number}
   * @param radius {Number} in kilometers
   * @returns {Array}
   */
  near: function near(fragment, latitude, longitude, radius) {
    return ["geopoint.near", fragment, latitude, longitude, radius];
  }

};

},{}],49:[function(require,module,exports){
(function (process){

"use strict";

var Utils = require('./utils');

var createError = function createError(status, message) {
  var err = new Error(message);
  err.status = status;
  return err;
};

// -- Request handlers

var ajaxRequest = function ajaxRequest() {
  if (typeof XMLHttpRequest != 'undefined' && 'withCredentials' in new XMLHttpRequest()) {
    return function (url, callback) {

      var xhr = new XMLHttpRequest();

      // Called on success
      var resolve = function resolve() {
        var ttl,
            cacheControl = /max-age\s*=\s*(\d+)/.exec(xhr.getResponseHeader('Cache-Control'));
        if (cacheControl && cacheControl.length > 1) {
          ttl = parseInt(cacheControl[1], 10);
        }
        callback(null, JSON.parse(xhr.responseText), xhr, ttl);
      };

      // Called on error
      var reject = function reject() {
        var status = xhr.status;
        callback(createError(status, "Unexpected status code [" + status + "] on URL " + url), null, xhr);
      };

      // Bind the XHR finished callback
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status && xhr.status == 200) {
            resolve();
          } else {
            reject();
          }
        }
      };

      // Open the XHR
      xhr.open('GET', url, true);

      // Kit version (can't override the user-agent client side)
      // xhr.setRequestHeader("X-Prismic-User-Agent", "Prismic-javascript-kit/%VERSION%".replace("%VERSION%", Global.Prismic.version));

      // Json request
      xhr.setRequestHeader('Accept', 'application/json');

      // Send the XHR
      xhr.send();
    };
  }
};

var xdomainRequest = function xdomainRequest() {
  if (typeof XDomainRequest != 'undefined') {
    // Internet Explorer
    return function (url, callback) {

      var xdr = new XDomainRequest();

      // Called on success
      var resolve = function resolve() {
        callback(null, JSON.parse(xdr.responseText), xdr, 0);
      };

      // Called on error
      var reject = function reject(msg) {
        callback(new Error(msg), null, xdr);
      };

      // Bind the XDR finished callback
      xdr.onload = function () {
        resolve(xdr);
      };

      // Bind the XDR error callback
      xdr.onerror = function () {
        reject("Unexpected status code on URL " + url);
      };

      // Open the XHR
      xdr.open('GET', url, true);

      // Bind the XDR timeout callback
      xdr.ontimeout = function () {
        reject("Request timeout");
      };

      // Empty callback. IE sometimes abort the reqeust if
      // this is not present
      xdr.onprogress = function () {};

      xdr.send();
    };
  }
};

var nodeJSRequest = function nodeJSRequest() {
  if (typeof require == 'function' && require('http')) {
    var http = require('http'),
        https = require('https'),
        url = require('url'),
        pjson = require('../package.json');

    return function (requestUrl, callback) {

      var parsed = url.parse(requestUrl),
          h = parsed.protocol == 'https:' ? https : http,
          options = {
        hostname: parsed.hostname,
        path: parsed.path,
        query: parsed.query,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Prismic-javascript-kit/' + pjson.version + " NodeJS/" + process.version
        }
      };

      if (!requestUrl) {
        console.log("BOOM");
        var e = new Error('dummy');
        var stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@').split('\n');
        console.log(stack);
      }
      var request = h.get(options, function (response) {
        if (response.statusCode && response.statusCode == 200) {
          var jsonStr = '';

          response.setEncoding('utf8');
          response.on('data', function (chunk) {
            jsonStr += chunk;
          });

          response.on('end', function () {
            var json;
            try {
              json = JSON.parse(jsonStr);
            } catch (ex) {
              console.log("Failed to parse json: " + jsonStr, ex);
            }
            var cacheControl = response.headers['cache-control'];
            var ttl = cacheControl && /max-age=(\d+)/.test(cacheControl) ? parseInt(/max-age=(\d+)/.exec(cacheControl)[1], 10) : undefined;

            callback(null, json, response, ttl);
          });
        } else {
          callback(createError(response.statusCode, "Unexpected status code [" + response.statusCode + "] on URL " + requestUrl), null, response);
        }
      });

      // properly handle timeouts
      request.on('error', function (err) {
        callback(new Error("Unexpected error on URL " + requestUrl), null, err);
      });
    };
  }
};

// Number of requests currently running (capped by MAX_CONNECTIONS)
var running = 0;
// Requests in queue
var queue = [];

var processQueue = function processQueue() {
  if (queue.length === 0 || running >= Utils.MAX_CONNECTIONS) {
    return;
  }
  running++;
  var next = queue.shift();
  var fn = ajaxRequest() || xdomainRequest() || nodeJSRequest() || (function () {
    throw new Error("No request handler available (tried XMLHttpRequest & NodeJS)");
  })();
  fn.call(this, next.url, function (error, result, xhr, ttl) {
    running--;
    next.callback(error, result, xhr, ttl);
    processQueue();
  });
};

var request = function request() {
  return function (url, callback) {
    queue.push({
      'url': url,
      'callback': callback
    });
    processQueue();
  };
};

module.exports = {
  MAX_CONNECTIONS: 20, // Number of maximum simultaneous connections to the prismic server
  request: request
};

}).call(this,require('_process'))

},{"../package.json":39,"./utils":49,"_process":14,"http":30,"https":8,"url":35}]},{},[41])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVpbHRpbi1zdGF0dXMtY29kZXMvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9jb3JlLXV0aWwtaXMvbGliL3V0aWwuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9odHRwcy1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzLW5leHRpY2stYXJncy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHVueWNvZGUvcHVueWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV93cml0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS90cmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3dyaXRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9jYXBhYmlsaXR5LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXF1ZXN0LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXNwb25zZS5qcyIsIm5vZGVfbW9kdWxlcy9zdHJpbmdfZGVjb2Rlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3VybC91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3V0aWwtZGVwcmVjYXRlL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL2FwaS5qcyIsInNyYy9icm93c2VyLmpzIiwic3JjL2NhY2hlLmpzIiwic3JjL2RvY3VtZW50cy5qcyIsInNyYy9leHBlcmltZW50cy5qcyIsInNyYy9mcmFnbWVudHMuanMiLCJzcmMvbHJ1LmpzIiwic3JjL3BvbHlmaWxsLmpzIiwic3JjL3ByZWRpY2F0ZXMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1Z0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7OztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcmhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvOEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqaEJBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTs7QUNEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDblJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1dEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDekNBLFlBQVksQ0FBQzs7OztBQUViLElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUM7SUFDdEMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUM7SUFDcEMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDMUIsU0FBUyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDbEMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDaEMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQzs7QUFFdkMsSUFBSSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVE7SUFDN0IsV0FBVyxHQUFHLFdBQVcsQ0FBQyxXQUFXOzs7Ozs7O0FB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QUUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUN4RCxXQUFPLEVBQUUsQ0FBQztBQUNWLFFBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdkMsZ0JBQVksRUFBRSxDQUFDO0dBQ2hCLENBQUMsQ0FBQztDQUNKLENBQUM7O0FBRUYsSUFBSSxPQUFPLEdBQUcsU0FBVixPQUFPLEdBQWU7QUFDeEIsU0FBTyxVQUFVLEdBQUcsRUFBRSxRQUFRLEVBQUU7QUFDOUIsU0FBSyxDQUFDLElBQUksQ0FBQztBQUNULFdBQUssRUFBRSxHQUFHO0FBQ1YsZ0JBQVUsRUFBRSxRQUFRO0tBQ3JCLENBQUMsQ0FBQztBQUNILGdCQUFZLEVBQUUsQ0FBQztHQUNoQixDQUFDO0NBQ0gsQ0FBQzs7QUFFRixNQUFNLENBQUMsT0FBTyxHQUFHO0FBQ2YsaUJBQWUsRUFBRSxFQUFFO0FBQ25CLFNBQU8sRUFBRSxPQUFPO0NBQ2pCLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFBMVVNfVVJMX1NBRkUgPSAnLScuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0hfVVJMX1NBRkUgPSAnXycuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTIHx8XG5cdFx0ICAgIGNvZGUgPT09IFBMVVNfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIIHx8XG5cdFx0ICAgIGNvZGUgPT09IFNMQVNIX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCIiLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciByb290UGFyZW50ID0ge31cblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBTYWZhcmkgNS03IGxhY2tzIHN1cHBvcnQgZm9yIGNoYW5naW5nIHRoZSBgT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3RvcmAgcHJvcGVydHlcbiAqICAgICBvbiBvYmplY3RzLlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgZnVuY3Rpb24gQmFyICgpIHt9XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICBhcnIuY29uc3RydWN0b3IgPSBCYXJcbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICBhcnIuY29uc3RydWN0b3IgPT09IEJhciAmJiAvLyBjb25zdHJ1Y3RvciBjYW4gYmUgc2V0XG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKGFyZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIC8vIEF2b2lkIGdvaW5nIHRocm91Z2ggYW4gQXJndW1lbnRzQWRhcHRvclRyYW1wb2xpbmUgaW4gdGhlIGNvbW1vbiBjYXNlLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBhcmd1bWVudHNbMV0pXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnKVxuICB9XG5cbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXMubGVuZ3RoID0gMFxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgICB9XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIG9iamVjdClcbiAgICB9XG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5KSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGFycmF5LmJ5dGVMZW5ndGhcbiAgICB0aGF0ID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21UeXBlZEFycmF5KHRoYXQsIG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG59IGVsc2Uge1xuICAvLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuICBCdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuICBCdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZSAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgICB0aGF0Ll9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBmcm9tUG9vbCA9IGxlbmd0aCAhPT0gMCAmJiBsZW5ndGggPD0gQnVmZmVyLnBvb2xTaXplID4+PiAxXG4gIGlmIChmcm9tUG9vbCkgdGhhdC5wYXJlbnQgPSByb290UGFyZW50XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2xvd0J1ZmZlcikpIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcbiAgZGVsZXRlIGJ1Zi5wYXJlbnRcbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgdmFyIGkgPSAwXG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSBicmVha1xuXG4gICAgKytpXG4gIH1cblxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0IGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycy4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykgc3RyaW5nID0gJycgKyBzdHJpbmdcblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIC8vIERlcHJlY2F0ZWRcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0IHwgMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgfCAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiAwXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICBieXRlT2Zmc2V0ID4+PSAwXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVybiAtMVxuXG4gIC8vIE5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sZW5ndGggKyBieXRlT2Zmc2V0LCAwKVxuXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSByZXR1cm4gLTEgLy8gc3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcgYWx3YXlzIGZhaWxzXG4gICAgcmV0dXJuIFN0cmluZy5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgWyB2YWwgXSwgYnl0ZU9mZnNldClcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yICh2YXIgaSA9IDA7IGJ5dGVPZmZzZXQgKyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyW2J5dGVPZmZzZXQgKyBpXSA9PT0gdmFsW2ZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4XSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbC5sZW5ndGgpIHJldHVybiBieXRlT2Zmc2V0ICsgZm91bmRJbmRleFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuLy8gYGdldGAgaXMgZGVwcmVjYXRlZFxuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiBnZXQgKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgaXMgZGVwcmVjYXRlZFxuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBzZXQgKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgaWYgKG5ld0J1Zi5sZW5ndGgpIG5ld0J1Zi5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCB0aGlzXG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRTdGFydClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gdG9BcnJheUJ1ZmZlciAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgfVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gX2F1Z21lbnQgKGFycikge1xuICBhcnIuY29uc3RydWN0b3IgPSBCdWZmZXJcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IHNldCBtZXRob2QgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWRcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuZXF1YWxzID0gQlAuZXF1YWxzXG4gIGFyci5jb21wYXJlID0gQlAuY29tcGFyZVxuICBhcnIuaW5kZXhPZiA9IEJQLmluZGV4T2ZcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludExFID0gQlAucmVhZFVJbnRMRVxuICBhcnIucmVhZFVJbnRCRSA9IEJQLnJlYWRVSW50QkVcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50TEUgPSBCUC5yZWFkSW50TEVcbiAgYXJyLnJlYWRJbnRCRSA9IEJQLnJlYWRJbnRCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnRMRSA9IEJQLndyaXRlVUludExFXG4gIGFyci53cml0ZVVJbnRCRSA9IEJQLndyaXRlVUludEJFXG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnRMRSA9IEJQLndyaXRlSW50TEVcbiAgYXJyLndyaXRlSW50QkUgPSBCUC53cml0ZUludEJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBcIjEwMFwiOiBcIkNvbnRpbnVlXCIsXG4gIFwiMTAxXCI6IFwiU3dpdGNoaW5nIFByb3RvY29sc1wiLFxuICBcIjEwMlwiOiBcIlByb2Nlc3NpbmdcIixcbiAgXCIyMDBcIjogXCJPS1wiLFxuICBcIjIwMVwiOiBcIkNyZWF0ZWRcIixcbiAgXCIyMDJcIjogXCJBY2NlcHRlZFwiLFxuICBcIjIwM1wiOiBcIk5vbi1BdXRob3JpdGF0aXZlIEluZm9ybWF0aW9uXCIsXG4gIFwiMjA0XCI6IFwiTm8gQ29udGVudFwiLFxuICBcIjIwNVwiOiBcIlJlc2V0IENvbnRlbnRcIixcbiAgXCIyMDZcIjogXCJQYXJ0aWFsIENvbnRlbnRcIixcbiAgXCIyMDdcIjogXCJNdWx0aS1TdGF0dXNcIixcbiAgXCIzMDBcIjogXCJNdWx0aXBsZSBDaG9pY2VzXCIsXG4gIFwiMzAxXCI6IFwiTW92ZWQgUGVybWFuZW50bHlcIixcbiAgXCIzMDJcIjogXCJNb3ZlZCBUZW1wb3JhcmlseVwiLFxuICBcIjMwM1wiOiBcIlNlZSBPdGhlclwiLFxuICBcIjMwNFwiOiBcIk5vdCBNb2RpZmllZFwiLFxuICBcIjMwNVwiOiBcIlVzZSBQcm94eVwiLFxuICBcIjMwN1wiOiBcIlRlbXBvcmFyeSBSZWRpcmVjdFwiLFxuICBcIjMwOFwiOiBcIlBlcm1hbmVudCBSZWRpcmVjdFwiLFxuICBcIjQwMFwiOiBcIkJhZCBSZXF1ZXN0XCIsXG4gIFwiNDAxXCI6IFwiVW5hdXRob3JpemVkXCIsXG4gIFwiNDAyXCI6IFwiUGF5bWVudCBSZXF1aXJlZFwiLFxuICBcIjQwM1wiOiBcIkZvcmJpZGRlblwiLFxuICBcIjQwNFwiOiBcIk5vdCBGb3VuZFwiLFxuICBcIjQwNVwiOiBcIk1ldGhvZCBOb3QgQWxsb3dlZFwiLFxuICBcIjQwNlwiOiBcIk5vdCBBY2NlcHRhYmxlXCIsXG4gIFwiNDA3XCI6IFwiUHJveHkgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIixcbiAgXCI0MDhcIjogXCJSZXF1ZXN0IFRpbWUtb3V0XCIsXG4gIFwiNDA5XCI6IFwiQ29uZmxpY3RcIixcbiAgXCI0MTBcIjogXCJHb25lXCIsXG4gIFwiNDExXCI6IFwiTGVuZ3RoIFJlcXVpcmVkXCIsXG4gIFwiNDEyXCI6IFwiUHJlY29uZGl0aW9uIEZhaWxlZFwiLFxuICBcIjQxM1wiOiBcIlJlcXVlc3QgRW50aXR5IFRvbyBMYXJnZVwiLFxuICBcIjQxNFwiOiBcIlJlcXVlc3QtVVJJIFRvbyBMYXJnZVwiLFxuICBcIjQxNVwiOiBcIlVuc3VwcG9ydGVkIE1lZGlhIFR5cGVcIixcbiAgXCI0MTZcIjogXCJSZXF1ZXN0ZWQgUmFuZ2UgTm90IFNhdGlzZmlhYmxlXCIsXG4gIFwiNDE3XCI6IFwiRXhwZWN0YXRpb24gRmFpbGVkXCIsXG4gIFwiNDE4XCI6IFwiSSdtIGEgdGVhcG90XCIsXG4gIFwiNDIyXCI6IFwiVW5wcm9jZXNzYWJsZSBFbnRpdHlcIixcbiAgXCI0MjNcIjogXCJMb2NrZWRcIixcbiAgXCI0MjRcIjogXCJGYWlsZWQgRGVwZW5kZW5jeVwiLFxuICBcIjQyNVwiOiBcIlVub3JkZXJlZCBDb2xsZWN0aW9uXCIsXG4gIFwiNDI2XCI6IFwiVXBncmFkZSBSZXF1aXJlZFwiLFxuICBcIjQyOFwiOiBcIlByZWNvbmRpdGlvbiBSZXF1aXJlZFwiLFxuICBcIjQyOVwiOiBcIlRvbyBNYW55IFJlcXVlc3RzXCIsXG4gIFwiNDMxXCI6IFwiUmVxdWVzdCBIZWFkZXIgRmllbGRzIFRvbyBMYXJnZVwiLFxuICBcIjUwMFwiOiBcIkludGVybmFsIFNlcnZlciBFcnJvclwiLFxuICBcIjUwMVwiOiBcIk5vdCBJbXBsZW1lbnRlZFwiLFxuICBcIjUwMlwiOiBcIkJhZCBHYXRld2F5XCIsXG4gIFwiNTAzXCI6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICBcIjUwNFwiOiBcIkdhdGV3YXkgVGltZS1vdXRcIixcbiAgXCI1MDVcIjogXCJIVFRQIFZlcnNpb24gTm90IFN1cHBvcnRlZFwiLFxuICBcIjUwNlwiOiBcIlZhcmlhbnQgQWxzbyBOZWdvdGlhdGVzXCIsXG4gIFwiNTA3XCI6IFwiSW5zdWZmaWNpZW50IFN0b3JhZ2VcIixcbiAgXCI1MDlcIjogXCJCYW5kd2lkdGggTGltaXQgRXhjZWVkZWRcIixcbiAgXCI1MTBcIjogXCJOb3QgRXh0ZW5kZWRcIixcbiAgXCI1MTFcIjogXCJOZXR3b3JrIEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCJcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuXG5mdW5jdGlvbiBpc0FycmF5KGFyZykge1xuICBpZiAoQXJyYXkuaXNBcnJheSkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGFyZyk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSBCdWZmZXIuaXNCdWZmZXI7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xuXG52YXIgaHR0cHMgPSBtb2R1bGUuZXhwb3J0cztcblxuZm9yICh2YXIga2V5IGluIGh0dHApIHtcbiAgICBpZiAoaHR0cC5oYXNPd25Qcm9wZXJ0eShrZXkpKSBodHRwc1trZXldID0gaHR0cFtrZXldO1xufTtcblxuaHR0cHMucmVxdWVzdCA9IGZ1bmN0aW9uIChwYXJhbXMsIGNiKSB7XG4gICAgaWYgKCFwYXJhbXMpIHBhcmFtcyA9IHt9O1xuICAgIHBhcmFtcy5zY2hlbWUgPSAnaHR0cHMnO1xuICAgIHBhcmFtcy5wcm90b2NvbCA9ICdodHRwczonO1xuICAgIHJldHVybiBodHRwLnJlcXVlc3QuY2FsbCh0aGlzLCBwYXJhbXMsIGNiKTtcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvKipcbiAqIERldGVybWluZSBpZiBhbiBvYmplY3QgaXMgQnVmZmVyXG4gKlxuICogQXV0aG9yOiAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBMaWNlbnNlOiAgTUlUXG4gKlxuICogYG5wbSBpbnN0YWxsIGlzLWJ1ZmZlcmBcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuICEhKG9iaiAhPSBudWxsICYmXG4gICAgKG9iai5faXNCdWZmZXIgfHwgLy8gRm9yIFNhZmFyaSA1LTcgKG1pc3NpbmcgT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3RvcilcbiAgICAgIChvYmouY29uc3RydWN0b3IgJiZcbiAgICAgIHR5cGVvZiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopKVxuICAgICkpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmlmICghcHJvY2Vzcy52ZXJzaW9uIHx8XG4gICAgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YwLicpID09PSAwIHx8XG4gICAgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YxLicpID09PSAwICYmIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MS44LicpICE9PSAwKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gbmV4dFRpY2s7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHByb2Nlc3MubmV4dFRpY2s7XG59XG5cbmZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgdmFyIGkgPSAwO1xuICB3aGlsZSAoaSA8IGFyZ3MubGVuZ3RoKSB7XG4gICAgYXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICB9XG4gIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gYWZ0ZXJUaWNrKCkge1xuICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9KTtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyohIGh0dHBzOi8vbXRocy5iZS9wdW55Y29kZSB2MS40LjAgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cyAmJlxuXHRcdCFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG5cdHZhciBmcmVlTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiZcblx0XHQhbW9kdWxlLm5vZGVUeXBlICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKFxuXHRcdGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8XG5cdFx0ZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLnNlbGYgPT09IGZyZWVHbG9iYWxcblx0KSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXlxceDIwLVxceDdFXS8sIC8vIHVucHJpbnRhYmxlIEFTQ0lJIGNoYXJzICsgbm9uLUFTQ0lJIGNoYXJzXG5cdHJlZ2V4U2VwYXJhdG9ycyA9IC9bXFx4MkVcXHUzMDAyXFx1RkYwRVxcdUZGNjFdL2csIC8vIFJGQyAzNDkwIHNlcGFyYXRvcnNcblxuXHQvKiogRXJyb3IgbWVzc2FnZXMgKi9cblx0ZXJyb3JzID0ge1xuXHRcdCdvdmVyZmxvdyc6ICdPdmVyZmxvdzogaW5wdXQgbmVlZHMgd2lkZXIgaW50ZWdlcnMgdG8gcHJvY2VzcycsXG5cdFx0J25vdC1iYXNpYyc6ICdJbGxlZ2FsIGlucHV0ID49IDB4ODAgKG5vdCBhIGJhc2ljIGNvZGUgcG9pbnQpJyxcblx0XHQnaW52YWxpZC1pbnB1dCc6ICdJbnZhbGlkIGlucHV0J1xuXHR9LFxuXG5cdC8qKiBDb252ZW5pZW5jZSBzaG9ydGN1dHMgKi9cblx0YmFzZU1pbnVzVE1pbiA9IGJhc2UgLSB0TWluLFxuXHRmbG9vciA9IE1hdGguZmxvb3IsXG5cdHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUsXG5cblx0LyoqIFRlbXBvcmFyeSB2YXJpYWJsZSAqL1xuXHRrZXk7XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBlcnJvciB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBUaGUgZXJyb3IgdHlwZS5cblx0ICogQHJldHVybnMge0Vycm9yfSBUaHJvd3MgYSBgUmFuZ2VFcnJvcmAgd2l0aCB0aGUgYXBwbGljYWJsZSBlcnJvciBtZXNzYWdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZXJyb3IodHlwZSkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKGVycm9yc1t0eXBlXSk7XG5cdH1cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGBBcnJheSNtYXBgIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpdGVyYXRlIG92ZXIuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeSBhcnJheVxuXHQgKiBpdGVtLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXAoYXJyYXksIGZuKSB7XG5cdFx0dmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblx0XHR2YXIgcmVzdWx0ID0gW107XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRyZXN1bHRbbGVuZ3RoXSA9IGZuKGFycmF5W2xlbmd0aF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgc2ltcGxlIGBBcnJheSNtYXBgLWxpa2Ugd3JhcHBlciB0byB3b3JrIHdpdGggZG9tYWluIG5hbWUgc3RyaW5ncyBvciBlbWFpbFxuXHQgKiBhZGRyZXNzZXMuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeVxuXHQgKiBjaGFyYWN0ZXIuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgc3RyaW5nIG9mIGNoYXJhY3RlcnMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrXG5cdCAqIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwRG9tYWluKHN0cmluZywgZm4pIHtcblx0XHR2YXIgcGFydHMgPSBzdHJpbmcuc3BsaXQoJ0AnKTtcblx0XHR2YXIgcmVzdWx0ID0gJyc7XG5cdFx0aWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdC8vIEluIGVtYWlsIGFkZHJlc3Nlcywgb25seSB0aGUgZG9tYWluIG5hbWUgc2hvdWxkIGJlIHB1bnljb2RlZC4gTGVhdmVcblx0XHRcdC8vIHRoZSBsb2NhbCBwYXJ0IChpLmUuIGV2ZXJ5dGhpbmcgdXAgdG8gYEBgKSBpbnRhY3QuXG5cdFx0XHRyZXN1bHQgPSBwYXJ0c1swXSArICdAJztcblx0XHRcdHN0cmluZyA9IHBhcnRzWzFdO1xuXHRcdH1cblx0XHQvLyBBdm9pZCBgc3BsaXQocmVnZXgpYCBmb3IgSUU4IGNvbXBhdGliaWxpdHkuIFNlZSAjMTcuXG5cdFx0c3RyaW5nID0gc3RyaW5nLnJlcGxhY2UocmVnZXhTZXBhcmF0b3JzLCAnXFx4MkUnKTtcblx0XHR2YXIgbGFiZWxzID0gc3RyaW5nLnNwbGl0KCcuJyk7XG5cdFx0dmFyIGVuY29kZWQgPSBtYXAobGFiZWxzLCBmbikuam9pbignLicpO1xuXHRcdHJldHVybiByZXN1bHQgKyBlbmNvZGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgbnVtZXJpYyBjb2RlIHBvaW50cyBvZiBlYWNoIFVuaWNvZGVcblx0ICogY2hhcmFjdGVyIGluIHRoZSBzdHJpbmcuIFdoaWxlIEphdmFTY3JpcHQgdXNlcyBVQ1MtMiBpbnRlcm5hbGx5LFxuXHQgKiB0aGlzIGZ1bmN0aW9uIHdpbGwgY29udmVydCBhIHBhaXIgb2Ygc3Vycm9nYXRlIGhhbHZlcyAoZWFjaCBvZiB3aGljaFxuXHQgKiBVQ1MtMiBleHBvc2VzIGFzIHNlcGFyYXRlIGNoYXJhY3RlcnMpIGludG8gYSBzaW5nbGUgY29kZSBwb2ludCxcblx0ICogbWF0Y2hpbmcgVVRGLTE2LlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmVuY29kZWBcblx0ICogQHNlZSA8aHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzQ5MiNzZWN0aW9uLTMuNFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRhcHQoZGVsdGEsIG51bVBvaW50cywgZmlyc3RUaW1lKSB7XG5cdFx0dmFyIGsgPSAwO1xuXHRcdGRlbHRhID0gZmlyc3RUaW1lID8gZmxvb3IoZGVsdGEgLyBkYW1wKSA6IGRlbHRhID4+IDE7XG5cdFx0ZGVsdGEgKz0gZmxvb3IoZGVsdGEgLyBudW1Qb2ludHMpO1xuXHRcdGZvciAoLyogbm8gaW5pdGlhbGl6YXRpb24gKi87IGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG5cdFx0XHRkZWx0YSA9IGZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG5cdFx0fVxuXHRcdHJldHVybiBmbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZShpbnB1dCkge1xuXHRcdC8vIERvbid0IHVzZSBVQ1MtMlxuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgaW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGgsXG5cdFx0ICAgIG91dCxcblx0XHQgICAgaSA9IDAsXG5cdFx0ICAgIG4gPSBpbml0aWFsTixcblx0XHQgICAgYmlhcyA9IGluaXRpYWxCaWFzLFxuXHRcdCAgICBiYXNpYyxcblx0XHQgICAgaixcblx0XHQgICAgaW5kZXgsXG5cdFx0ICAgIG9sZGksXG5cdFx0ICAgIHcsXG5cdFx0ICAgIGssXG5cdFx0ICAgIGRpZ2l0LFxuXHRcdCAgICB0LFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgYmFzZU1pbnVzVDtcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHM6IGxldCBgYmFzaWNgIGJlIHRoZSBudW1iZXIgb2YgaW5wdXQgY29kZVxuXHRcdC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG5cdFx0Ly8gdGhlIGZpcnN0IGJhc2ljIGNvZGUgcG9pbnRzIHRvIHRoZSBvdXRwdXQuXG5cblx0XHRiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG5cdFx0aWYgKGJhc2ljIDwgMCkge1xuXHRcdFx0YmFzaWMgPSAwO1xuXHRcdH1cblxuXHRcdGZvciAoaiA9IDA7IGogPCBiYXNpYzsgKytqKSB7XG5cdFx0XHQvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcblx0XHRcdGlmIChpbnB1dC5jaGFyQ29kZUF0KGopID49IDB4ODApIHtcblx0XHRcdFx0ZXJyb3IoJ25vdC1iYXNpYycpO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBkZWNvZGluZyBsb29wOiBzdGFydCBqdXN0IGFmdGVyIHRoZSBsYXN0IGRlbGltaXRlciBpZiBhbnkgYmFzaWMgY29kZVxuXHRcdC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cblx0XHRmb3IgKGluZGV4ID0gYmFzaWMgPiAwID8gYmFzaWMgKyAxIDogMDsgaW5kZXggPCBpbnB1dExlbmd0aDsgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqLykge1xuXG5cdFx0XHQvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG5cdFx0XHQvLyBEZWNvZGUgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlciBpbnRvIGBkZWx0YWAsXG5cdFx0XHQvLyB3aGljaCBnZXRzIGFkZGVkIHRvIGBpYC4gVGhlIG92ZXJmbG93IGNoZWNraW5nIGlzIGVhc2llclxuXHRcdFx0Ly8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcblx0XHRcdC8vIHZhbHVlIGF0IHRoZSBlbmQgdG8gb2J0YWluIGBkZWx0YWAuXG5cdFx0XHRmb3IgKG9sZGkgPSBpLCB3ID0gMSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cblx0XHRcdFx0aWYgKGluZGV4ID49IGlucHV0TGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA+PSBiYXNlIHx8IGRpZ2l0ID4gZmxvb3IoKG1heEludCAtIGkpIC8gdykpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGkgKz0gZGlnaXQgKiB3O1xuXHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPCB0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHcgKj0gYmFzZU1pbnVzVDtcblxuXHRcdFx0fVxuXG5cdFx0XHRvdXQgPSBvdXRwdXQubGVuZ3RoICsgMTtcblx0XHRcdGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG5cdFx0XHQvLyBgaWAgd2FzIHN1cHBvc2VkIHRvIHdyYXAgYXJvdW5kIGZyb20gYG91dGAgdG8gYDBgLFxuXHRcdFx0Ly8gaW5jcmVtZW50aW5nIGBuYCBlYWNoIHRpbWUsIHNvIHdlJ2xsIGZpeCB0aGF0IG5vdzpcblx0XHRcdGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdG4gKz0gZmxvb3IoaSAvIG91dCk7XG5cdFx0XHRpICU9IG91dDtcblxuXHRcdFx0Ly8gSW5zZXJ0IGBuYCBhdCBwb3NpdGlvbiBgaWAgb2YgdGhlIG91dHB1dFxuXHRcdFx0b3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVjczJlbmNvZGUob3V0cHV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMgKGUuZy4gYSBkb21haW4gbmFtZSBsYWJlbCkgdG8gYVxuXHQgKiBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUoaW5wdXQpIHtcblx0XHR2YXIgbixcblx0XHQgICAgZGVsdGEsXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50LFxuXHRcdCAgICBiYXNpY0xlbmd0aCxcblx0XHQgICAgYmlhcyxcblx0XHQgICAgaixcblx0XHQgICAgbSxcblx0XHQgICAgcSxcblx0XHQgICAgayxcblx0XHQgICAgdCxcblx0XHQgICAgY3VycmVudFZhbHVlLFxuXHRcdCAgICBvdXRwdXQgPSBbXSxcblx0XHQgICAgLyoqIGBpbnB1dExlbmd0aGAgd2lsbCBob2xkIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgaW4gYGlucHV0YC4gKi9cblx0XHQgICAgaW5wdXRMZW5ndGgsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsXG5cdFx0ICAgIGJhc2VNaW51c1QsXG5cdFx0ICAgIHFNaW51c1Q7XG5cblx0XHQvLyBDb252ZXJ0IHRoZSBpbnB1dCBpbiBVQ1MtMiB0byBVbmljb2RlXG5cdFx0aW5wdXQgPSB1Y3MyZGVjb2RlKGlucHV0KTtcblxuXHRcdC8vIENhY2hlIHRoZSBsZW5ndGhcblx0XHRpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHN0YXRlXG5cdFx0biA9IGluaXRpYWxOO1xuXHRcdGRlbHRhID0gMDtcblx0XHRiaWFzID0gaW5pdGlhbEJpYXM7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzXG5cdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGN1cnJlbnRWYWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGhhbmRsZWRDUENvdW50ID0gYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuXG5cdFx0Ly8gYGhhbmRsZWRDUENvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGhhbmRsZWQ7XG5cdFx0Ly8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG5cdFx0Ly8gRmluaXNoIHRoZSBiYXNpYyBzdHJpbmcgLSBpZiBpdCBpcyBub3QgZW1wdHkgLSB3aXRoIGEgZGVsaW1pdGVyXG5cdFx0aWYgKGJhc2ljTGVuZ3RoKSB7XG5cdFx0XHRvdXRwdXQucHVzaChkZWxpbWl0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZW5jb2RpbmcgbG9vcDpcblx0XHR3aGlsZSAoaGFuZGxlZENQQ291bnQgPCBpbnB1dExlbmd0aCkge1xuXG5cdFx0XHQvLyBBbGwgbm9uLWJhc2ljIGNvZGUgcG9pbnRzIDwgbiBoYXZlIGJlZW4gaGFuZGxlZCBhbHJlYWR5LiBGaW5kIHRoZSBuZXh0XG5cdFx0XHQvLyBsYXJnZXIgb25lOlxuXHRcdFx0Zm9yIChtID0gbWF4SW50LCBqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPj0gbiAmJiBjdXJyZW50VmFsdWUgPCBtKSB7XG5cdFx0XHRcdFx0bSA9IGN1cnJlbnRWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG5cdFx0XHQvLyBidXQgZ3VhcmQgYWdhaW5zdCBvdmVyZmxvd1xuXHRcdFx0aGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXHRcdFx0aWYgKG0gLSBuID4gZmxvb3IoKG1heEludCAtIGRlbHRhKSAvIGhhbmRsZWRDUENvdW50UGx1c09uZSkpIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGRlbHRhICs9IChtIC0gbikgKiBoYW5kbGVkQ1BDb3VudFBsdXNPbmU7XG5cdFx0XHRuID0gbTtcblxuXHRcdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IG4gJiYgKytkZWx0YSA+IG1heEludCkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG5cdFx0XHRcdFx0Ly8gUmVwcmVzZW50IGRlbHRhIGFzIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXJcblx0XHRcdFx0XHRmb3IgKHEgPSBkZWx0YSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cdFx0XHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblx0XHRcdFx0XHRcdGlmIChxIDwgdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHFNaW51c1QgPSBxIC0gdDtcblx0XHRcdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKFxuXHRcdFx0XHRcdFx0XHRzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHQgKyBxTWludXNUICUgYmFzZU1pbnVzVCwgMCkpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0cSA9IGZsb29yKHFNaW51c1QgLyBiYXNlTWludXNUKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHEsIDApKSk7XG5cdFx0XHRcdFx0YmlhcyA9IGFkYXB0KGRlbHRhLCBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoKTtcblx0XHRcdFx0XHRkZWx0YSA9IDA7XG5cdFx0XHRcdFx0KytoYW5kbGVkQ1BDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQrK2RlbHRhO1xuXHRcdFx0KytuO1xuXG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzc1xuXHQgKiB0byBVbmljb2RlLiBPbmx5IHRoZSBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGlucHV0IHdpbGwgYmUgY29udmVydGVkLCBpLmUuXG5cdCAqIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlblxuXHQgKiBjb252ZXJ0ZWQgdG8gVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGVkIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG9cblx0ICogY29udmVydCB0byBVbmljb2RlLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgVW5pY29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gUHVueWNvZGVcblx0ICogc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9Vbmljb2RlKGlucHV0KSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihpbnB1dCwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBQdW55Y29kZS4gT25seSB0aGUgbm9uLUFTQ0lJIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCxcblx0ICogaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQncyBhbHJlYWR5IGluXG5cdCAqIEFTQ0lJLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvIGNvbnZlcnQsIGFzIGFcblx0ICogVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUgb3Jcblx0ICogZW1haWwgYWRkcmVzcy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvQVNDSUkoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4zLjInLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBPYmplY3Rcblx0XHQgKi9cblx0XHQndWNzMic6IHtcblx0XHRcdCdkZWNvZGUnOiB1Y3MyZGVjb2RlLFxuXHRcdFx0J2VuY29kZSc6IHVjczJlbmNvZGVcblx0XHR9LFxuXHRcdCdkZWNvZGUnOiBkZWNvZGUsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQndG9BU0NJSSc6IHRvQVNDSUksXG5cdFx0J3RvVW5pY29kZSc6IHRvVW5pY29kZVxuXHR9O1xuXG5cdC8qKiBFeHBvc2UgYHB1bnljb2RlYCAqL1xuXHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRpZiAoXG5cdFx0dHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmXG5cdFx0dHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiZcblx0XHRkZWZpbmUuYW1kXG5cdCkge1xuXHRcdGRlZmluZSgncHVueWNvZGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBwdW55Y29kZTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XG5cdFx0aWYgKG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzKSB7XG5cdFx0XHQvLyBpbiBOb2RlLmpzLCBpby5qcywgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cblx0XHRcdGZvciAoa2V5IGluIHB1bnljb2RlKSB7XG5cdFx0XHRcdHB1bnljb2RlLmhhc093blByb3BlcnR5KGtleSkgJiYgKGZyZWVFeHBvcnRzW2tleV0gPSBwdW55Y29kZVtrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8vIElmIG9iai5oYXNPd25Qcm9wZXJ0eSBoYXMgYmVlbiBvdmVycmlkZGVuLCB0aGVuIGNhbGxpbmdcbi8vIG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSB3aWxsIGJyZWFrLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzE3MDdcbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocXMsIHNlcCwgZXEsIG9wdGlvbnMpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIHZhciBvYmogPSB7fTtcblxuICBpZiAodHlwZW9mIHFzICE9PSAnc3RyaW5nJyB8fCBxcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgdmFyIHJlZ2V4cCA9IC9cXCsvZztcbiAgcXMgPSBxcy5zcGxpdChzZXApO1xuXG4gIHZhciBtYXhLZXlzID0gMTAwMDtcbiAgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubWF4S2V5cyA9PT0gJ251bWJlcicpIHtcbiAgICBtYXhLZXlzID0gb3B0aW9ucy5tYXhLZXlzO1xuICB9XG5cbiAgdmFyIGxlbiA9IHFzLmxlbmd0aDtcbiAgLy8gbWF4S2V5cyA8PSAwIG1lYW5zIHRoYXQgd2Ugc2hvdWxkIG5vdCBsaW1pdCBrZXlzIGNvdW50XG4gIGlmIChtYXhLZXlzID4gMCAmJiBsZW4gPiBtYXhLZXlzKSB7XG4gICAgbGVuID0gbWF4S2V5cztcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICB2YXIgeCA9IHFzW2ldLnJlcGxhY2UocmVnZXhwLCAnJTIwJyksXG4gICAgICAgIGlkeCA9IHguaW5kZXhPZihlcSksXG4gICAgICAgIGtzdHIsIHZzdHIsIGssIHY7XG5cbiAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgIGtzdHIgPSB4LnN1YnN0cigwLCBpZHgpO1xuICAgICAgdnN0ciA9IHguc3Vic3RyKGlkeCArIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrc3RyID0geDtcbiAgICAgIHZzdHIgPSAnJztcbiAgICB9XG5cbiAgICBrID0gZGVjb2RlVVJJQ29tcG9uZW50KGtzdHIpO1xuICAgIHYgPSBkZWNvZGVVUklDb21wb25lbnQodnN0cik7XG5cbiAgICBpZiAoIWhhc093blByb3BlcnR5KG9iaiwgaykpIHtcbiAgICAgIG9ialtrXSA9IHY7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgIG9ialtrXS5wdXNoKHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmpba10gPSBbb2JqW2tdLCB2XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5naWZ5UHJpbWl0aXZlID0gZnVuY3Rpb24odikge1xuICBzd2l0Y2ggKHR5cGVvZiB2KSB7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB2O1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gdiA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIGlzRmluaXRlKHYpID8gdiA6ICcnO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiAnJztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmosIHNlcCwgZXEsIG5hbWUpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICBvYmogPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gbWFwKG9iamVjdEtleXMob2JqKSwgZnVuY3Rpb24oaykge1xuICAgICAgdmFyIGtzID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShrKSkgKyBlcTtcbiAgICAgIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgICAgcmV0dXJuIG1hcChvYmpba10sIGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKHYpKTtcbiAgICAgICAgfSkuam9pbihzZXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmpba10pKTtcbiAgICAgIH1cbiAgICB9KS5qb2luKHNlcCk7XG5cbiAgfVxuXG4gIGlmICghbmFtZSkgcmV0dXJuICcnO1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShuYW1lKSkgKyBlcSArXG4gICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9iaikpO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIG1hcCAoeHMsIGYpIHtcbiAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmKTtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzLnB1c2goZih4c1tpXSwgaSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgcmVzLnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5kZWNvZGUgPSBleHBvcnRzLnBhcnNlID0gcmVxdWlyZSgnLi9kZWNvZGUnKTtcbmV4cG9ydHMuZW5jb2RlID0gZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2VuY29kZScpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV9kdXBsZXguanNcIilcbiIsIi8vIGEgZHVwbGV4IHN0cmVhbSBpcyBqdXN0IGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUuXG4vLyBTaW5jZSBKUyBkb2Vzbid0IGhhdmUgbXVsdGlwbGUgcHJvdG90eXBhbCBpbmhlcml0YW5jZSwgdGhpcyBjbGFzc1xuLy8gcHJvdG90eXBhbGx5IGluaGVyaXRzIGZyb20gUmVhZGFibGUsIGFuZCB0aGVuIHBhcmFzaXRpY2FsbHkgZnJvbVxuLy8gV3JpdGFibGUuXG5cbid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5tb2R1bGUuZXhwb3J0cyA9IER1cGxleDtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBwcm9jZXNzTmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzLW5leHRpY2stYXJncycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBSZWFkYWJsZSA9IHJlcXVpcmUoJy4vX3N0cmVhbV9yZWFkYWJsZScpO1xudmFyIFdyaXRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3dyaXRhYmxlJyk7XG5cbnV0aWwuaW5oZXJpdHMoRHVwbGV4LCBSZWFkYWJsZSk7XG5cbnZhciBrZXlzID0gb2JqZWN0S2V5cyhXcml0YWJsZS5wcm90b3R5cGUpO1xuZm9yICh2YXIgdiA9IDA7IHYgPCBrZXlzLmxlbmd0aDsgdisrKSB7XG4gIHZhciBtZXRob2QgPSBrZXlzW3ZdO1xuICBpZiAoIUR1cGxleC5wcm90b3R5cGVbbWV0aG9kXSlcbiAgICBEdXBsZXgucHJvdG90eXBlW21ldGhvZF0gPSBXcml0YWJsZS5wcm90b3R5cGVbbWV0aG9kXTtcbn1cblxuZnVuY3Rpb24gRHVwbGV4KG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBEdXBsZXgob3B0aW9ucyk7XG5cbiAgUmVhZGFibGUuY2FsbCh0aGlzLCBvcHRpb25zKTtcbiAgV3JpdGFibGUuY2FsbCh0aGlzLCBvcHRpb25zKTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlYWRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLnJlYWRhYmxlID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy53cml0YWJsZSA9PT0gZmFsc2UpXG4gICAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXG4gIHRoaXMuYWxsb3dIYWxmT3BlbiA9IHRydWU7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dIYWxmT3BlbiA9PT0gZmFsc2UpXG4gICAgdGhpcy5hbGxvd0hhbGZPcGVuID0gZmFsc2U7XG5cbiAgdGhpcy5vbmNlKCdlbmQnLCBvbmVuZCk7XG59XG5cbi8vIHRoZSBuby1oYWxmLW9wZW4gZW5mb3JjZXJcbmZ1bmN0aW9uIG9uZW5kKCkge1xuICAvLyBpZiB3ZSBhbGxvdyBoYWxmLW9wZW4gc3RhdGUsIG9yIGlmIHRoZSB3cml0YWJsZSBzaWRlIGVuZGVkLFxuICAvLyB0aGVuIHdlJ3JlIG9rLlxuICBpZiAodGhpcy5hbGxvd0hhbGZPcGVuIHx8IHRoaXMuX3dyaXRhYmxlU3RhdGUuZW5kZWQpXG4gICAgcmV0dXJuO1xuXG4gIC8vIG5vIG1vcmUgZGF0YSBjYW4gYmUgd3JpdHRlbi5cbiAgLy8gQnV0IGFsbG93IG1vcmUgd3JpdGVzIHRvIGhhcHBlbiBpbiB0aGlzIHRpY2suXG4gIHByb2Nlc3NOZXh0VGljayhvbkVuZE5ULCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gb25FbmROVChzZWxmKSB7XG4gIHNlbGYuZW5kKCk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2ggKHhzLCBmKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZih4c1tpXSwgaSk7XG4gIH1cbn1cbiIsIi8vIGEgcGFzc3Rocm91Z2ggc3RyZWFtLlxuLy8gYmFzaWNhbGx5IGp1c3QgdGhlIG1vc3QgbWluaW1hbCBzb3J0IG9mIFRyYW5zZm9ybSBzdHJlYW0uXG4vLyBFdmVyeSB3cml0dGVuIGNodW5rIGdldHMgb3V0cHV0IGFzLWlzLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUGFzc1Rocm91Z2g7XG5cbnZhciBUcmFuc2Zvcm0gPSByZXF1aXJlKCcuL19zdHJlYW1fdHJhbnNmb3JtJyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudXRpbC5pbmhlcml0cyhQYXNzVGhyb3VnaCwgVHJhbnNmb3JtKTtcblxuZnVuY3Rpb24gUGFzc1Rocm91Z2gob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUGFzc1Rocm91Z2gpKVxuICAgIHJldHVybiBuZXcgUGFzc1Rocm91Z2gob3B0aW9ucyk7XG5cbiAgVHJhbnNmb3JtLmNhbGwodGhpcywgb3B0aW9ucyk7XG59XG5cblBhc3NUaHJvdWdoLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihudWxsLCBjaHVuayk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWRhYmxlO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHByb2Nlc3NOZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5Jyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5SZWFkYWJsZS5SZWFkYWJsZVN0YXRlID0gUmVhZGFibGVTdGF0ZTtcblxudmFyIEVFID0gcmVxdWlyZSgnZXZlbnRzJyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgRUVsaXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lcnModHlwZSkubGVuZ3RoO1xufTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBTdHJlYW07XG4oZnVuY3Rpb24gKCl7dHJ5e1xuICBTdHJlYW0gPSByZXF1aXJlKCdzdCcgKyAncmVhbScpO1xufWNhdGNoKF8pe31maW5hbGx5e1xuICBpZiAoIVN0cmVhbSlcbiAgICBTdHJlYW0gPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG59fSgpKVxuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgZGVidWdVdGlsID0gcmVxdWlyZSgndXRpbCcpO1xudmFyIGRlYnVnO1xuaWYgKGRlYnVnVXRpbCAmJiBkZWJ1Z1V0aWwuZGVidWdsb2cpIHtcbiAgZGVidWcgPSBkZWJ1Z1V0aWwuZGVidWdsb2coJ3N0cmVhbScpO1xufSBlbHNlIHtcbiAgZGVidWcgPSBmdW5jdGlvbiAoKSB7fTtcbn1cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgU3RyaW5nRGVjb2RlcjtcblxudXRpbC5pbmhlcml0cyhSZWFkYWJsZSwgU3RyZWFtKTtcblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFJlYWRhYmxlU3RhdGUob3B0aW9ucywgc3RyZWFtKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnLiBVc2VkIHRvIG1ha2UgcmVhZChuKSBpZ25vcmUgbiBhbmQgdG9cbiAgLy8gbWFrZSBhbGwgdGhlIGJ1ZmZlciBtZXJnaW5nIGFuZCBsZW5ndGggY2hlY2tzIGdvIGF3YXlcbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLnJlYWRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyB0aGUgcG9pbnQgYXQgd2hpY2ggaXQgc3RvcHMgY2FsbGluZyBfcmVhZCgpIHRvIGZpbGwgdGhlIGJ1ZmZlclxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIFwiZG9uJ3QgY2FsbCBfcmVhZCBwcmVlbXB0aXZlbHkgZXZlclwiXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gdGhpcy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gY2FzdCB0byBpbnRzLlxuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSB+fnRoaXMuaGlnaFdhdGVyTWFyaztcblxuICB0aGlzLmJ1ZmZlciA9IFtdO1xuICB0aGlzLmxlbmd0aCA9IDA7XG4gIHRoaXMucGlwZXMgPSBudWxsO1xuICB0aGlzLnBpcGVzQ291bnQgPSAwO1xuICB0aGlzLmZsb3dpbmcgPSBudWxsO1xuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIHRoaXMuZW5kRW1pdHRlZCA9IGZhbHNlO1xuICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyB3aGVuZXZlciB3ZSByZXR1cm4gbnVsbCwgdGhlbiB3ZSBzZXQgYSBmbGFnIHRvIHNheVxuICAvLyB0aGF0IHdlJ3JlIGF3YWl0aW5nIGEgJ3JlYWRhYmxlJyBldmVudCBlbWlzc2lvbi5cbiAgdGhpcy5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5yZWFkYWJsZUxpc3RlbmluZyA9IGZhbHNlO1xuXG4gIC8vIENyeXB0byBpcyBraW5kIG9mIG9sZCBhbmQgY3J1c3R5LiAgSGlzdG9yaWNhbGx5LCBpdHMgZGVmYXVsdCBzdHJpbmdcbiAgLy8gZW5jb2RpbmcgaXMgJ2JpbmFyeScgc28gd2UgaGF2ZSB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlLlxuICAvLyBFdmVyeXRoaW5nIGVsc2UgaW4gdGhlIHVuaXZlcnNlIHVzZXMgJ3V0ZjgnLCB0aG91Z2guXG4gIHRoaXMuZGVmYXVsdEVuY29kaW5nID0gb3B0aW9ucy5kZWZhdWx0RW5jb2RpbmcgfHwgJ3V0ZjgnO1xuXG4gIC8vIHdoZW4gcGlwaW5nLCB3ZSBvbmx5IGNhcmUgYWJvdXQgJ3JlYWRhYmxlJyBldmVudHMgdGhhdCBoYXBwZW5cbiAgLy8gYWZ0ZXIgcmVhZCgpaW5nIGFsbCB0aGUgYnl0ZXMgYW5kIG5vdCBnZXR0aW5nIGFueSBwdXNoYmFjay5cbiAgdGhpcy5yYW5PdXQgPSBmYWxzZTtcblxuICAvLyB0aGUgbnVtYmVyIG9mIHdyaXRlcnMgdGhhdCBhcmUgYXdhaXRpbmcgYSBkcmFpbiBldmVudCBpbiAucGlwZSgpc1xuICB0aGlzLmF3YWl0RHJhaW4gPSAwO1xuXG4gIC8vIGlmIHRydWUsIGEgbWF5YmVSZWFkTW9yZSBoYXMgYmVlbiBzY2hlZHVsZWRcbiAgdGhpcy5yZWFkaW5nTW9yZSA9IGZhbHNlO1xuXG4gIHRoaXMuZGVjb2RlciA9IG51bGw7XG4gIHRoaXMuZW5jb2RpbmcgPSBudWxsO1xuICBpZiAob3B0aW9ucy5lbmNvZGluZykge1xuICAgIGlmICghU3RyaW5nRGVjb2RlcilcbiAgICAgIFN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2Rlci8nKS5TdHJpbmdEZWNvZGVyO1xuICAgIHRoaXMuZGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKG9wdGlvbnMuZW5jb2RpbmcpO1xuICAgIHRoaXMuZW5jb2RpbmcgPSBvcHRpb25zLmVuY29kaW5nO1xuICB9XG59XG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBSZWFkYWJsZShvcHRpb25zKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJlYWRhYmxlKSlcbiAgICByZXR1cm4gbmV3IFJlYWRhYmxlKG9wdGlvbnMpO1xuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUgPSBuZXcgUmVhZGFibGVTdGF0ZShvcHRpb25zLCB0aGlzKTtcblxuICAvLyBsZWdhY3lcbiAgdGhpcy5yZWFkYWJsZSA9IHRydWU7XG5cbiAgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMucmVhZCA9PT0gJ2Z1bmN0aW9uJylcbiAgICB0aGlzLl9yZWFkID0gb3B0aW9ucy5yZWFkO1xuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBNYW51YWxseSBzaG92ZSBzb21ldGhpbmcgaW50byB0aGUgcmVhZCgpIGJ1ZmZlci5cbi8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBoaWdoV2F0ZXJNYXJrIGhhcyBub3QgYmVlbiBoaXQgeWV0LFxuLy8gc2ltaWxhciB0byBob3cgV3JpdGFibGUud3JpdGUoKSByZXR1cm5zIHRydWUgaWYgeW91IHNob3VsZFxuLy8gd3JpdGUoKSBzb21lIG1vcmUuXG5SZWFkYWJsZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZykge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuXG4gIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJiB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBlbmNvZGluZyB8fCBzdGF0ZS5kZWZhdWx0RW5jb2Rpbmc7XG4gICAgaWYgKGVuY29kaW5nICE9PSBzdGF0ZS5lbmNvZGluZykge1xuICAgICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gICAgICBlbmNvZGluZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGZhbHNlKTtcbn07XG5cbi8vIFVuc2hpZnQgc2hvdWxkICphbHdheXMqIGJlIHNvbWV0aGluZyBkaXJlY3RseSBvdXQgb2YgcmVhZCgpXG5SZWFkYWJsZS5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uKGNodW5rKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgJycsIHRydWUpO1xufTtcblxuUmVhZGFibGUucHJvdG90eXBlLmlzUGF1c2VkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPT09IGZhbHNlO1xufTtcblxuZnVuY3Rpb24gcmVhZGFibGVBZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGFkZFRvRnJvbnQpIHtcbiAgdmFyIGVyID0gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuayk7XG4gIGlmIChlcikge1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgfSBlbHNlIGlmIChjaHVuayA9PT0gbnVsbCkge1xuICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgICBvbkVvZkNodW5rKHN0cmVhbSwgc3RhdGUpO1xuICB9IGVsc2UgaWYgKHN0YXRlLm9iamVjdE1vZGUgfHwgY2h1bmsgJiYgY2h1bmsubGVuZ3RoID4gMCkge1xuICAgIGlmIChzdGF0ZS5lbmRlZCAmJiAhYWRkVG9Gcm9udCkge1xuICAgICAgdmFyIGUgPSBuZXcgRXJyb3IoJ3N0cmVhbS5wdXNoKCkgYWZ0ZXIgRU9GJyk7XG4gICAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlKTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlLmVuZEVtaXR0ZWQgJiYgYWRkVG9Gcm9udCkge1xuICAgICAgdmFyIGUgPSBuZXcgRXJyb3IoJ3N0cmVhbS51bnNoaWZ0KCkgYWZ0ZXIgZW5kIGV2ZW50Jyk7XG4gICAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHN0YXRlLmRlY29kZXIgJiYgIWFkZFRvRnJvbnQgJiYgIWVuY29kaW5nKVxuICAgICAgICBjaHVuayA9IHN0YXRlLmRlY29kZXIud3JpdGUoY2h1bmspO1xuXG4gICAgICBpZiAoIWFkZFRvRnJvbnQpXG4gICAgICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcblxuICAgICAgLy8gaWYgd2Ugd2FudCB0aGUgZGF0YSBub3csIGp1c3QgZW1pdCBpdC5cbiAgICAgIGlmIChzdGF0ZS5mbG93aW5nICYmIHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuc3luYykge1xuICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGNodW5rKTtcbiAgICAgICAgc3RyZWFtLnJlYWQoMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB1cGRhdGUgdGhlIGJ1ZmZlciBpbmZvLlxuICAgICAgICBzdGF0ZS5sZW5ndGggKz0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG4gICAgICAgIGlmIChhZGRUb0Zyb250KVxuICAgICAgICAgIHN0YXRlLmJ1ZmZlci51bnNoaWZ0KGNodW5rKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHN0YXRlLmJ1ZmZlci5wdXNoKGNodW5rKTtcblxuICAgICAgICBpZiAoc3RhdGUubmVlZFJlYWRhYmxlKVxuICAgICAgICAgIGVtaXRSZWFkYWJsZShzdHJlYW0pO1xuICAgICAgfVxuXG4gICAgICBtYXliZVJlYWRNb3JlKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfSBlbHNlIGlmICghYWRkVG9Gcm9udCkge1xuICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBuZWVkTW9yZURhdGEoc3RhdGUpO1xufVxuXG5cbi8vIGlmIGl0J3MgcGFzdCB0aGUgaGlnaCB3YXRlciBtYXJrLCB3ZSBjYW4gcHVzaCBpbiBzb21lIG1vcmUuXG4vLyBBbHNvLCBpZiB3ZSBoYXZlIG5vIGRhdGEgeWV0LCB3ZSBjYW4gc3RhbmQgc29tZVxuLy8gbW9yZSBieXRlcy4gIFRoaXMgaXMgdG8gd29yayBhcm91bmQgY2FzZXMgd2hlcmUgaHdtPTAsXG4vLyBzdWNoIGFzIHRoZSByZXBsLiAgQWxzbywgaWYgdGhlIHB1c2goKSB0cmlnZ2VyZWQgYVxuLy8gcmVhZGFibGUgZXZlbnQsIGFuZCB0aGUgdXNlciBjYWxsZWQgcmVhZChsYXJnZU51bWJlcikgc3VjaCB0aGF0XG4vLyBuZWVkUmVhZGFibGUgd2FzIHNldCwgdGhlbiB3ZSBvdWdodCB0byBwdXNoIG1vcmUsIHNvIHRoYXQgYW5vdGhlclxuLy8gJ3JlYWRhYmxlJyBldmVudCB3aWxsIGJlIHRyaWdnZXJlZC5cbmZ1bmN0aW9uIG5lZWRNb3JlRGF0YShzdGF0ZSkge1xuICByZXR1cm4gIXN0YXRlLmVuZGVkICYmXG4gICAgICAgICAoc3RhdGUubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyayB8fFxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCk7XG59XG5cbi8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuUmVhZGFibGUucHJvdG90eXBlLnNldEVuY29kaW5nID0gZnVuY3Rpb24oZW5jKSB7XG4gIGlmICghU3RyaW5nRGVjb2RlcilcbiAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoZW5jKTtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5lbmNvZGluZyA9IGVuYztcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBEb24ndCByYWlzZSB0aGUgaHdtID4gOE1CXG52YXIgTUFYX0hXTSA9IDB4ODAwMDAwO1xuZnVuY3Rpb24gY29tcHV0ZU5ld0hpZ2hXYXRlck1hcmsobikge1xuICBpZiAobiA+PSBNQVhfSFdNKSB7XG4gICAgbiA9IE1BWF9IV007XG4gIH0gZWxzZSB7XG4gICAgLy8gR2V0IHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXIgb2YgMlxuICAgIG4tLTtcbiAgICBuIHw9IG4gPj4+IDE7XG4gICAgbiB8PSBuID4+PiAyO1xuICAgIG4gfD0gbiA+Pj4gNDtcbiAgICBuIHw9IG4gPj4+IDg7XG4gICAgbiB8PSBuID4+PiAxNjtcbiAgICBuKys7XG4gIH1cbiAgcmV0dXJuIG47XG59XG5cbmZ1bmN0aW9uIGhvd011Y2hUb1JlYWQobiwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICByZXR1cm4gMDtcblxuICBpZiAoc3RhdGUub2JqZWN0TW9kZSlcbiAgICByZXR1cm4gbiA9PT0gMCA/IDAgOiAxO1xuXG4gIGlmIChuID09PSBudWxsIHx8IGlzTmFOKG4pKSB7XG4gICAgLy8gb25seSBmbG93IG9uZSBidWZmZXIgYXQgYSB0aW1lXG4gICAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgc3RhdGUuYnVmZmVyLmxlbmd0aClcbiAgICAgIHJldHVybiBzdGF0ZS5idWZmZXJbMF0ubGVuZ3RoO1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBzdGF0ZS5sZW5ndGg7XG4gIH1cblxuICBpZiAobiA8PSAwKVxuICAgIHJldHVybiAwO1xuXG4gIC8vIElmIHdlJ3JlIGFza2luZyBmb3IgbW9yZSB0aGFuIHRoZSB0YXJnZXQgYnVmZmVyIGxldmVsLFxuICAvLyB0aGVuIHJhaXNlIHRoZSB3YXRlciBtYXJrLiAgQnVtcCB1cCB0byB0aGUgbmV4dCBoaWdoZXN0XG4gIC8vIHBvd2VyIG9mIDIsIHRvIHByZXZlbnQgaW5jcmVhc2luZyBpdCBleGNlc3NpdmVseSBpbiB0aW55XG4gIC8vIGFtb3VudHMuXG4gIGlmIChuID4gc3RhdGUuaGlnaFdhdGVyTWFyaylcbiAgICBzdGF0ZS5oaWdoV2F0ZXJNYXJrID0gY29tcHV0ZU5ld0hpZ2hXYXRlck1hcmsobik7XG5cbiAgLy8gZG9uJ3QgaGF2ZSB0aGF0IG11Y2guICByZXR1cm4gbnVsbCwgdW5sZXNzIHdlJ3ZlIGVuZGVkLlxuICBpZiAobiA+IHN0YXRlLmxlbmd0aCkge1xuICAgIGlmICghc3RhdGUuZW5kZWQpIHtcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgICByZXR1cm4gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbjtcbn1cblxuLy8geW91IGNhbiBvdmVycmlkZSBlaXRoZXIgdGhpcyBtZXRob2QsIG9yIHRoZSBhc3luYyBfcmVhZChuKSBiZWxvdy5cblJlYWRhYmxlLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24obikge1xuICBkZWJ1ZygncmVhZCcsIG4pO1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgbk9yaWcgPSBuO1xuXG4gIGlmICh0eXBlb2YgbiAhPT0gJ251bWJlcicgfHwgbiA+IDApXG4gICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG5cbiAgLy8gaWYgd2UncmUgZG9pbmcgcmVhZCgwKSB0byB0cmlnZ2VyIGEgcmVhZGFibGUgZXZlbnQsIGJ1dCB3ZVxuICAvLyBhbHJlYWR5IGhhdmUgYSBidW5jaCBvZiBkYXRhIGluIHRoZSBidWZmZXIsIHRoZW4ganVzdCB0cmlnZ2VyXG4gIC8vIHRoZSAncmVhZGFibGUnIGV2ZW50IGFuZCBtb3ZlIG9uLlxuICBpZiAobiA9PT0gMCAmJlxuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlICYmXG4gICAgICAoc3RhdGUubGVuZ3RoID49IHN0YXRlLmhpZ2hXYXRlck1hcmsgfHwgc3RhdGUuZW5kZWQpKSB7XG4gICAgZGVidWcoJ3JlYWQ6IGVtaXRSZWFkYWJsZScsIHN0YXRlLmxlbmd0aCwgc3RhdGUuZW5kZWQpO1xuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUuZW5kZWQpXG4gICAgICBlbmRSZWFkYWJsZSh0aGlzKTtcbiAgICBlbHNlXG4gICAgICBlbWl0UmVhZGFibGUodGhpcyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBuID0gaG93TXVjaFRvUmVhZChuLCBzdGF0ZSk7XG5cbiAgLy8gaWYgd2UndmUgZW5kZWQsIGFuZCB3ZSdyZSBub3cgY2xlYXIsIHRoZW4gZmluaXNoIGl0IHVwLlxuICBpZiAobiA9PT0gMCAmJiBzdGF0ZS5lbmRlZCkge1xuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgICBlbmRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEFsbCB0aGUgYWN0dWFsIGNodW5rIGdlbmVyYXRpb24gbG9naWMgbmVlZHMgdG8gYmVcbiAgLy8gKmJlbG93KiB0aGUgY2FsbCB0byBfcmVhZC4gIFRoZSByZWFzb24gaXMgdGhhdCBpbiBjZXJ0YWluXG4gIC8vIHN5bnRoZXRpYyBzdHJlYW0gY2FzZXMsIHN1Y2ggYXMgcGFzc3Rocm91Z2ggc3RyZWFtcywgX3JlYWRcbiAgLy8gbWF5IGJlIGEgY29tcGxldGVseSBzeW5jaHJvbm91cyBvcGVyYXRpb24gd2hpY2ggbWF5IGNoYW5nZVxuICAvLyB0aGUgc3RhdGUgb2YgdGhlIHJlYWQgYnVmZmVyLCBwcm92aWRpbmcgZW5vdWdoIGRhdGEgd2hlblxuICAvLyBiZWZvcmUgdGhlcmUgd2FzICpub3QqIGVub3VnaC5cbiAgLy9cbiAgLy8gU28sIHRoZSBzdGVwcyBhcmU6XG4gIC8vIDEuIEZpZ3VyZSBvdXQgd2hhdCB0aGUgc3RhdGUgb2YgdGhpbmdzIHdpbGwgYmUgYWZ0ZXIgd2UgZG9cbiAgLy8gYSByZWFkIGZyb20gdGhlIGJ1ZmZlci5cbiAgLy9cbiAgLy8gMi4gSWYgdGhhdCByZXN1bHRpbmcgc3RhdGUgd2lsbCB0cmlnZ2VyIGEgX3JlYWQsIHRoZW4gY2FsbCBfcmVhZC5cbiAgLy8gTm90ZSB0aGF0IHRoaXMgbWF5IGJlIGFzeW5jaHJvbm91cywgb3Igc3luY2hyb25vdXMuICBZZXMsIGl0IGlzXG4gIC8vIGRlZXBseSB1Z2x5IHRvIHdyaXRlIEFQSXMgdGhpcyB3YXksIGJ1dCB0aGF0IHN0aWxsIGRvZXNuJ3QgbWVhblxuICAvLyB0aGF0IHRoZSBSZWFkYWJsZSBjbGFzcyBzaG91bGQgYmVoYXZlIGltcHJvcGVybHksIGFzIHN0cmVhbXMgYXJlXG4gIC8vIGRlc2lnbmVkIHRvIGJlIHN5bmMvYXN5bmMgYWdub3N0aWMuXG4gIC8vIFRha2Ugbm90ZSBpZiB0aGUgX3JlYWQgY2FsbCBpcyBzeW5jIG9yIGFzeW5jIChpZSwgaWYgdGhlIHJlYWQgY2FsbFxuICAvLyBoYXMgcmV0dXJuZWQgeWV0KSwgc28gdGhhdCB3ZSBrbm93IHdoZXRoZXIgb3Igbm90IGl0J3Mgc2FmZSB0byBlbWl0XG4gIC8vICdyZWFkYWJsZScgZXRjLlxuICAvL1xuICAvLyAzLiBBY3R1YWxseSBwdWxsIHRoZSByZXF1ZXN0ZWQgY2h1bmtzIG91dCBvZiB0aGUgYnVmZmVyIGFuZCByZXR1cm4uXG5cbiAgLy8gaWYgd2UgbmVlZCBhIHJlYWRhYmxlIGV2ZW50LCB0aGVuIHdlIG5lZWQgdG8gZG8gc29tZSByZWFkaW5nLlxuICB2YXIgZG9SZWFkID0gc3RhdGUubmVlZFJlYWRhYmxlO1xuICBkZWJ1ZygnbmVlZCByZWFkYWJsZScsIGRvUmVhZCk7XG5cbiAgLy8gaWYgd2UgY3VycmVudGx5IGhhdmUgbGVzcyB0aGFuIHRoZSBoaWdoV2F0ZXJNYXJrLCB0aGVuIGFsc28gcmVhZCBzb21lXG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgfHwgc3RhdGUubGVuZ3RoIC0gbiA8IHN0YXRlLmhpZ2hXYXRlck1hcmspIHtcbiAgICBkb1JlYWQgPSB0cnVlO1xuICAgIGRlYnVnKCdsZW5ndGggbGVzcyB0aGFuIHdhdGVybWFyaycsIGRvUmVhZCk7XG4gIH1cblxuICAvLyBob3dldmVyLCBpZiB3ZSd2ZSBlbmRlZCwgdGhlbiB0aGVyZSdzIG5vIHBvaW50LCBhbmQgaWYgd2UncmUgYWxyZWFkeVxuICAvLyByZWFkaW5nLCB0aGVuIGl0J3MgdW5uZWNlc3NhcnkuXG4gIGlmIChzdGF0ZS5lbmRlZCB8fCBzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZG9SZWFkID0gZmFsc2U7XG4gICAgZGVidWcoJ3JlYWRpbmcgb3IgZW5kZWQnLCBkb1JlYWQpO1xuICB9XG5cbiAgaWYgKGRvUmVhZCkge1xuICAgIGRlYnVnKCdkbyByZWFkJyk7XG4gICAgc3RhdGUucmVhZGluZyA9IHRydWU7XG4gICAgc3RhdGUuc3luYyA9IHRydWU7XG4gICAgLy8gaWYgdGhlIGxlbmd0aCBpcyBjdXJyZW50bHkgemVybywgdGhlbiB3ZSAqbmVlZCogYSByZWFkYWJsZSBldmVudC5cbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKVxuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAvLyBjYWxsIGludGVybmFsIHJlYWQgbWV0aG9kXG4gICAgdGhpcy5fcmVhZChzdGF0ZS5oaWdoV2F0ZXJNYXJrKTtcbiAgICBzdGF0ZS5zeW5jID0gZmFsc2U7XG4gIH1cblxuICAvLyBJZiBfcmVhZCBwdXNoZWQgZGF0YSBzeW5jaHJvbm91c2x5LCB0aGVuIGByZWFkaW5nYCB3aWxsIGJlIGZhbHNlLFxuICAvLyBhbmQgd2UgbmVlZCB0byByZS1ldmFsdWF0ZSBob3cgbXVjaCBkYXRhIHdlIGNhbiByZXR1cm4gdG8gdGhlIHVzZXIuXG4gIGlmIChkb1JlYWQgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgbiA9IGhvd011Y2hUb1JlYWQobk9yaWcsIHN0YXRlKTtcblxuICB2YXIgcmV0O1xuICBpZiAobiA+IDApXG4gICAgcmV0ID0gZnJvbUxpc3Qobiwgc3RhdGUpO1xuICBlbHNlXG4gICAgcmV0ID0gbnVsbDtcblxuICBpZiAocmV0ID09PSBudWxsKSB7XG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICBuID0gMDtcbiAgfVxuXG4gIHN0YXRlLmxlbmd0aCAtPSBuO1xuXG4gIC8vIElmIHdlIGhhdmUgbm90aGluZyBpbiB0aGUgYnVmZmVyLCB0aGVuIHdlIHdhbnQgdG8ga25vd1xuICAvLyBhcyBzb29uIGFzIHdlICpkbyogZ2V0IHNvbWV0aGluZyBpbnRvIHRoZSBidWZmZXIuXG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgJiYgIXN0YXRlLmVuZGVkKVxuICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG5cbiAgLy8gSWYgd2UgdHJpZWQgdG8gcmVhZCgpIHBhc3QgdGhlIEVPRiwgdGhlbiBlbWl0IGVuZCBvbiB0aGUgbmV4dCB0aWNrLlxuICBpZiAobk9yaWcgIT09IG4gJiYgc3RhdGUuZW5kZWQgJiYgc3RhdGUubGVuZ3RoID09PSAwKVxuICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuXG4gIGlmIChyZXQgIT09IG51bGwpXG4gICAgdGhpcy5lbWl0KCdkYXRhJywgcmV0KTtcblxuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuaykge1xuICB2YXIgZXIgPSBudWxsO1xuICBpZiAoIShCdWZmZXIuaXNCdWZmZXIoY2h1bmspKSAmJlxuICAgICAgdHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJyAmJlxuICAgICAgY2h1bmsgIT09IG51bGwgJiZcbiAgICAgIGNodW5rICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZXIgPSBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG5vbi1zdHJpbmcvYnVmZmVyIGNodW5rJyk7XG4gIH1cbiAgcmV0dXJuIGVyO1xufVxuXG5cbmZ1bmN0aW9uIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUuZW5kZWQpIHJldHVybjtcbiAgaWYgKHN0YXRlLmRlY29kZXIpIHtcbiAgICB2YXIgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLmVuZCgpO1xuICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpIHtcbiAgICAgIHN0YXRlLmJ1ZmZlci5wdXNoKGNodW5rKTtcbiAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuXG4gIC8vIGVtaXQgJ3JlYWRhYmxlJyBub3cgdG8gbWFrZSBzdXJlIGl0IGdldHMgcGlja2VkIHVwLlxuICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbn1cblxuLy8gRG9uJ3QgZW1pdCByZWFkYWJsZSByaWdodCBhd2F5IGluIHN5bmMgbW9kZSwgYmVjYXVzZSB0aGlzIGNhbiB0cmlnZ2VyXG4vLyBhbm90aGVyIHJlYWQoKSBjYWxsID0+IHN0YWNrIG92ZXJmbG93LiAgVGhpcyB3YXksIGl0IG1pZ2h0IHRyaWdnZXJcbi8vIGEgbmV4dFRpY2sgcmVjdXJzaW9uIHdhcm5pbmcsIGJ1dCB0aGF0J3Mgbm90IHNvIGJhZC5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBzdGF0ZS5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgaWYgKCFzdGF0ZS5lbWl0dGVkUmVhZGFibGUpIHtcbiAgICBkZWJ1ZygnZW1pdFJlYWRhYmxlJywgc3RhdGUuZmxvd2luZyk7XG4gICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICBpZiAoc3RhdGUuc3luYylcbiAgICAgIHByb2Nlc3NOZXh0VGljayhlbWl0UmVhZGFibGVfLCBzdHJlYW0pO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGVfKHN0cmVhbSkge1xuICBkZWJ1ZygnZW1pdCByZWFkYWJsZScpO1xuICBzdHJlYW0uZW1pdCgncmVhZGFibGUnKTtcbiAgZmxvdyhzdHJlYW0pO1xufVxuXG5cbi8vIGF0IHRoaXMgcG9pbnQsIHRoZSB1c2VyIGhhcyBwcmVzdW1hYmx5IHNlZW4gdGhlICdyZWFkYWJsZScgZXZlbnQsXG4vLyBhbmQgY2FsbGVkIHJlYWQoKSB0byBjb25zdW1lIHNvbWUgZGF0YS4gIHRoYXQgbWF5IGhhdmUgdHJpZ2dlcmVkXG4vLyBpbiB0dXJuIGFub3RoZXIgX3JlYWQobikgY2FsbCwgaW4gd2hpY2ggY2FzZSByZWFkaW5nID0gdHJ1ZSBpZlxuLy8gaXQncyBpbiBwcm9ncmVzcy5cbi8vIEhvd2V2ZXIsIGlmIHdlJ3JlIG5vdCBlbmRlZCwgb3IgcmVhZGluZywgYW5kIHRoZSBsZW5ndGggPCBod20sXG4vLyB0aGVuIGdvIGFoZWFkIGFuZCB0cnkgdG8gcmVhZCBzb21lIG1vcmUgcHJlZW1wdGl2ZWx5LlxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVhZGluZ01vcmUpIHtcbiAgICBzdGF0ZS5yZWFkaW5nTW9yZSA9IHRydWU7XG4gICAgcHJvY2Vzc05leHRUaWNrKG1heWJlUmVhZE1vcmVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXliZVJlYWRNb3JlXyhzdHJlYW0sIHN0YXRlKSB7XG4gIHZhciBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIHdoaWxlICghc3RhdGUucmVhZGluZyAmJiAhc3RhdGUuZmxvd2luZyAmJiAhc3RhdGUuZW5kZWQgJiZcbiAgICAgICAgIHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcmspIHtcbiAgICBkZWJ1ZygnbWF5YmVSZWFkTW9yZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgICBpZiAobGVuID09PSBzdGF0ZS5sZW5ndGgpXG4gICAgICAvLyBkaWRuJ3QgZ2V0IGFueSBkYXRhLCBzdG9wIHNwaW5uaW5nLlxuICAgICAgYnJlYWs7XG4gICAgZWxzZVxuICAgICAgbGVuID0gc3RhdGUubGVuZ3RoO1xuICB9XG4gIHN0YXRlLnJlYWRpbmdNb3JlID0gZmFsc2U7XG59XG5cbi8vIGFic3RyYWN0IG1ldGhvZC4gIHRvIGJlIG92ZXJyaWRkZW4gaW4gc3BlY2lmaWMgaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vIGNhbGwgY2IoZXIsIGRhdGEpIHdoZXJlIGRhdGEgaXMgPD0gbiBpbiBsZW5ndGguXG4vLyBmb3IgdmlydHVhbCAobm9uLXN0cmluZywgbm9uLWJ1ZmZlcikgc3RyZWFtcywgXCJsZW5ndGhcIiBpcyBzb21ld2hhdFxuLy8gYXJiaXRyYXJ5LCBhbmQgcGVyaGFwcyBub3QgdmVyeSBtZWFuaW5nZnVsLlxuUmVhZGFibGUucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24obikge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5SZWFkYWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKGRlc3QsIHBpcGVPcHRzKSB7XG4gIHZhciBzcmMgPSB0aGlzO1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuXG4gIHN3aXRjaCAoc3RhdGUucGlwZXNDb3VudCkge1xuICAgIGNhc2UgMDpcbiAgICAgIHN0YXRlLnBpcGVzID0gZGVzdDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMTpcbiAgICAgIHN0YXRlLnBpcGVzID0gW3N0YXRlLnBpcGVzLCBkZXN0XTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBzdGF0ZS5waXBlcy5wdXNoKGRlc3QpO1xuICAgICAgYnJlYWs7XG4gIH1cbiAgc3RhdGUucGlwZXNDb3VudCArPSAxO1xuICBkZWJ1ZygncGlwZSBjb3VudD0lZCBvcHRzPSVqJywgc3RhdGUucGlwZXNDb3VudCwgcGlwZU9wdHMpO1xuXG4gIHZhciBkb0VuZCA9ICghcGlwZU9wdHMgfHwgcGlwZU9wdHMuZW5kICE9PSBmYWxzZSkgJiZcbiAgICAgICAgICAgICAgZGVzdCAhPT0gcHJvY2Vzcy5zdGRvdXQgJiZcbiAgICAgICAgICAgICAgZGVzdCAhPT0gcHJvY2Vzcy5zdGRlcnI7XG5cbiAgdmFyIGVuZEZuID0gZG9FbmQgPyBvbmVuZCA6IGNsZWFudXA7XG4gIGlmIChzdGF0ZS5lbmRFbWl0dGVkKVxuICAgIHByb2Nlc3NOZXh0VGljayhlbmRGbik7XG4gIGVsc2VcbiAgICBzcmMub25jZSgnZW5kJywgZW5kRm4pO1xuXG4gIGRlc3Qub24oJ3VucGlwZScsIG9udW5waXBlKTtcbiAgZnVuY3Rpb24gb251bnBpcGUocmVhZGFibGUpIHtcbiAgICBkZWJ1Zygnb251bnBpcGUnKTtcbiAgICBpZiAocmVhZGFibGUgPT09IHNyYykge1xuICAgICAgY2xlYW51cCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZW5kKCkge1xuICAgIGRlYnVnKCdvbmVuZCcpO1xuICAgIGRlc3QuZW5kKCk7XG4gIH1cblxuICAvLyB3aGVuIHRoZSBkZXN0IGRyYWlucywgaXQgcmVkdWNlcyB0aGUgYXdhaXREcmFpbiBjb3VudGVyXG4gIC8vIG9uIHRoZSBzb3VyY2UuICBUaGlzIHdvdWxkIGJlIG1vcmUgZWxlZ2FudCB3aXRoIGEgLm9uY2UoKVxuICAvLyBoYW5kbGVyIGluIGZsb3coKSwgYnV0IGFkZGluZyBhbmQgcmVtb3ZpbmcgcmVwZWF0ZWRseSBpc1xuICAvLyB0b28gc2xvdy5cbiAgdmFyIG9uZHJhaW4gPSBwaXBlT25EcmFpbihzcmMpO1xuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIHZhciBjbGVhbmVkVXAgPSBmYWxzZTtcbiAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICBkZWJ1ZygnY2xlYW51cCcpO1xuICAgIC8vIGNsZWFudXAgZXZlbnQgaGFuZGxlcnMgb25jZSB0aGUgcGlwZSBpcyBicm9rZW5cbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdkcmFpbicsIG9uZHJhaW4pO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcigndW5waXBlJywgb251bnBpcGUpO1xuICAgIHNyYy5yZW1vdmVMaXN0ZW5lcignZW5kJywgb25lbmQpO1xuICAgIHNyYy5yZW1vdmVMaXN0ZW5lcignZW5kJywgY2xlYW51cCk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcblxuICAgIGNsZWFuZWRVcCA9IHRydWU7XG5cbiAgICAvLyBpZiB0aGUgcmVhZGVyIGlzIHdhaXRpbmcgZm9yIGEgZHJhaW4gZXZlbnQgZnJvbSB0aGlzXG4gICAgLy8gc3BlY2lmaWMgd3JpdGVyLCB0aGVuIGl0IHdvdWxkIGNhdXNlIGl0IHRvIG5ldmVyIHN0YXJ0XG4gICAgLy8gZmxvd2luZyBhZ2Fpbi5cbiAgICAvLyBTbywgaWYgdGhpcyBpcyBhd2FpdGluZyBhIGRyYWluLCB0aGVuIHdlIGp1c3QgY2FsbCBpdCBub3cuXG4gICAgLy8gSWYgd2UgZG9uJ3Qga25vdywgdGhlbiBhc3N1bWUgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igb25lLlxuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluICYmXG4gICAgICAgICghZGVzdC5fd3JpdGFibGVTdGF0ZSB8fCBkZXN0Ll93cml0YWJsZVN0YXRlLm5lZWREcmFpbikpXG4gICAgICBvbmRyYWluKCk7XG4gIH1cblxuICBzcmMub24oJ2RhdGEnLCBvbmRhdGEpO1xuICBmdW5jdGlvbiBvbmRhdGEoY2h1bmspIHtcbiAgICBkZWJ1Zygnb25kYXRhJyk7XG4gICAgdmFyIHJldCA9IGRlc3Qud3JpdGUoY2h1bmspO1xuICAgIGlmIChmYWxzZSA9PT0gcmV0KSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciB1bnBpcGVkIGR1cmluZyBgZGVzdC53cml0ZSgpYCwgaXQgaXMgcG9zc2libGVcbiAgICAgIC8vIHRvIGdldCBzdHVjayBpbiBhIHBlcm1hbmVudGx5IHBhdXNlZCBzdGF0ZSBpZiB0aGF0IHdyaXRlXG4gICAgICAvLyBhbHNvIHJldHVybmVkIGZhbHNlLlxuICAgICAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEgJiZcbiAgICAgICAgICBzdGF0ZS5waXBlc1swXSA9PT0gZGVzdCAmJlxuICAgICAgICAgIHNyYy5saXN0ZW5lckNvdW50KCdkYXRhJykgPT09IDEgJiZcbiAgICAgICAgICAhY2xlYW5lZFVwKSB7XG4gICAgICAgIGRlYnVnKCdmYWxzZSB3cml0ZSByZXNwb25zZSwgcGF1c2UnLCBzcmMuX3JlYWRhYmxlU3RhdGUuYXdhaXREcmFpbik7XG4gICAgICAgIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKys7XG4gICAgICB9XG4gICAgICBzcmMucGF1c2UoKTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgZGVzdCBoYXMgYW4gZXJyb3IsIHRoZW4gc3RvcCBwaXBpbmcgaW50byBpdC5cbiAgLy8gaG93ZXZlciwgZG9uJ3Qgc3VwcHJlc3MgdGhlIHRocm93aW5nIGJlaGF2aW9yIGZvciB0aGlzLlxuICBmdW5jdGlvbiBvbmVycm9yKGVyKSB7XG4gICAgZGVidWcoJ29uZXJyb3InLCBlcik7XG4gICAgdW5waXBlKCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBpZiAoRUVsaXN0ZW5lckNvdW50KGRlc3QsICdlcnJvcicpID09PSAwKVxuICAgICAgZGVzdC5lbWl0KCdlcnJvcicsIGVyKTtcbiAgfVxuICAvLyBUaGlzIGlzIGEgYnJ1dGFsbHkgdWdseSBoYWNrIHRvIG1ha2Ugc3VyZSB0aGF0IG91ciBlcnJvciBoYW5kbGVyXG4gIC8vIGlzIGF0dGFjaGVkIGJlZm9yZSBhbnkgdXNlcmxhbmQgb25lcy4gIE5FVkVSIERPIFRISVMuXG4gIGlmICghZGVzdC5fZXZlbnRzIHx8ICFkZXN0Ll9ldmVudHMuZXJyb3IpXG4gICAgZGVzdC5vbignZXJyb3InLCBvbmVycm9yKTtcbiAgZWxzZSBpZiAoaXNBcnJheShkZXN0Ll9ldmVudHMuZXJyb3IpKVxuICAgIGRlc3QuX2V2ZW50cy5lcnJvci51bnNoaWZ0KG9uZXJyb3IpO1xuICBlbHNlXG4gICAgZGVzdC5fZXZlbnRzLmVycm9yID0gW29uZXJyb3IsIGRlc3QuX2V2ZW50cy5lcnJvcl07XG5cblxuICAvLyBCb3RoIGNsb3NlIGFuZCBmaW5pc2ggc2hvdWxkIHRyaWdnZXIgdW5waXBlLCBidXQgb25seSBvbmNlLlxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG4gIGZ1bmN0aW9uIG9uZmluaXNoKCkge1xuICAgIGRlYnVnKCdvbmZpbmlzaCcpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG5cbiAgZnVuY3Rpb24gdW5waXBlKCkge1xuICAgIGRlYnVnKCd1bnBpcGUnKTtcbiAgICBzcmMudW5waXBlKGRlc3QpO1xuICB9XG5cbiAgLy8gdGVsbCB0aGUgZGVzdCB0aGF0IGl0J3MgYmVpbmcgcGlwZWQgdG9cbiAgZGVzdC5lbWl0KCdwaXBlJywgc3JjKTtcblxuICAvLyBzdGFydCB0aGUgZmxvdyBpZiBpdCBoYXNuJ3QgYmVlbiBzdGFydGVkIGFscmVhZHkuXG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdwaXBlIHJlc3VtZScpO1xuICAgIHNyYy5yZXN1bWUoKTtcbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufTtcblxuZnVuY3Rpb24gcGlwZU9uRHJhaW4oc3JjKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhdGUgPSBzcmMuX3JlYWRhYmxlU3RhdGU7XG4gICAgZGVidWcoJ3BpcGVPbkRyYWluJywgc3RhdGUuYXdhaXREcmFpbik7XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4pXG4gICAgICBzdGF0ZS5hd2FpdERyYWluLS07XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gPT09IDAgJiYgRUVsaXN0ZW5lckNvdW50KHNyYywgJ2RhdGEnKSkge1xuICAgICAgc3RhdGUuZmxvd2luZyA9IHRydWU7XG4gICAgICBmbG93KHNyYyk7XG4gICAgfVxuICB9O1xufVxuXG5cblJlYWRhYmxlLnByb3RvdHlwZS51bnBpcGUgPSBmdW5jdGlvbihkZXN0KSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgLy8gaWYgd2UncmUgbm90IHBpcGluZyBhbnl3aGVyZSwgdGhlbiBkbyBub3RoaW5nLlxuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMClcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBqdXN0IG9uZSBkZXN0aW5hdGlvbi4gIG1vc3QgY29tbW9uIGNhc2UuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAxKSB7XG4gICAgLy8gcGFzc2VkIGluIG9uZSwgYnV0IGl0J3Mgbm90IHRoZSByaWdodCBvbmUuXG4gICAgaWYgKGRlc3QgJiYgZGVzdCAhPT0gc3RhdGUucGlwZXMpXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmICghZGVzdClcbiAgICAgIGRlc3QgPSBzdGF0ZS5waXBlcztcblxuICAgIC8vIGdvdCBhIG1hdGNoLlxuICAgIHN0YXRlLnBpcGVzID0gbnVsbDtcbiAgICBzdGF0ZS5waXBlc0NvdW50ID0gMDtcbiAgICBzdGF0ZS5mbG93aW5nID0gZmFsc2U7XG4gICAgaWYgKGRlc3QpXG4gICAgICBkZXN0LmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gc2xvdyBjYXNlLiBtdWx0aXBsZSBwaXBlIGRlc3RpbmF0aW9ucy5cblxuICBpZiAoIWRlc3QpIHtcbiAgICAvLyByZW1vdmUgYWxsLlxuICAgIHZhciBkZXN0cyA9IHN0YXRlLnBpcGVzO1xuICAgIHZhciBsZW4gPSBzdGF0ZS5waXBlc0NvdW50O1xuICAgIHN0YXRlLnBpcGVzID0gbnVsbDtcbiAgICBzdGF0ZS5waXBlc0NvdW50ID0gMDtcbiAgICBzdGF0ZS5mbG93aW5nID0gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgZGVzdHNbaV0uZW1pdCgndW5waXBlJywgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyB0cnkgdG8gZmluZCB0aGUgcmlnaHQgb25lLlxuICB2YXIgaSA9IGluZGV4T2Yoc3RhdGUucGlwZXMsIGRlc3QpO1xuICBpZiAoaSA9PT0gLTEpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgc3RhdGUucGlwZXMuc3BsaWNlKGksIDEpO1xuICBzdGF0ZS5waXBlc0NvdW50IC09IDE7XG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAxKVxuICAgIHN0YXRlLnBpcGVzID0gc3RhdGUucGlwZXNbMF07XG5cbiAgZGVzdC5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIHNldCB1cCBkYXRhIGV2ZW50cyBpZiB0aGV5IGFyZSBhc2tlZCBmb3Jcbi8vIEVuc3VyZSByZWFkYWJsZSBsaXN0ZW5lcnMgZXZlbnR1YWxseSBnZXQgc29tZXRoaW5nXG5SZWFkYWJsZS5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldiwgZm4pIHtcbiAgdmFyIHJlcyA9IFN0cmVhbS5wcm90b3R5cGUub24uY2FsbCh0aGlzLCBldiwgZm4pO1xuXG4gIC8vIElmIGxpc3RlbmluZyB0byBkYXRhLCBhbmQgaXQgaGFzIG5vdCBleHBsaWNpdGx5IGJlZW4gcGF1c2VkLFxuICAvLyB0aGVuIGNhbGwgcmVzdW1lIHRvIHN0YXJ0IHRoZSBmbG93IG9mIGRhdGEgb24gdGhlIG5leHQgdGljay5cbiAgaWYgKGV2ID09PSAnZGF0YScgJiYgZmFsc2UgIT09IHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZykge1xuICAgIHRoaXMucmVzdW1lKCk7XG4gIH1cblxuICBpZiAoZXYgPT09ICdyZWFkYWJsZScgJiYgdGhpcy5yZWFkYWJsZSkge1xuICAgIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKCFzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZykge1xuICAgICAgc3RhdGUucmVhZGFibGVMaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgICAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgICAgIHByb2Nlc3NOZXh0VGljayhuUmVhZGluZ05leHRUaWNrLCB0aGlzKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUubGVuZ3RoKSB7XG4gICAgICAgIGVtaXRSZWFkYWJsZSh0aGlzLCBzdGF0ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcztcbn07XG5SZWFkYWJsZS5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBSZWFkYWJsZS5wcm90b3R5cGUub247XG5cbmZ1bmN0aW9uIG5SZWFkaW5nTmV4dFRpY2soc2VsZikge1xuICBkZWJ1ZygncmVhZGFibGUgbmV4dHRpY2sgcmVhZCAwJyk7XG4gIHNlbGYucmVhZCgwKTtcbn1cblxuLy8gcGF1c2UoKSBhbmQgcmVzdW1lKCkgYXJlIHJlbW5hbnRzIG9mIHRoZSBsZWdhY3kgcmVhZGFibGUgc3RyZWFtIEFQSVxuLy8gSWYgdGhlIHVzZXIgdXNlcyB0aGVtLCB0aGVuIHN3aXRjaCBpbnRvIG9sZCBtb2RlLlxuUmVhZGFibGUucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICBpZiAoIXN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncmVzdW1lJyk7XG4gICAgc3RhdGUuZmxvd2luZyA9IHRydWU7XG4gICAgcmVzdW1lKHRoaXMsIHN0YXRlKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uIHJlc3VtZShzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVzdW1lU2NoZWR1bGVkKSB7XG4gICAgc3RhdGUucmVzdW1lU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICBwcm9jZXNzTmV4dFRpY2socmVzdW1lXywgc3RyZWFtLCBzdGF0ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzdW1lXyhzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVhZGluZykge1xuICAgIGRlYnVnKCdyZXN1bWUgcmVhZCAwJyk7XG4gICAgc3RyZWFtLnJlYWQoMCk7XG4gIH1cblxuICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSBmYWxzZTtcbiAgc3RyZWFtLmVtaXQoJ3Jlc3VtZScpO1xuICBmbG93KHN0cmVhbSk7XG4gIGlmIChzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5yZWFkaW5nKVxuICAgIHN0cmVhbS5yZWFkKDApO1xufVxuXG5SZWFkYWJsZS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgZGVidWcoJ2NhbGwgcGF1c2UgZmxvd2luZz0laicsIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyk7XG4gIGlmIChmYWxzZSAhPT0gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKSB7XG4gICAgZGVidWcoJ3BhdXNlJyk7XG4gICAgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nID0gZmFsc2U7XG4gICAgdGhpcy5lbWl0KCdwYXVzZScpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gZmxvdyhzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBkZWJ1ZygnZmxvdycsIHN0YXRlLmZsb3dpbmcpO1xuICBpZiAoc3RhdGUuZmxvd2luZykge1xuICAgIGRvIHtcbiAgICAgIHZhciBjaHVuayA9IHN0cmVhbS5yZWFkKCk7XG4gICAgfSB3aGlsZSAobnVsbCAhPT0gY2h1bmsgJiYgc3RhdGUuZmxvd2luZyk7XG4gIH1cbn1cblxuLy8gd3JhcCBhbiBvbGQtc3R5bGUgc3RyZWFtIGFzIHRoZSBhc3luYyBkYXRhIHNvdXJjZS5cbi8vIFRoaXMgaXMgKm5vdCogcGFydCBvZiB0aGUgcmVhZGFibGUgc3RyZWFtIGludGVyZmFjZS5cbi8vIEl0IGlzIGFuIHVnbHkgdW5mb3J0dW5hdGUgbWVzcyBvZiBoaXN0b3J5LlxuUmVhZGFibGUucHJvdG90eXBlLndyYXAgPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgdmFyIHBhdXNlZCA9IGZhbHNlO1xuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgc3RyZWFtLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBlbmQnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhc3RhdGUuZW5kZWQpIHtcbiAgICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgICBpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKVxuICAgICAgICBzZWxmLnB1c2goY2h1bmspO1xuICAgIH1cblxuICAgIHNlbGYucHVzaChudWxsKTtcbiAgfSk7XG5cbiAgc3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24oY2h1bmspIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBkYXRhJyk7XG4gICAgaWYgKHN0YXRlLmRlY29kZXIpXG4gICAgICBjaHVuayA9IHN0YXRlLmRlY29kZXIud3JpdGUoY2h1bmspO1xuXG4gICAgLy8gZG9uJ3Qgc2tpcCBvdmVyIGZhbHN5IHZhbHVlcyBpbiBvYmplY3RNb2RlXG4gICAgaWYgKHN0YXRlLm9iamVjdE1vZGUgJiYgKGNodW5rID09PSBudWxsIHx8IGNodW5rID09PSB1bmRlZmluZWQpKVxuICAgICAgcmV0dXJuO1xuICAgIGVsc2UgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmICghY2h1bmsgfHwgIWNodW5rLmxlbmd0aCkpXG4gICAgICByZXR1cm47XG5cbiAgICB2YXIgcmV0ID0gc2VsZi5wdXNoKGNodW5rKTtcbiAgICBpZiAoIXJldCkge1xuICAgICAgcGF1c2VkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5wYXVzZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gcHJveHkgYWxsIHRoZSBvdGhlciBtZXRob2RzLlxuICAvLyBpbXBvcnRhbnQgd2hlbiB3cmFwcGluZyBmaWx0ZXJzIGFuZCBkdXBsZXhlcy5cbiAgZm9yICh2YXIgaSBpbiBzdHJlYW0pIHtcbiAgICBpZiAodGhpc1tpXSA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBzdHJlYW1baV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXNbaV0gPSBmdW5jdGlvbihtZXRob2QpIHsgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc3RyZWFtW21ldGhvZF0uYXBwbHkoc3RyZWFtLCBhcmd1bWVudHMpO1xuICAgICAgfTsgfShpKTtcbiAgICB9XG4gIH1cblxuICAvLyBwcm94eSBjZXJ0YWluIGltcG9ydGFudCBldmVudHMuXG4gIHZhciBldmVudHMgPSBbJ2Vycm9yJywgJ2Nsb3NlJywgJ2Rlc3Ryb3knLCAncGF1c2UnLCAncmVzdW1lJ107XG4gIGZvckVhY2goZXZlbnRzLCBmdW5jdGlvbihldikge1xuICAgIHN0cmVhbS5vbihldiwgc2VsZi5lbWl0LmJpbmQoc2VsZiwgZXYpKTtcbiAgfSk7XG5cbiAgLy8gd2hlbiB3ZSB0cnkgdG8gY29uc3VtZSBzb21lIG1vcmUgYnl0ZXMsIHNpbXBseSB1bnBhdXNlIHRoZVxuICAvLyB1bmRlcmx5aW5nIHN0cmVhbS5cbiAgc2VsZi5fcmVhZCA9IGZ1bmN0aW9uKG4pIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBfcmVhZCcsIG4pO1xuICAgIGlmIChwYXVzZWQpIHtcbiAgICAgIHBhdXNlZCA9IGZhbHNlO1xuICAgICAgc3RyZWFtLnJlc3VtZSgpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gc2VsZjtcbn07XG5cblxuLy8gZXhwb3NlZCBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5LlxuUmVhZGFibGUuX2Zyb21MaXN0ID0gZnJvbUxpc3Q7XG5cbi8vIFBsdWNrIG9mZiBuIGJ5dGVzIGZyb20gYW4gYXJyYXkgb2YgYnVmZmVycy5cbi8vIExlbmd0aCBpcyB0aGUgY29tYmluZWQgbGVuZ3RocyBvZiBhbGwgdGhlIGJ1ZmZlcnMgaW4gdGhlIGxpc3QuXG5mdW5jdGlvbiBmcm9tTGlzdChuLCBzdGF0ZSkge1xuICB2YXIgbGlzdCA9IHN0YXRlLmJ1ZmZlcjtcbiAgdmFyIGxlbmd0aCA9IHN0YXRlLmxlbmd0aDtcbiAgdmFyIHN0cmluZ01vZGUgPSAhIXN0YXRlLmRlY29kZXI7XG4gIHZhciBvYmplY3RNb2RlID0gISFzdGF0ZS5vYmplY3RNb2RlO1xuICB2YXIgcmV0O1xuXG4gIC8vIG5vdGhpbmcgaW4gdGhlIGxpc3QsIGRlZmluaXRlbHkgZW1wdHkuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMClcbiAgICByZXR1cm4gbnVsbDtcblxuICBpZiAobGVuZ3RoID09PSAwKVxuICAgIHJldCA9IG51bGw7XG4gIGVsc2UgaWYgKG9iamVjdE1vZGUpXG4gICAgcmV0ID0gbGlzdC5zaGlmdCgpO1xuICBlbHNlIGlmICghbiB8fCBuID49IGxlbmd0aCkge1xuICAgIC8vIHJlYWQgaXQgYWxsLCB0cnVuY2F0ZSB0aGUgYXJyYXkuXG4gICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICByZXQgPSBsaXN0LmpvaW4oJycpO1xuICAgIGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKVxuICAgICAgcmV0ID0gbGlzdFswXTtcbiAgICBlbHNlXG4gICAgICByZXQgPSBCdWZmZXIuY29uY2F0KGxpc3QsIGxlbmd0aCk7XG4gICAgbGlzdC5sZW5ndGggPSAwO1xuICB9IGVsc2Uge1xuICAgIC8vIHJlYWQganVzdCBzb21lIG9mIGl0LlxuICAgIGlmIChuIDwgbGlzdFswXS5sZW5ndGgpIHtcbiAgICAgIC8vIGp1c3QgdGFrZSBhIHBhcnQgb2YgdGhlIGZpcnN0IGxpc3QgaXRlbS5cbiAgICAgIC8vIHNsaWNlIGlzIHRoZSBzYW1lIGZvciBidWZmZXJzIGFuZCBzdHJpbmdzLlxuICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICByZXQgPSBidWYuc2xpY2UoMCwgbik7XG4gICAgICBsaXN0WzBdID0gYnVmLnNsaWNlKG4pO1xuICAgIH0gZWxzZSBpZiAobiA9PT0gbGlzdFswXS5sZW5ndGgpIHtcbiAgICAgIC8vIGZpcnN0IGxpc3QgaXMgYSBwZXJmZWN0IG1hdGNoXG4gICAgICByZXQgPSBsaXN0LnNoaWZ0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNvbXBsZXggY2FzZS5cbiAgICAgIC8vIHdlIGhhdmUgZW5vdWdoIHRvIGNvdmVyIGl0LCBidXQgaXQgc3BhbnMgcGFzdCB0aGUgZmlyc3QgYnVmZmVyLlxuICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgIHJldCA9ICcnO1xuICAgICAgZWxzZVxuICAgICAgICByZXQgPSBuZXcgQnVmZmVyKG4pO1xuXG4gICAgICB2YXIgYyA9IDA7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3QubGVuZ3RoOyBpIDwgbCAmJiBjIDwgbjsgaSsrKSB7XG4gICAgICAgIHZhciBidWYgPSBsaXN0WzBdO1xuICAgICAgICB2YXIgY3B5ID0gTWF0aC5taW4obiAtIGMsIGJ1Zi5sZW5ndGgpO1xuXG4gICAgICAgIGlmIChzdHJpbmdNb2RlKVxuICAgICAgICAgIHJldCArPSBidWYuc2xpY2UoMCwgY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGJ1Zi5jb3B5KHJldCwgYywgMCwgY3B5KTtcblxuICAgICAgICBpZiAoY3B5IDwgYnVmLmxlbmd0aClcbiAgICAgICAgICBsaXN0WzBdID0gYnVmLnNsaWNlKGNweSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBsaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgYyArPSBjcHk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gZW5kUmVhZGFibGUoc3RyZWFtKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcblxuICAvLyBJZiB3ZSBnZXQgaGVyZSBiZWZvcmUgY29uc3VtaW5nIGFsbCB0aGUgYnl0ZXMsIHRoZW4gdGhhdCBpcyBhXG4gIC8vIGJ1ZyBpbiBub2RlLiAgU2hvdWxkIG5ldmVyIGhhcHBlbi5cbiAgaWYgKHN0YXRlLmxlbmd0aCA+IDApXG4gICAgdGhyb3cgbmV3IEVycm9yKCdlbmRSZWFkYWJsZSBjYWxsZWQgb24gbm9uLWVtcHR5IHN0cmVhbScpO1xuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCkge1xuICAgIHN0YXRlLmVuZGVkID0gdHJ1ZTtcbiAgICBwcm9jZXNzTmV4dFRpY2soZW5kUmVhZGFibGVOVCwgc3RhdGUsIHN0cmVhbSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW5kUmVhZGFibGVOVChzdGF0ZSwgc3RyZWFtKSB7XG4gIC8vIENoZWNrIHRoYXQgd2UgZGlkbid0IGdldCBvbmUgbGFzdCB1bnNoaWZ0LlxuICBpZiAoIXN0YXRlLmVuZEVtaXR0ZWQgJiYgc3RhdGUubGVuZ3RoID09PSAwKSB7XG4gICAgc3RhdGUuZW5kRW1pdHRlZCA9IHRydWU7XG4gICAgc3RyZWFtLnJlYWRhYmxlID0gZmFsc2U7XG4gICAgc3RyZWFtLmVtaXQoJ2VuZCcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZvckVhY2ggKHhzLCBmKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZih4c1tpXSwgaSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5kZXhPZiAoeHMsIHgpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBpZiAoeHNbaV0gPT09IHgpIHJldHVybiBpO1xuICB9XG4gIHJldHVybiAtMTtcbn1cbiIsIi8vIGEgdHJhbnNmb3JtIHN0cmVhbSBpcyBhIHJlYWRhYmxlL3dyaXRhYmxlIHN0cmVhbSB3aGVyZSB5b3UgZG9cbi8vIHNvbWV0aGluZyB3aXRoIHRoZSBkYXRhLiAgU29tZXRpbWVzIGl0J3MgY2FsbGVkIGEgXCJmaWx0ZXJcIixcbi8vIGJ1dCB0aGF0J3Mgbm90IGEgZ3JlYXQgbmFtZSBmb3IgaXQsIHNpbmNlIHRoYXQgaW1wbGllcyBhIHRoaW5nIHdoZXJlXG4vLyBzb21lIGJpdHMgcGFzcyB0aHJvdWdoLCBhbmQgb3RoZXJzIGFyZSBzaW1wbHkgaWdub3JlZC4gIChUaGF0IHdvdWxkXG4vLyBiZSBhIHZhbGlkIGV4YW1wbGUgb2YgYSB0cmFuc2Zvcm0sIG9mIGNvdXJzZS4pXG4vL1xuLy8gV2hpbGUgdGhlIG91dHB1dCBpcyBjYXVzYWxseSByZWxhdGVkIHRvIHRoZSBpbnB1dCwgaXQncyBub3QgYVxuLy8gbmVjZXNzYXJpbHkgc3ltbWV0cmljIG9yIHN5bmNocm9ub3VzIHRyYW5zZm9ybWF0aW9uLiAgRm9yIGV4YW1wbGUsXG4vLyBhIHpsaWIgc3RyZWFtIG1pZ2h0IHRha2UgbXVsdGlwbGUgcGxhaW4tdGV4dCB3cml0ZXMoKSwgYW5kIHRoZW5cbi8vIGVtaXQgYSBzaW5nbGUgY29tcHJlc3NlZCBjaHVuayBzb21lIHRpbWUgaW4gdGhlIGZ1dHVyZS5cbi8vXG4vLyBIZXJlJ3MgaG93IHRoaXMgd29ya3M6XG4vL1xuLy8gVGhlIFRyYW5zZm9ybSBzdHJlYW0gaGFzIGFsbCB0aGUgYXNwZWN0cyBvZiB0aGUgcmVhZGFibGUgYW5kIHdyaXRhYmxlXG4vLyBzdHJlYW0gY2xhc3Nlcy4gIFdoZW4geW91IHdyaXRlKGNodW5rKSwgdGhhdCBjYWxscyBfd3JpdGUoY2h1bmssY2IpXG4vLyBpbnRlcm5hbGx5LCBhbmQgcmV0dXJucyBmYWxzZSBpZiB0aGVyZSdzIGEgbG90IG9mIHBlbmRpbmcgd3JpdGVzXG4vLyBidWZmZXJlZCB1cC4gIFdoZW4geW91IGNhbGwgcmVhZCgpLCB0aGF0IGNhbGxzIF9yZWFkKG4pIHVudGlsXG4vLyB0aGVyZSdzIGVub3VnaCBwZW5kaW5nIHJlYWRhYmxlIGRhdGEgYnVmZmVyZWQgdXAuXG4vL1xuLy8gSW4gYSB0cmFuc2Zvcm0gc3RyZWFtLCB0aGUgd3JpdHRlbiBkYXRhIGlzIHBsYWNlZCBpbiBhIGJ1ZmZlci4gIFdoZW5cbi8vIF9yZWFkKG4pIGlzIGNhbGxlZCwgaXQgdHJhbnNmb3JtcyB0aGUgcXVldWVkIHVwIGRhdGEsIGNhbGxpbmcgdGhlXG4vLyBidWZmZXJlZCBfd3JpdGUgY2IncyBhcyBpdCBjb25zdW1lcyBjaHVua3MuICBJZiBjb25zdW1pbmcgYSBzaW5nbGVcbi8vIHdyaXR0ZW4gY2h1bmsgd291bGQgcmVzdWx0IGluIG11bHRpcGxlIG91dHB1dCBjaHVua3MsIHRoZW4gdGhlIGZpcnN0XG4vLyBvdXRwdXR0ZWQgYml0IGNhbGxzIHRoZSByZWFkY2IsIGFuZCBzdWJzZXF1ZW50IGNodW5rcyBqdXN0IGdvIGludG9cbi8vIHRoZSByZWFkIGJ1ZmZlciwgYW5kIHdpbGwgY2F1c2UgaXQgdG8gZW1pdCAncmVhZGFibGUnIGlmIG5lY2Vzc2FyeS5cbi8vXG4vLyBUaGlzIHdheSwgYmFjay1wcmVzc3VyZSBpcyBhY3R1YWxseSBkZXRlcm1pbmVkIGJ5IHRoZSByZWFkaW5nIHNpZGUsXG4vLyBzaW5jZSBfcmVhZCBoYXMgdG8gYmUgY2FsbGVkIHRvIHN0YXJ0IHByb2Nlc3NpbmcgYSBuZXcgY2h1bmsuICBIb3dldmVyLFxuLy8gYSBwYXRob2xvZ2ljYWwgaW5mbGF0ZSB0eXBlIG9mIHRyYW5zZm9ybSBjYW4gY2F1c2UgZXhjZXNzaXZlIGJ1ZmZlcmluZ1xuLy8gaGVyZS4gIEZvciBleGFtcGxlLCBpbWFnaW5lIGEgc3RyZWFtIHdoZXJlIGV2ZXJ5IGJ5dGUgb2YgaW5wdXQgaXNcbi8vIGludGVycHJldGVkIGFzIGFuIGludGVnZXIgZnJvbSAwLTI1NSwgYW5kIHRoZW4gcmVzdWx0cyBpbiB0aGF0IG1hbnlcbi8vIGJ5dGVzIG9mIG91dHB1dC4gIFdyaXRpbmcgdGhlIDQgYnl0ZXMge2ZmLGZmLGZmLGZmfSB3b3VsZCByZXN1bHQgaW5cbi8vIDFrYiBvZiBkYXRhIGJlaW5nIG91dHB1dC4gIEluIHRoaXMgY2FzZSwgeW91IGNvdWxkIHdyaXRlIGEgdmVyeSBzbWFsbFxuLy8gYW1vdW50IG9mIGlucHV0LCBhbmQgZW5kIHVwIHdpdGggYSB2ZXJ5IGxhcmdlIGFtb3VudCBvZiBvdXRwdXQuICBJblxuLy8gc3VjaCBhIHBhdGhvbG9naWNhbCBpbmZsYXRpbmcgbWVjaGFuaXNtLCB0aGVyZSdkIGJlIG5vIHdheSB0byB0ZWxsXG4vLyB0aGUgc3lzdGVtIHRvIHN0b3AgZG9pbmcgdGhlIHRyYW5zZm9ybS4gIEEgc2luZ2xlIDRNQiB3cml0ZSBjb3VsZFxuLy8gY2F1c2UgdGhlIHN5c3RlbSB0byBydW4gb3V0IG9mIG1lbW9yeS5cbi8vXG4vLyBIb3dldmVyLCBldmVuIGluIHN1Y2ggYSBwYXRob2xvZ2ljYWwgY2FzZSwgb25seSBhIHNpbmdsZSB3cml0dGVuIGNodW5rXG4vLyB3b3VsZCBiZSBjb25zdW1lZCwgYW5kIHRoZW4gdGhlIHJlc3Qgd291bGQgd2FpdCAodW4tdHJhbnNmb3JtZWQpIHVudGlsXG4vLyB0aGUgcmVzdWx0cyBvZiB0aGUgcHJldmlvdXMgdHJhbnNmb3JtZWQgY2h1bmsgd2VyZSBjb25zdW1lZC5cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zZm9ybTtcblxudmFyIER1cGxleCA9IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFRyYW5zZm9ybSwgRHVwbGV4KTtcblxuXG5mdW5jdGlvbiBUcmFuc2Zvcm1TdGF0ZShzdHJlYW0pIHtcbiAgdGhpcy5hZnRlclRyYW5zZm9ybSA9IGZ1bmN0aW9uKGVyLCBkYXRhKSB7XG4gICAgcmV0dXJuIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpO1xuICB9O1xuXG4gIHRoaXMubmVlZFRyYW5zZm9ybSA9IGZhbHNlO1xuICB0aGlzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuICB0aGlzLndyaXRlY2h1bmsgPSBudWxsO1xufVxuXG5mdW5jdGlvbiBhZnRlclRyYW5zZm9ybShzdHJlYW0sIGVyLCBkYXRhKSB7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG4gIHRzLnRyYW5zZm9ybWluZyA9IGZhbHNlO1xuXG4gIHZhciBjYiA9IHRzLndyaXRlY2I7XG5cbiAgaWYgKCFjYilcbiAgICByZXR1cm4gc3RyZWFtLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdubyB3cml0ZWNiIGluIFRyYW5zZm9ybSBjbGFzcycpKTtcblxuICB0cy53cml0ZWNodW5rID0gbnVsbDtcbiAgdHMud3JpdGVjYiA9IG51bGw7XG5cbiAgaWYgKGRhdGEgIT09IG51bGwgJiYgZGF0YSAhPT0gdW5kZWZpbmVkKVxuICAgIHN0cmVhbS5wdXNoKGRhdGEpO1xuXG4gIGlmIChjYilcbiAgICBjYihlcik7XG5cbiAgdmFyIHJzID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBycy5yZWFkaW5nID0gZmFsc2U7XG4gIGlmIChycy5uZWVkUmVhZGFibGUgfHwgcnMubGVuZ3RoIDwgcnMuaGlnaFdhdGVyTWFyaykge1xuICAgIHN0cmVhbS5fcmVhZChycy5oaWdoV2F0ZXJNYXJrKTtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIFRyYW5zZm9ybShvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBUcmFuc2Zvcm0pKVxuICAgIHJldHVybiBuZXcgVHJhbnNmb3JtKG9wdGlvbnMpO1xuXG4gIER1cGxleC5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlID0gbmV3IFRyYW5zZm9ybVN0YXRlKHRoaXMpO1xuXG4gIC8vIHdoZW4gdGhlIHdyaXRhYmxlIHNpZGUgZmluaXNoZXMsIHRoZW4gZmx1c2ggb3V0IGFueXRoaW5nIHJlbWFpbmluZy5cbiAgdmFyIHN0cmVhbSA9IHRoaXM7XG5cbiAgLy8gc3RhcnQgb3V0IGFza2luZyBmb3IgYSByZWFkYWJsZSBldmVudCBvbmNlIGRhdGEgaXMgdHJhbnNmb3JtZWQuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyB3ZSBoYXZlIGltcGxlbWVudGVkIHRoZSBfcmVhZCBtZXRob2QsIGFuZCBkb25lIHRoZSBvdGhlciB0aGluZ3NcbiAgLy8gdGhhdCBSZWFkYWJsZSB3YW50cyBiZWZvcmUgdGhlIGZpcnN0IF9yZWFkIGNhbGwsIHNvIHVuc2V0IHRoZVxuICAvLyBzeW5jIGd1YXJkIGZsYWcuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuc3luYyA9IGZhbHNlO1xuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnRyYW5zZm9ybSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX3RyYW5zZm9ybSA9IG9wdGlvbnMudHJhbnNmb3JtO1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmZsdXNoID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fZmx1c2ggPSBvcHRpb25zLmZsdXNoO1xuICB9XG5cbiAgdGhpcy5vbmNlKCdwcmVmaW5pc2gnLCBmdW5jdGlvbigpIHtcbiAgICBpZiAodHlwZW9mIHRoaXMuX2ZsdXNoID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fZmx1c2goZnVuY3Rpb24oZXIpIHtcbiAgICAgICAgZG9uZShzdHJlYW0sIGVyKTtcbiAgICAgIH0pO1xuICAgIGVsc2VcbiAgICAgIGRvbmUoc3RyZWFtKTtcbiAgfSk7XG59XG5cblRyYW5zZm9ybS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZykge1xuICB0aGlzLl90cmFuc2Zvcm1TdGF0ZS5uZWVkVHJhbnNmb3JtID0gZmFsc2U7XG4gIHJldHVybiBEdXBsZXgucHJvdG90eXBlLnB1c2guY2FsbCh0aGlzLCBjaHVuaywgZW5jb2RpbmcpO1xufTtcblxuLy8gVGhpcyBpcyB0aGUgcGFydCB3aGVyZSB5b3UgZG8gc3R1ZmYhXG4vLyBvdmVycmlkZSB0aGlzIGZ1bmN0aW9uIGluIGltcGxlbWVudGF0aW9uIGNsYXNzZXMuXG4vLyAnY2h1bmsnIGlzIGFuIGlucHV0IGNodW5rLlxuLy9cbi8vIENhbGwgYHB1c2gobmV3Q2h1bmspYCB0byBwYXNzIGFsb25nIHRyYW5zZm9ybWVkIG91dHB1dFxuLy8gdG8gdGhlIHJlYWRhYmxlIHNpZGUuICBZb3UgbWF5IGNhbGwgJ3B1c2gnIHplcm8gb3IgbW9yZSB0aW1lcy5cbi8vXG4vLyBDYWxsIGBjYihlcnIpYCB3aGVuIHlvdSBhcmUgZG9uZSB3aXRoIHRoaXMgY2h1bmsuICBJZiB5b3UgcGFzc1xuLy8gYW4gZXJyb3IsIHRoZW4gdGhhdCdsbCBwdXQgdGhlIGh1cnQgb24gdGhlIHdob2xlIG9wZXJhdGlvbi4gIElmIHlvdVxuLy8gbmV2ZXIgY2FsbCBjYigpLCB0aGVuIHlvdSdsbCBuZXZlciBnZXQgYW5vdGhlciBjaHVuay5cblRyYW5zZm9ybS5wcm90b3R5cGUuX3RyYW5zZm9ybSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcbn07XG5cblRyYW5zZm9ybS5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMud3JpdGVjYiA9IGNiO1xuICB0cy53cml0ZWNodW5rID0gY2h1bms7XG4gIHRzLndyaXRlZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgaWYgKCF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB2YXIgcnMgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICAgIGlmICh0cy5uZWVkVHJhbnNmb3JtIHx8XG4gICAgICAgIHJzLm5lZWRSZWFkYWJsZSB8fFxuICAgICAgICBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKVxuICAgICAgdGhpcy5fcmVhZChycy5oaWdoV2F0ZXJNYXJrKTtcbiAgfVxufTtcblxuLy8gRG9lc24ndCBtYXR0ZXIgd2hhdCB0aGUgYXJncyBhcmUgaGVyZS5cbi8vIF90cmFuc2Zvcm0gZG9lcyBhbGwgdGhlIHdvcmsuXG4vLyBUaGF0IHdlIGdvdCBoZXJlIG1lYW5zIHRoYXQgdGhlIHJlYWRhYmxlIHNpZGUgd2FudHMgbW9yZSBkYXRhLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fcmVhZCA9IGZ1bmN0aW9uKG4pIHtcbiAgdmFyIHRzID0gdGhpcy5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHRzLndyaXRlY2h1bmsgIT09IG51bGwgJiYgdHMud3JpdGVjYiAmJiAhdHMudHJhbnNmb3JtaW5nKSB7XG4gICAgdHMudHJhbnNmb3JtaW5nID0gdHJ1ZTtcbiAgICB0aGlzLl90cmFuc2Zvcm0odHMud3JpdGVjaHVuaywgdHMud3JpdGVlbmNvZGluZywgdHMuYWZ0ZXJUcmFuc2Zvcm0pO1xuICB9IGVsc2Uge1xuICAgIC8vIG1hcmsgdGhhdCB3ZSBuZWVkIGEgdHJhbnNmb3JtLCBzbyB0aGF0IGFueSBkYXRhIHRoYXQgY29tZXMgaW5cbiAgICAvLyB3aWxsIGdldCBwcm9jZXNzZWQsIG5vdyB0aGF0IHdlJ3ZlIGFza2VkIGZvciBpdC5cbiAgICB0cy5uZWVkVHJhbnNmb3JtID0gdHJ1ZTtcbiAgfVxufTtcblxuXG5mdW5jdGlvbiBkb25lKHN0cmVhbSwgZXIpIHtcbiAgaWYgKGVyKVxuICAgIHJldHVybiBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG5cbiAgLy8gaWYgdGhlcmUncyBub3RoaW5nIGluIHRoZSB3cml0ZSBidWZmZXIsIHRoZW4gdGhhdCBtZWFuc1xuICAvLyB0aGF0IG5vdGhpbmcgbW9yZSB3aWxsIGV2ZXIgYmUgcHJvdmlkZWRcbiAgdmFyIHdzID0gc3RyZWFtLl93cml0YWJsZVN0YXRlO1xuICB2YXIgdHMgPSBzdHJlYW0uX3RyYW5zZm9ybVN0YXRlO1xuXG4gIGlmICh3cy5sZW5ndGgpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gd3MubGVuZ3RoICE9IDAnKTtcblxuICBpZiAodHMudHJhbnNmb3JtaW5nKVxuICAgIHRocm93IG5ldyBFcnJvcignY2FsbGluZyB0cmFuc2Zvcm0gZG9uZSB3aGVuIHN0aWxsIHRyYW5zZm9ybWluZycpO1xuXG4gIHJldHVybiBzdHJlYW0ucHVzaChudWxsKTtcbn1cbiIsIi8vIEEgYml0IHNpbXBsZXIgdGhhbiByZWFkYWJsZSBzdHJlYW1zLlxuLy8gSW1wbGVtZW50IGFuIGFzeW5jIC5fd3JpdGUoY2h1bmssIGVuY29kaW5nLCBjYiksIGFuZCBpdCdsbCBoYW5kbGUgYWxsXG4vLyB0aGUgZHJhaW4gZXZlbnQgZW1pc3Npb24gYW5kIGJ1ZmZlcmluZy5cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdyaXRhYmxlO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHByb2Nlc3NOZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5Xcml0YWJsZS5Xcml0YWJsZVN0YXRlID0gV3JpdGFibGVTdGF0ZTtcblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpbnRlcm5hbFV0aWwgPSB7XG4gIGRlcHJlY2F0ZTogcmVxdWlyZSgndXRpbC1kZXByZWNhdGUnKVxufTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBTdHJlYW07XG4oZnVuY3Rpb24gKCl7dHJ5e1xuICBTdHJlYW0gPSByZXF1aXJlKCdzdCcgKyAncmVhbScpO1xufWNhdGNoKF8pe31maW5hbGx5e1xuICBpZiAoIVN0cmVhbSlcbiAgICBTdHJlYW0gPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG59fSgpKVxuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnV0aWwuaW5oZXJpdHMoV3JpdGFibGUsIFN0cmVhbSk7XG5cbmZ1bmN0aW9uIG5vcCgpIHt9XG5cbmZ1bmN0aW9uIFdyaXRlUmVxKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdGhpcy5jaHVuayA9IGNodW5rO1xuICB0aGlzLmVuY29kaW5nID0gZW5jb2Rpbmc7XG4gIHRoaXMuY2FsbGJhY2sgPSBjYjtcbiAgdGhpcy5uZXh0ID0gbnVsbDtcbn1cblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFdyaXRhYmxlU3RhdGUob3B0aW9ucywgc3RyZWFtKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnIHRvIGluZGljYXRlIHdoZXRoZXIgb3Igbm90IHRoaXMgc3RyZWFtXG4gIC8vIGNvbnRhaW5zIGJ1ZmZlcnMgb3Igb2JqZWN0cy5cbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLndyaXRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyB0aGUgcG9pbnQgYXQgd2hpY2ggd3JpdGUoKSBzdGFydHMgcmV0dXJuaW5nIGZhbHNlXG4gIC8vIE5vdGU6IDAgaXMgYSB2YWxpZCB2YWx1ZSwgbWVhbnMgdGhhdCB3ZSBhbHdheXMgcmV0dXJuIGZhbHNlIGlmXG4gIC8vIHRoZSBlbnRpcmUgYnVmZmVyIGlzIG5vdCBmbHVzaGVkIGltbWVkaWF0ZWx5IG9uIHdyaXRlKClcbiAgdmFyIGh3bSA9IG9wdGlvbnMuaGlnaFdhdGVyTWFyaztcbiAgdmFyIGRlZmF1bHRId20gPSB0aGlzLm9iamVjdE1vZGUgPyAxNiA6IDE2ICogMTAyNDtcbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gKGh3bSB8fCBod20gPT09IDApID8gaHdtIDogZGVmYXVsdEh3bTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMubmVlZERyYWluID0gZmFsc2U7XG4gIC8vIGF0IHRoZSBzdGFydCBvZiBjYWxsaW5nIGVuZCgpXG4gIHRoaXMuZW5kaW5nID0gZmFsc2U7XG4gIC8vIHdoZW4gZW5kKCkgaGFzIGJlZW4gY2FsbGVkLCBhbmQgcmV0dXJuZWRcbiAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAvLyB3aGVuICdmaW5pc2gnIGlzIGVtaXR0ZWRcbiAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gIC8vIHNob3VsZCB3ZSBkZWNvZGUgc3RyaW5ncyBpbnRvIGJ1ZmZlcnMgYmVmb3JlIHBhc3NpbmcgdG8gX3dyaXRlP1xuICAvLyB0aGlzIGlzIGhlcmUgc28gdGhhdCBzb21lIG5vZGUtY29yZSBzdHJlYW1zIGNhbiBvcHRpbWl6ZSBzdHJpbmdcbiAgLy8gaGFuZGxpbmcgYXQgYSBsb3dlciBsZXZlbC5cbiAgdmFyIG5vRGVjb2RlID0gb3B0aW9ucy5kZWNvZGVTdHJpbmdzID09PSBmYWxzZTtcbiAgdGhpcy5kZWNvZGVTdHJpbmdzID0gIW5vRGVjb2RlO1xuXG4gIC8vIENyeXB0byBpcyBraW5kIG9mIG9sZCBhbmQgY3J1c3R5LiAgSGlzdG9yaWNhbGx5LCBpdHMgZGVmYXVsdCBzdHJpbmdcbiAgLy8gZW5jb2RpbmcgaXMgJ2JpbmFyeScgc28gd2UgaGF2ZSB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlLlxuICAvLyBFdmVyeXRoaW5nIGVsc2UgaW4gdGhlIHVuaXZlcnNlIHVzZXMgJ3V0ZjgnLCB0aG91Z2guXG4gIHRoaXMuZGVmYXVsdEVuY29kaW5nID0gb3B0aW9ucy5kZWZhdWx0RW5jb2RpbmcgfHwgJ3V0ZjgnO1xuXG4gIC8vIG5vdCBhbiBhY3R1YWwgYnVmZmVyIHdlIGtlZXAgdHJhY2sgb2YsIGJ1dCBhIG1lYXN1cmVtZW50XG4gIC8vIG9mIGhvdyBtdWNoIHdlJ3JlIHdhaXRpbmcgdG8gZ2V0IHB1c2hlZCB0byBzb21lIHVuZGVybHlpbmdcbiAgLy8gc29ja2V0IG9yIGZpbGUuXG4gIHRoaXMubGVuZ3RoID0gMDtcblxuICAvLyBhIGZsYWcgdG8gc2VlIHdoZW4gd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBhIHdyaXRlLlxuICB0aGlzLndyaXRpbmcgPSBmYWxzZTtcblxuICAvLyB3aGVuIHRydWUgYWxsIHdyaXRlcyB3aWxsIGJlIGJ1ZmZlcmVkIHVudGlsIC51bmNvcmsoKSBjYWxsXG4gIHRoaXMuY29ya2VkID0gMDtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyBhIGZsYWcgdG8ga25vdyBpZiB3ZSdyZSBwcm9jZXNzaW5nIHByZXZpb3VzbHkgYnVmZmVyZWQgaXRlbXMsIHdoaWNoXG4gIC8vIG1heSBjYWxsIHRoZSBfd3JpdGUoKSBjYWxsYmFjayBpbiB0aGUgc2FtZSB0aWNrLCBzbyB0aGF0IHdlIGRvbid0XG4gIC8vIGVuZCB1cCBpbiBhbiBvdmVybGFwcGVkIG9ud3JpdGUgc2l0dWF0aW9uLlxuICB0aGlzLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCdzIHBhc3NlZCB0byBfd3JpdGUoY2h1bmssY2IpXG4gIHRoaXMub253cml0ZSA9IGZ1bmN0aW9uKGVyKSB7XG4gICAgb253cml0ZShzdHJlYW0sIGVyKTtcbiAgfTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCB0aGUgdXNlciBzdXBwbGllcyB0byB3cml0ZShjaHVuayxlbmNvZGluZyxjYilcbiAgdGhpcy53cml0ZWNiID0gbnVsbDtcblxuICAvLyB0aGUgYW1vdW50IHRoYXQgaXMgYmVpbmcgd3JpdHRlbiB3aGVuIF93cml0ZSBpcyBjYWxsZWQuXG4gIHRoaXMud3JpdGVsZW4gPSAwO1xuXG4gIHRoaXMuYnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgdGhpcy5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcblxuICAvLyBudW1iZXIgb2YgcGVuZGluZyB1c2VyLXN1cHBsaWVkIHdyaXRlIGNhbGxiYWNrc1xuICAvLyB0aGlzIG11c3QgYmUgMCBiZWZvcmUgJ2ZpbmlzaCcgY2FuIGJlIGVtaXR0ZWRcbiAgdGhpcy5wZW5kaW5nY2IgPSAwO1xuXG4gIC8vIGVtaXQgcHJlZmluaXNoIGlmIHRoZSBvbmx5IHRoaW5nIHdlJ3JlIHdhaXRpbmcgZm9yIGlzIF93cml0ZSBjYnNcbiAgLy8gVGhpcyBpcyByZWxldmFudCBmb3Igc3luY2hyb25vdXMgVHJhbnNmb3JtIHN0cmVhbXNcbiAgdGhpcy5wcmVmaW5pc2hlZCA9IGZhbHNlO1xuXG4gIC8vIFRydWUgaWYgdGhlIGVycm9yIHdhcyBhbHJlYWR5IGVtaXR0ZWQgYW5kIHNob3VsZCBub3QgYmUgdGhyb3duIGFnYWluXG4gIHRoaXMuZXJyb3JFbWl0dGVkID0gZmFsc2U7XG59XG5cbldyaXRhYmxlU3RhdGUucHJvdG90eXBlLmdldEJ1ZmZlciA9IGZ1bmN0aW9uIHdyaXRhYmxlU3RhdGVHZXRCdWZmZXIoKSB7XG4gIHZhciBjdXJyZW50ID0gdGhpcy5idWZmZXJlZFJlcXVlc3Q7XG4gIHZhciBvdXQgPSBbXTtcbiAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICBvdXQucHVzaChjdXJyZW50KTtcbiAgICBjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuICB9XG4gIHJldHVybiBvdXQ7XG59O1xuXG4oZnVuY3Rpb24gKCl7dHJ5IHtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShXcml0YWJsZVN0YXRlLnByb3RvdHlwZSwgJ2J1ZmZlcicsIHtcbiAgZ2V0OiBpbnRlcm5hbFV0aWwuZGVwcmVjYXRlKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlcigpO1xuICB9LCAnX3dyaXRhYmxlU3RhdGUuYnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBfd3JpdGFibGVTdGF0ZS5nZXRCdWZmZXIgJyArXG4gICAgICdpbnN0ZWFkLicpXG59KTtcbn1jYXRjaChfKXt9fSgpKTtcblxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gV3JpdGFibGUob3B0aW9ucykge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIC8vIFdyaXRhYmxlIGN0b3IgaXMgYXBwbGllZCB0byBEdXBsZXhlcywgdGhvdWdoIHRoZXkncmUgbm90XG4gIC8vIGluc3RhbmNlb2YgV3JpdGFibGUsIHRoZXkncmUgaW5zdGFuY2VvZiBSZWFkYWJsZS5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFdyaXRhYmxlKSAmJiAhKHRoaXMgaW5zdGFuY2VvZiBEdXBsZXgpKVxuICAgIHJldHVybiBuZXcgV3JpdGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fd3JpdGFibGVTdGF0ZSA9IG5ldyBXcml0YWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeS5cbiAgdGhpcy53cml0YWJsZSA9IHRydWU7XG5cbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMud3JpdGUgPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl93cml0ZSA9IG9wdGlvbnMud3JpdGU7XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMud3JpdGV2ID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fd3JpdGV2ID0gb3B0aW9ucy53cml0ZXY7XG4gIH1cblxuICBTdHJlYW0uY2FsbCh0aGlzKTtcbn1cblxuLy8gT3RoZXJ3aXNlIHBlb3BsZSBjYW4gcGlwZSBXcml0YWJsZSBzdHJlYW1zLCB3aGljaCBpcyBqdXN0IHdyb25nLlxuV3JpdGFibGUucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQ2Fubm90IHBpcGUuIE5vdCByZWFkYWJsZS4nKSk7XG59O1xuXG5cbmZ1bmN0aW9uIHdyaXRlQWZ0ZXJFbmQoc3RyZWFtLCBjYikge1xuICB2YXIgZXIgPSBuZXcgRXJyb3IoJ3dyaXRlIGFmdGVyIGVuZCcpO1xuICAvLyBUT0RPOiBkZWZlciBlcnJvciBldmVudHMgY29uc2lzdGVudGx5IGV2ZXJ5d2hlcmUsIG5vdCBqdXN0IHRoZSBjYlxuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xufVxuXG4vLyBJZiB3ZSBnZXQgc29tZXRoaW5nIHRoYXQgaXMgbm90IGEgYnVmZmVyLCBzdHJpbmcsIG51bGwsIG9yIHVuZGVmaW5lZCxcbi8vIGFuZCB3ZSdyZSBub3QgaW4gb2JqZWN0TW9kZSwgdGhlbiB0aGF0J3MgYW4gZXJyb3IuXG4vLyBPdGhlcndpc2Ugc3RyZWFtIGNodW5rcyBhcmUgYWxsIGNvbnNpZGVyZWQgdG8gYmUgb2YgbGVuZ3RoPTEsIGFuZCB0aGVcbi8vIHdhdGVybWFya3MgZGV0ZXJtaW5lIGhvdyBtYW55IG9iamVjdHMgdG8ga2VlcCBpbiB0aGUgYnVmZmVyLCByYXRoZXIgdGhhblxuLy8gaG93IG1hbnkgYnl0ZXMgb3IgY2hhcmFjdGVycy5cbmZ1bmN0aW9uIHZhbGlkQ2h1bmsoc3RyZWFtLCBzdGF0ZSwgY2h1bmssIGNiKSB7XG4gIHZhciB2YWxpZCA9IHRydWU7XG5cbiAgaWYgKCEoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSkgJiZcbiAgICAgIHR5cGVvZiBjaHVuayAhPT0gJ3N0cmluZycgJiZcbiAgICAgIGNodW5rICE9PSBudWxsICYmXG4gICAgICBjaHVuayAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhc3RhdGUub2JqZWN0TW9kZSkge1xuICAgIHZhciBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gICAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG4gICAgdmFsaWQgPSBmYWxzZTtcbiAgfVxuICByZXR1cm4gdmFsaWQ7XG59XG5cbldyaXRhYmxlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHJldCA9IGZhbHNlO1xuXG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoY2h1bmspKVxuICAgIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gIGVsc2UgaWYgKCFlbmNvZGluZylcbiAgICBlbmNvZGluZyA9IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcblxuICBpZiAodHlwZW9mIGNiICE9PSAnZnVuY3Rpb24nKVxuICAgIGNiID0gbm9wO1xuXG4gIGlmIChzdGF0ZS5lbmRlZClcbiAgICB3cml0ZUFmdGVyRW5kKHRoaXMsIGNiKTtcbiAgZWxzZSBpZiAodmFsaWRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssIGNiKSkge1xuICAgIHN0YXRlLnBlbmRpbmdjYisrO1xuICAgIHJldCA9IHdyaXRlT3JCdWZmZXIodGhpcywgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5jb3JrID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgc3RhdGUuY29ya2VkKys7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUudW5jb3JrID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHN0YXRlLmNvcmtlZCkge1xuICAgIHN0YXRlLmNvcmtlZC0tO1xuXG4gICAgaWYgKCFzdGF0ZS53cml0aW5nICYmXG4gICAgICAgICFzdGF0ZS5jb3JrZWQgJiZcbiAgICAgICAgIXN0YXRlLmZpbmlzaGVkICYmXG4gICAgICAgICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmXG4gICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdClcbiAgICAgIGNsZWFyQnVmZmVyKHRoaXMsIHN0YXRlKTtcbiAgfVxufTtcblxuV3JpdGFibGUucHJvdG90eXBlLnNldERlZmF1bHRFbmNvZGluZyA9IGZ1bmN0aW9uIHNldERlZmF1bHRFbmNvZGluZyhlbmNvZGluZykge1xuICAvLyBub2RlOjpQYXJzZUVuY29kaW5nKCkgcmVxdWlyZXMgbG93ZXIgY2FzZS5cbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycpXG4gICAgZW5jb2RpbmcgPSBlbmNvZGluZy50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIShbJ2hleCcsICd1dGY4JywgJ3V0Zi04JywgJ2FzY2lpJywgJ2JpbmFyeScsICdiYXNlNjQnLFxuJ3VjczInLCAndWNzLTInLCd1dGYxNmxlJywgJ3V0Zi0xNmxlJywgJ3JhdyddXG4uaW5kZXhPZigoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKSkgPiAtMSkpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgdGhpcy5fd3JpdGFibGVTdGF0ZS5kZWZhdWx0RW5jb2RpbmcgPSBlbmNvZGluZztcbn07XG5cbmZ1bmN0aW9uIGRlY29kZUNodW5rKHN0YXRlLCBjaHVuaywgZW5jb2RpbmcpIHtcbiAgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmXG4gICAgICBzdGF0ZS5kZWNvZGVTdHJpbmdzICE9PSBmYWxzZSAmJlxuICAgICAgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJykge1xuICAgIGNodW5rID0gbmV3IEJ1ZmZlcihjaHVuaywgZW5jb2RpbmcpO1xuICB9XG4gIHJldHVybiBjaHVuaztcbn1cblxuLy8gaWYgd2UncmUgYWxyZWFkeSB3cml0aW5nIHNvbWV0aGluZywgdGhlbiBqdXN0IHB1dCB0aGlzXG4vLyBpbiB0aGUgcXVldWUsIGFuZCB3YWl0IG91ciB0dXJuLiAgT3RoZXJ3aXNlLCBjYWxsIF93cml0ZVxuLy8gSWYgd2UgcmV0dXJuIGZhbHNlLCB0aGVuIHdlIG5lZWQgYSBkcmFpbiBldmVudCwgc28gc2V0IHRoYXQgZmxhZy5cbmZ1bmN0aW9uIHdyaXRlT3JCdWZmZXIoc3RyZWFtLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjaHVuayA9IGRlY29kZUNodW5rKHN0YXRlLCBjaHVuaywgZW5jb2RpbmcpO1xuXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoY2h1bmspKVxuICAgIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICBzdGF0ZS5sZW5ndGggKz0gbGVuO1xuXG4gIHZhciByZXQgPSBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrO1xuICAvLyB3ZSBtdXN0IGVuc3VyZSB0aGF0IHByZXZpb3VzIG5lZWREcmFpbiB3aWxsIG5vdCBiZSByZXNldCB0byBmYWxzZS5cbiAgaWYgKCFyZXQpXG4gICAgc3RhdGUubmVlZERyYWluID0gdHJ1ZTtcblxuICBpZiAoc3RhdGUud3JpdGluZyB8fCBzdGF0ZS5jb3JrZWQpIHtcbiAgICB2YXIgbGFzdCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG5ldyBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgICBpZiAobGFzdCkge1xuICAgICAgbGFzdC5uZXh0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgd3JpdGV2LCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgc3RhdGUud3JpdGVsZW4gPSBsZW47XG4gIHN0YXRlLndyaXRlY2IgPSBjYjtcbiAgc3RhdGUud3JpdGluZyA9IHRydWU7XG4gIHN0YXRlLnN5bmMgPSB0cnVlO1xuICBpZiAod3JpdGV2KVxuICAgIHN0cmVhbS5fd3JpdGV2KGNodW5rLCBzdGF0ZS5vbndyaXRlKTtcbiAgZWxzZVxuICAgIHN0cmVhbS5fd3JpdGUoY2h1bmssIGVuY29kaW5nLCBzdGF0ZS5vbndyaXRlKTtcbiAgc3RhdGUuc3luYyA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlRXJyb3Ioc3RyZWFtLCBzdGF0ZSwgc3luYywgZXIsIGNiKSB7XG4gIC0tc3RhdGUucGVuZGluZ2NiO1xuICBpZiAoc3luYylcbiAgICBwcm9jZXNzTmV4dFRpY2soY2IsIGVyKTtcbiAgZWxzZVxuICAgIGNiKGVyKTtcblxuICBzdHJlYW0uX3dyaXRhYmxlU3RhdGUuZXJyb3JFbWl0dGVkID0gdHJ1ZTtcbiAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlU3RhdGVVcGRhdGUoc3RhdGUpIHtcbiAgc3RhdGUud3JpdGluZyA9IGZhbHNlO1xuICBzdGF0ZS53cml0ZWNiID0gbnVsbDtcbiAgc3RhdGUubGVuZ3RoIC09IHN0YXRlLndyaXRlbGVuO1xuICBzdGF0ZS53cml0ZWxlbiA9IDA7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGUoc3RyZWFtLCBlcikge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciBzeW5jID0gc3RhdGUuc3luYztcbiAgdmFyIGNiID0gc3RhdGUud3JpdGVjYjtcblxuICBvbndyaXRlU3RhdGVVcGRhdGUoc3RhdGUpO1xuXG4gIGlmIChlcilcbiAgICBvbndyaXRlRXJyb3Ioc3RyZWFtLCBzdGF0ZSwgc3luYywgZXIsIGNiKTtcbiAgZWxzZSB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgYWN0dWFsbHkgcmVhZHkgdG8gZmluaXNoLCBidXQgZG9uJ3QgZW1pdCB5ZXRcbiAgICB2YXIgZmluaXNoZWQgPSBuZWVkRmluaXNoKHN0YXRlKTtcblxuICAgIGlmICghZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QpIHtcbiAgICAgIGNsZWFyQnVmZmVyKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cblxuICAgIGlmIChzeW5jKSB7XG4gICAgICBwcm9jZXNzTmV4dFRpY2soYWZ0ZXJXcml0ZSwgc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZnRlcldyaXRlKHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYikge1xuICBpZiAoIWZpbmlzaGVkKVxuICAgIG9ud3JpdGVEcmFpbihzdHJlYW0sIHN0YXRlKTtcbiAgc3RhdGUucGVuZGluZ2NiLS07XG4gIGNiKCk7XG4gIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpO1xufVxuXG4vLyBNdXN0IGZvcmNlIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCBvbiBuZXh0VGljaywgc28gdGhhdCB3ZSBkb24ndFxuLy8gZW1pdCAnZHJhaW4nIGJlZm9yZSB0aGUgd3JpdGUoKSBjb25zdW1lciBnZXRzIHRoZSAnZmFsc2UnIHJldHVyblxuLy8gdmFsdWUsIGFuZCBoYXMgYSBjaGFuY2UgdG8gYXR0YWNoIGEgJ2RyYWluJyBsaXN0ZW5lci5cbmZ1bmN0aW9uIG9ud3JpdGVEcmFpbihzdHJlYW0sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUubmVlZERyYWluKSB7XG4gICAgc3RhdGUubmVlZERyYWluID0gZmFsc2U7XG4gICAgc3RyZWFtLmVtaXQoJ2RyYWluJyk7XG4gIH1cbn1cblxuXG4vLyBpZiB0aGVyZSdzIHNvbWV0aGluZyBpbiB0aGUgYnVmZmVyIHdhaXRpbmcsIHRoZW4gcHJvY2VzcyBpdFxuZnVuY3Rpb24gY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSkge1xuICBzdGF0ZS5idWZmZXJQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgdmFyIGVudHJ5ID0gc3RhdGUuYnVmZmVyZWRSZXF1ZXN0O1xuXG4gIGlmIChzdHJlYW0uX3dyaXRldiAmJiBlbnRyeSAmJiBlbnRyeS5uZXh0KSB7XG4gICAgLy8gRmFzdCBjYXNlLCB3cml0ZSBldmVyeXRoaW5nIHVzaW5nIF93cml0ZXYoKVxuICAgIHZhciBidWZmZXIgPSBbXTtcbiAgICB2YXIgY2JzID0gW107XG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICBjYnMucHVzaChlbnRyeS5jYWxsYmFjayk7XG4gICAgICBidWZmZXIucHVzaChlbnRyeSk7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm5leHQ7XG4gICAgfVxuXG4gICAgLy8gY291bnQgdGhlIG9uZSB3ZSBhcmUgYWRkaW5nLCBhcyB3ZWxsLlxuICAgIC8vIFRPRE8oaXNhYWNzKSBjbGVhbiB0aGlzIHVwXG4gICAgc3RhdGUucGVuZGluZ2NiKys7XG4gICAgc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCB0cnVlLCBzdGF0ZS5sZW5ndGgsIGJ1ZmZlciwgJycsIGZ1bmN0aW9uKGVycikge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3RhdGUucGVuZGluZ2NiLS07XG4gICAgICAgIGNic1tpXShlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2xlYXIgYnVmZmVyXG4gIH0gZWxzZSB7XG4gICAgLy8gU2xvdyBjYXNlLCB3cml0ZSBjaHVua3Mgb25lLWJ5LW9uZVxuICAgIHdoaWxlIChlbnRyeSkge1xuICAgICAgdmFyIGNodW5rID0gZW50cnkuY2h1bms7XG4gICAgICB2YXIgZW5jb2RpbmcgPSBlbnRyeS5lbmNvZGluZztcbiAgICAgIHZhciBjYiA9IGVudHJ5LmNhbGxiYWNrO1xuICAgICAgdmFyIGxlbiA9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuXG4gICAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICAgICAgZW50cnkgPSBlbnRyeS5uZXh0O1xuICAgICAgLy8gaWYgd2UgZGlkbid0IGNhbGwgdGhlIG9ud3JpdGUgaW1tZWRpYXRlbHksIHRoZW5cbiAgICAgIC8vIGl0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byB3YWl0IHVudGlsIGl0IGRvZXMuXG4gICAgICAvLyBhbHNvLCB0aGF0IG1lYW5zIHRoYXQgdGhlIGNodW5rIGFuZCBjYiBhcmUgY3VycmVudGx5XG4gICAgICAvLyBiZWluZyBwcm9jZXNzZWQsIHNvIG1vdmUgdGhlIGJ1ZmZlciBjb3VudGVyIHBhc3QgdGhlbS5cbiAgICAgIGlmIChzdGF0ZS53cml0aW5nKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbnRyeSA9PT0gbnVsbClcbiAgICAgIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB9XG4gIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9IGVudHJ5O1xuICBzdGF0ZS5idWZmZXJQcm9jZXNzaW5nID0gZmFsc2U7XG59XG5cbldyaXRhYmxlLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNiKG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJykpO1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZXYgPSBudWxsO1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmICh0eXBlb2YgY2h1bmsgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGNodW5rO1xuICAgIGNodW5rID0gbnVsbDtcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBpZiAoY2h1bmsgIT09IG51bGwgJiYgY2h1bmsgIT09IHVuZGVmaW5lZClcbiAgICB0aGlzLndyaXRlKGNodW5rLCBlbmNvZGluZyk7XG5cbiAgLy8gLmVuZCgpIGZ1bGx5IHVuY29ya3NcbiAgaWYgKHN0YXRlLmNvcmtlZCkge1xuICAgIHN0YXRlLmNvcmtlZCA9IDE7XG4gICAgdGhpcy51bmNvcmsoKTtcbiAgfVxuXG4gIC8vIGlnbm9yZSB1bm5lY2Vzc2FyeSBlbmQoKSBjYWxscy5cbiAgaWYgKCFzdGF0ZS5lbmRpbmcgJiYgIXN0YXRlLmZpbmlzaGVkKVxuICAgIGVuZFdyaXRhYmxlKHRoaXMsIHN0YXRlLCBjYik7XG59O1xuXG5cbmZ1bmN0aW9uIG5lZWRGaW5pc2goc3RhdGUpIHtcbiAgcmV0dXJuIChzdGF0ZS5lbmRpbmcgJiZcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPT09IG51bGwgJiZcbiAgICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgICAhc3RhdGUud3JpdGluZyk7XG59XG5cbmZ1bmN0aW9uIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucHJlZmluaXNoZWQpIHtcbiAgICBzdGF0ZS5wcmVmaW5pc2hlZCA9IHRydWU7XG4gICAgc3RyZWFtLmVtaXQoJ3ByZWZpbmlzaCcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIG5lZWQgPSBuZWVkRmluaXNoKHN0YXRlKTtcbiAgaWYgKG5lZWQpIHtcbiAgICBpZiAoc3RhdGUucGVuZGluZ2NiID09PSAwKSB7XG4gICAgICBwcmVmaW5pc2goc3RyZWFtLCBzdGF0ZSk7XG4gICAgICBzdGF0ZS5maW5pc2hlZCA9IHRydWU7XG4gICAgICBzdHJlYW0uZW1pdCgnZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5lZWQ7XG59XG5cbmZ1bmN0aW9uIGVuZFdyaXRhYmxlKHN0cmVhbSwgc3RhdGUsIGNiKSB7XG4gIHN0YXRlLmVuZGluZyA9IHRydWU7XG4gIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpO1xuICBpZiAoY2IpIHtcbiAgICBpZiAoc3RhdGUuZmluaXNoZWQpXG4gICAgICBwcm9jZXNzTmV4dFRpY2soY2IpO1xuICAgIGVsc2VcbiAgICAgIHN0cmVhbS5vbmNlKCdmaW5pc2gnLCBjYik7XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qc1wiKVxuIiwidmFyIFN0cmVhbSA9IChmdW5jdGlvbiAoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVxdWlyZSgnc3QnICsgJ3JlYW0nKTsgLy8gaGFjayB0byBmaXggYSBjaXJjdWxhciBkZXBlbmRlbmN5IGlzc3VlIHdoZW4gdXNlZCB3aXRoIGJyb3dzZXJpZnlcbiAgfSBjYXRjaChfKXt9XG59KCkpO1xuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcycpO1xuZXhwb3J0cy5TdHJlYW0gPSBTdHJlYW0gfHwgZXhwb3J0cztcbmV4cG9ydHMuUmVhZGFibGUgPSBleHBvcnRzO1xuZXhwb3J0cy5Xcml0YWJsZSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fd3JpdGFibGUuanMnKTtcbmV4cG9ydHMuRHVwbGV4ID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9kdXBsZXguanMnKTtcbmV4cG9ydHMuVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV90cmFuc2Zvcm0uanMnKTtcbmV4cG9ydHMuUGFzc1Rocm91Z2ggPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX3RyYW5zZm9ybS5qc1wiKVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV93cml0YWJsZS5qc1wiKVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbm1vZHVsZS5leHBvcnRzID0gU3RyZWFtO1xuXG52YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5pbmhlcml0cyhTdHJlYW0sIEVFKTtcblN0cmVhbS5SZWFkYWJsZSA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS9yZWFkYWJsZS5qcycpO1xuU3RyZWFtLldyaXRhYmxlID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3dyaXRhYmxlLmpzJyk7XG5TdHJlYW0uRHVwbGV4ID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL2R1cGxleC5qcycpO1xuU3RyZWFtLlRyYW5zZm9ybSA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS90cmFuc2Zvcm0uanMnKTtcblN0cmVhbS5QYXNzVGhyb3VnaCA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS9wYXNzdGhyb3VnaC5qcycpO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjQueFxuU3RyZWFtLlN0cmVhbSA9IFN0cmVhbTtcblxuXG5cbi8vIG9sZC1zdHlsZSBzdHJlYW1zLiAgTm90ZSB0aGF0IHRoZSBwaXBlIG1ldGhvZCAodGhlIG9ubHkgcmVsZXZhbnRcbi8vIHBhcnQgb2YgdGhpcyBjbGFzcykgaXMgb3ZlcnJpZGRlbiBpbiB0aGUgUmVhZGFibGUgY2xhc3MuXG5cbmZ1bmN0aW9uIFN0cmVhbSgpIHtcbiAgRUUuY2FsbCh0aGlzKTtcbn1cblxuU3RyZWFtLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgb3B0aW9ucykge1xuICB2YXIgc291cmNlID0gdGhpcztcblxuICBmdW5jdGlvbiBvbmRhdGEoY2h1bmspIHtcbiAgICBpZiAoZGVzdC53cml0YWJsZSkge1xuICAgICAgaWYgKGZhbHNlID09PSBkZXN0LndyaXRlKGNodW5rKSAmJiBzb3VyY2UucGF1c2UpIHtcbiAgICAgICAgc291cmNlLnBhdXNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc291cmNlLm9uKCdkYXRhJywgb25kYXRhKTtcblxuICBmdW5jdGlvbiBvbmRyYWluKCkge1xuICAgIGlmIChzb3VyY2UucmVhZGFibGUgJiYgc291cmNlLnJlc3VtZSkge1xuICAgICAgc291cmNlLnJlc3VtZSgpO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Qub24oJ2RyYWluJywgb25kcmFpbik7XG5cbiAgLy8gSWYgdGhlICdlbmQnIG9wdGlvbiBpcyBub3Qgc3VwcGxpZWQsIGRlc3QuZW5kKCkgd2lsbCBiZSBjYWxsZWQgd2hlblxuICAvLyBzb3VyY2UgZ2V0cyB0aGUgJ2VuZCcgb3IgJ2Nsb3NlJyBldmVudHMuICBPbmx5IGRlc3QuZW5kKCkgb25jZS5cbiAgaWYgKCFkZXN0Ll9pc1N0ZGlvICYmICghb3B0aW9ucyB8fCBvcHRpb25zLmVuZCAhPT0gZmFsc2UpKSB7XG4gICAgc291cmNlLm9uKCdlbmQnLCBvbmVuZCk7XG4gICAgc291cmNlLm9uKCdjbG9zZScsIG9uY2xvc2UpO1xuICB9XG5cbiAgdmFyIGRpZE9uRW5kID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uZW5kKCkge1xuICAgIGlmIChkaWRPbkVuZCkgcmV0dXJuO1xuICAgIGRpZE9uRW5kID0gdHJ1ZTtcblxuICAgIGRlc3QuZW5kKCk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgaWYgKHR5cGVvZiBkZXN0LmRlc3Ryb3kgPT09ICdmdW5jdGlvbicpIGRlc3QuZGVzdHJveSgpO1xuICB9XG5cbiAgLy8gZG9uJ3QgbGVhdmUgZGFuZ2xpbmcgcGlwZXMgd2hlbiB0aGVyZSBhcmUgZXJyb3JzLlxuICBmdW5jdGlvbiBvbmVycm9yKGVyKSB7XG4gICAgY2xlYW51cCgpO1xuICAgIGlmIChFRS5saXN0ZW5lckNvdW50KHRoaXMsICdlcnJvcicpID09PSAwKSB7XG4gICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkIHN0cmVhbSBlcnJvciBpbiBwaXBlLlxuICAgIH1cbiAgfVxuXG4gIHNvdXJjZS5vbignZXJyb3InLCBvbmVycm9yKTtcbiAgZGVzdC5vbignZXJyb3InLCBvbmVycm9yKTtcblxuICAvLyByZW1vdmUgYWxsIHRoZSBldmVudCBsaXN0ZW5lcnMgdGhhdCB3ZXJlIGFkZGVkLlxuICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZGF0YScsIG9uZGF0YSk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZHJhaW4nLCBvbmRyYWluKTtcblxuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZW5kJywgb25lbmQpO1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcblxuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBjbGVhbnVwKTtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIGNsZWFudXApO1xuICB9XG5cbiAgc291cmNlLm9uKCdlbmQnLCBjbGVhbnVwKTtcbiAgc291cmNlLm9uKCdjbG9zZScsIGNsZWFudXApO1xuXG4gIGRlc3Qub24oJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgZGVzdC5lbWl0KCdwaXBlJywgc291cmNlKTtcblxuICAvLyBBbGxvdyBmb3IgdW5peC1saWtlIHVzYWdlOiBBLnBpcGUoQikucGlwZShDKVxuICByZXR1cm4gZGVzdDtcbn07XG4iLCJ2YXIgQ2xpZW50UmVxdWVzdCA9IHJlcXVpcmUoJy4vbGliL3JlcXVlc3QnKVxudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ3h0ZW5kJylcbnZhciBzdGF0dXNDb2RlcyA9IHJlcXVpcmUoJ2J1aWx0aW4tc3RhdHVzLWNvZGVzJylcbnZhciB1cmwgPSByZXF1aXJlKCd1cmwnKVxuXG52YXIgaHR0cCA9IGV4cG9ydHNcblxuaHR0cC5yZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdHMsIGNiKSB7XG5cdGlmICh0eXBlb2Ygb3B0cyA9PT0gJ3N0cmluZycpXG5cdFx0b3B0cyA9IHVybC5wYXJzZShvcHRzKVxuXHRlbHNlXG5cdFx0b3B0cyA9IGV4dGVuZChvcHRzKVxuXG5cdHZhciBwcm90b2NvbCA9IG9wdHMucHJvdG9jb2wgfHwgJydcblx0dmFyIGhvc3QgPSBvcHRzLmhvc3RuYW1lIHx8IG9wdHMuaG9zdFxuXHR2YXIgcG9ydCA9IG9wdHMucG9ydFxuXHR2YXIgcGF0aCA9IG9wdHMucGF0aCB8fCAnLydcblxuXHQvLyBOZWNlc3NhcnkgZm9yIElQdjYgYWRkcmVzc2VzXG5cdGlmIChob3N0ICYmIGhvc3QuaW5kZXhPZignOicpICE9PSAtMSlcblx0XHRob3N0ID0gJ1snICsgaG9zdCArICddJ1xuXG5cdC8vIFRoaXMgbWF5IGJlIGEgcmVsYXRpdmUgdXJsLiBUaGUgYnJvd3NlciBzaG91bGQgYWx3YXlzIGJlIGFibGUgdG8gaW50ZXJwcmV0IGl0IGNvcnJlY3RseS5cblx0b3B0cy51cmwgPSAoaG9zdCA/IChwcm90b2NvbCArICcvLycgKyBob3N0KSA6ICcnKSArIChwb3J0ID8gJzonICsgcG9ydCA6ICcnKSArIHBhdGhcblx0b3B0cy5tZXRob2QgPSAob3B0cy5tZXRob2QgfHwgJ0dFVCcpLnRvVXBwZXJDYXNlKClcblx0b3B0cy5oZWFkZXJzID0gb3B0cy5oZWFkZXJzIHx8IHt9XG5cblx0Ly8gQWxzbyB2YWxpZCBvcHRzLmF1dGgsIG9wdHMubW9kZVxuXG5cdHZhciByZXEgPSBuZXcgQ2xpZW50UmVxdWVzdChvcHRzKVxuXHRpZiAoY2IpXG5cdFx0cmVxLm9uKCdyZXNwb25zZScsIGNiKVxuXHRyZXR1cm4gcmVxXG59XG5cbmh0dHAuZ2V0ID0gZnVuY3Rpb24gZ2V0IChvcHRzLCBjYikge1xuXHR2YXIgcmVxID0gaHR0cC5yZXF1ZXN0KG9wdHMsIGNiKVxuXHRyZXEuZW5kKClcblx0cmV0dXJuIHJlcVxufVxuXG5odHRwLkFnZW50ID0gZnVuY3Rpb24gKCkge31cbmh0dHAuQWdlbnQuZGVmYXVsdE1heFNvY2tldHMgPSA0XG5cbmh0dHAuU1RBVFVTX0NPREVTID0gc3RhdHVzQ29kZXNcblxuaHR0cC5NRVRIT0RTID0gW1xuXHQnQ0hFQ0tPVVQnLFxuXHQnQ09OTkVDVCcsXG5cdCdDT1BZJyxcblx0J0RFTEVURScsXG5cdCdHRVQnLFxuXHQnSEVBRCcsXG5cdCdMT0NLJyxcblx0J00tU0VBUkNIJyxcblx0J01FUkdFJyxcblx0J01LQUNUSVZJVFknLFxuXHQnTUtDT0wnLFxuXHQnTU9WRScsXG5cdCdOT1RJRlknLFxuXHQnT1BUSU9OUycsXG5cdCdQQVRDSCcsXG5cdCdQT1NUJyxcblx0J1BST1BGSU5EJyxcblx0J1BST1BQQVRDSCcsXG5cdCdQVVJHRScsXG5cdCdQVVQnLFxuXHQnUkVQT1JUJyxcblx0J1NFQVJDSCcsXG5cdCdTVUJTQ1JJQkUnLFxuXHQnVFJBQ0UnLFxuXHQnVU5MT0NLJyxcblx0J1VOU1VCU0NSSUJFJ1xuXSIsImV4cG9ydHMuZmV0Y2ggPSBpc0Z1bmN0aW9uKGdsb2JhbC5mZXRjaCkgJiYgaXNGdW5jdGlvbihnbG9iYWwuUmVhZGFibGVCeXRlU3RyZWFtKVxuXG5leHBvcnRzLmJsb2JDb25zdHJ1Y3RvciA9IGZhbHNlXG50cnkge1xuXHRuZXcgQmxvYihbbmV3IEFycmF5QnVmZmVyKDEpXSlcblx0ZXhwb3J0cy5ibG9iQ29uc3RydWN0b3IgPSB0cnVlXG59IGNhdGNoIChlKSB7fVxuXG52YXIgeGhyID0gbmV3IGdsb2JhbC5YTUxIdHRwUmVxdWVzdCgpXG4vLyBJZiBsb2NhdGlvbi5ob3N0IGlzIGVtcHR5LCBlLmcuIGlmIHRoaXMgcGFnZS93b3JrZXIgd2FzIGxvYWRlZFxuLy8gZnJvbSBhIEJsb2IsIHRoZW4gdXNlIGV4YW1wbGUuY29tIHRvIGF2b2lkIGFuIGVycm9yXG54aHIub3BlbignR0VUJywgZ2xvYmFsLmxvY2F0aW9uLmhvc3QgPyAnLycgOiAnaHR0cHM6Ly9leGFtcGxlLmNvbScpXG5cbmZ1bmN0aW9uIGNoZWNrVHlwZVN1cHBvcnQgKHR5cGUpIHtcblx0dHJ5IHtcblx0XHR4aHIucmVzcG9uc2VUeXBlID0gdHlwZVxuXHRcdHJldHVybiB4aHIucmVzcG9uc2VUeXBlID09PSB0eXBlXG5cdH0gY2F0Y2ggKGUpIHt9XG5cdHJldHVybiBmYWxzZVxufVxuXG4vLyBGb3Igc29tZSBzdHJhbmdlIHJlYXNvbiwgU2FmYXJpIDcuMCByZXBvcnRzIHR5cGVvZiBnbG9iYWwuQXJyYXlCdWZmZXIgPT09ICdvYmplY3QnLlxuLy8gU2FmYXJpIDcuMSBhcHBlYXJzIHRvIGhhdmUgZml4ZWQgdGhpcyBidWcuXG52YXIgaGF2ZUFycmF5QnVmZmVyID0gdHlwZW9mIGdsb2JhbC5BcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCdcbnZhciBoYXZlU2xpY2UgPSBoYXZlQXJyYXlCdWZmZXIgJiYgaXNGdW5jdGlvbihnbG9iYWwuQXJyYXlCdWZmZXIucHJvdG90eXBlLnNsaWNlKVxuXG5leHBvcnRzLmFycmF5YnVmZmVyID0gaGF2ZUFycmF5QnVmZmVyICYmIGNoZWNrVHlwZVN1cHBvcnQoJ2FycmF5YnVmZmVyJylcbi8vIFRoZXNlIG5leHQgdHdvIHRlc3RzIHVuYXZvaWRhYmx5IHNob3cgd2FybmluZ3MgaW4gQ2hyb21lLiBTaW5jZSBmZXRjaCB3aWxsIGFsd2F5c1xuLy8gYmUgdXNlZCBpZiBpdCdzIGF2YWlsYWJsZSwganVzdCByZXR1cm4gZmFsc2UgZm9yIHRoZXNlIHRvIGF2b2lkIHRoZSB3YXJuaW5ncy5cbmV4cG9ydHMubXNzdHJlYW0gPSAhZXhwb3J0cy5mZXRjaCAmJiBoYXZlU2xpY2UgJiYgY2hlY2tUeXBlU3VwcG9ydCgnbXMtc3RyZWFtJylcbmV4cG9ydHMubW96Y2h1bmtlZGFycmF5YnVmZmVyID0gIWV4cG9ydHMuZmV0Y2ggJiYgaGF2ZUFycmF5QnVmZmVyICYmXG5cdGNoZWNrVHlwZVN1cHBvcnQoJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJylcbmV4cG9ydHMub3ZlcnJpZGVNaW1lVHlwZSA9IGlzRnVuY3Rpb24oeGhyLm92ZXJyaWRlTWltZVR5cGUpXG5leHBvcnRzLnZiQXJyYXkgPSBpc0Z1bmN0aW9uKGdsb2JhbC5WQkFycmF5KVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nXG59XG5cbnhociA9IG51bGwgLy8gSGVscCBnY1xuIiwiLy8gdmFyIEJhc2U2NCA9IHJlcXVpcmUoJ0Jhc2U2NCcpXG52YXIgY2FwYWJpbGl0eSA9IHJlcXVpcmUoJy4vY2FwYWJpbGl0eScpXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpXG52YXIgcmVzcG9uc2UgPSByZXF1aXJlKCcuL3Jlc3BvbnNlJylcbnZhciBzdHJlYW0gPSByZXF1aXJlKCdzdHJlYW0nKVxuXG52YXIgSW5jb21pbmdNZXNzYWdlID0gcmVzcG9uc2UuSW5jb21pbmdNZXNzYWdlXG52YXIgclN0YXRlcyA9IHJlc3BvbnNlLnJlYWR5U3RhdGVzXG5cbmZ1bmN0aW9uIGRlY2lkZU1vZGUgKHByZWZlckJpbmFyeSkge1xuXHRpZiAoY2FwYWJpbGl0eS5mZXRjaCkge1xuXHRcdHJldHVybiAnZmV0Y2gnXG5cdH0gZWxzZSBpZiAoY2FwYWJpbGl0eS5tb3pjaHVua2VkYXJyYXlidWZmZXIpIHtcblx0XHRyZXR1cm4gJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJ1xuXHR9IGVsc2UgaWYgKGNhcGFiaWxpdHkubXNzdHJlYW0pIHtcblx0XHRyZXR1cm4gJ21zLXN0cmVhbSdcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5LmFycmF5YnVmZmVyICYmIHByZWZlckJpbmFyeSkge1xuXHRcdHJldHVybiAnYXJyYXlidWZmZXInXG5cdH0gZWxzZSBpZiAoY2FwYWJpbGl0eS52YkFycmF5ICYmIHByZWZlckJpbmFyeSkge1xuXHRcdHJldHVybiAndGV4dDp2YmFycmF5J1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiAndGV4dCdcblx0fVxufVxuXG52YXIgQ2xpZW50UmVxdWVzdCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9wdHMpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHN0cmVhbS5Xcml0YWJsZS5jYWxsKHNlbGYpXG5cblx0c2VsZi5fb3B0cyA9IG9wdHNcblx0c2VsZi5fYm9keSA9IFtdXG5cdHNlbGYuX2hlYWRlcnMgPSB7fVxuXHRpZiAob3B0cy5hdXRoKVxuXHRcdHNlbGYuc2V0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyBuZXcgQnVmZmVyKG9wdHMuYXV0aCkudG9TdHJpbmcoJ2Jhc2U2NCcpKVxuXHRPYmplY3Qua2V5cyhvcHRzLmhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRzZWxmLnNldEhlYWRlcihuYW1lLCBvcHRzLmhlYWRlcnNbbmFtZV0pXG5cdH0pXG5cblx0dmFyIHByZWZlckJpbmFyeVxuXHRpZiAob3B0cy5tb2RlID09PSAncHJlZmVyLXN0cmVhbWluZycpIHtcblx0XHQvLyBJZiBzdHJlYW1pbmcgaXMgYSBoaWdoIHByaW9yaXR5IGJ1dCBiaW5hcnkgY29tcGF0aWJpbGl0eSBhbmRcblx0XHQvLyB0aGUgYWNjdXJhY3kgb2YgdGhlICdjb250ZW50LXR5cGUnIGhlYWRlciBhcmVuJ3Rcblx0XHRwcmVmZXJCaW5hcnkgPSBmYWxzZVxuXHR9IGVsc2UgaWYgKG9wdHMubW9kZSA9PT0gJ2FsbG93LXdyb25nLWNvbnRlbnQtdHlwZScpIHtcblx0XHQvLyBJZiBzdHJlYW1pbmcgaXMgbW9yZSBpbXBvcnRhbnQgdGhhbiBwcmVzZXJ2aW5nIHRoZSAnY29udGVudC10eXBlJyBoZWFkZXJcblx0XHRwcmVmZXJCaW5hcnkgPSAhY2FwYWJpbGl0eS5vdmVycmlkZU1pbWVUeXBlXG5cdH0gZWxzZSBpZiAoIW9wdHMubW9kZSB8fCBvcHRzLm1vZGUgPT09ICdkZWZhdWx0JyB8fCBvcHRzLm1vZGUgPT09ICdwcmVmZXItZmFzdCcpIHtcblx0XHQvLyBVc2UgYmluYXJ5IGlmIHRleHQgc3RyZWFtaW5nIG1heSBjb3JydXB0IGRhdGEgb3IgdGhlIGNvbnRlbnQtdHlwZSBoZWFkZXIsIG9yIGZvciBzcGVlZFxuXHRcdHByZWZlckJpbmFyeSA9IHRydWVcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdmFsdWUgZm9yIG9wdHMubW9kZScpXG5cdH1cblx0c2VsZi5fbW9kZSA9IGRlY2lkZU1vZGUocHJlZmVyQmluYXJ5KVxuXG5cdHNlbGYub24oJ2ZpbmlzaCcsIGZ1bmN0aW9uICgpIHtcblx0XHRzZWxmLl9vbkZpbmlzaCgpXG5cdH0pXG59XG5cbmluaGVyaXRzKENsaWVudFJlcXVlc3QsIHN0cmVhbS5Xcml0YWJsZSlcblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuc2V0SGVhZGVyID0gZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHR2YXIgbG93ZXJOYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpXG5cdC8vIFRoaXMgY2hlY2sgaXMgbm90IG5lY2Vzc2FyeSwgYnV0IGl0IHByZXZlbnRzIHdhcm5pbmdzIGZyb20gYnJvd3NlcnMgYWJvdXQgc2V0dGluZyB1bnNhZmVcblx0Ly8gaGVhZGVycy4gVG8gYmUgaG9uZXN0IEknbSBub3QgZW50aXJlbHkgc3VyZSBoaWRpbmcgdGhlc2Ugd2FybmluZ3MgaXMgYSBnb29kIHRoaW5nLCBidXRcblx0Ly8gaHR0cC1icm93c2VyaWZ5IGRpZCBpdCwgc28gSSB3aWxsIHRvby5cblx0aWYgKHVuc2FmZUhlYWRlcnMuaW5kZXhPZihsb3dlck5hbWUpICE9PSAtMSlcblx0XHRyZXR1cm5cblxuXHRzZWxmLl9oZWFkZXJzW2xvd2VyTmFtZV0gPSB7XG5cdFx0bmFtZTogbmFtZSxcblx0XHR2YWx1ZTogdmFsdWVcblx0fVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5nZXRIZWFkZXIgPSBmdW5jdGlvbiAobmFtZSkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0cmV0dXJuIHNlbGYuX2hlYWRlcnNbbmFtZS50b0xvd2VyQ2FzZSgpXS52YWx1ZVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5yZW1vdmVIZWFkZXIgPSBmdW5jdGlvbiAobmFtZSkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0ZGVsZXRlIHNlbGYuX2hlYWRlcnNbbmFtZS50b0xvd2VyQ2FzZSgpXVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5fb25GaW5pc2ggPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdGlmIChzZWxmLl9kZXN0cm95ZWQpXG5cdFx0cmV0dXJuXG5cdHZhciBvcHRzID0gc2VsZi5fb3B0c1xuXG5cdHZhciBoZWFkZXJzT2JqID0gc2VsZi5faGVhZGVyc1xuXHR2YXIgYm9keVxuXHRpZiAob3B0cy5tZXRob2QgPT09ICdQT1NUJyB8fCBvcHRzLm1ldGhvZCA9PT0gJ1BVVCcgfHwgb3B0cy5tZXRob2QgPT09ICdQQVRDSCcpIHtcblx0XHRpZiAoY2FwYWJpbGl0eS5ibG9iQ29uc3RydWN0b3IpIHtcblx0XHRcdGJvZHkgPSBuZXcgZ2xvYmFsLkJsb2Ioc2VsZi5fYm9keS5tYXAoZnVuY3Rpb24gKGJ1ZmZlcikge1xuXHRcdFx0XHRyZXR1cm4gYnVmZmVyLnRvQXJyYXlCdWZmZXIoKVxuXHRcdFx0fSksIHtcblx0XHRcdFx0dHlwZTogKGhlYWRlcnNPYmpbJ2NvbnRlbnQtdHlwZSddIHx8IHt9KS52YWx1ZSB8fCAnJ1xuXHRcdFx0fSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZ2V0IHV0Zjggc3RyaW5nXG5cdFx0XHRib2R5ID0gQnVmZmVyLmNvbmNhdChzZWxmLl9ib2R5KS50b1N0cmluZygpXG5cdFx0fVxuXHR9XG5cblx0aWYgKHNlbGYuX21vZGUgPT09ICdmZXRjaCcpIHtcblx0XHR2YXIgaGVhZGVycyA9IE9iamVjdC5rZXlzKGhlYWRlcnNPYmopLm1hcChmdW5jdGlvbiAobmFtZSkge1xuXHRcdFx0cmV0dXJuIFtoZWFkZXJzT2JqW25hbWVdLm5hbWUsIGhlYWRlcnNPYmpbbmFtZV0udmFsdWVdXG5cdFx0fSlcblxuXHRcdGdsb2JhbC5mZXRjaChzZWxmLl9vcHRzLnVybCwge1xuXHRcdFx0bWV0aG9kOiBzZWxmLl9vcHRzLm1ldGhvZCxcblx0XHRcdGhlYWRlcnM6IGhlYWRlcnMsXG5cdFx0XHRib2R5OiBib2R5LFxuXHRcdFx0bW9kZTogJ2NvcnMnLFxuXHRcdFx0Y3JlZGVudGlhbHM6IG9wdHMud2l0aENyZWRlbnRpYWxzID8gJ2luY2x1ZGUnIDogJ3NhbWUtb3JpZ2luJ1xuXHRcdH0pLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG5cdFx0XHRzZWxmLl9mZXRjaFJlc3BvbnNlID0gcmVzcG9uc2Vcblx0XHRcdHNlbGYuX2Nvbm5lY3QoKVxuXHRcdH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcblx0XHRcdHNlbGYuZW1pdCgnZXJyb3InLCByZWFzb24pXG5cdFx0fSlcblx0fSBlbHNlIHtcblx0XHR2YXIgeGhyID0gc2VsZi5feGhyID0gbmV3IGdsb2JhbC5YTUxIdHRwUmVxdWVzdCgpXG5cdFx0dHJ5IHtcblx0XHRcdHhoci5vcGVuKHNlbGYuX29wdHMubWV0aG9kLCBzZWxmLl9vcHRzLnVybCwgdHJ1ZSlcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgZXJyKVxuXHRcdFx0fSlcblx0XHRcdHJldHVyblxuXHRcdH1cblxuXHRcdC8vIENhbid0IHNldCByZXNwb25zZVR5cGUgb24gcmVhbGx5IG9sZCBicm93c2Vyc1xuXHRcdGlmICgncmVzcG9uc2VUeXBlJyBpbiB4aHIpXG5cdFx0XHR4aHIucmVzcG9uc2VUeXBlID0gc2VsZi5fbW9kZS5zcGxpdCgnOicpWzBdXG5cblx0XHRpZiAoJ3dpdGhDcmVkZW50aWFscycgaW4geGhyKVxuXHRcdFx0eGhyLndpdGhDcmVkZW50aWFscyA9ICEhb3B0cy53aXRoQ3JlZGVudGlhbHNcblxuXHRcdGlmIChzZWxmLl9tb2RlID09PSAndGV4dCcgJiYgJ292ZXJyaWRlTWltZVR5cGUnIGluIHhocilcblx0XHRcdHhoci5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3BsYWluOyBjaGFyc2V0PXgtdXNlci1kZWZpbmVkJylcblxuXHRcdE9iamVjdC5rZXlzKGhlYWRlcnNPYmopLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlcnNPYmpbbmFtZV0ubmFtZSwgaGVhZGVyc09ialtuYW1lXS52YWx1ZSlcblx0XHR9KVxuXG5cdFx0c2VsZi5fcmVzcG9uc2UgPSBudWxsXG5cdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHN3aXRjaCAoeGhyLnJlYWR5U3RhdGUpIHtcblx0XHRcdFx0Y2FzZSByU3RhdGVzLkxPQURJTkc6XG5cdFx0XHRcdGNhc2UgclN0YXRlcy5ET05FOlxuXHRcdFx0XHRcdHNlbGYuX29uWEhSUHJvZ3Jlc3MoKVxuXHRcdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIE5lY2Vzc2FyeSBmb3Igc3RyZWFtaW5nIGluIEZpcmVmb3gsIHNpbmNlIHhoci5yZXNwb25zZSBpcyBPTkxZIGRlZmluZWRcblx0XHQvLyBpbiBvbnByb2dyZXNzLCBub3QgaW4gb25yZWFkeXN0YXRlY2hhbmdlIHdpdGggeGhyLnJlYWR5U3RhdGUgPSAzXG5cdFx0aWYgKHNlbGYuX21vZGUgPT09ICdtb3otY2h1bmtlZC1hcnJheWJ1ZmZlcicpIHtcblx0XHRcdHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLl9vblhIUlByb2dyZXNzKClcblx0XHRcdH1cblx0XHR9XG5cblx0XHR4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmIChzZWxmLl9kZXN0cm95ZWQpXG5cdFx0XHRcdHJldHVyblxuXHRcdFx0c2VsZi5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignWEhSIGVycm9yJykpXG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHhoci5zZW5kKGJvZHkpXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2VsZi5lbWl0KCdlcnJvcicsIGVycilcblx0XHRcdH0pXG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdH1cbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgeGhyLnN0YXR1cyBpcyByZWFkYWJsZS4gRXZlbiB0aG91Z2ggdGhlIHNwZWMgc2F5cyBpdCBzaG91bGRcbiAqIGJlIGF2YWlsYWJsZSBpbiByZWFkeVN0YXRlIDMsIGFjY2Vzc2luZyBpdCB0aHJvd3MgYW4gZXhjZXB0aW9uIGluIElFOFxuICovXG5mdW5jdGlvbiBzdGF0dXNWYWxpZCAoeGhyKSB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuICh4aHIuc3RhdHVzICE9PSBudWxsKVxuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX29uWEhSUHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdGlmICghc3RhdHVzVmFsaWQoc2VsZi5feGhyKSB8fCBzZWxmLl9kZXN0cm95ZWQpXG5cdFx0cmV0dXJuXG5cblx0aWYgKCFzZWxmLl9yZXNwb25zZSlcblx0XHRzZWxmLl9jb25uZWN0KClcblxuXHRzZWxmLl9yZXNwb25zZS5fb25YSFJQcm9ncmVzcygpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl9jb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHRpZiAoc2VsZi5fZGVzdHJveWVkKVxuXHRcdHJldHVyblxuXG5cdHNlbGYuX3Jlc3BvbnNlID0gbmV3IEluY29taW5nTWVzc2FnZShzZWxmLl94aHIsIHNlbGYuX2ZldGNoUmVzcG9uc2UsIHNlbGYuX21vZGUpXG5cdHNlbGYuZW1pdCgncmVzcG9uc2UnLCBzZWxmLl9yZXNwb25zZSlcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24gKGNodW5rLCBlbmNvZGluZywgY2IpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0c2VsZi5fYm9keS5wdXNoKGNodW5rKVxuXHRjYigpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmFib3J0ID0gQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHNlbGYuX2Rlc3Ryb3llZCA9IHRydWVcblx0aWYgKHNlbGYuX3Jlc3BvbnNlKVxuXHRcdHNlbGYuX3Jlc3BvbnNlLl9kZXN0cm95ZWQgPSB0cnVlXG5cdGlmIChzZWxmLl94aHIpXG5cdFx0c2VsZi5feGhyLmFib3J0KClcblx0Ly8gQ3VycmVudGx5LCB0aGVyZSBpc24ndCBhIHdheSB0byB0cnVseSBhYm9ydCBhIGZldGNoLlxuXHQvLyBJZiB5b3UgbGlrZSBiaWtlc2hlZGRpbmcsIHNlZSBodHRwczovL2dpdGh1Yi5jb20vd2hhdHdnL2ZldGNoL2lzc3Vlcy8yN1xufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbiAoZGF0YSwgZW5jb2RpbmcsIGNiKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcblx0XHRjYiA9IGRhdGFcblx0XHRkYXRhID0gdW5kZWZpbmVkXG5cdH1cblxuXHRzdHJlYW0uV3JpdGFibGUucHJvdG90eXBlLmVuZC5jYWxsKHNlbGYsIGRhdGEsIGVuY29kaW5nLCBjYilcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZmx1c2hIZWFkZXJzID0gZnVuY3Rpb24gKCkge31cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7fVxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuc2V0Tm9EZWxheSA9IGZ1bmN0aW9uICgpIHt9XG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXRTb2NrZXRLZWVwQWxpdmUgPSBmdW5jdGlvbiAoKSB7fVxuXG4vLyBUYWtlbiBmcm9tIGh0dHA6Ly93d3cudzMub3JnL1RSL1hNTEh0dHBSZXF1ZXN0LyN0aGUtc2V0cmVxdWVzdGhlYWRlciUyOCUyOS1tZXRob2RcbnZhciB1bnNhZmVIZWFkZXJzID0gW1xuXHQnYWNjZXB0LWNoYXJzZXQnLFxuXHQnYWNjZXB0LWVuY29kaW5nJyxcblx0J2FjY2Vzcy1jb250cm9sLXJlcXVlc3QtaGVhZGVycycsXG5cdCdhY2Nlc3MtY29udHJvbC1yZXF1ZXN0LW1ldGhvZCcsXG5cdCdjb25uZWN0aW9uJyxcblx0J2NvbnRlbnQtbGVuZ3RoJyxcblx0J2Nvb2tpZScsXG5cdCdjb29raWUyJyxcblx0J2RhdGUnLFxuXHQnZG50Jyxcblx0J2V4cGVjdCcsXG5cdCdob3N0Jyxcblx0J2tlZXAtYWxpdmUnLFxuXHQnb3JpZ2luJyxcblx0J3JlZmVyZXInLFxuXHQndGUnLFxuXHQndHJhaWxlcicsXG5cdCd0cmFuc2Zlci1lbmNvZGluZycsXG5cdCd1cGdyYWRlJyxcblx0J3VzZXItYWdlbnQnLFxuXHQndmlhJ1xuXVxuIiwidmFyIGNhcGFiaWxpdHkgPSByZXF1aXJlKCcuL2NhcGFiaWxpdHknKVxudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxudmFyIHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbnZhciByU3RhdGVzID0gZXhwb3J0cy5yZWFkeVN0YXRlcyA9IHtcblx0VU5TRU5UOiAwLFxuXHRPUEVORUQ6IDEsXG5cdEhFQURFUlNfUkVDRUlWRUQ6IDIsXG5cdExPQURJTkc6IDMsXG5cdERPTkU6IDRcbn1cblxudmFyIEluY29taW5nTWVzc2FnZSA9IGV4cG9ydHMuSW5jb21pbmdNZXNzYWdlID0gZnVuY3Rpb24gKHhociwgcmVzcG9uc2UsIG1vZGUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHN0cmVhbS5SZWFkYWJsZS5jYWxsKHNlbGYpXG5cblx0c2VsZi5fbW9kZSA9IG1vZGVcblx0c2VsZi5oZWFkZXJzID0ge31cblx0c2VsZi5yYXdIZWFkZXJzID0gW11cblx0c2VsZi50cmFpbGVycyA9IHt9XG5cdHNlbGYucmF3VHJhaWxlcnMgPSBbXVxuXG5cdC8vIEZha2UgdGhlICdjbG9zZScgZXZlbnQsIGJ1dCBvbmx5IG9uY2UgJ2VuZCcgZmlyZXNcblx0c2VsZi5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdC8vIFRoZSBuZXh0VGljayBpcyBuZWNlc3NhcnkgdG8gcHJldmVudCB0aGUgJ3JlcXVlc3QnIG1vZHVsZSBmcm9tIGNhdXNpbmcgYW4gaW5maW5pdGUgbG9vcFxuXHRcdHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuXHRcdFx0c2VsZi5lbWl0KCdjbG9zZScpXG5cdFx0fSlcblx0fSlcblxuXHRpZiAobW9kZSA9PT0gJ2ZldGNoJykge1xuXHRcdHNlbGYuX2ZldGNoUmVzcG9uc2UgPSByZXNwb25zZVxuXG5cdFx0c2VsZi5zdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzXG5cdFx0c2VsZi5zdGF0dXNNZXNzYWdlID0gcmVzcG9uc2Uuc3RhdHVzVGV4dFxuXHRcdC8vIGJhY2t3YXJkcyBjb21wYXRpYmxlIHZlcnNpb24gb2YgZm9yICg8aXRlbT4gb2YgPGl0ZXJhYmxlPik6XG5cdFx0Ly8gZm9yICh2YXIgPGl0ZW0+LF9pLF9pdCA9IDxpdGVyYWJsZT5bU3ltYm9sLml0ZXJhdG9yXSgpOyA8aXRlbT4gPSAoX2kgPSBfaXQubmV4dCgpKS52YWx1ZSwhX2kuZG9uZTspXG5cdFx0Zm9yICh2YXIgaGVhZGVyLCBfaSwgX2l0ID0gcmVzcG9uc2UuaGVhZGVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IGhlYWRlciA9IChfaSA9IF9pdC5uZXh0KCkpLnZhbHVlLCAhX2kuZG9uZTspIHtcblx0XHRcdHNlbGYuaGVhZGVyc1toZWFkZXJbMF0udG9Mb3dlckNhc2UoKV0gPSBoZWFkZXJbMV1cblx0XHRcdHNlbGYucmF3SGVhZGVycy5wdXNoKGhlYWRlclswXSwgaGVhZGVyWzFdKVxuXHRcdH1cblxuXHRcdC8vIFRPRE86IHRoaXMgZG9lc24ndCByZXNwZWN0IGJhY2twcmVzc3VyZS4gT25jZSBXcml0YWJsZVN0cmVhbSBpcyBhdmFpbGFibGUsIHRoaXMgY2FuIGJlIGZpeGVkXG5cdFx0dmFyIHJlYWRlciA9IHJlc3BvbnNlLmJvZHkuZ2V0UmVhZGVyKClcblx0XHRmdW5jdGlvbiByZWFkICgpIHtcblx0XHRcdHJlYWRlci5yZWFkKCkudGhlbihmdW5jdGlvbiAocmVzdWx0KSB7XG5cdFx0XHRcdGlmIChzZWxmLl9kZXN0cm95ZWQpXG5cdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdGlmIChyZXN1bHQuZG9uZSkge1xuXHRcdFx0XHRcdHNlbGYucHVzaChudWxsKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKHJlc3VsdC52YWx1ZSkpXG5cdFx0XHRcdHJlYWQoKVxuXHRcdFx0fSlcblx0XHR9XG5cdFx0cmVhZCgpXG5cblx0fSBlbHNlIHtcblx0XHRzZWxmLl94aHIgPSB4aHJcblx0XHRzZWxmLl9wb3MgPSAwXG5cblx0XHRzZWxmLnN0YXR1c0NvZGUgPSB4aHIuc3RhdHVzXG5cdFx0c2VsZi5zdGF0dXNNZXNzYWdlID0geGhyLnN0YXR1c1RleHRcblx0XHR2YXIgaGVhZGVycyA9IHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKS5zcGxpdCgvXFxyP1xcbi8pXG5cdFx0aGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChoZWFkZXIpIHtcblx0XHRcdHZhciBtYXRjaGVzID0gaGVhZGVyLm1hdGNoKC9eKFteOl0rKTpcXHMqKC4qKS8pXG5cdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHR2YXIga2V5ID0gbWF0Y2hlc1sxXS50b0xvd2VyQ2FzZSgpXG5cdFx0XHRcdGlmIChzZWxmLmhlYWRlcnNba2V5XSAhPT0gdW5kZWZpbmVkKVxuXHRcdFx0XHRcdHNlbGYuaGVhZGVyc1trZXldICs9ICcsICcgKyBtYXRjaGVzWzJdXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRzZWxmLmhlYWRlcnNba2V5XSA9IG1hdGNoZXNbMl1cblx0XHRcdFx0c2VsZi5yYXdIZWFkZXJzLnB1c2gobWF0Y2hlc1sxXSwgbWF0Y2hlc1syXSlcblx0XHRcdH1cblx0XHR9KVxuXG5cdFx0c2VsZi5fY2hhcnNldCA9ICd4LXVzZXItZGVmaW5lZCdcblx0XHRpZiAoIWNhcGFiaWxpdHkub3ZlcnJpZGVNaW1lVHlwZSkge1xuXHRcdFx0dmFyIG1pbWVUeXBlID0gc2VsZi5yYXdIZWFkZXJzWydtaW1lLXR5cGUnXVxuXHRcdFx0aWYgKG1pbWVUeXBlKSB7XG5cdFx0XHRcdHZhciBjaGFyc2V0TWF0Y2ggPSBtaW1lVHlwZS5tYXRjaCgvO1xccypjaGFyc2V0PShbXjtdKSg7fCQpLylcblx0XHRcdFx0aWYgKGNoYXJzZXRNYXRjaCkge1xuXHRcdFx0XHRcdHNlbGYuX2NoYXJzZXQgPSBjaGFyc2V0TWF0Y2hbMV0udG9Mb3dlckNhc2UoKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXNlbGYuX2NoYXJzZXQpXG5cdFx0XHRcdHNlbGYuX2NoYXJzZXQgPSAndXRmLTgnIC8vIGJlc3QgZ3Vlc3Ncblx0XHR9XG5cdH1cbn1cblxuaW5oZXJpdHMoSW5jb21pbmdNZXNzYWdlLCBzdHJlYW0uUmVhZGFibGUpXG5cbkluY29taW5nTWVzc2FnZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbiAoKSB7fVxuXG5JbmNvbWluZ01lc3NhZ2UucHJvdG90eXBlLl9vblhIUlByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHR2YXIgeGhyID0gc2VsZi5feGhyXG5cblx0dmFyIHJlc3BvbnNlID0gbnVsbFxuXHRzd2l0Y2ggKHNlbGYuX21vZGUpIHtcblx0XHRjYXNlICd0ZXh0OnZiYXJyYXknOiAvLyBGb3IgSUU5XG5cdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgIT09IHJTdGF0ZXMuRE9ORSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIFRoaXMgZmFpbHMgaW4gSUU4XG5cdFx0XHRcdHJlc3BvbnNlID0gbmV3IGdsb2JhbC5WQkFycmF5KHhoci5yZXNwb25zZUJvZHkpLnRvQXJyYXkoKVxuXHRcdFx0fSBjYXRjaCAoZSkge31cblx0XHRcdGlmIChyZXNwb25zZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihyZXNwb25zZSkpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHQvLyBGYWxscyB0aHJvdWdoIGluIElFOFx0XG5cdFx0Y2FzZSAndGV4dCc6XG5cdFx0XHR0cnkgeyAvLyBUaGlzIHdpbGwgZmFpbCB3aGVuIHJlYWR5U3RhdGUgPSAzIGluIElFOS4gU3dpdGNoIG1vZGUgYW5kIHdhaXQgZm9yIHJlYWR5U3RhdGUgPSA0XG5cdFx0XHRcdHJlc3BvbnNlID0geGhyLnJlc3BvbnNlVGV4dFxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRzZWxmLl9tb2RlID0gJ3RleHQ6dmJhcnJheSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGlmIChyZXNwb25zZS5sZW5ndGggPiBzZWxmLl9wb3MpIHtcblx0XHRcdFx0dmFyIG5ld0RhdGEgPSByZXNwb25zZS5zdWJzdHIoc2VsZi5fcG9zKVxuXHRcdFx0XHRpZiAoc2VsZi5fY2hhcnNldCA9PT0gJ3gtdXNlci1kZWZpbmVkJykge1xuXHRcdFx0XHRcdHZhciBidWZmZXIgPSBuZXcgQnVmZmVyKG5ld0RhdGEubGVuZ3RoKVxuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbmV3RGF0YS5sZW5ndGg7IGkrKylcblx0XHRcdFx0XHRcdGJ1ZmZlcltpXSA9IG5ld0RhdGEuY2hhckNvZGVBdChpKSAmIDB4ZmZcblxuXHRcdFx0XHRcdHNlbGYucHVzaChidWZmZXIpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2VsZi5wdXNoKG5ld0RhdGEsIHNlbGYuX2NoYXJzZXQpXG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fcG9zID0gcmVzcG9uc2UubGVuZ3RoXG5cdFx0XHR9XG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ2FycmF5YnVmZmVyJzpcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5ET05FKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2Vcblx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSkpXG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ21vei1jaHVua2VkLWFycmF5YnVmZmVyJzogLy8gdGFrZSB3aG9sZVxuXHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2Vcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5MT0FESU5HIHx8ICFyZXNwb25zZSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSkpXG5cdFx0XHRicmVha1xuXHRcdGNhc2UgJ21zLXN0cmVhbSc6XG5cdFx0XHRyZXNwb25zZSA9IHhoci5yZXNwb25zZVxuXHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlICE9PSByU3RhdGVzLkxPQURJTkcpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR2YXIgcmVhZGVyID0gbmV3IGdsb2JhbC5NU1N0cmVhbVJlYWRlcigpXG5cdFx0XHRyZWFkZXIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKHJlYWRlci5yZXN1bHQuYnl0ZUxlbmd0aCA+IHNlbGYuX3Bvcykge1xuXHRcdFx0XHRcdHNlbGYucHVzaChuZXcgQnVmZmVyKG5ldyBVaW50OEFycmF5KHJlYWRlci5yZXN1bHQuc2xpY2Uoc2VsZi5fcG9zKSkpKVxuXHRcdFx0XHRcdHNlbGYuX3BvcyA9IHJlYWRlci5yZXN1bHQuYnl0ZUxlbmd0aFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZWFkZXIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZWxmLnB1c2gobnVsbClcblx0XHRcdH1cblx0XHRcdC8vIHJlYWRlci5vbmVycm9yID0gPz8/IC8vIFRPRE86IHRoaXNcblx0XHRcdHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihyZXNwb25zZSlcblx0XHRcdGJyZWFrXG5cdH1cblxuXHQvLyBUaGUgbXMtc3RyZWFtIGNhc2UgaGFuZGxlcyBlbmQgc2VwYXJhdGVseSBpbiByZWFkZXIub25sb2FkKClcblx0aWYgKHNlbGYuX3hoci5yZWFkeVN0YXRlID09PSByU3RhdGVzLkRPTkUgJiYgc2VsZi5fbW9kZSAhPT0gJ21zLXN0cmVhbScpIHtcblx0XHRzZWxmLnB1c2gobnVsbClcblx0fVxufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnZhciBpc0J1ZmZlckVuY29kaW5nID0gQnVmZmVyLmlzRW5jb2RpbmdcbiAgfHwgZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgICAgICBzd2l0Y2ggKGVuY29kaW5nICYmIGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgIGNhc2UgJ2hleCc6IGNhc2UgJ3V0ZjgnOiBjYXNlICd1dGYtOCc6IGNhc2UgJ2FzY2lpJzogY2FzZSAnYmluYXJ5JzogY2FzZSAnYmFzZTY0JzogY2FzZSAndWNzMic6IGNhc2UgJ3Vjcy0yJzogY2FzZSAndXRmMTZsZSc6IGNhc2UgJ3V0Zi0xNmxlJzogY2FzZSAncmF3JzogcmV0dXJuIHRydWU7XG4gICAgICAgICBkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG4gICAgICAgfVxuICAgICB9XG5cblxuZnVuY3Rpb24gYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgaWYgKGVuY29kaW5nICYmICFpc0J1ZmZlckVuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgfVxufVxuXG4vLyBTdHJpbmdEZWNvZGVyIHByb3ZpZGVzIGFuIGludGVyZmFjZSBmb3IgZWZmaWNpZW50bHkgc3BsaXR0aW5nIGEgc2VyaWVzIG9mXG4vLyBidWZmZXJzIGludG8gYSBzZXJpZXMgb2YgSlMgc3RyaW5ncyB3aXRob3V0IGJyZWFraW5nIGFwYXJ0IG11bHRpLWJ5dGVcbi8vIGNoYXJhY3RlcnMuIENFU1UtOCBpcyBoYW5kbGVkIGFzIHBhcnQgb2YgdGhlIFVURi04IGVuY29kaW5nLlxuLy9cbi8vIEBUT0RPIEhhbmRsaW5nIGFsbCBlbmNvZGluZ3MgaW5zaWRlIGEgc2luZ2xlIG9iamVjdCBtYWtlcyBpdCB2ZXJ5IGRpZmZpY3VsdFxuLy8gdG8gcmVhc29uIGFib3V0IHRoaXMgY29kZSwgc28gaXQgc2hvdWxkIGJlIHNwbGl0IHVwIGluIHRoZSBmdXR1cmUuXG4vLyBAVE9ETyBUaGVyZSBzaG91bGQgYmUgYSB1dGY4LXN0cmljdCBlbmNvZGluZyB0aGF0IHJlamVjdHMgaW52YWxpZCBVVEYtOCBjb2RlXG4vLyBwb2ludHMgYXMgdXNlZCBieSBDRVNVLTguXG52YXIgU3RyaW5nRGVjb2RlciA9IGV4cG9ydHMuU3RyaW5nRGVjb2RlciA9IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gIHRoaXMuZW5jb2RpbmcgPSAoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1stX10vLCAnJyk7XG4gIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKTtcbiAgc3dpdGNoICh0aGlzLmVuY29kaW5nKSB7XG4gICAgY2FzZSAndXRmOCc6XG4gICAgICAvLyBDRVNVLTggcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDMtYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIC8vIFVURi0xNiByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMi1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMjtcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIC8vIEJhc2UtNjQgc3RvcmVzIDMgYnl0ZXMgaW4gNCBjaGFycywgYW5kIHBhZHMgdGhlIHJlbWFpbmRlci5cbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy53cml0ZSA9IHBhc3NUaHJvdWdoV3JpdGU7XG4gICAgICByZXR1cm47XG4gIH1cblxuICAvLyBFbm91Z2ggc3BhY2UgdG8gc3RvcmUgYWxsIGJ5dGVzIG9mIGEgc2luZ2xlIGNoYXJhY3Rlci4gVVRGLTggbmVlZHMgNFxuICAvLyBieXRlcywgYnV0IENFU1UtOCBtYXkgcmVxdWlyZSB1cCB0byA2ICgzIGJ5dGVzIHBlciBzdXJyb2dhdGUpLlxuICB0aGlzLmNoYXJCdWZmZXIgPSBuZXcgQnVmZmVyKDYpO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgcmVjZWl2ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhclJlY2VpdmVkID0gMDtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIGV4cGVjdGVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJMZW5ndGggPSAwO1xufTtcblxuXG4vLyB3cml0ZSBkZWNvZGVzIHRoZSBnaXZlbiBidWZmZXIgYW5kIHJldHVybnMgaXQgYXMgSlMgc3RyaW5nIHRoYXQgaXNcbi8vIGd1YXJhbnRlZWQgdG8gbm90IGNvbnRhaW4gYW55IHBhcnRpYWwgbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLiBBbnkgcGFydGlhbFxuLy8gY2hhcmFjdGVyIGZvdW5kIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciBpcyBidWZmZXJlZCB1cCwgYW5kIHdpbGwgYmVcbi8vIHJldHVybmVkIHdoZW4gY2FsbGluZyB3cml0ZSBhZ2FpbiB3aXRoIHRoZSByZW1haW5pbmcgYnl0ZXMuXG4vL1xuLy8gTm90ZTogQ29udmVydGluZyBhIEJ1ZmZlciBjb250YWluaW5nIGFuIG9ycGhhbiBzdXJyb2dhdGUgdG8gYSBTdHJpbmdcbi8vIGN1cnJlbnRseSB3b3JrcywgYnV0IGNvbnZlcnRpbmcgYSBTdHJpbmcgdG8gYSBCdWZmZXIgKHZpYSBgbmV3IEJ1ZmZlcmAsIG9yXG4vLyBCdWZmZXIjd3JpdGUpIHdpbGwgcmVwbGFjZSBpbmNvbXBsZXRlIHN1cnJvZ2F0ZXMgd2l0aCB0aGUgdW5pY29kZVxuLy8gcmVwbGFjZW1lbnQgY2hhcmFjdGVyLiBTZWUgaHR0cHM6Ly9jb2RlcmV2aWV3LmNocm9taXVtLm9yZy8xMjExNzMwMDkvIC5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciBjaGFyU3RyID0gJyc7XG4gIC8vIGlmIG91ciBsYXN0IHdyaXRlIGVuZGVkIHdpdGggYW4gaW5jb21wbGV0ZSBtdWx0aWJ5dGUgY2hhcmFjdGVyXG4gIHdoaWxlICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcmVtYWluaW5nIGJ5dGVzIHRoaXMgYnVmZmVyIGhhcyB0byBvZmZlciBmb3IgdGhpcyBjaGFyXG4gICAgdmFyIGF2YWlsYWJsZSA9IChidWZmZXIubGVuZ3RoID49IHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkKSA/XG4gICAgICAgIHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkIDpcbiAgICAgICAgYnVmZmVyLmxlbmd0aDtcblxuICAgIC8vIGFkZCB0aGUgbmV3IGJ5dGVzIHRvIHRoZSBjaGFyIGJ1ZmZlclxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgdGhpcy5jaGFyUmVjZWl2ZWQsIDAsIGF2YWlsYWJsZSk7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gYXZhaWxhYmxlO1xuXG4gICAgaWYgKHRoaXMuY2hhclJlY2VpdmVkIDwgdGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgICAvLyBzdGlsbCBub3QgZW5vdWdoIGNoYXJzIGluIHRoaXMgYnVmZmVyPyB3YWl0IGZvciBtb3JlIC4uLlxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8vIHJlbW92ZSBieXRlcyBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgY2hhcmFjdGVyIGZyb20gdGhlIGJ1ZmZlclxuICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShhdmFpbGFibGUsIGJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgLy8gZ2V0IHRoZSBjaGFyYWN0ZXIgdGhhdCB3YXMgc3BsaXRcbiAgICBjaGFyU3RyID0gdGhpcy5jaGFyQnVmZmVyLnNsaWNlKDAsIHRoaXMuY2hhckxlbmd0aCkudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG5cbiAgICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gICAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGNoYXJTdHIubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCArPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgICBjaGFyU3RyID0gJyc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgPSB0aGlzLmNoYXJMZW5ndGggPSAwO1xuXG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIG1vcmUgYnl0ZXMgaW4gdGhpcyBidWZmZXIsIGp1c3QgZW1pdCBvdXIgY2hhclxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY2hhclN0cjtcbiAgICB9XG4gICAgYnJlYWs7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgYW5kIHNldCBjaGFyTGVuZ3RoIC8gY2hhclJlY2VpdmVkXG4gIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKTtcblxuICB2YXIgZW5kID0gYnVmZmVyLmxlbmd0aDtcbiAgaWYgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGJ1ZmZlciB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXIgYnl0ZXMgd2UgZ290XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCBidWZmZXIubGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQsIGVuZCk7XG4gICAgZW5kIC09IHRoaXMuY2hhclJlY2VpdmVkO1xuICB9XG5cbiAgY2hhclN0ciArPSBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgZW5kKTtcblxuICB2YXIgZW5kID0gY2hhclN0ci5sZW5ndGggLSAxO1xuICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoZW5kKTtcbiAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgIHZhciBzaXplID0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgIHRoaXMuY2hhckxlbmd0aCArPSBzaXplO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IHNpemU7XG4gICAgdGhpcy5jaGFyQnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCBzaXplLCAwLCBzaXplKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIDAsIHNpemUpO1xuICAgIHJldHVybiBjaGFyU3RyLnN1YnN0cmluZygwLCBlbmQpO1xuICB9XG5cbiAgLy8gb3IganVzdCBlbWl0IHRoZSBjaGFyU3RyXG4gIHJldHVybiBjaGFyU3RyO1xufTtcblxuLy8gZGV0ZWN0SW5jb21wbGV0ZUNoYXIgZGV0ZXJtaW5lcyBpZiB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIFVURi04IGNoYXJhY3RlciBhdFxuLy8gdGhlIGVuZCBvZiB0aGUgZ2l2ZW4gYnVmZmVyLiBJZiBzbywgaXQgc2V0cyB0aGlzLmNoYXJMZW5ndGggdG8gdGhlIGJ5dGVcbi8vIGxlbmd0aCB0aGF0IGNoYXJhY3RlciwgYW5kIHNldHMgdGhpcy5jaGFyUmVjZWl2ZWQgdG8gdGhlIG51bWJlciBvZiBieXRlc1xuLy8gdGhhdCBhcmUgYXZhaWxhYmxlIGZvciB0aGlzIGNoYXJhY3Rlci5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmRldGVjdEluY29tcGxldGVDaGFyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIGRldGVybWluZSBob3cgbWFueSBieXRlcyB3ZSBoYXZlIHRvIGNoZWNrIGF0IHRoZSBlbmQgb2YgdGhpcyBidWZmZXJcbiAgdmFyIGkgPSAoYnVmZmVyLmxlbmd0aCA+PSAzKSA/IDMgOiBidWZmZXIubGVuZ3RoO1xuXG4gIC8vIEZpZ3VyZSBvdXQgaWYgb25lIG9mIHRoZSBsYXN0IGkgYnl0ZXMgb2Ygb3VyIGJ1ZmZlciBhbm5vdW5jZXMgYW5cbiAgLy8gaW5jb21wbGV0ZSBjaGFyLlxuICBmb3IgKDsgaSA+IDA7IGktLSkge1xuICAgIHZhciBjID0gYnVmZmVyW2J1ZmZlci5sZW5ndGggLSBpXTtcblxuICAgIC8vIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1VURi04I0Rlc2NyaXB0aW9uXG5cbiAgICAvLyAxMTBYWFhYWFxuICAgIGlmIChpID09IDEgJiYgYyA+PiA1ID09IDB4MDYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDI7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTEwWFhYWFxuICAgIGlmIChpIDw9IDIgJiYgYyA+PiA0ID09IDB4MEUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTExMFhYWFxuICAgIGlmIChpIDw9IDMgJiYgYyA+PiAzID09IDB4MUUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBpO1xufTtcblxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciByZXMgPSAnJztcbiAgaWYgKGJ1ZmZlciAmJiBidWZmZXIubGVuZ3RoKVxuICAgIHJlcyA9IHRoaXMud3JpdGUoYnVmZmVyKTtcblxuICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQpIHtcbiAgICB2YXIgY3IgPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgICB2YXIgYnVmID0gdGhpcy5jaGFyQnVmZmVyO1xuICAgIHZhciBlbmMgPSB0aGlzLmVuY29kaW5nO1xuICAgIHJlcyArPSBidWYuc2xpY2UoMCwgY3IpLnRvU3RyaW5nKGVuYyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gcGFzc1Rocm91Z2hXcml0ZShidWZmZXIpIHtcbiAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcbn1cblxuZnVuY3Rpb24gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMjtcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAyIDogMDtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDM7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMyA6IDA7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHVueWNvZGUgPSByZXF1aXJlKCdwdW55Y29kZScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZXhwb3J0cy5wYXJzZSA9IHVybFBhcnNlO1xuZXhwb3J0cy5yZXNvbHZlID0gdXJsUmVzb2x2ZTtcbmV4cG9ydHMucmVzb2x2ZU9iamVjdCA9IHVybFJlc29sdmVPYmplY3Q7XG5leHBvcnRzLmZvcm1hdCA9IHVybEZvcm1hdDtcblxuZXhwb3J0cy5VcmwgPSBVcmw7XG5cbmZ1bmN0aW9uIFVybCgpIHtcbiAgdGhpcy5wcm90b2NvbCA9IG51bGw7XG4gIHRoaXMuc2xhc2hlcyA9IG51bGw7XG4gIHRoaXMuYXV0aCA9IG51bGw7XG4gIHRoaXMuaG9zdCA9IG51bGw7XG4gIHRoaXMucG9ydCA9IG51bGw7XG4gIHRoaXMuaG9zdG5hbWUgPSBudWxsO1xuICB0aGlzLmhhc2ggPSBudWxsO1xuICB0aGlzLnNlYXJjaCA9IG51bGw7XG4gIHRoaXMucXVlcnkgPSBudWxsO1xuICB0aGlzLnBhdGhuYW1lID0gbnVsbDtcbiAgdGhpcy5wYXRoID0gbnVsbDtcbiAgdGhpcy5ocmVmID0gbnVsbDtcbn1cblxuLy8gUmVmZXJlbmNlOiBSRkMgMzk4NiwgUkZDIDE4MDgsIFJGQyAyMzk2XG5cbi8vIGRlZmluZSB0aGVzZSBoZXJlIHNvIGF0IGxlYXN0IHRoZXkgb25seSBoYXZlIHRvIGJlXG4vLyBjb21waWxlZCBvbmNlIG9uIHRoZSBmaXJzdCBtb2R1bGUgbG9hZC5cbnZhciBwcm90b2NvbFBhdHRlcm4gPSAvXihbYS16MC05ListXSs6KS9pLFxuICAgIHBvcnRQYXR0ZXJuID0gLzpbMC05XSokLyxcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgYSBzaW1wbGUgcGF0aCBVUkxcbiAgICBzaW1wbGVQYXRoUGF0dGVybiA9IC9eKFxcL1xcLz8oPyFcXC8pW15cXD9cXHNdKikoXFw/W15cXHNdKik/JC8sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyByZXNlcnZlZCBmb3IgZGVsaW1pdGluZyBVUkxzLlxuICAgIC8vIFdlIGFjdHVhbGx5IGp1c3QgYXV0by1lc2NhcGUgdGhlc2UuXG4gICAgZGVsaW1zID0gWyc8JywgJz4nLCAnXCInLCAnYCcsICcgJywgJ1xccicsICdcXG4nLCAnXFx0J10sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyBub3QgYWxsb3dlZCBmb3IgdmFyaW91cyByZWFzb25zLlxuICAgIHVud2lzZSA9IFsneycsICd9JywgJ3wnLCAnXFxcXCcsICdeJywgJ2AnXS5jb25jYXQoZGVsaW1zKSxcblxuICAgIC8vIEFsbG93ZWQgYnkgUkZDcywgYnV0IGNhdXNlIG9mIFhTUyBhdHRhY2tzLiAgQWx3YXlzIGVzY2FwZSB0aGVzZS5cbiAgICBhdXRvRXNjYXBlID0gWydcXCcnXS5jb25jYXQodW53aXNlKSxcbiAgICAvLyBDaGFyYWN0ZXJzIHRoYXQgYXJlIG5ldmVyIGV2ZXIgYWxsb3dlZCBpbiBhIGhvc3RuYW1lLlxuICAgIC8vIE5vdGUgdGhhdCBhbnkgaW52YWxpZCBjaGFycyBhcmUgYWxzbyBoYW5kbGVkLCBidXQgdGhlc2VcbiAgICAvLyBhcmUgdGhlIG9uZXMgdGhhdCBhcmUgKmV4cGVjdGVkKiB0byBiZSBzZWVuLCBzbyB3ZSBmYXN0LXBhdGhcbiAgICAvLyB0aGVtLlxuICAgIG5vbkhvc3RDaGFycyA9IFsnJScsICcvJywgJz8nLCAnOycsICcjJ10uY29uY2F0KGF1dG9Fc2NhcGUpLFxuICAgIGhvc3RFbmRpbmdDaGFycyA9IFsnLycsICc/JywgJyMnXSxcbiAgICBob3N0bmFtZU1heExlbiA9IDI1NSxcbiAgICBob3N0bmFtZVBhcnRQYXR0ZXJuID0gL15bK2EtejAtOUEtWl8tXXswLDYzfSQvLFxuICAgIGhvc3RuYW1lUGFydFN0YXJ0ID0gL14oWythLXowLTlBLVpfLV17MCw2M30pKC4qKSQvLFxuICAgIC8vIHByb3RvY29scyB0aGF0IGNhbiBhbGxvdyBcInVuc2FmZVwiIGFuZCBcInVud2lzZVwiIGNoYXJzLlxuICAgIHVuc2FmZVByb3RvY29sID0ge1xuICAgICAgJ2phdmFzY3JpcHQnOiB0cnVlLFxuICAgICAgJ2phdmFzY3JpcHQ6JzogdHJ1ZVxuICAgIH0sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgbmV2ZXIgaGF2ZSBhIGhvc3RuYW1lLlxuICAgIGhvc3RsZXNzUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBhbHdheXMgY29udGFpbiBhIC8vIGJpdC5cbiAgICBzbGFzaGVkUHJvdG9jb2wgPSB7XG4gICAgICAnaHR0cCc6IHRydWUsXG4gICAgICAnaHR0cHMnOiB0cnVlLFxuICAgICAgJ2Z0cCc6IHRydWUsXG4gICAgICAnZ29waGVyJzogdHJ1ZSxcbiAgICAgICdmaWxlJzogdHJ1ZSxcbiAgICAgICdodHRwOic6IHRydWUsXG4gICAgICAnaHR0cHM6JzogdHJ1ZSxcbiAgICAgICdmdHA6JzogdHJ1ZSxcbiAgICAgICdnb3BoZXI6JzogdHJ1ZSxcbiAgICAgICdmaWxlOic6IHRydWVcbiAgICB9LFxuICAgIHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcblxuZnVuY3Rpb24gdXJsUGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCkge1xuICBpZiAodXJsICYmIHV0aWwuaXNPYmplY3QodXJsKSAmJiB1cmwgaW5zdGFuY2VvZiBVcmwpIHJldHVybiB1cmw7XG5cbiAgdmFyIHUgPSBuZXcgVXJsO1xuICB1LnBhcnNlKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpO1xuICByZXR1cm4gdTtcbn1cblxuVXJsLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpIHtcbiAgaWYgKCF1dGlsLmlzU3RyaW5nKHVybCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUGFyYW1ldGVyICd1cmwnIG11c3QgYmUgYSBzdHJpbmcsIG5vdCBcIiArIHR5cGVvZiB1cmwpO1xuICB9XG5cbiAgLy8gQ29weSBjaHJvbWUsIElFLCBvcGVyYSBiYWNrc2xhc2gtaGFuZGxpbmcgYmVoYXZpb3IuXG4gIC8vIEJhY2sgc2xhc2hlcyBiZWZvcmUgdGhlIHF1ZXJ5IHN0cmluZyBnZXQgY29udmVydGVkIHRvIGZvcndhcmQgc2xhc2hlc1xuICAvLyBTZWU6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNTkxNlxuICB2YXIgcXVlcnlJbmRleCA9IHVybC5pbmRleE9mKCc/JyksXG4gICAgICBzcGxpdHRlciA9XG4gICAgICAgICAgKHF1ZXJ5SW5kZXggIT09IC0xICYmIHF1ZXJ5SW5kZXggPCB1cmwuaW5kZXhPZignIycpKSA/ICc/JyA6ICcjJyxcbiAgICAgIHVTcGxpdCA9IHVybC5zcGxpdChzcGxpdHRlciksXG4gICAgICBzbGFzaFJlZ2V4ID0gL1xcXFwvZztcbiAgdVNwbGl0WzBdID0gdVNwbGl0WzBdLnJlcGxhY2Uoc2xhc2hSZWdleCwgJy8nKTtcbiAgdXJsID0gdVNwbGl0LmpvaW4oc3BsaXR0ZXIpO1xuXG4gIHZhciByZXN0ID0gdXJsO1xuXG4gIC8vIHRyaW0gYmVmb3JlIHByb2NlZWRpbmcuXG4gIC8vIFRoaXMgaXMgdG8gc3VwcG9ydCBwYXJzZSBzdHVmZiBsaWtlIFwiICBodHRwOi8vZm9vLmNvbSAgXFxuXCJcbiAgcmVzdCA9IHJlc3QudHJpbSgpO1xuXG4gIGlmICghc2xhc2hlc0Rlbm90ZUhvc3QgJiYgdXJsLnNwbGl0KCcjJykubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gVHJ5IGZhc3QgcGF0aCByZWdleHBcbiAgICB2YXIgc2ltcGxlUGF0aCA9IHNpbXBsZVBhdGhQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gICAgaWYgKHNpbXBsZVBhdGgpIHtcbiAgICAgIHRoaXMucGF0aCA9IHJlc3Q7XG4gICAgICB0aGlzLmhyZWYgPSByZXN0O1xuICAgICAgdGhpcy5wYXRobmFtZSA9IHNpbXBsZVBhdGhbMV07XG4gICAgICBpZiAoc2ltcGxlUGF0aFsyXSkge1xuICAgICAgICB0aGlzLnNlYXJjaCA9IHNpbXBsZVBhdGhbMl07XG4gICAgICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMuc2VhcmNoLnN1YnN0cigxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRoaXMuc2VhcmNoLnN1YnN0cigxKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gJyc7XG4gICAgICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcm90byA9IHByb3RvY29sUGF0dGVybi5leGVjKHJlc3QpO1xuICBpZiAocHJvdG8pIHtcbiAgICBwcm90byA9IHByb3RvWzBdO1xuICAgIHZhciBsb3dlclByb3RvID0gcHJvdG8udG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLnByb3RvY29sID0gbG93ZXJQcm90bztcbiAgICByZXN0ID0gcmVzdC5zdWJzdHIocHJvdG8ubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIGZpZ3VyZSBvdXQgaWYgaXQncyBnb3QgYSBob3N0XG4gIC8vIHVzZXJAc2VydmVyIGlzICphbHdheXMqIGludGVycHJldGVkIGFzIGEgaG9zdG5hbWUsIGFuZCB1cmxcbiAgLy8gcmVzb2x1dGlvbiB3aWxsIHRyZWF0IC8vZm9vL2JhciBhcyBob3N0PWZvbyxwYXRoPWJhciBiZWNhdXNlIHRoYXQnc1xuICAvLyBob3cgdGhlIGJyb3dzZXIgcmVzb2x2ZXMgcmVsYXRpdmUgVVJMcy5cbiAgaWYgKHNsYXNoZXNEZW5vdGVIb3N0IHx8IHByb3RvIHx8IHJlc3QubWF0Y2goL15cXC9cXC9bXkBcXC9dK0BbXkBcXC9dKy8pKSB7XG4gICAgdmFyIHNsYXNoZXMgPSByZXN0LnN1YnN0cigwLCAyKSA9PT0gJy8vJztcbiAgICBpZiAoc2xhc2hlcyAmJiAhKHByb3RvICYmIGhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dKSkge1xuICAgICAgcmVzdCA9IHJlc3Quc3Vic3RyKDIpO1xuICAgICAgdGhpcy5zbGFzaGVzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dICYmXG4gICAgICAoc2xhc2hlcyB8fCAocHJvdG8gJiYgIXNsYXNoZWRQcm90b2NvbFtwcm90b10pKSkge1xuXG4gICAgLy8gdGhlcmUncyBhIGhvc3RuYW1lLlxuICAgIC8vIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiAvLCA/LCA7LCBvciAjIGVuZHMgdGhlIGhvc3QuXG4gICAgLy9cbiAgICAvLyBJZiB0aGVyZSBpcyBhbiBAIGluIHRoZSBob3N0bmFtZSwgdGhlbiBub24taG9zdCBjaGFycyAqYXJlKiBhbGxvd2VkXG4gICAgLy8gdG8gdGhlIGxlZnQgb2YgdGhlIGxhc3QgQCBzaWduLCB1bmxlc3Mgc29tZSBob3N0LWVuZGluZyBjaGFyYWN0ZXJcbiAgICAvLyBjb21lcyAqYmVmb3JlKiB0aGUgQC1zaWduLlxuICAgIC8vIFVSTHMgYXJlIG9ibm94aW91cy5cbiAgICAvL1xuICAgIC8vIGV4OlxuICAgIC8vIGh0dHA6Ly9hQGJAYy8gPT4gdXNlcjphQGIgaG9zdDpjXG4gICAgLy8gaHR0cDovL2FAYj9AYyA9PiB1c2VyOmEgaG9zdDpjIHBhdGg6Lz9AY1xuXG4gICAgLy8gdjAuMTIgVE9ETyhpc2FhY3MpOiBUaGlzIGlzIG5vdCBxdWl0ZSBob3cgQ2hyb21lIGRvZXMgdGhpbmdzLlxuICAgIC8vIFJldmlldyBvdXIgdGVzdCBjYXNlIGFnYWluc3QgYnJvd3NlcnMgbW9yZSBjb21wcmVoZW5zaXZlbHkuXG5cbiAgICAvLyBmaW5kIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiBhbnkgaG9zdEVuZGluZ0NoYXJzXG4gICAgdmFyIGhvc3RFbmQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhvc3RFbmRpbmdDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhlYyA9IHJlc3QuaW5kZXhPZihob3N0RW5kaW5nQ2hhcnNbaV0pO1xuICAgICAgaWYgKGhlYyAhPT0gLTEgJiYgKGhvc3RFbmQgPT09IC0xIHx8IGhlYyA8IGhvc3RFbmQpKVxuICAgICAgICBob3N0RW5kID0gaGVjO1xuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGVpdGhlciB3ZSBoYXZlIGFuIGV4cGxpY2l0IHBvaW50IHdoZXJlIHRoZVxuICAgIC8vIGF1dGggcG9ydGlvbiBjYW5ub3QgZ28gcGFzdCwgb3IgdGhlIGxhc3QgQCBjaGFyIGlzIHRoZSBkZWNpZGVyLlxuICAgIHZhciBhdXRoLCBhdFNpZ247XG4gICAgaWYgKGhvc3RFbmQgPT09IC0xKSB7XG4gICAgICAvLyBhdFNpZ24gY2FuIGJlIGFueXdoZXJlLlxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhdFNpZ24gbXVzdCBiZSBpbiBhdXRoIHBvcnRpb24uXG4gICAgICAvLyBodHRwOi8vYUBiL2NAZCA9PiBob3N0OmIgYXV0aDphIHBhdGg6L2NAZFxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcsIGhvc3RFbmQpO1xuICAgIH1cblxuICAgIC8vIE5vdyB3ZSBoYXZlIGEgcG9ydGlvbiB3aGljaCBpcyBkZWZpbml0ZWx5IHRoZSBhdXRoLlxuICAgIC8vIFB1bGwgdGhhdCBvZmYuXG4gICAgaWYgKGF0U2lnbiAhPT0gLTEpIHtcbiAgICAgIGF1dGggPSByZXN0LnNsaWNlKDAsIGF0U2lnbik7XG4gICAgICByZXN0ID0gcmVzdC5zbGljZShhdFNpZ24gKyAxKTtcbiAgICAgIHRoaXMuYXV0aCA9IGRlY29kZVVSSUNvbXBvbmVudChhdXRoKTtcbiAgICB9XG5cbiAgICAvLyB0aGUgaG9zdCBpcyB0aGUgcmVtYWluaW5nIHRvIHRoZSBsZWZ0IG9mIHRoZSBmaXJzdCBub24taG9zdCBjaGFyXG4gICAgaG9zdEVuZCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9uSG9zdENoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaGVjID0gcmVzdC5pbmRleE9mKG5vbkhvc3RDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpXG4gICAgICAgIGhvc3RFbmQgPSBoZWM7XG4gICAgfVxuICAgIC8vIGlmIHdlIHN0aWxsIGhhdmUgbm90IGhpdCBpdCwgdGhlbiB0aGUgZW50aXJlIHRoaW5nIGlzIGEgaG9zdC5cbiAgICBpZiAoaG9zdEVuZCA9PT0gLTEpXG4gICAgICBob3N0RW5kID0gcmVzdC5sZW5ndGg7XG5cbiAgICB0aGlzLmhvc3QgPSByZXN0LnNsaWNlKDAsIGhvc3RFbmQpO1xuICAgIHJlc3QgPSByZXN0LnNsaWNlKGhvc3RFbmQpO1xuXG4gICAgLy8gcHVsbCBvdXQgcG9ydC5cbiAgICB0aGlzLnBhcnNlSG9zdCgpO1xuXG4gICAgLy8gd2UndmUgaW5kaWNhdGVkIHRoYXQgdGhlcmUgaXMgYSBob3N0bmFtZSxcbiAgICAvLyBzbyBldmVuIGlmIGl0J3MgZW1wdHksIGl0IGhhcyB0byBiZSBwcmVzZW50LlxuICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lIHx8ICcnO1xuXG4gICAgLy8gaWYgaG9zdG5hbWUgYmVnaW5zIHdpdGggWyBhbmQgZW5kcyB3aXRoIF1cbiAgICAvLyBhc3N1bWUgdGhhdCBpdCdzIGFuIElQdjYgYWRkcmVzcy5cbiAgICB2YXIgaXB2Nkhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZVswXSA9PT0gJ1snICYmXG4gICAgICAgIHRoaXMuaG9zdG5hbWVbdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAxXSA9PT0gJ10nO1xuXG4gICAgLy8gdmFsaWRhdGUgYSBsaXR0bGUuXG4gICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgIHZhciBob3N0cGFydHMgPSB0aGlzLmhvc3RuYW1lLnNwbGl0KC9cXC4vKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gaG9zdHBhcnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgcGFydCA9IGhvc3RwYXJ0c1tpXTtcbiAgICAgICAgaWYgKCFwYXJ0KSBjb250aW51ZTtcbiAgICAgICAgaWYgKCFwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFBhdHRlcm4pKSB7XG4gICAgICAgICAgdmFyIG5ld3BhcnQgPSAnJztcbiAgICAgICAgICBmb3IgKHZhciBqID0gMCwgayA9IHBhcnQubGVuZ3RoOyBqIDwgazsgaisrKSB7XG4gICAgICAgICAgICBpZiAocGFydC5jaGFyQ29kZUF0KGopID4gMTI3KSB7XG4gICAgICAgICAgICAgIC8vIHdlIHJlcGxhY2Ugbm9uLUFTQ0lJIGNoYXIgd2l0aCBhIHRlbXBvcmFyeSBwbGFjZWhvbGRlclxuICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHRoaXMgdG8gbWFrZSBzdXJlIHNpemUgb2YgaG9zdG5hbWUgaXMgbm90XG4gICAgICAgICAgICAgIC8vIGJyb2tlbiBieSByZXBsYWNpbmcgbm9uLUFTQ0lJIGJ5IG5vdGhpbmdcbiAgICAgICAgICAgICAgbmV3cGFydCArPSAneCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9IHBhcnRbal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHdlIHRlc3QgYWdhaW4gd2l0aCBBU0NJSSBjaGFyIG9ubHlcbiAgICAgICAgICBpZiAoIW5ld3BhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICAgIHZhciB2YWxpZFBhcnRzID0gaG9zdHBhcnRzLnNsaWNlKDAsIGkpO1xuICAgICAgICAgICAgdmFyIG5vdEhvc3QgPSBob3N0cGFydHMuc2xpY2UoaSArIDEpO1xuICAgICAgICAgICAgdmFyIGJpdCA9IHBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0U3RhcnQpO1xuICAgICAgICAgICAgaWYgKGJpdCkge1xuICAgICAgICAgICAgICB2YWxpZFBhcnRzLnB1c2goYml0WzFdKTtcbiAgICAgICAgICAgICAgbm90SG9zdC51bnNoaWZ0KGJpdFsyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobm90SG9zdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgcmVzdCA9ICcvJyArIG5vdEhvc3Quam9pbignLicpICsgcmVzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaG9zdG5hbWUgPSB2YWxpZFBhcnRzLmpvaW4oJy4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmhvc3RuYW1lLmxlbmd0aCA+IGhvc3RuYW1lTWF4TGVuKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGhvc3RuYW1lcyBhcmUgYWx3YXlzIGxvd2VyIGNhc2UuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIGlmICghaXB2Nkhvc3RuYW1lKSB7XG4gICAgICAvLyBJRE5BIFN1cHBvcnQ6IFJldHVybnMgYSBwdW55Y29kZWQgcmVwcmVzZW50YXRpb24gb2YgXCJkb21haW5cIi5cbiAgICAgIC8vIEl0IG9ubHkgY29udmVydHMgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHRoYXRcbiAgICAgIC8vIGhhdmUgbm9uLUFTQ0lJIGNoYXJhY3RlcnMsIGkuZS4gaXQgZG9lc24ndCBtYXR0ZXIgaWZcbiAgICAgIC8vIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCBhbHJlYWR5IGlzIEFTQ0lJLW9ubHkuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gcHVueWNvZGUudG9BU0NJSSh0aGlzLmhvc3RuYW1lKTtcbiAgICB9XG5cbiAgICB2YXIgcCA9IHRoaXMucG9ydCA/ICc6JyArIHRoaXMucG9ydCA6ICcnO1xuICAgIHZhciBoID0gdGhpcy5ob3N0bmFtZSB8fCAnJztcbiAgICB0aGlzLmhvc3QgPSBoICsgcDtcbiAgICB0aGlzLmhyZWYgKz0gdGhpcy5ob3N0O1xuXG4gICAgLy8gc3RyaXAgWyBhbmQgXSBmcm9tIHRoZSBob3N0bmFtZVxuICAgIC8vIHRoZSBob3N0IGZpZWxkIHN0aWxsIHJldGFpbnMgdGhlbSwgdGhvdWdoXG4gICAgaWYgKGlwdjZIb3N0bmFtZSkge1xuICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUuc3Vic3RyKDEsIHRoaXMuaG9zdG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBpZiAocmVzdFswXSAhPT0gJy8nKSB7XG4gICAgICAgIHJlc3QgPSAnLycgKyByZXN0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIG5vdyByZXN0IGlzIHNldCB0byB0aGUgcG9zdC1ob3N0IHN0dWZmLlxuICAvLyBjaG9wIG9mZiBhbnkgZGVsaW0gY2hhcnMuXG4gIGlmICghdW5zYWZlUHJvdG9jb2xbbG93ZXJQcm90b10pIHtcblxuICAgIC8vIEZpcnN0LCBtYWtlIDEwMCUgc3VyZSB0aGF0IGFueSBcImF1dG9Fc2NhcGVcIiBjaGFycyBnZXRcbiAgICAvLyBlc2NhcGVkLCBldmVuIGlmIGVuY29kZVVSSUNvbXBvbmVudCBkb2Vzbid0IHRoaW5rIHRoZXlcbiAgICAvLyBuZWVkIHRvIGJlLlxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXV0b0VzY2FwZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBhZSA9IGF1dG9Fc2NhcGVbaV07XG4gICAgICBpZiAocmVzdC5pbmRleE9mKGFlKSA9PT0gLTEpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgdmFyIGVzYyA9IGVuY29kZVVSSUNvbXBvbmVudChhZSk7XG4gICAgICBpZiAoZXNjID09PSBhZSkge1xuICAgICAgICBlc2MgPSBlc2NhcGUoYWUpO1xuICAgICAgfVxuICAgICAgcmVzdCA9IHJlc3Quc3BsaXQoYWUpLmpvaW4oZXNjKTtcbiAgICB9XG4gIH1cblxuXG4gIC8vIGNob3Agb2ZmIGZyb20gdGhlIHRhaWwgZmlyc3QuXG4gIHZhciBoYXNoID0gcmVzdC5pbmRleE9mKCcjJyk7XG4gIGlmIChoYXNoICE9PSAtMSkge1xuICAgIC8vIGdvdCBhIGZyYWdtZW50IHN0cmluZy5cbiAgICB0aGlzLmhhc2ggPSByZXN0LnN1YnN0cihoYXNoKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBoYXNoKTtcbiAgfVxuICB2YXIgcW0gPSByZXN0LmluZGV4T2YoJz8nKTtcbiAgaWYgKHFtICE9PSAtMSkge1xuICAgIHRoaXMuc2VhcmNoID0gcmVzdC5zdWJzdHIocW0pO1xuICAgIHRoaXMucXVlcnkgPSByZXN0LnN1YnN0cihxbSArIDEpO1xuICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5xdWVyeSk7XG4gICAgfVxuICAgIHJlc3QgPSByZXN0LnNsaWNlKDAsIHFtKTtcbiAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgLy8gbm8gcXVlcnkgc3RyaW5nLCBidXQgcGFyc2VRdWVyeVN0cmluZyBzdGlsbCByZXF1ZXN0ZWRcbiAgICB0aGlzLnNlYXJjaCA9ICcnO1xuICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgfVxuICBpZiAocmVzdCkgdGhpcy5wYXRobmFtZSA9IHJlc3Q7XG4gIGlmIChzbGFzaGVkUHJvdG9jb2xbbG93ZXJQcm90b10gJiZcbiAgICAgIHRoaXMuaG9zdG5hbWUgJiYgIXRoaXMucGF0aG5hbWUpIHtcbiAgICB0aGlzLnBhdGhuYW1lID0gJy8nO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICBpZiAodGhpcy5wYXRobmFtZSB8fCB0aGlzLnNlYXJjaCkge1xuICAgIHZhciBwID0gdGhpcy5wYXRobmFtZSB8fCAnJztcbiAgICB2YXIgcyA9IHRoaXMuc2VhcmNoIHx8ICcnO1xuICAgIHRoaXMucGF0aCA9IHAgKyBzO1xuICB9XG5cbiAgLy8gZmluYWxseSwgcmVjb25zdHJ1Y3QgdGhlIGhyZWYgYmFzZWQgb24gd2hhdCBoYXMgYmVlbiB2YWxpZGF0ZWQuXG4gIHRoaXMuaHJlZiA9IHRoaXMuZm9ybWF0KCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZm9ybWF0IGEgcGFyc2VkIG9iamVjdCBpbnRvIGEgdXJsIHN0cmluZ1xuZnVuY3Rpb24gdXJsRm9ybWF0KG9iaikge1xuICAvLyBlbnN1cmUgaXQncyBhbiBvYmplY3QsIGFuZCBub3QgYSBzdHJpbmcgdXJsLlxuICAvLyBJZiBpdCdzIGFuIG9iaiwgdGhpcyBpcyBhIG5vLW9wLlxuICAvLyB0aGlzIHdheSwgeW91IGNhbiBjYWxsIHVybF9mb3JtYXQoKSBvbiBzdHJpbmdzXG4gIC8vIHRvIGNsZWFuIHVwIHBvdGVudGlhbGx5IHdvbmt5IHVybHMuXG4gIGlmICh1dGlsLmlzU3RyaW5nKG9iaikpIG9iaiA9IHVybFBhcnNlKG9iaik7XG4gIGlmICghKG9iaiBpbnN0YW5jZW9mIFVybCkpIHJldHVybiBVcmwucHJvdG90eXBlLmZvcm1hdC5jYWxsKG9iaik7XG4gIHJldHVybiBvYmouZm9ybWF0KCk7XG59XG5cblVybC5wcm90b3R5cGUuZm9ybWF0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBhdXRoID0gdGhpcy5hdXRoIHx8ICcnO1xuICBpZiAoYXV0aCkge1xuICAgIGF1dGggPSBlbmNvZGVVUklDb21wb25lbnQoYXV0aCk7XG4gICAgYXV0aCA9IGF1dGgucmVwbGFjZSgvJTNBL2ksICc6Jyk7XG4gICAgYXV0aCArPSAnQCc7XG4gIH1cblxuICB2YXIgcHJvdG9jb2wgPSB0aGlzLnByb3RvY29sIHx8ICcnLFxuICAgICAgcGF0aG5hbWUgPSB0aGlzLnBhdGhuYW1lIHx8ICcnLFxuICAgICAgaGFzaCA9IHRoaXMuaGFzaCB8fCAnJyxcbiAgICAgIGhvc3QgPSBmYWxzZSxcbiAgICAgIHF1ZXJ5ID0gJyc7XG5cbiAgaWYgKHRoaXMuaG9zdCkge1xuICAgIGhvc3QgPSBhdXRoICsgdGhpcy5ob3N0O1xuICB9IGVsc2UgaWYgKHRoaXMuaG9zdG5hbWUpIHtcbiAgICBob3N0ID0gYXV0aCArICh0aGlzLmhvc3RuYW1lLmluZGV4T2YoJzonKSA9PT0gLTEgP1xuICAgICAgICB0aGlzLmhvc3RuYW1lIDpcbiAgICAgICAgJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyk7XG4gICAgaWYgKHRoaXMucG9ydCkge1xuICAgICAgaG9zdCArPSAnOicgKyB0aGlzLnBvcnQ7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMucXVlcnkgJiZcbiAgICAgIHV0aWwuaXNPYmplY3QodGhpcy5xdWVyeSkgJiZcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcnkpLmxlbmd0aCkge1xuICAgIHF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHRoaXMucXVlcnkpO1xuICB9XG5cbiAgdmFyIHNlYXJjaCA9IHRoaXMuc2VhcmNoIHx8IChxdWVyeSAmJiAoJz8nICsgcXVlcnkpKSB8fCAnJztcblxuICBpZiAocHJvdG9jb2wgJiYgcHJvdG9jb2wuc3Vic3RyKC0xKSAhPT0gJzonKSBwcm90b2NvbCArPSAnOic7XG5cbiAgLy8gb25seSB0aGUgc2xhc2hlZFByb3RvY29scyBnZXQgdGhlIC8vLiAgTm90IG1haWx0bzosIHhtcHA6LCBldGMuXG4gIC8vIHVubGVzcyB0aGV5IGhhZCB0aGVtIHRvIGJlZ2luIHdpdGguXG4gIGlmICh0aGlzLnNsYXNoZXMgfHxcbiAgICAgICghcHJvdG9jb2wgfHwgc2xhc2hlZFByb3RvY29sW3Byb3RvY29sXSkgJiYgaG9zdCAhPT0gZmFsc2UpIHtcbiAgICBob3N0ID0gJy8vJyArIChob3N0IHx8ICcnKTtcbiAgICBpZiAocGF0aG5hbWUgJiYgcGF0aG5hbWUuY2hhckF0KDApICE9PSAnLycpIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gIH0gZWxzZSBpZiAoIWhvc3QpIHtcbiAgICBob3N0ID0gJyc7XG4gIH1cblxuICBpZiAoaGFzaCAmJiBoYXNoLmNoYXJBdCgwKSAhPT0gJyMnKSBoYXNoID0gJyMnICsgaGFzaDtcbiAgaWYgKHNlYXJjaCAmJiBzZWFyY2guY2hhckF0KDApICE9PSAnPycpIHNlYXJjaCA9ICc/JyArIHNlYXJjaDtcblxuICBwYXRobmFtZSA9IHBhdGhuYW1lLnJlcGxhY2UoL1s/I10vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KG1hdGNoKTtcbiAgfSk7XG4gIHNlYXJjaCA9IHNlYXJjaC5yZXBsYWNlKCcjJywgJyUyMycpO1xuXG4gIHJldHVybiBwcm90b2NvbCArIGhvc3QgKyBwYXRobmFtZSArIHNlYXJjaCArIGhhc2g7XG59O1xuXG5mdW5jdGlvbiB1cmxSZXNvbHZlKHNvdXJjZSwgcmVsYXRpdmUpIHtcbiAgcmV0dXJuIHVybFBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmUocmVsYXRpdmUpO1xufVxuXG5VcmwucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xuICByZXR1cm4gdGhpcy5yZXNvbHZlT2JqZWN0KHVybFBhcnNlKHJlbGF0aXZlLCBmYWxzZSwgdHJ1ZSkpLmZvcm1hdCgpO1xufTtcblxuZnVuY3Rpb24gdXJsUmVzb2x2ZU9iamVjdChzb3VyY2UsIHJlbGF0aXZlKSB7XG4gIGlmICghc291cmNlKSByZXR1cm4gcmVsYXRpdmU7XG4gIHJldHVybiB1cmxQYXJzZShzb3VyY2UsIGZhbHNlLCB0cnVlKS5yZXNvbHZlT2JqZWN0KHJlbGF0aXZlKTtcbn1cblxuVXJsLnByb3RvdHlwZS5yZXNvbHZlT2JqZWN0ID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcbiAgaWYgKHV0aWwuaXNTdHJpbmcocmVsYXRpdmUpKSB7XG4gICAgdmFyIHJlbCA9IG5ldyBVcmwoKTtcbiAgICByZWwucGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKTtcbiAgICByZWxhdGl2ZSA9IHJlbDtcbiAgfVxuXG4gIHZhciByZXN1bHQgPSBuZXcgVXJsKCk7XG4gIHZhciB0a2V5cyA9IE9iamVjdC5rZXlzKHRoaXMpO1xuICBmb3IgKHZhciB0ayA9IDA7IHRrIDwgdGtleXMubGVuZ3RoOyB0aysrKSB7XG4gICAgdmFyIHRrZXkgPSB0a2V5c1t0a107XG4gICAgcmVzdWx0W3RrZXldID0gdGhpc1t0a2V5XTtcbiAgfVxuXG4gIC8vIGhhc2ggaXMgYWx3YXlzIG92ZXJyaWRkZW4sIG5vIG1hdHRlciB3aGF0LlxuICAvLyBldmVuIGhyZWY9XCJcIiB3aWxsIHJlbW92ZSBpdC5cbiAgcmVzdWx0Lmhhc2ggPSByZWxhdGl2ZS5oYXNoO1xuXG4gIC8vIGlmIHRoZSByZWxhdGl2ZSB1cmwgaXMgZW1wdHksIHRoZW4gdGhlcmUncyBub3RoaW5nIGxlZnQgdG8gZG8gaGVyZS5cbiAgaWYgKHJlbGF0aXZlLmhyZWYgPT09ICcnKSB7XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIGhyZWZzIGxpa2UgLy9mb28vYmFyIGFsd2F5cyBjdXQgdG8gdGhlIHByb3RvY29sLlxuICBpZiAocmVsYXRpdmUuc2xhc2hlcyAmJiAhcmVsYXRpdmUucHJvdG9jb2wpIHtcbiAgICAvLyB0YWtlIGV2ZXJ5dGhpbmcgZXhjZXB0IHRoZSBwcm90b2NvbCBmcm9tIHJlbGF0aXZlXG4gICAgdmFyIHJrZXlzID0gT2JqZWN0LmtleXMocmVsYXRpdmUpO1xuICAgIGZvciAodmFyIHJrID0gMDsgcmsgPCBya2V5cy5sZW5ndGg7IHJrKyspIHtcbiAgICAgIHZhciBya2V5ID0gcmtleXNbcmtdO1xuICAgICAgaWYgKHJrZXkgIT09ICdwcm90b2NvbCcpXG4gICAgICAgIHJlc3VsdFtya2V5XSA9IHJlbGF0aXZlW3JrZXldO1xuICAgIH1cblxuICAgIC8vdXJsUGFyc2UgYXBwZW5kcyB0cmFpbGluZyAvIHRvIHVybHMgbGlrZSBodHRwOi8vd3d3LmV4YW1wbGUuY29tXG4gICAgaWYgKHNsYXNoZWRQcm90b2NvbFtyZXN1bHQucHJvdG9jb2xdICYmXG4gICAgICAgIHJlc3VsdC5ob3N0bmFtZSAmJiAhcmVzdWx0LnBhdGhuYW1lKSB7XG4gICAgICByZXN1bHQucGF0aCA9IHJlc3VsdC5wYXRobmFtZSA9ICcvJztcbiAgICB9XG5cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKHJlbGF0aXZlLnByb3RvY29sICYmIHJlbGF0aXZlLnByb3RvY29sICE9PSByZXN1bHQucHJvdG9jb2wpIHtcbiAgICAvLyBpZiBpdCdzIGEga25vd24gdXJsIHByb3RvY29sLCB0aGVuIGNoYW5naW5nXG4gICAgLy8gdGhlIHByb3RvY29sIGRvZXMgd2VpcmQgdGhpbmdzXG4gICAgLy8gZmlyc3QsIGlmIGl0J3Mgbm90IGZpbGU6LCB0aGVuIHdlIE1VU1QgaGF2ZSBhIGhvc3QsXG4gICAgLy8gYW5kIGlmIHRoZXJlIHdhcyBhIHBhdGhcbiAgICAvLyB0byBiZWdpbiB3aXRoLCB0aGVuIHdlIE1VU1QgaGF2ZSBhIHBhdGguXG4gICAgLy8gaWYgaXQgaXMgZmlsZTosIHRoZW4gdGhlIGhvc3QgaXMgZHJvcHBlZCxcbiAgICAvLyBiZWNhdXNlIHRoYXQncyBrbm93biB0byBiZSBob3N0bGVzcy5cbiAgICAvLyBhbnl0aGluZyBlbHNlIGlzIGFzc3VtZWQgdG8gYmUgYWJzb2x1dGUuXG4gICAgaWYgKCFzbGFzaGVkUHJvdG9jb2xbcmVsYXRpdmUucHJvdG9jb2xdKSB7XG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJlbGF0aXZlKTtcbiAgICAgIGZvciAodmFyIHYgPSAwOyB2IDwga2V5cy5sZW5ndGg7IHYrKykge1xuICAgICAgICB2YXIgayA9IGtleXNbdl07XG4gICAgICAgIHJlc3VsdFtrXSA9IHJlbGF0aXZlW2tdO1xuICAgICAgfVxuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJlc3VsdC5wcm90b2NvbCA9IHJlbGF0aXZlLnByb3RvY29sO1xuICAgIGlmICghcmVsYXRpdmUuaG9zdCAmJiAhaG9zdGxlc3NQcm90b2NvbFtyZWxhdGl2ZS5wcm90b2NvbF0pIHtcbiAgICAgIHZhciByZWxQYXRoID0gKHJlbGF0aXZlLnBhdGhuYW1lIHx8ICcnKS5zcGxpdCgnLycpO1xuICAgICAgd2hpbGUgKHJlbFBhdGgubGVuZ3RoICYmICEocmVsYXRpdmUuaG9zdCA9IHJlbFBhdGguc2hpZnQoKSkpO1xuICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0KSByZWxhdGl2ZS5ob3N0ID0gJyc7XG4gICAgICBpZiAoIXJlbGF0aXZlLmhvc3RuYW1lKSByZWxhdGl2ZS5ob3N0bmFtZSA9ICcnO1xuICAgICAgaWYgKHJlbFBhdGhbMF0gIT09ICcnKSByZWxQYXRoLnVuc2hpZnQoJycpO1xuICAgICAgaWYgKHJlbFBhdGgubGVuZ3RoIDwgMikgcmVsUGF0aC51bnNoaWZ0KCcnKTtcbiAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbFBhdGguam9pbignLycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxhdGl2ZS5wYXRobmFtZTtcbiAgICB9XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICByZXN1bHQuaG9zdCA9IHJlbGF0aXZlLmhvc3QgfHwgJyc7XG4gICAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoO1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3Q7XG4gICAgcmVzdWx0LnBvcnQgPSByZWxhdGl2ZS5wb3J0O1xuICAgIC8vIHRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHJlc3VsdC5wYXRobmFtZSB8fCByZXN1bHQuc2VhcmNoKSB7XG4gICAgICB2YXIgcCA9IHJlc3VsdC5wYXRobmFtZSB8fCAnJztcbiAgICAgIHZhciBzID0gcmVzdWx0LnNlYXJjaCB8fCAnJztcbiAgICAgIHJlc3VsdC5wYXRoID0gcCArIHM7XG4gICAgfVxuICAgIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmFyIGlzU291cmNlQWJzID0gKHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpLFxuICAgICAgaXNSZWxBYnMgPSAoXG4gICAgICAgICAgcmVsYXRpdmUuaG9zdCB8fFxuICAgICAgICAgIHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nXG4gICAgICApLFxuICAgICAgbXVzdEVuZEFicyA9IChpc1JlbEFicyB8fCBpc1NvdXJjZUFicyB8fFxuICAgICAgICAgICAgICAgICAgICAocmVzdWx0Lmhvc3QgJiYgcmVsYXRpdmUucGF0aG5hbWUpKSxcbiAgICAgIHJlbW92ZUFsbERvdHMgPSBtdXN0RW5kQWJzLFxuICAgICAgc3JjUGF0aCA9IHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuc3BsaXQoJy8nKSB8fCBbXSxcbiAgICAgIHJlbFBhdGggPSByZWxhdGl2ZS5wYXRobmFtZSAmJiByZWxhdGl2ZS5wYXRobmFtZS5zcGxpdCgnLycpIHx8IFtdLFxuICAgICAgcHN5Y2hvdGljID0gcmVzdWx0LnByb3RvY29sICYmICFzbGFzaGVkUHJvdG9jb2xbcmVzdWx0LnByb3RvY29sXTtcblxuICAvLyBpZiB0aGUgdXJsIGlzIGEgbm9uLXNsYXNoZWQgdXJsLCB0aGVuIHJlbGF0aXZlXG4gIC8vIGxpbmtzIGxpa2UgLi4vLi4gc2hvdWxkIGJlIGFibGVcbiAgLy8gdG8gY3Jhd2wgdXAgdG8gdGhlIGhvc3RuYW1lLCBhcyB3ZWxsLiAgVGhpcyBpcyBzdHJhbmdlLlxuICAvLyByZXN1bHQucHJvdG9jb2wgaGFzIGFscmVhZHkgYmVlbiBzZXQgYnkgbm93LlxuICAvLyBMYXRlciBvbiwgcHV0IHRoZSBmaXJzdCBwYXRoIHBhcnQgaW50byB0aGUgaG9zdCBmaWVsZC5cbiAgaWYgKHBzeWNob3RpYykge1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9ICcnO1xuICAgIHJlc3VsdC5wb3J0ID0gbnVsbDtcbiAgICBpZiAocmVzdWx0Lmhvc3QpIHtcbiAgICAgIGlmIChzcmNQYXRoWzBdID09PSAnJykgc3JjUGF0aFswXSA9IHJlc3VsdC5ob3N0O1xuICAgICAgZWxzZSBzcmNQYXRoLnVuc2hpZnQocmVzdWx0Lmhvc3QpO1xuICAgIH1cbiAgICByZXN1bHQuaG9zdCA9ICcnO1xuICAgIGlmIChyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgICAgcmVsYXRpdmUuaG9zdG5hbWUgPSBudWxsO1xuICAgICAgcmVsYXRpdmUucG9ydCA9IG51bGw7XG4gICAgICBpZiAocmVsYXRpdmUuaG9zdCkge1xuICAgICAgICBpZiAocmVsUGF0aFswXSA9PT0gJycpIHJlbFBhdGhbMF0gPSByZWxhdGl2ZS5ob3N0O1xuICAgICAgICBlbHNlIHJlbFBhdGgudW5zaGlmdChyZWxhdGl2ZS5ob3N0KTtcbiAgICAgIH1cbiAgICAgIHJlbGF0aXZlLmhvc3QgPSBudWxsO1xuICAgIH1cbiAgICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyAmJiAocmVsUGF0aFswXSA9PT0gJycgfHwgc3JjUGF0aFswXSA9PT0gJycpO1xuICB9XG5cbiAgaWYgKGlzUmVsQWJzKSB7XG4gICAgLy8gaXQncyBhYnNvbHV0ZS5cbiAgICByZXN1bHQuaG9zdCA9IChyZWxhdGl2ZS5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgPT09ICcnKSA/XG4gICAgICAgICAgICAgICAgICByZWxhdGl2ZS5ob3N0IDogcmVzdWx0Lmhvc3Q7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gKHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3RuYW1lID09PSAnJykgP1xuICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aXZlLmhvc3RuYW1lIDogcmVzdWx0Lmhvc3RuYW1lO1xuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgc3JjUGF0aCA9IHJlbFBhdGg7XG4gICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBkb3QtaGFuZGxpbmcgYmVsb3cuXG4gIH0gZWxzZSBpZiAocmVsUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBpdCdzIHJlbGF0aXZlXG4gICAgLy8gdGhyb3cgYXdheSB0aGUgZXhpc3RpbmcgZmlsZSwgYW5kIHRha2UgdGhlIG5ldyBwYXRoIGluc3RlYWQuXG4gICAgaWYgKCFzcmNQYXRoKSBzcmNQYXRoID0gW107XG4gICAgc3JjUGF0aC5wb3AoKTtcbiAgICBzcmNQYXRoID0gc3JjUGF0aC5jb25jYXQocmVsUGF0aCk7XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgfSBlbHNlIGlmICghdXRpbC5pc051bGxPclVuZGVmaW5lZChyZWxhdGl2ZS5zZWFyY2gpKSB7XG4gICAgLy8ganVzdCBwdWxsIG91dCB0aGUgc2VhcmNoLlxuICAgIC8vIGxpa2UgaHJlZj0nP2ZvbycuXG4gICAgLy8gUHV0IHRoaXMgYWZ0ZXIgdGhlIG90aGVyIHR3byBjYXNlcyBiZWNhdXNlIGl0IHNpbXBsaWZpZXMgdGhlIGJvb2xlYW5zXG4gICAgaWYgKHBzeWNob3RpYykge1xuICAgICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBzcmNQYXRoLnNoaWZ0KCk7XG4gICAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgICAvL3RoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAgIC8vdXJsLnJlc29sdmVPYmplY3QoJ21haWx0bzpsb2NhbDFAZG9tYWluMScsICdsb2NhbDJAZG9tYWluMicpXG4gICAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaG9zdC5zcGxpdCgnQCcpIDogZmFsc2U7XG4gICAgICBpZiAoYXV0aEluSG9zdCkge1xuICAgICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmICghdXRpbC5pc051bGwocmVzdWx0LnBhdGhuYW1lKSB8fCAhdXRpbC5pc051bGwocmVzdWx0LnNlYXJjaCkpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gKHJlc3VsdC5wYXRobmFtZSA/IHJlc3VsdC5wYXRobmFtZSA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgICB9XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBubyBwYXRoIGF0IGFsbC4gIGVhc3kuXG4gICAgLy8gd2UndmUgYWxyZWFkeSBoYW5kbGVkIHRoZSBvdGhlciBzdHVmZiBhYm92ZS5cbiAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnNlYXJjaCkge1xuICAgICAgcmVzdWx0LnBhdGggPSAnLycgKyByZXN1bHQuc2VhcmNoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aCA9IG51bGw7XG4gICAgfVxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBpZiBhIHVybCBFTkRzIGluIC4gb3IgLi4sIHRoZW4gaXQgbXVzdCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgLy8gaG93ZXZlciwgaWYgaXQgZW5kcyBpbiBhbnl0aGluZyBlbHNlIG5vbi1zbGFzaHksXG4gIC8vIHRoZW4gaXQgbXVzdCBOT1QgZ2V0IGEgdHJhaWxpbmcgc2xhc2guXG4gIHZhciBsYXN0ID0gc3JjUGF0aC5zbGljZSgtMSlbMF07XG4gIHZhciBoYXNUcmFpbGluZ1NsYXNoID0gKFxuICAgICAgKHJlc3VsdC5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgfHwgc3JjUGF0aC5sZW5ndGggPiAxKSAmJlxuICAgICAgKGxhc3QgPT09ICcuJyB8fCBsYXN0ID09PSAnLi4nKSB8fCBsYXN0ID09PSAnJyk7XG5cbiAgLy8gc3RyaXAgc2luZ2xlIGRvdHMsIHJlc29sdmUgZG91YmxlIGRvdHMgdG8gcGFyZW50IGRpclxuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gc3JjUGF0aC5sZW5ndGg7IGkgPj0gMDsgaS0tKSB7XG4gICAgbGFzdCA9IHNyY1BhdGhbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKCFtdXN0RW5kQWJzICYmICFyZW1vdmVBbGxEb3RzKSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBzcmNQYXRoLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgc3JjUGF0aFswXSAhPT0gJycgJiZcbiAgICAgICghc3JjUGF0aFswXSB8fCBzcmNQYXRoWzBdLmNoYXJBdCgwKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgudW5zaGlmdCgnJyk7XG4gIH1cblxuICBpZiAoaGFzVHJhaWxpbmdTbGFzaCAmJiAoc3JjUGF0aC5qb2luKCcvJykuc3Vic3RyKC0xKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgucHVzaCgnJyk7XG4gIH1cblxuICB2YXIgaXNBYnNvbHV0ZSA9IHNyY1BhdGhbMF0gPT09ICcnIHx8XG4gICAgICAoc3JjUGF0aFswXSAmJiBzcmNQYXRoWzBdLmNoYXJBdCgwKSA9PT0gJy8nKTtcblxuICAvLyBwdXQgdGhlIGhvc3QgYmFja1xuICBpZiAocHN5Y2hvdGljKSB7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBpc0Fic29sdXRlID8gJycgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjUGF0aC5sZW5ndGggPyBzcmNQYXRoLnNoaWZ0KCkgOiAnJztcbiAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgLy90aGlzIGVzcGVjaWFsbHkgaGFwcGVucyBpbiBjYXNlcyBsaWtlXG4gICAgLy91cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lmhvc3Quc3BsaXQoJ0AnKSA6IGZhbHNlO1xuICAgIGlmIChhdXRoSW5Ib3N0KSB7XG4gICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgIH1cbiAgfVxuXG4gIG11c3RFbmRBYnMgPSBtdXN0RW5kQWJzIHx8IChyZXN1bHQuaG9zdCAmJiBzcmNQYXRoLmxlbmd0aCk7XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBzcmNQYXRoLnVuc2hpZnQoJycpO1xuICB9XG5cbiAgaWYgKCFzcmNQYXRoLmxlbmd0aCkge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IG51bGw7XG4gICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IHNyY1BhdGguam9pbignLycpO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IHJlcXVlc3QuaHR0cFxuICBpZiAoIXV0aWwuaXNOdWxsKHJlc3VsdC5wYXRobmFtZSkgfHwgIXV0aWwuaXNOdWxsKHJlc3VsdC5zZWFyY2gpKSB7XG4gICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogJycpICtcbiAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgfVxuICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGggfHwgcmVzdWx0LmF1dGg7XG4gIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5VcmwucHJvdG90eXBlLnBhcnNlSG9zdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaG9zdCA9IHRoaXMuaG9zdDtcbiAgdmFyIHBvcnQgPSBwb3J0UGF0dGVybi5leGVjKGhvc3QpO1xuICBpZiAocG9ydCkge1xuICAgIHBvcnQgPSBwb3J0WzBdO1xuICAgIGlmIChwb3J0ICE9PSAnOicpIHtcbiAgICAgIHRoaXMucG9ydCA9IHBvcnQuc3Vic3RyKDEpO1xuICAgIH1cbiAgICBob3N0ID0gaG9zdC5zdWJzdHIoMCwgaG9zdC5sZW5ndGggLSBwb3J0Lmxlbmd0aCk7XG4gIH1cbiAgaWYgKGhvc3QpIHRoaXMuaG9zdG5hbWUgPSBob3N0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzU3RyaW5nOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gdHlwZW9mKGFyZykgPT09ICdzdHJpbmcnO1xuICB9LFxuICBpc09iamVjdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIHR5cGVvZihhcmcpID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG4gIH0sXG4gIGlzTnVsbDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbiAgfSxcbiAgaXNOdWxsT3JVbmRlZmluZWQ6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBhcmcgPT0gbnVsbDtcbiAgfVxufTtcbiIsIlxuLyoqXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlcHJlY2F0ZTtcblxuLyoqXG4gKiBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuICogUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLm5vRGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLnRocm93RGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gZGVwcmVjYXRlZCBmdW5jdGlvbnNcbiAqIHdpbGwgdGhyb3cgYW4gRXJyb3Igd2hlbiBpbnZva2VkLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudHJhY2VEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCBpbnZva2UgYGNvbnNvbGUudHJhY2UoKWAgaW5zdGVhZCBvZiBgY29uc29sZS5lcnJvcigpYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiAtIHRoZSBmdW5jdGlvbiB0byBkZXByZWNhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBtc2cgLSB0aGUgc3RyaW5nIHRvIHByaW50IHRvIHRoZSBjb25zb2xlIHdoZW4gYGZuYCBpcyBpbnZva2VkXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IGEgbmV3IFwiZGVwcmVjYXRlZFwiIHZlcnNpb24gb2YgYGZuYFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZXByZWNhdGUgKGZuLCBtc2cpIHtcbiAgaWYgKGNvbmZpZygnbm9EZXByZWNhdGlvbicpKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAoY29uZmlnKCd0aHJvd0RlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGNvbmZpZygndHJhY2VEZXByZWNhdGlvbicpKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgYGxvY2FsU3RvcmFnZWAgZm9yIGJvb2xlYW4gdmFsdWVzIGZvciB0aGUgZ2l2ZW4gYG5hbWVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvbmZpZyAobmFtZSkge1xuICAvLyBhY2Nlc3NpbmcgZ2xvYmFsLmxvY2FsU3RvcmFnZSBjYW4gdHJpZ2dlciBhIERPTUV4Y2VwdGlvbiBpbiBzYW5kYm94ZWQgaWZyYW1lc1xuICB0cnkge1xuICAgIGlmICghZ2xvYmFsLmxvY2FsU3RvcmFnZSkgcmV0dXJuIGZhbHNlO1xuICB9IGNhdGNoIChfKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciB2YWwgPSBnbG9iYWwubG9jYWxTdG9yYWdlW25hbWVdO1xuICBpZiAobnVsbCA9PSB2YWwpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIFN0cmluZyh2YWwpLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcInByaXNtaWMuaW9cIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkphdmFTY3JpcHQgZGV2ZWxvcG1lbnQga2l0IGZvciBwcmlzbWljLmlvXCIsXG4gIFwibGljZW5zZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vcHJpc21pY2lvL2phdmFzY3JpcHQta2l0XCIsXG4gIFwia2V5d29yZHNcIjogW1xuICAgIFwicHJpc21pY1wiLFxuICAgIFwicHJpc21pYy5pb1wiLFxuICAgIFwiY21zXCIsXG4gICAgXCJjb250ZW50XCIsXG4gICAgXCJhcGlcIlxuICBdLFxuICBcInZlcnNpb25cIjogXCIyLjAuMFwiLFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJiYWJlbC1wcmVzZXQtZXMyMDE1XCI6IFwiXjYuMy4xM1wiLFxuICAgIFwiYmFiZWxpZnlcIjogXCJeNy4yLjBcIixcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTIuMC4xXCIsXG4gICAgXCJjaGFpXCI6IFwiKlwiLFxuICAgIFwiY29kZWNsaW1hdGUtdGVzdC1yZXBvcnRlclwiOiBcIn4wLjAuNFwiLFxuICAgIFwiZ3VscFwiOiBcIn4zLjkuMFwiLFxuICAgIFwiZ3VscC1naC1wYWdlc1wiOiBcIn4wLjUuMFwiLFxuICAgIFwiZ3VscC1naXN0XCI6IFwifjEuMC4zXCIsXG4gICAgXCJndWxwLWpzZG9jXCI6IFwifjAuMS40XCIsXG4gICAgXCJndWxwLXNvdXJjZW1hcHNcIjogXCJeMS42LjBcIixcbiAgICBcImd1bHAtdWdsaWZ5XCI6IFwifjEuMi4wXCIsXG4gICAgXCJndWxwLXV0aWxcIjogXCJ+My4wLjZcIixcbiAgICBcIm1vY2hhXCI6IFwiKlwiLFxuICAgIFwic291cmNlLW1hcC1zdXBwb3J0XCI6IFwiXjAuNC4wXCIsXG4gICAgXCJ2aW55bC1idWZmZXJcIjogXCJeMS4wLjBcIixcbiAgICBcInZpbnlsLXNvdXJjZS1zdHJlYW1cIjogXCJeMS4xLjBcIlxuICB9LFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiaHR0cDovL2dpdGh1Yi5jb20vcHJpc21pY2lvL2phdmFzY3JpcHQta2l0LmdpdFwiXG4gIH0sXG4gIFwibWFpblwiOiBcInNyYy9hcGkuanNcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInRlc3RcIjogXCJtb2NoYVwiLFxuICAgIFwibGludFwiOiBcImVzbGludCBzcmNcIlxuICB9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGV4cGVyaW1lbnRzID0gcmVxdWlyZSgnLi9leHBlcmltZW50cycpLFxuICAgIFByZWRpY2F0ZXMgPSByZXF1aXJlKCcuL3ByZWRpY2F0ZXMnKSxcbiAgICBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKSxcbiAgICBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpLFxuICAgIEFwaUNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZS5qcycpLFxuICAgIGRvY3VtZW50cyA9IHJlcXVpcmUoJy4vZG9jdW1lbnRzJyk7XG5cbnZhciBEb2N1bWVudCA9IGRvY3VtZW50cy5Eb2N1bWVudCxcbiAgICBFeHBlcmltZW50cyA9IGV4cGVyaW1lbnRzLkV4cGVyaW1lbnRzO1xuXG5cbi8qKlxuICogSW5pdGlhbGlzYXRpb24gb2YgdGhlIEFQSSBvYmplY3QuXG4gKiBUaGlzIGlzIGZvciBpbnRlcm5hbCB1c2UsIGZyb20gb3V0c2lkZSB0aGlzIGtpdCwgeW91IHNob3VsZCBjYWxsIFByaXNtaWMuQXBpKClcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEFwaSh1cmwsIGFjY2Vzc1Rva2VuLCBtYXliZVJlcXVlc3RIYW5kbGVyLCBtYXliZUFwaUNhY2hlLCBtYXliZUFwaURhdGFUVEwpIHtcbiAgdGhpcy51cmwgPSB1cmwgKyAoYWNjZXNzVG9rZW4gPyAodXJsLmluZGV4T2YoJz8nKSA+IC0xID8gJyYnIDogJz8nKSArICdhY2Nlc3NfdG9rZW49JyArIGFjY2Vzc1Rva2VuIDogJycpO1xuICB0aGlzLmFjY2Vzc1Rva2VuID0gYWNjZXNzVG9rZW47XG4gIHRoaXMuYXBpQ2FjaGUgPSBtYXliZUFwaUNhY2hlIHx8IGdsb2JhbENhY2hlKCk7XG4gIHRoaXMucmVxdWVzdEhhbmRsZXIgPSBtYXliZVJlcXVlc3RIYW5kbGVyIHx8IFV0aWxzLnJlcXVlc3QoKTtcbiAgdGhpcy5hcGlDYWNoZUtleSA9IHRoaXMudXJsICsgKHRoaXMuYWNjZXNzVG9rZW4gPyAoJyMnICsgdGhpcy5hY2Nlc3NUb2tlbikgOiAnJyk7XG4gIHRoaXMuYXBpRGF0YVRUTCA9IG1heWJlQXBpRGF0YVRUTCB8fCA1O1xuICByZXR1cm4gdGhpcztcbn1cblxuLyoqXG4gKiBUaGUga2l0J3MgbWFpbiBlbnRyeSBwb2ludDsgaW5pdGlhbGl6ZSB5b3VyIEFQSSBsaWtlIHRoaXM6IFByaXNtaWMuQXBpKHVybCwgY2FsbGJhY2ssIGFjY2Vzc1Rva2VuLCBtYXliZVJlcXVlc3RIYW5kbGVyKVxuICpcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBBcGlcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBtYW5kYXRvcnkgVVJMIG9mIHRoZSBwcmlzbWljLmlvIEFQSSBlbmRwb2ludCAobGlrZTogaHR0cHM6Ly9sZXNib25uZXNjaG9zZXMucHJpc21pYy5pby9hcGkpXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBBUEkgd2FzIHJldHJpZXZlZCwgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2l0aCB0d28gcGFyYW1ldGVyczogYSBwb3RlbnRpYWwgZXJyb3Igb2JqZWN0IGFuZCB0aGUgQVBJIG9iamVjdFxuICogQHBhcmFtIHtzdHJpbmd9IG1heWJlQWNjZXNzVG9rZW4gLSBUaGUgYWNjZXNzVG9rZW4gZm9yIGFuIE9BdXRoMiBjb25uZWN0aW9uXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBtYXliZVJlcXVlc3RIYW5kbGVyIC0gRW52aXJvbm1lbnQgc3BlY2lmaWMgSFRUUCByZXF1ZXN0IGhhbmRsaW5nIGZ1bmN0aW9uXG4gKiBAcGFyYW0ge29iamVjdH0gbWF5YmVBcGlDYWNoZSAtIEEgY2FjaGUgb2JqZWN0IHdpdGggZ2V0L3NldCBmdW5jdGlvbnMgZm9yIGNhY2hpbmcgQVBJIHJlc3BvbnNlc1xuICogQHBhcmFtIHtpbnR9IG1heWJlQXBpRGF0YVRUTCAtIEhvdyBsb25nIChpbiBzZWNvbmRzKSB0byBjYWNoZSBkYXRhIHVzZWQgYnkgdGhlIGNsaWVudCB0byBtYWtlIGNhbGxzIChlLmcuIHJlZnMpLiBEZWZhdWx0cyB0byA1IHNlY29uZHNcbiAqIEByZXR1cm5zIHtBcGl9IC0gVGhlIEFwaSBvYmplY3QgdGhhdCBjYW4gYmUgbWFuaXB1bGF0ZWRcbiAqL1xuZnVuY3Rpb24gZ2V0QXBpKHVybCwgY2FsbGJhY2ssIG1heWJlQWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIsIG1heWJlQXBpQ2FjaGUsIG1heWJlQXBpRGF0YVRUTCkge1xuICB2YXIgYXBpID0gbmV3IEFwaSh1cmwsIG1heWJlQWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIsIG1heWJlQXBpQ2FjaGUsIG1heWJlQXBpRGF0YVRUTCk7XG4gIC8vVXNlIGNhY2hlZCBhcGkgZGF0YSBpZiBhdmFpbGFibGVcbiAgYXBpLmdldChmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgaWYgKGNhbGxiYWNrICYmIGVycikge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkge1xuICAgICAgYXBpLmRhdGEgPSBkYXRhO1xuICAgICAgYXBpLmJvb2ttYXJrcyA9IGRhdGEuYm9va21hcmtzO1xuICAgICAgYXBpLmV4cGVyaW1lbnRzID0gbmV3IEV4cGVyaW1lbnRzKGRhdGEuZXhwZXJpbWVudHMpO1xuICAgIH1cblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2sobnVsbCwgYXBpKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBhcGk7XG59XG5cblxuQXBpLnByb3RvdHlwZSA9IHtcblxuICAvLyBQcmVkaWNhdGVzXG4gIEFUOiBcImF0XCIsXG4gIEFOWTogXCJhbnlcIixcbiAgU0lNSUxBUjogXCJzaW1pbGFyXCIsXG4gIEZVTExURVhUOiBcImZ1bGx0ZXh0XCIsXG4gIE5VTUJFUjoge1xuICAgIEdUOiBcIm51bWJlci5ndFwiLFxuICAgIExUOiBcIm51bWJlci5sdFwiXG4gIH0sXG4gIERBVEU6IHtcbiAgICAvLyBPdGhlciBkYXRlIG9wZXJhdG9ycyBhcmUgYXZhaWxhYmxlOiBzZWUgdGhlIGRvY3VtZW50YXRpb24uXG4gICAgQUZURVI6IFwiZGF0ZS5hZnRlclwiLFxuICAgIEJFRk9SRTogXCJkYXRlLmJlZm9yZVwiLFxuICAgIEJFVFdFRU46IFwiZGF0ZS5iZXR3ZWVuXCJcbiAgfSxcblxuICAvLyBGcmFnbWVudDogdXNhYmxlIGFzIHRoZSBzZWNvbmQgZWxlbWVudCBvZiBhIHF1ZXJ5IGFycmF5IG9uIG1vc3QgcHJlZGljYXRlcyAoZXhjZXB0IFNJTUlMQVIpLlxuICAvLyBZb3UgY2FuIGFsc28gdXNlIFwibXkuKlwiIGZvciB5b3VyIGN1c3RvbSBmaWVsZHMuXG4gIERPQ1VNRU5UOiB7XG4gICAgSUQ6IFwiZG9jdW1lbnQuaWRcIixcbiAgICBUWVBFOiBcImRvY3VtZW50LnR5cGVcIixcbiAgICBUQUdTOiBcImRvY3VtZW50LnRhZ3NcIlxuICB9LFxuXG4gIGRhdGE6IG51bGwsXG5cbiAgLyoqXG4gICAqIEZldGNoZXMgZGF0YSB1c2VkIHRvIGNvbnN0cnVjdCB0aGUgYXBpIGNsaWVudCwgZnJvbSBjYWNoZSBpZiBpdCdzXG4gICAqIHByZXNlbnQsIG90aGVyd2lzZSBmcm9tIGNhbGxpbmcgdGhlIHByaXNtaWMgYXBpIGVuZHBvaW50ICh3aGljaCBpc1xuICAgKiB0aGVuIGNhY2hlZCkuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gcmVjZWl2ZSB0aGUgZGF0YVxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB0aGlzLmFwaUNhY2hlS2V5O1xuXG4gICAgdGhpcy5hcGlDYWNoZS5nZXQoY2FjaGVLZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAoZXJyIHx8IHZhbHVlKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgdmFsdWUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHNlbGYucmVxdWVzdEhhbmRsZXIoc2VsZi51cmwsIGZ1bmN0aW9uKGVyciwgZGF0YSwgeGhyLCB0dGwpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCwgeGhyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcGFyc2VkID0gc2VsZi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHRsID0gdHRsIHx8IHNlbGYuYXBpRGF0YVRUTDtcblxuICAgICAgICBzZWxmLmFwaUNhY2hlLnNldChjYWNoZUtleSwgcGFyc2VkLCB0dGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIsIHBhcnNlZCwgeGhyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogQ2xlYW5zIGFwaSBkYXRhIGZyb20gdGhlIGNhY2hlIGFuZCBmZXRjaGVzIGFuIHVwIHRvIGRhdGUgY29weS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgZGF0YSBoYXMgYmVlbiByZWZyZXNoZWRcbiAgICovXG4gIHJlZnJlc2g6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB0aGlzLmFwaUNhY2hlS2V5O1xuXG4gICAgdGhpcy5hcGlDYWNoZS5yZW1vdmUoY2FjaGVLZXksIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChjYWxsYmFjayAmJiBlcnIpIHsgY2FsbGJhY2soZXJyKTsgcmV0dXJuOyB9XG4gICAgICBpZiAoIWNhbGxiYWNrICYmIGVycikgeyB0aHJvdyBlcnI7IH1cblxuICAgICAgc2VsZi5nZXQoZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICBpZiAoY2FsbGJhY2sgJiYgZXJyKSB7IGNhbGxiYWNrKGVycik7IHJldHVybjsgfVxuICAgICAgICBpZiAoIWNhbGxiYWNrICYmIGVycikgeyB0aHJvdyBlcnI7IH1cblxuICAgICAgICBzZWxmLmRhdGEgPSBkYXRhO1xuICAgICAgICBzZWxmLmJvb2ttYXJrcyA9IGRhdGEuYm9va21hcmtzO1xuICAgICAgICBzZWxmLmV4cGVyaW1lbnRzID0gbmV3IEV4cGVyaW1lbnRzKGRhdGEuZXhwZXJpbWVudHMpO1xuXG4gICAgICAgIGlmIChjYWxsYmFjaykgeyBjYWxsYmFjaygpOyB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCByZXR1cm5zIHRoZSAvYXBpIGRvY3VtZW50LlxuICAgKiBUaGlzIGlzIGZvciBpbnRlcm5hbCB1c2UsIGZyb20gb3V0c2lkZSB0aGlzIGtpdCwgeW91IHNob3VsZCBjYWxsIFByaXNtaWMuQXBpKClcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGRhdGEgLSBUaGUgSlNPTiBkb2N1bWVudCByZXNwb25kZWQgb24gdGhlIEFQSSdzIGVuZHBvaW50XG4gICAqIEByZXR1cm5zIHtBcGl9IC0gVGhlIEFwaSBvYmplY3QgdGhhdCBjYW4gYmUgbWFuaXB1bGF0ZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHBhcnNlOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHJlZnMsXG4gICAgICAgIG1hc3RlcixcbiAgICAgICAgZm9ybXMgPSB7fSxcbiAgICAgICAgZm9ybSxcbiAgICAgICAgdHlwZXMsXG4gICAgICAgIHRhZ3MsXG4gICAgICAgIGYsXG4gICAgICAgIGk7XG5cbiAgICAvLyBQYXJzZSB0aGUgZm9ybXNcbiAgICBmb3IgKGkgaW4gZGF0YS5mb3Jtcykge1xuICAgICAgaWYgKGRhdGEuZm9ybXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgZiA9IGRhdGEuZm9ybXNbaV07XG5cbiAgICAgICAgaWYodGhpcy5hY2Nlc3NUb2tlbikge1xuICAgICAgICAgIGYuZmllbGRzWydhY2Nlc3NfdG9rZW4nXSA9IHt9O1xuICAgICAgICAgIGYuZmllbGRzWydhY2Nlc3NfdG9rZW4nXVsndHlwZSddID0gJ3N0cmluZyc7XG4gICAgICAgICAgZi5maWVsZHNbJ2FjY2Vzc190b2tlbiddWydkZWZhdWx0J10gPSB0aGlzLmFjY2Vzc1Rva2VuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9ybSA9IG5ldyBGb3JtKFxuICAgICAgICAgIGYubmFtZSxcbiAgICAgICAgICBmLmZpZWxkcyxcbiAgICAgICAgICBmLmZvcm1fbWV0aG9kLFxuICAgICAgICAgIGYucmVsLFxuICAgICAgICAgIGYuZW5jdHlwZSxcbiAgICAgICAgICBmLmFjdGlvblxuICAgICAgICApO1xuXG4gICAgICAgIGZvcm1zW2ldID0gZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZWZzID0gZGF0YS5yZWZzLm1hcChmdW5jdGlvbiAocikge1xuICAgICAgcmV0dXJuIG5ldyBSZWYoXG4gICAgICAgIHIucmVmLFxuICAgICAgICByLmxhYmVsLFxuICAgICAgICByLmlzTWFzdGVyUmVmLFxuICAgICAgICByLnNjaGVkdWxlZEF0LFxuICAgICAgICByLmlkXG4gICAgICApO1xuICAgIH0pIHx8IFtdO1xuXG4gICAgbWFzdGVyID0gcmVmcy5maWx0ZXIoZnVuY3Rpb24gKHIpIHtcbiAgICAgIHJldHVybiByLmlzTWFzdGVyID09PSB0cnVlO1xuICAgIH0pO1xuXG4gICAgdHlwZXMgPSBkYXRhLnR5cGVzO1xuXG4gICAgdGFncyA9IGRhdGEudGFncztcblxuICAgIGlmIChtYXN0ZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyAoXCJObyBtYXN0ZXIgcmVmLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYm9va21hcmtzOiBkYXRhLmJvb2ttYXJrcyB8fCB7fSxcbiAgICAgIHJlZnM6IHJlZnMsXG4gICAgICBmb3JtczogZm9ybXMsXG4gICAgICBtYXN0ZXI6IG1hc3RlclswXSxcbiAgICAgIHR5cGVzOiB0eXBlcyxcbiAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICBleHBlcmltZW50czogZGF0YS5leHBlcmltZW50cyxcbiAgICAgIG9hdXRoSW5pdGlhdGU6IGRhdGFbJ29hdXRoX2luaXRpYXRlJ10sXG4gICAgICBvYXV0aFRva2VuOiBkYXRhWydvYXV0aF90b2tlbiddXG4gICAgfTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCB1c2UgZm9ybSgpIG5vd1xuICAgKiBAcGFyYW0ge3N0cmluZ30gZm9ybUlkIC0gVGhlIGlkIG9mIGEgZm9ybSwgbGlrZSBcImV2ZXJ5dGhpbmdcIiwgb3IgXCJwcm9kdWN0c1wiXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIHRoZSBTZWFyY2hGb3JtIHRoYXQgY2FuIGJlIHVzZWQuXG4gICAqL1xuICBmb3JtczogZnVuY3Rpb24oZm9ybUlkKSB7XG4gICAgcmV0dXJuIHRoaXMuZm9ybShmb3JtSWQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgdXNlYWJsZSBmb3JtIGZyb20gaXRzIGlkLCBhcyBkZXNjcmliZWQgaW4gdGhlIFJFU1RmdWwgZGVzY3JpcHRpb24gb2YgdGhlIEFQSS5cbiAgICogRm9yIGluc3RhbmNlOiBhcGkuZm9ybShcImV2ZXJ5dGhpbmdcIikgd29ya3Mgb24gZXZlcnkgcmVwb3NpdG9yeSAoYXMgXCJldmVyeXRoaW5nXCIgZXhpc3RzIGJ5IGRlZmF1bHQpXG4gICAqIFlvdSBjYW4gdGhlbiBjaGFpbiB0aGUgY2FsbHM6IGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKS5xdWVyeSgnW1s6ZCA9IGF0KGRvY3VtZW50LmlkLCBcIlVrTDBnTXV2ellVQU5DcGZcIildXScpLnJlZihyZWYpLnN1Ym1pdCgpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtSWQgLSBUaGUgaWQgb2YgYSBmb3JtLCBsaWtlIFwiZXZlcnl0aGluZ1wiLCBvciBcInByb2R1Y3RzXCJcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gdGhlIFNlYXJjaEZvcm0gdGhhdCBjYW4gYmUgdXNlZC5cbiAgICovXG4gIGZvcm06IGZ1bmN0aW9uKGZvcm1JZCkge1xuICAgIHZhciBmb3JtID0gdGhpcy5kYXRhLmZvcm1zW2Zvcm1JZF07XG4gICAgaWYoZm9ybSkge1xuICAgICAgcmV0dXJuIG5ldyBTZWFyY2hGb3JtKHRoaXMsIGZvcm0sIHt9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRoZSBJRCBvZiB0aGUgbWFzdGVyIHJlZiBvbiB0aGlzIHByaXNtaWMuaW8gQVBJLlxuICAgKiBEbyBub3QgdXNlIGxpa2UgdGhpczogc2VhcmNoRm9ybS5yZWYoYXBpLm1hc3RlcigpKS5cbiAgICogSW5zdGVhZCwgc2V0IHlvdXIgcmVmIG9uY2UgaW4gYSB2YXJpYWJsZSwgYW5kIGNhbGwgaXQgd2hlbiB5b3UgbmVlZCBpdDsgdGhpcyB3aWxsIGFsbG93IHRvIGNoYW5nZSB0aGUgcmVmIHlvdSdyZSB2aWV3aW5nIGVhc2lseSBmb3IgeW91ciBlbnRpcmUgcGFnZS5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIG1hc3RlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5tYXN0ZXIucmVmO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSByZWYgSUQgZm9yIGEgZ2l2ZW4gcmVmJ3MgbGFiZWwuXG4gICAqIERvIG5vdCB1c2UgbGlrZSB0aGlzOiBzZWFyY2hGb3JtLnJlZihhcGkucmVmKFwiRnV0dXJlIHJlbGVhc2UgbGFiZWxcIikpLlxuICAgKiBJbnN0ZWFkLCBzZXQgeW91ciByZWYgb25jZSBpbiBhIHZhcmlhYmxlLCBhbmQgY2FsbCBpdCB3aGVuIHlvdSBuZWVkIGl0OyB0aGlzIHdpbGwgYWxsb3cgdG8gY2hhbmdlIHRoZSByZWYgeW91J3JlIHZpZXdpbmcgZWFzaWx5IGZvciB5b3VyIGVudGlyZSBwYWdlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWwgLSB0aGUgcmVmJ3MgbGFiZWxcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIHJlZjogZnVuY3Rpb24obGFiZWwpIHtcbiAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmRhdGEucmVmcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYodGhpcy5kYXRhLnJlZnNbaV0ubGFiZWwgPT0gbGFiZWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5yZWZzW2ldLnJlZjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRoZSBjdXJyZW50IGV4cGVyaW1lbnQsIG9yIG51bGxcbiAgICogQHJldHVybnMge0V4cGVyaW1lbnR9XG4gICAqL1xuICBjdXJyZW50RXhwZXJpbWVudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhwZXJpbWVudHMuY3VycmVudCgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgcmVwb3NpdG9yeVxuICAgKiBAcGFyYW0ge3N0cmluZ3xhcnJheXxQcmVkaWNhdGV9IHRoZSBxdWVyeSBpdHNlbGZcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgcXVlcnk6IGZ1bmN0aW9uKHEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGZvcm0gPSB0aGlzLmZvcm0oJ2V2ZXJ5dGhpbmcnKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgZm9ybSA9IGZvcm0uc2V0KGtleSwgb3B0aW9uc1trZXldKTtcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zWydyZWYnXSkge1xuICAgICAgZm9ybSA9IGZvcm0ucmVmKHRoaXMubWFzdGVyKCkpO1xuICAgIH1cbiAgICByZXR1cm4gZm9ybS5xdWVyeShxKS5zdWJtaXQoY2FsbGJhY2spO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gaWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBhZGRpdGlvbmFsIHBhcmFtZXRlcnNcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2soZXJyLCByZXNwb25zZSlcbiAgICovXG4gIGdldEJ5SUQ6IGZ1bmN0aW9uKGlkLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnF1ZXJ5KFByZWRpY2F0ZXMuYXQoJ2RvY3VtZW50LmlkJywgaWQpLCBvcHRpb25zLCBmdW5jdGlvbihlcnIsIHJlc3BvbnNlKSB7XG4gICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcG9uc2UucmVzdWx0c1swXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBtdWx0aXBsZSBkb2N1bWVudHMgZnJvbSBhbiBhcnJheSBvZiBpZFxuICAgKiBAcGFyYW0ge2FycmF5fSBpZHNcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgZ2V0QnlJRHM6IGZ1bmN0aW9uKGlkcywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5xdWVyeShbJ2luJywgJ2RvY3VtZW50LmlkJywgaWRzXSwgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gdWlkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIHRoZSBjdXN0b20gdHlwZSBvZiB0aGUgZG9jdW1lbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVpZFxuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBnZXRCeVVJRDogZnVuY3Rpb24odHlwZSwgdWlkLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnF1ZXJ5KFByZWRpY2F0ZXMuYXQoJ215LicrdHlwZSsnLnVpZCcsIHVpZCksIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXNwb25zZS5yZXN1bHRzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiB1aWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgdGhlIGN1c3RvbSB0eXBlIG9mIHRoZSBkb2N1bWVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdWlkXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBhZGRpdGlvbmFsIHBhcmFtZXRlcnNcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2soZXJyLCByZXNwb25zZSlcbiAgICovXG4gIGdldEJvb2ttYXJrOiBmdW5jdGlvbihib29rbWFyaywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgaWQgPSB0aGlzLmJvb2ttYXJrc1tib29rbWFya107XG4gICAgaWYgKGlkKSB7XG4gICAgICB0aGlzLmdldEJ5SWQodGhpcy5ib29rbWFya3NbYm9va21hcmtdLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKG5ldyBFcnJvcihcIkVycm9yIHJldHJpZXZpbmcgYm9va21hcmtlZCBpZFwiKSk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIFVSTCB0byBkaXNwbGF5IGEgZ2l2ZW4gcHJldmlld1xuICAgKiBAcGFyYW0ge3N0cmluZ30gdG9rZW4gYXMgcmVjZWl2ZWQgZnJvbSBQcmlzbWljIHNlcnZlciB0byBpZGVudGlmeSB0aGUgY29udGVudCB0byBwcmV2aWV3XG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlciB0aGUgbGluayByZXNvbHZlciB0byBidWlsZCBVUkwgZm9yIHlvdXIgc2l0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZGVmYXVsdFVybCB0aGUgVVJMIHRvIGRlZmF1bHQgdG8gcmV0dXJuIGlmIHRoZSBwcmV2aWV3IGRvZXNuJ3QgY29ycmVzcG9uZCB0byBhIGRvY3VtZW50XG4gICAqICAgICAgICAgICAgICAgICh1c3VhbGx5IHRoZSBob21lIHBhZ2Ugb2YgeW91ciBzaXRlKVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayB0byBnZXQgdGhlIHJlc3VsdGluZyBVUkxcbiAgICovXG4gIHByZXZpZXdTZXNzaW9uOiBmdW5jdGlvbih0b2tlbiwgbGlua1Jlc29sdmVyLCBkZWZhdWx0VXJsLCBjYWxsYmFjaykge1xuICAgIHZhciBhcGkgPSB0aGlzO1xuICAgIHZhciBQcmVkaWNhdGVzID0gUHJlZGljYXRlcztcbiAgICB0aGlzLnJlcXVlc3RIYW5kbGVyKHRva2VuLCBmdW5jdGlvbiAoZXJyLCByZXN1bHQsIHhocikge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIsIGRlZmF1bHRVcmwsIHhocik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBtYWluRG9jdW1lbnRJZCA9IHJlc3VsdC5tYWluRG9jdW1lbnQ7XG4gICAgICAgIGlmICghbWFpbkRvY3VtZW50SWQpIHtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKS5xdWVyeShQcmVkaWNhdGVzLmF0KFwiZG9jdW1lbnQuaWRcIiwgbWFpbkRvY3VtZW50SWQpKS5yZWYodG9rZW4pLnN1Ym1pdChmdW5jdGlvbihlcnIsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBpZiAocmVzcG9uc2UucmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGxpbmtSZXNvbHZlcihyZXNwb25zZS5yZXN1bHRzWzBdKSwgeGhyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWxsYmFjayhlLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBGZXRjaCBhIFVSTCBjb3JyZXNwb25kaW5nIHRvIGEgcXVlcnksIGFuZCBwYXJzZSB0aGUgcmVzcG9uc2UgYXMgYSBSZXNwb25zZSBvYmplY3RcbiAgICovXG4gIHJlcXVlc3Q6IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2spIHtcbiAgICB2YXIgYXBpID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB1cmwgKyAodGhpcy5hY2Nlc3NUb2tlbiA/ICgnIycgKyB0aGlzLmFjY2Vzc1Rva2VuKSA6ICcnKTtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmFwaUNhY2hlO1xuICAgIGNhY2hlLmdldChjYWNoZUtleSwgZnVuY3Rpb24gKGVyciwgdmFsdWUpIHtcbiAgICAgIGlmIChlcnIgfHwgdmFsdWUpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGFwaS5yZXF1ZXN0SGFuZGxlcih1cmwsIGZ1bmN0aW9uIChlcnIsIGRvY3VtZW50cywgeGhyLCB0dGwpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCwgeGhyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3VsdHMgPSBkb2N1bWVudHMucmVzdWx0cy5tYXAocGFyc2VEb2MpO1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UoXG4gICAgICAgICAgZG9jdW1lbnRzLnBhZ2UsXG4gICAgICAgICAgZG9jdW1lbnRzLnJlc3VsdHNfcGVyX3BhZ2UsXG4gICAgICAgICAgZG9jdW1lbnRzLnJlc3VsdHNfc2l6ZSxcbiAgICAgICAgICBkb2N1bWVudHMudG90YWxfcmVzdWx0c19zaXplLFxuICAgICAgICAgIGRvY3VtZW50cy50b3RhbF9wYWdlcyxcbiAgICAgICAgICBkb2N1bWVudHMubmV4dF9wYWdlLFxuICAgICAgICAgIGRvY3VtZW50cy5wcmV2X3BhZ2UsXG4gICAgICAgICAgcmVzdWx0cyB8fCBbXSk7XG4gICAgICAgIGlmICh0dGwpIHtcbiAgICAgICAgICBjYWNoZS5zZXQoY2FjaGVLZXksIHJlc3BvbnNlLCB0dGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIHN1Ym1pdHRhYmxlIFJFU1RmdWwgZm9ybSBhcyBkZXNjcmliZWQgb24gdGhlIEFQSSBlbmRwb2ludCAoYXMgcGVyIFJFU1RmdWwgc3RhbmRhcmRzKVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBGb3JtKG5hbWUsIGZpZWxkcywgZm9ybV9tZXRob2QsIHJlbCwgZW5jdHlwZSwgYWN0aW9uKSB7XG4gIHRoaXMubmFtZSA9IG5hbWU7XG4gIHRoaXMuZmllbGRzID0gZmllbGRzO1xuICB0aGlzLmZvcm1fbWV0aG9kID0gZm9ybV9tZXRob2Q7XG4gIHRoaXMucmVsID0gcmVsO1xuICB0aGlzLmVuY3R5cGUgPSBlbmN0eXBlO1xuICB0aGlzLmFjdGlvbiA9IGFjdGlvbjtcbn1cblxuRm9ybS5wcm90b3R5cGUgPSB7fTtcblxuLyoqXG4gKiBQYXJzZSBqc29uIGFzIGEgZG9jdW1lbnRcbiAqXG4gKiBAcmV0dXJucyB7RG9jdW1lbnR9XG4gKi9cbnZhciBwYXJzZURvYyA9IGZ1bmN0aW9uKGpzb24pIHtcbiAgdmFyIGZyYWdtZW50cyA9IHt9O1xuICBmb3IodmFyIGZpZWxkIGluIGpzb24uZGF0YVtqc29uLnR5cGVdKSB7XG4gICAgZnJhZ21lbnRzW2pzb24udHlwZSArICcuJyArIGZpZWxkXSA9IGpzb24uZGF0YVtqc29uLnR5cGVdW2ZpZWxkXTtcbiAgfVxuXG4gIHZhciBzbHVncyA9IFtdO1xuICBpZiAoanNvbi5zbHVncyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBqc29uLnNsdWdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzbHVncy5wdXNoKGRlY29kZVVSSUNvbXBvbmVudChqc29uLnNsdWdzW2ldKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBEb2N1bWVudChcbiAgICBqc29uLmlkLFxuICAgIGpzb24udWlkIHx8IG51bGwsXG4gICAganNvbi50eXBlLFxuICAgIGpzb24uaHJlZixcbiAgICBqc29uLnRhZ3MsXG4gICAgc2x1Z3MsXG4gICAgZnJhZ21lbnRzXG4gICk7XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgU2VhcmNoRm9ybSBvYmplY3QuIFRvIGNyZWF0ZSBTZWFyY2hGb3JtIG9iamVjdHMgdGhhdCBhcmUgYWxsb3dlZCBpbiB0aGUgQVBJLCBwbGVhc2UgdXNlIHRoZSBBUEkuZm9ybSgpIG1ldGhvZC5cbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIFNlYXJjaEZvcm1cbiAqL1xuZnVuY3Rpb24gU2VhcmNoRm9ybShhcGksIGZvcm0sIGRhdGEpIHtcbiAgdGhpcy5hcGkgPSBhcGk7XG4gIHRoaXMuZm9ybSA9IGZvcm07XG4gIHRoaXMuZGF0YSA9IGRhdGEgfHwge307XG5cbiAgZm9yKHZhciBmaWVsZCBpbiBmb3JtLmZpZWxkcykge1xuICAgIGlmKGZvcm0uZmllbGRzW2ZpZWxkXVsnZGVmYXVsdCddKSB7XG4gICAgICB0aGlzLmRhdGFbZmllbGRdID0gW2Zvcm0uZmllbGRzW2ZpZWxkXVsnZGVmYXVsdCddXTtcbiAgICB9XG4gIH1cbn1cblxuU2VhcmNoRm9ybS5wcm90b3R5cGUgPSB7XG5cbiAgLyoqXG4gICAqIFNldCBhbiBBUEkgY2FsbCBwYXJhbWV0ZXIuIFRoaXMgd2lsbCBvbmx5IHdvcmsgaWYgZmllbGQgaXMgYSB2YWxpZCBmaWVsZCBvZiB0aGVcbiAgICogUkVTVGZ1bCBmb3JtIGluIHRoZSBmaXJzdCBwbGFjZSAoYXMgZGVzY3JpYmVkIGluIHRoZSAvYXBpIGRvY3VtZW50KTsgb3RoZXJ3aXNlLFxuICAgKiBhbiBcIlVua25vd24gZmllbGRcIiBlcnJvciBpcyB0aHJvd24uXG4gICAqIFBsZWFzZSBwcmVmZXIgdXNpbmcgZGVkaWNhdGVkIG1ldGhvZHMgbGlrZSBxdWVyeSgpLCBvcmRlcmluZ3MoKSwgLi4uXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZCAtIFRoZSBuYW1lIG9mIHRoZSBmaWVsZCB0byBzZXRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gVGhlIHZhbHVlIHRoYXQgZ2V0cyBhc3NpZ25lZFxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIHNldDogZnVuY3Rpb24oZmllbGQsIHZhbHVlKSB7XG4gICAgdmFyIGZpZWxkRGVzYyA9IHRoaXMuZm9ybS5maWVsZHNbZmllbGRdO1xuICAgIGlmKCFmaWVsZERlc2MpIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gZmllbGQgXCIgKyBmaWVsZCk7XG4gICAgdmFyIHZhbHVlcz0gdGhpcy5kYXRhW2ZpZWxkXSB8fCBbXTtcbiAgICBpZih2YWx1ZSA9PT0gJycgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gd2UgbXVzdCBjb21wYXJlIHZhbHVlIHRvIG51bGwgYmVjYXVzZSB3ZSB3YW50IHRvIGFsbG93IDBcbiAgICAgIHZhbHVlID0gbnVsbDtcbiAgICB9XG4gICAgaWYoZmllbGREZXNjLm11bHRpcGxlKSB7XG4gICAgICBpZiAodmFsdWUpIHZhbHVlcy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWVzID0gdmFsdWUgJiYgW3ZhbHVlXTtcbiAgICB9XG4gICAgdGhpcy5kYXRhW2ZpZWxkXSA9IHZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyBhIHJlZiB0byBxdWVyeSBvbiBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIGEgbWFuZGF0b3J5XG4gICAqIG1ldGhvZCB0byBjYWxsIGJlZm9yZSBjYWxsaW5nIHN1Ym1pdCgpLCBhbmQgYXBpLmZvcm0oJ2V2ZXJ5dGhpbmcnKS5zdWJtaXQoKVxuICAgKiB3aWxsIG5vdCB3b3JrLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlZn0gcmVmIC0gVGhlIFJlZiBvYmplY3QgZGVmaW5pbmcgdGhlIHJlZiB0byBxdWVyeVxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIHJlZjogZnVuY3Rpb24ocmVmKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KFwicmVmXCIsIHJlZik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNldHMgYSBwcmVkaWNhdGUtYmFzZWQgcXVlcnkgZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyB3aGVyZSB5b3VcbiAgICogcGFzdGUgd2hhdCB5b3UgY29tcG9zZSBpbiB5b3VyIHByaXNtaWMuaW8gQVBJIGJyb3dzZXIuXG4gICAqXG4gICAqIEBleGFtcGxlIGZvcm0ucXVlcnkoUHJpc21pYy5QcmVkaWNhdGVzLmF0KFwiZG9jdW1lbnQuaWRcIiwgXCJmb29iYXJcIikpXG4gICAqIEBwYXJhbSB7c3RyaW5nfC4uLmFycmF5fSBxdWVyeSAtIEVpdGhlciBhIHF1ZXJ5IGFzIGEgc3RyaW5nLCBvciBhcyBtYW55IHByZWRpY2F0ZXMgYXMgeW91IHdhbnQuIFNlZSBQcmlzbWljLlByZWRpY2F0ZXMuXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgaWYgKHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiB0aGlzLnNldChcInFcIiwgcXVlcnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJlZGljYXRlcztcbiAgICAgIGlmIChxdWVyeS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkgJiYgcXVlcnkubGVuZ3RoID4gMCAmJiBxdWVyeVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgcHJlZGljYXRlcyA9IHF1ZXJ5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJlZGljYXRlcyA9IFtdLnNsaWNlLmFwcGx5KGFyZ3VtZW50cyk7IC8vIENvbnZlcnQgdG8gYSByZWFsIEpTIGFycmF5XG4gICAgICB9XG4gICAgICB2YXIgc3RyaW5nUXVlcmllcyA9IFtdO1xuICAgICAgcHJlZGljYXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmVkaWNhdGUpIHtcbiAgICAgICAgdmFyIGZpcnN0QXJnID0gKHByZWRpY2F0ZVsxXS5pbmRleE9mKFwibXkuXCIpID09PSAwIHx8IHByZWRpY2F0ZVsxXS5pbmRleE9mKFwiZG9jdW1lbnRcIikgPT09IDApID8gcHJlZGljYXRlWzFdXG4gICAgICAgICAgICAgIDogJ1wiJyArIHByZWRpY2F0ZVsxXSArICdcIic7XG4gICAgICAgIHN0cmluZ1F1ZXJpZXMucHVzaChcIls6ZCA9IFwiICsgcHJlZGljYXRlWzBdICsgXCIoXCIgKyBmaXJzdEFyZyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAocHJlZGljYXRlLmxlbmd0aCA+IDIgPyBcIiwgXCIgOiBcIlwiKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVkaWNhdGUuc2xpY2UoMikubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHAgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1wiJyArIHAgKyAnXCInO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiW1wiICsgcC5tYXAoZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdcIicgKyBlICsgJ1wiJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJywnKSArIFwiXVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmdldFRpbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICB9KSgpICsgXCIpXVwiKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMucXVlcnkoXCJbXCIgKyBzdHJpbmdRdWVyaWVzLmpvaW4oXCJcIikgKyBcIl1cIik7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIGEgcGFnZSBzaXplIHRvIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYW4gb3B0aW9uYWwgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBwYWdlIHNpemVcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBwYWdlU2l6ZTogZnVuY3Rpb24oc2l6ZSkge1xuICAgIHJldHVybiB0aGlzLnNldChcInBhZ2VTaXplXCIsIHNpemUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXN0cmljdCB0aGUgcmVzdWx0cyBkb2N1bWVudCB0byB0aGUgc3BlY2lmaWVkIGZpZWxkc1xuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ3xhcnJheX0gZmllbGRzIC0gVGhlIGxpc3Qgb2YgZmllbGRzLCBhcnJheSBvciBjb21tYSBzZXBhcmF0ZWQgc3RyaW5nXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgZmV0Y2g6IGZ1bmN0aW9uKGZpZWxkcykge1xuICAgIGlmIChmaWVsZHMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgZmllbGRzID0gZmllbGRzLmpvaW4oXCIsXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXQoXCJmZXRjaFwiLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJbmNsdWRlIHRoZSByZXF1ZXN0ZWQgZmllbGRzIGluIHRoZSBEb2N1bWVudExpbmsgaW5zdGFuY2VzIGluIHRoZSByZXN1bHRcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8YXJyYXl9IGZpZWxkcyAtIFRoZSBsaXN0IG9mIGZpZWxkcywgYXJyYXkgb3IgY29tbWEgc2VwYXJhdGVkIHN0cmluZ1xuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIGZldGNoTGlua3M6IGZ1bmN0aW9uKGZpZWxkcykge1xuICAgIGlmIChmaWVsZHMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgZmllbGRzID0gZmllbGRzLmpvaW4oXCIsXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXQoXCJmZXRjaExpbmtzXCIsIGZpZWxkcyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBhZ2UgbnVtYmVyIHRvIHF1ZXJ5IGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYW4gb3B0aW9uYWwgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gcCAtIFRoZSBwYWdlIG51bWJlclxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIHBhZ2U6IGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gdGhpcy5zZXQoXCJwYWdlXCIsIHApO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBvcmRlcmluZ3MgdG8gcXVlcnkgZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyBhbiBvcHRpb25hbCBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSB7YXJyYXl9IG9yZGVyaW5ncyAtIEFycmF5IG9mIHN0cmluZzogbGlzdCBvZiBmaWVsZHMsIG9wdGlvbmFsbHkgZm9sbG93ZWQgYnkgc3BhY2UgYW5kIGRlc2MuIEV4YW1wbGU6IFsnbXkucHJvZHVjdC5wcmljZSBkZXNjJywgJ215LnByb2R1Y3QuZGF0ZSddXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgb3JkZXJpbmdzOiBmdW5jdGlvbihvcmRlcmluZ3MpIHtcbiAgICBpZiAodHlwZW9mIG9yZGVyaW5ncyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICAgIHJldHVybiB0aGlzLnNldChcIm9yZGVyaW5nc1wiLCBvcmRlcmluZ3MpO1xuICAgIH0gZWxzZSBpZiAoIW9yZGVyaW5ncykge1xuICAgICAgLy8gTm9vcFxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vcm1hbCB1c2FnZVxuICAgICAgcmV0dXJuIHRoaXMuc2V0KFwib3JkZXJpbmdzXCIsIFwiW1wiICsgb3JkZXJpbmdzLmpvaW4oXCIsXCIpICsgXCJdXCIpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogU3VibWl0cyB0aGUgcXVlcnksIGFuZCBjYWxscyB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIHF1ZXJ5IHdhcyBtYWRlLFxuICAgKiB0byB3aGljaCB5b3UgbWF5IHBhc3MgdGhyZWUgcGFyYW1ldGVyczogYSBwb3RlbnRpYWwgZXJyb3IgKG51bGwgaWYgbm8gcHJvYmxlbSksXG4gICAqIGEgUmVzcG9uc2Ugb2JqZWN0IChjb250YWluaW5nIGFsbCB0aGUgcGFnaW5hdGlvbiBzcGVjaWZpY3MgKyB0aGUgYXJyYXkgb2YgRG9jcyksXG4gICAqIGFuZCB0aGUgWE1MSHR0cFJlcXVlc3RcbiAgICovXG4gIHN1Ym1pdDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgdXJsID0gdGhpcy5mb3JtLmFjdGlvbjtcblxuICAgIGlmICh0aGlzLmRhdGEpIHtcbiAgICAgIHZhciBzZXAgPSAodXJsLmluZGV4T2YoJz8nKSA+IC0xID8gJyYnIDogJz8nKTtcbiAgICAgIGZvcih2YXIga2V5IGluIHRoaXMuZGF0YSkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB2YXIgdmFsdWVzID0gdGhpcy5kYXRhW2tleV07XG4gICAgICAgICAgaWYgKHZhbHVlcykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdXJsICs9IHNlcCArIGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZXNbaV0pO1xuICAgICAgICAgICAgICBzZXAgPSAnJic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5hcGkucmVxdWVzdCh1cmwsIGNhbGxiYWNrKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyB0aGUgcmVzcG9uc2Ugb2YgYSBTZWFyY2hGb3JtIHF1ZXJ5IGFzIHJldHVybmVkIGJ5IHRoZSBBUEkuXG4gKiBJdCBpbmNsdWRlcyBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSB1c2VmdWwgZm9yIHBhZ2luYXRpb24gKHBhZ2UsIHRvdGFsX3BhZ2VzLCB0b3RhbF9yZXN1bHRzX3NpemUsIC4uLiksXG4gKiBhcyB3ZWxsIGFzIHRoZSBmaWVsZCBcInJlc3VsdHNcIiwgd2hpY2ggaXMgYW4gYXJyYXkgb2Yge0BsaW5rIERvY3VtZW50fSBvYmplY3RzLCB0aGUgZG9jdW1lbnRzIHRoZW1zZWx2ZXMuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKi9cbmZ1bmN0aW9uIFJlc3BvbnNlKHBhZ2UsIHJlc3VsdHNfcGVyX3BhZ2UsIHJlc3VsdHNfc2l6ZSwgdG90YWxfcmVzdWx0c19zaXplLCB0b3RhbF9wYWdlcywgbmV4dF9wYWdlLCBwcmV2X3BhZ2UsIHJlc3VsdHMpIHtcbiAgLyoqXG4gICAqIFRoZSBjdXJyZW50IHBhZ2VcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMucGFnZSA9IHBhZ2U7XG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIHJlc3VsdHMgcGVyIHBhZ2VcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMucmVzdWx0c19wZXJfcGFnZSA9IHJlc3VsdHNfcGVyX3BhZ2U7XG4gIC8qKlxuICAgKiBUaGUgc2l6ZSBvZiB0aGUgY3VycmVudCBwYWdlXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0aGlzLnJlc3VsdHNfc2l6ZSA9IHJlc3VsdHNfc2l6ZTtcbiAgLyoqXG4gICAqIFRoZSB0b3RhbCBzaXplIG9mIHJlc3VsdHMgYWNyb3NzIGFsbCBwYWdlc1xuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdGhpcy50b3RhbF9yZXN1bHRzX3NpemUgPSB0b3RhbF9yZXN1bHRzX3NpemU7XG4gIC8qKlxuICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIHBhZ2VzXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0aGlzLnRvdGFsX3BhZ2VzID0gdG90YWxfcGFnZXM7XG4gIC8qKlxuICAgKiBUaGUgVVJMIG9mIHRoZSBuZXh0IHBhZ2UgaW4gdGhlIEFQSVxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5uZXh0X3BhZ2UgPSBuZXh0X3BhZ2U7XG4gIC8qKlxuICAgKiBUaGUgVVJMIG9mIHRoZSBwcmV2aW91cyBwYWdlIGluIHRoZSBBUElcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMucHJldl9wYWdlID0gcHJldl9wYWdlO1xuICAvKipcbiAgICogQXJyYXkgb2Yge0BsaW5rIERvY3VtZW50fSBmb3IgdGhlIGN1cnJlbnQgcGFnZVxuICAgKiBAdHlwZSB7QXJyYXl9XG4gICAqL1xuICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xufVxuXG4vKipcbiAqIEVtYm9kaWVzIGEgcHJpc21pYy5pbyByZWYgKGEgcGFzdCBvciBmdXR1cmUgcG9pbnQgaW4gdGltZSB5b3UgY2FuIHF1ZXJ5KVxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKi9cbmZ1bmN0aW9uIFJlZihyZWYsIGxhYmVsLCBpc01hc3Rlciwgc2NoZWR1bGVkQXQsIGlkKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBJRCBvZiB0aGUgcmVmXG4gICAqL1xuICB0aGlzLnJlZiA9IHJlZjtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxhYmVsIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gaXMgdHJ1ZSBpZiB0aGUgcmVmIGlzIHRoZSBtYXN0ZXIgcmVmXG4gICAqL1xuICB0aGlzLmlzTWFzdGVyID0gaXNNYXN0ZXI7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBzY2hlZHVsZWQgZGF0ZSBvZiB0aGUgcmVmXG4gICAqL1xuICB0aGlzLnNjaGVkdWxlZEF0ID0gc2NoZWR1bGVkQXQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBuYW1lIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMuaWQgPSBpZDtcbn1cblJlZi5wcm90b3R5cGUgPSB7fTtcblxuZnVuY3Rpb24gZ2xvYmFsQ2FjaGUoKSB7XG4gIHZhciBnO1xuICBpZiAodHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0Jykge1xuICAgIGcgPSBnbG9iYWw7IC8vIE5vZGVKU1xuICB9IGVsc2Uge1xuICAgIGcgPSB3aW5kb3c7IC8vIGJyb3dzZXJcbiAgfVxuICBpZiAoIWcucHJpc21pY0NhY2hlKSB7XG4gICAgZy5wcmlzbWljQ2FjaGUgPSBuZXcgQXBpQ2FjaGUoKTtcbiAgfVxuICByZXR1cm4gZy5wcmlzbWljQ2FjaGU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBleHBlcmltZW50Q29va2llOiBcImlvLnByaXNtaWMuZXhwZXJpbWVudFwiLFxuICBwcmV2aWV3Q29va2llOiBcImlvLnByaXNtaWMucHJldmlld1wiLFxuICBBcGk6IEFwaSxcbiAgRXhwZXJpbWVudHM6IEV4cGVyaW1lbnRzLFxuICBQcmVkaWNhdGVzOiBQcmVkaWNhdGVzLFxuICBGcmFnbWVudHM6IEZyYWdtZW50cyxcbiAgQXBpQ2FjaGU6IEFwaUNhY2hlLFxuICBnZXRBcGk6IGdldEFwaSxcbiAgcGFyc2VEb2M6IHBhcnNlRG9jXG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJy4vcG9seWZpbGwnKTtcblxud2luZG93LlByaXNtaWMgPSByZXF1aXJlKCcuL2FwaScpO1xuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIExSVUNhY2hlID0gcmVxdWlyZSgnLi9scnUnKTtcblxuLyoqXG4gKiBBcGkgY2FjaGVcbiAqL1xuZnVuY3Rpb24gQXBpQ2FjaGUobGltaXQpIHtcbiAgdGhpcy5scnUgPSBuZXcgTFJVQ2FjaGUobGltaXQpO1xufVxuXG5BcGlDYWNoZS5wcm90b3R5cGUgPSB7XG5cbiAgZ2V0OiBmdW5jdGlvbihrZXksIGNiKSB7XG4gICAgdmFyIG1heWJlRW50cnkgPSB0aGlzLmxydS5nZXQoa2V5KTtcbiAgICBpZihtYXliZUVudHJ5ICYmICF0aGlzLmlzRXhwaXJlZChrZXkpKSB7XG4gICAgICByZXR1cm4gY2IobnVsbCwgbWF5YmVFbnRyeS5kYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGNiKCk7XG4gIH0sXG5cbiAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlLCB0dGwsIGNiKSB7XG4gICAgdGhpcy5scnUucmVtb3ZlKGtleSk7XG4gICAgdGhpcy5scnUucHV0KGtleSwge1xuICAgICAgZGF0YTogdmFsdWUsXG4gICAgICBleHBpcmVkSW46IHR0bCA/IChEYXRlLm5vdygpICsgKHR0bCAqIDEwMDApKSA6IDBcbiAgICB9KTtcblxuICAgIHJldHVybiBjYigpO1xuICB9LFxuXG4gIGlzRXhwaXJlZDogZnVuY3Rpb24oa2V5KSB7XG4gICAgdmFyIGVudHJ5ID0gdGhpcy5scnUuZ2V0KGtleSk7XG4gICAgaWYoZW50cnkpIHtcbiAgICAgIHJldHVybiBlbnRyeS5leHBpcmVkSW4gIT09IDAgJiYgZW50cnkuZXhwaXJlZEluIDwgRGF0ZS5ub3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSxcblxuICByZW1vdmU6IGZ1bmN0aW9uKGtleSwgY2IpIHtcbiAgICB0aGlzLmxydS5yZW1vdmUoa2V5KTtcbiAgICByZXR1cm4gY2IoKTtcbiAgfSxcblxuICBjbGVhcjogZnVuY3Rpb24oY2IpIHtcbiAgICB0aGlzLmxydS5yZW1vdmVBbGwoKTtcbiAgICByZXR1cm4gY2IoKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcGlDYWNoZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEZ1bmN0aW9ucyB0byBhY2Nlc3MgZnJhZ21lbnRzOiBzdXBlcmNsYXNzIGZvciBEb2N1bWVudCBhbmQgRG9jIChmcm9tIEdyb3VwKSwgbm90IHN1cHBvc2VkIHRvIGJlIGNyZWF0ZWQgZGlyZWN0bHlcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBXaXRoRnJhZ21lbnRzKCkge31cblxuV2l0aEZyYWdtZW50cy5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBHZXRzIHRoZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QuIFNpbmNlIHlvdSBtb3N0IGxpa2VseSBrbm93IHRoZSB0eXBlXG4gICAqIG9mIHRoaXMgZnJhZ21lbnQsIGl0IGlzIGFkdmlzZWQgdGhhdCB5b3UgdXNlIGEgZGVkaWNhdGVkIG1ldGhvZCwgbGlrZSBnZXQgU3RydWN0dXJlZFRleHQoKSBvciBnZXREYXRlKCksXG4gICAqIGZvciBpbnN0YW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmF1dGhvclwiXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIEphdmFTY3JpcHQgRnJhZ21lbnQgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBmcmFncyA9IHRoaXMuX2dldEZyYWdtZW50cyhuYW1lKTtcbiAgICByZXR1cm4gZnJhZ3MubGVuZ3RoID8gZnJhZ3NbMF0gOiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gYXJyYXkgb2YgYWxsIHRoZSBmcmFnbWVudHMgaW4gY2FzZSB0aGV5IGFyZSBtdWx0aXBsZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbXVsdGlwbGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmF1dGhvclwiXG4gICAqIEByZXR1cm5zIHthcnJheX0gLSBBbiBhcnJheSBvZiBlYWNoIEphdmFTY3JpcHQgZnJhZ21lbnQgb2JqZWN0IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRBbGw6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RnJhZ21lbnRzKG5hbWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBpbWFnZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0SW1hZ2UoJ2Jsb2ctcG9zdC5waG90bycpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmcmFnbWVudCAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QucGhvdG9cIlxuICAgKiBAcmV0dXJucyB7SW1hZ2VFbH0gLSBUaGUgSW1hZ2Ugb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldEltYWdlOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBpbWcgPSB0aGlzLmdldChmcmFnbWVudCk7XG4gICAgaWYgKGltZyBpbnN0YW5jZW9mIEZyYWdtZW50cy5JbWFnZSkge1xuICAgICAgcmV0dXJuIGltZztcbiAgICB9XG4gICAgaWYgKGltZyBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgLy8gZmluZCBmaXJzdCBpbWFnZSBpbiBzdC5cbiAgICAgIHJldHVybiBpbWc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8vIFVzZWZ1bCBmb3Igb2Jzb2xldGUgbXVsdGlwbGVzXG4gIGdldEFsbEltYWdlczogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgaW1hZ2VzID0gdGhpcy5nZXRBbGwoZnJhZ21lbnQpO1xuXG4gICAgcmV0dXJuIGltYWdlcy5tYXAoZnVuY3Rpb24gKGltYWdlKSB7XG4gICAgICBpZiAoaW1hZ2UgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgICAgcmV0dXJuIGltYWdlO1xuICAgICAgfVxuICAgICAgaWYgKGltYWdlIGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBkb25lLlwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50cyA9IHRoaXMuZnJhZ21lbnRzO1xuXG4gICAgdmFyIGZpcnN0SW1hZ2UgPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihpbWFnZSwga2V5KSB7XG4gICAgICBpZiAoaW1hZ2UpIHtcbiAgICAgICAgcmV0dXJuIGltYWdlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgICAgICByZXR1cm4gZWxlbWVudDtcblxuICAgICAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gICAgcmV0dXJuIGZpcnN0SW1hZ2U7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RUaXRsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50cyA9IHRoaXMuZnJhZ21lbnRzO1xuXG4gICAgdmFyIGZpcnN0VGl0bGUgPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihzdCwga2V5KSB7XG4gICAgICBpZiAoc3QpIHtcbiAgICAgICAgcmV0dXJuIHN0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RUaXRsZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRUaXRsZSgpO1xuICAgICAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gICAgcmV0dXJuIGZpcnN0VGl0bGU7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmZyYWdtZW50cztcblxuICAgIHZhciBmaXJzdFBhcmFncmFwaCA9IE9iamVjdC5rZXlzKGZyYWdtZW50cykucmVkdWNlKGZ1bmN0aW9uKHN0LCBrZXkpIHtcbiAgICAgIGlmIChzdCkge1xuICAgICAgICByZXR1cm4gc3Q7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZWxlbWVudCA9IGZyYWdtZW50c1trZXldO1xuICAgICAgICBpZih0eXBlb2YgZWxlbWVudC5nZXRGaXJzdFBhcmFncmFwaCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGgoKTtcbiAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICAgIHJldHVybiBmaXJzdFBhcmFncmFwaDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgdmlldyB3aXRoaW4gdGhlIGltYWdlIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRJbWFnZVZpZXcoJ2Jsb2ctcG9zdC5waG90bycsICdsYXJnZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LnBob3RvXCJcbiAgICogQHJldHVybnMge0ltYWdlVmlld30gdmlldyAtIFRoZSBWaWV3IG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAqL1xuICBnZXRJbWFnZVZpZXc6IGZ1bmN0aW9uKG5hbWUsIHZpZXcpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRWaWV3KHZpZXcpO1xuICAgIH1cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIGZvcih2YXIgaT0wOyBpPGZyYWdtZW50LmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihmcmFnbWVudC5ibG9ja3NbaV0udHlwZSA9PSAnaW1hZ2UnKSB7XG4gICAgICAgICAgcmV0dXJuIGZyYWdtZW50LmJsb2Nrc1tpXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvLyBVc2VmdWwgZm9yIG9ic29sZXRlIG11bHRpcGxlc1xuICBnZXRBbGxJbWFnZVZpZXdzOiBmdW5jdGlvbihuYW1lLCB2aWV3KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsSW1hZ2VzKG5hbWUpLm1hcChmdW5jdGlvbiAoaW1hZ2UpIHtcbiAgICAgIHJldHVybiBpbWFnZS5nZXRWaWV3KHZpZXcpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSB0aW1lc3RhbXAgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldERhdGUoJ2Jsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGUnKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QucHVibGljYXRpb25kYXRlXCJcbiAgICogQHJldHVybnMge0RhdGV9IC0gVGhlIERhdGUgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldFRpbWVzdGFtcDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlRpbWVzdGFtcCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgZGF0ZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0RGF0ZSgnYmxvZy1wb3N0LnB1YmxpY2F0aW9uZGF0ZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGVcIlxuICAgKiBAcmV0dXJucyB7RGF0ZX0gLSBUaGUgRGF0ZSBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgKi9cbiAgZ2V0RGF0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkRhdGUpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgYSBib29sZWFuIHZhbHVlIG9mIHRoZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogVGhpcyB3b3JrcyBncmVhdCB3aXRoIGEgU2VsZWN0IGZyYWdtZW50LiBUaGUgU2VsZWN0IHZhbHVlcyB0aGF0IGFyZSBjb25zaWRlcmVkIHRydWUgYXJlIChsb3dlcmNhc2VkIGJlZm9yZSBtYXRjaGluZyk6ICd5ZXMnLCAnb24nLCBhbmQgJ3RydWUnLlxuICAgKlxuICAgKiBAZXhhbXBsZSBpZihkb2N1bWVudC5nZXRCb29sZWFuKCdibG9nLXBvc3QuZW5hYmxlQ29tbWVudHMnKSkgeyAuLi4gfVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuZW5hYmxlQ29tbWVudHNcIlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUaGUgYm9vbGVhbiB2YWx1ZSBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGdldEJvb2xlYW46IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICByZXR1cm4gZnJhZ21lbnQudmFsdWUgJiYgKGZyYWdtZW50LnZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ3llcycgfHwgZnJhZ21lbnQudmFsdWUudG9Mb3dlckNhc2UoKSA9PSAnb24nIHx8IGZyYWdtZW50LnZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ3RydWUnKTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgdGV4dCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogVGhlIG1ldGhvZCB3b3JrcyB3aXRoIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50cywgVGV4dCBmcmFnbWVudHMsIE51bWJlciBmcmFnbWVudHMsIFNlbGVjdCBmcmFnbWVudHMgYW5kIENvbG9yIGZyYWdtZW50cy5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0VGV4dCgnYmxvZy1wb3N0LmxhYmVsJykuYXNIdG1sKGxpbmtSZXNvbHZlcikuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5sYWJlbFwiXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhZnRlciAtIGEgc3VmZml4IHRoYXQgd2lsbCBiZSBhcHBlbmRlZCB0byB0aGUgdmFsdWVcbiAgICogQHJldHVybnMge29iamVjdH0gLSBlaXRoZXIgU3RydWN0dXJlZFRleHQsIG9yIFRleHQsIG9yIE51bWJlciwgb3IgU2VsZWN0LCBvciBDb2xvci5cbiAgICovXG4gIGdldFRleHQ6IGZ1bmN0aW9uKG5hbWUsIGFmdGVyKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5ibG9ja3MubWFwKGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgICAgIGlmKGJsb2NrLnRleHQpIHtcbiAgICAgICAgICByZXR1cm4gYmxvY2sudGV4dCArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgICB9XG4gICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICB9XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuVGV4dCkge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLk51bWJlcikge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlNlbGVjdCkge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkNvbG9yKSB7XG4gICAgICBpZihmcmFnbWVudC52YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWUgKyAoYWZ0ZXIgPyBhZnRlciA6ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRTdHJ1Y3R1cmVkVGV4dCgnYmxvZy1wb3N0LmJvZHknKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYm9keVwiXG4gICAqIEByZXR1cm5zIHtTdHJ1Y3R1cmVkVGV4dH0gLSBUaGUgU3RydWN0dXJlZFRleHQgZnJhZ21lbnQgdG8gbWFuaXB1bGF0ZS5cbiAgICovXG4gIGdldFN0cnVjdHVyZWRUZXh0OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiByZXF1aXJlKCcuL2ZyYWdtZW50cycpLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBMaW5rIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRMaW5rKCdibG9nLXBvc3QubGluaycpLnVybChyZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxpbmtcIlxuICAgKiBAcmV0dXJucyB7V2ViTGlua3xEb2N1bWVudExpbmt8SW1hZ2VMaW5rfSAtIFRoZSBMaW5rIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRMaW5rOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuV2ViTGluayB8fFxuICAgICAgICBmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmsgfHxcbiAgICAgICAgZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2VMaW5rKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBOdW1iZXIgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldE51bWJlcigncHJvZHVjdC5wcmljZScpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcInByb2R1Y3QucHJpY2VcIlxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIFRoZSBudW1iZXIgdmFsdWUgb2YgdGhlIGZyYWdtZW50LlxuICAgKi9cbiAgZ2V0TnVtYmVyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuTnVtYmVyKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBDb2xvciBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0Q29sb3IoJ3Byb2R1Y3QuY29sb3InKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmNvbG9yXCJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgc3RyaW5nIHZhbHVlIG9mIHRoZSBDb2xvciBmcmFnbWVudC5cbiAgICovXG4gIGdldENvbG9yOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuQ29sb3IpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqIEdldHMgdGhlIEdlb1BvaW50IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRHZW9Qb2ludCgnYmxvZy1wb3N0LmxvY2F0aW9uJykuYXNIdG1sKGxpbmtSZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxvY2F0aW9uXCJcbiAgICogQHJldHVybnMge0dlb1BvaW50fSAtIFRoZSBHZW9Qb2ludCBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgKi9cbiAgZ2V0R2VvUG9pbnQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkdlb1BvaW50KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBHcm91cCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0R3JvdXAoJ3Byb2R1Y3QuZ2FsbGVyeScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmdhbGxlcnlcIlxuICAgKiBAcmV0dXJucyB7R3JvdXB9IC0gVGhlIEdyb3VwIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRHcm91cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5Hcm91cCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogU2hvcnRjdXQgdG8gZ2V0IHRoZSBIVE1MIG91dHB1dCBvZiB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgZG9jdW1lbnQuXG4gICAqIFRoaXMgaXMgdGhlIHNhbWUgYXMgd3JpdGluZyBkb2N1bWVudC5nZXQoZnJhZ21lbnQpLmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYm9keVwiXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlclxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBIVE1MIG91dHB1dFxuICAgKi9cbiAgZ2V0SHRtbDogZnVuY3Rpb24obmFtZSwgbGlua1Jlc29sdmVyKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb2xkIGN0eCBhcmd1bWVudFxuICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYoZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNIdG1sKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuYXNIdG1sKGxpbmtSZXNvbHZlcik7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm1zIHRoZSB3aG9sZSBkb2N1bWVudCBhcyBhbiBIVE1MIG91dHB1dC4gRWFjaCBmcmFnbWVudCBpcyBzZXBhcmF0ZWQgYnkgYSAmbHQ7c2VjdGlvbiZndDsgdGFnLFxuICAgKiB3aXRoIHRoZSBhdHRyaWJ1dGUgZGF0YS1maWVsZD1cIm5hbWVvZmZyYWdtZW50XCJcbiAgICogTm90ZSB0aGF0IG1vc3Qgb2YgdGhlIHRpbWUgeW91IHdpbGwgbm90IHVzZSB0aGlzIG1ldGhvZCwgYnV0IHJlYWQgZnJhZ21lbnQgaW5kZXBlbmRlbnRseSBhbmQgZ2VuZXJhdGVcbiAgICogSFRNTCBvdXRwdXQgZm9yIHtAbGluayBTdHJ1Y3R1cmVkVGV4dH0gZnJhZ21lbnQgd2l0aCB0aGF0IGNsYXNzJyBhc0h0bWwgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgSFRNTCBvdXRwdXRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb2xkIGN0eCBhcmd1bWVudFxuICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHZhciBodG1scyA9IFtdO1xuICAgIGZvcih2YXIgZmllbGQgaW4gdGhpcy5mcmFnbWVudHMpIHtcbiAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KGZpZWxkKTtcbiAgICAgIGh0bWxzLnB1c2goZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNIdG1sID8gJzxzZWN0aW9uIGRhdGEtZmllbGQ9XCInICsgZmllbGQgKyAnXCI+JyArIGZyYWdtZW50LmFzSHRtbChsaW5rUmVzb2x2ZXIpICsgJzwvc2VjdGlvbj4nIDogJycpO1xuICAgIH1cbiAgICByZXR1cm4gaHRtbHMuam9pbignJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBkb2N1bWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb24obGlua1Jlc29sdmVyKSkge1xuICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBvbGQgY3R4IGFyZ3VtZW50XG4gICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgbGlua1Jlc29sdmVyID0gZnVuY3Rpb24oZG9jLCBpc0Jyb2tlbikge1xuICAgICAgICByZXR1cm4gY3R4LmxpbmtSZXNvbHZlcihjdHgsIGRvYywgaXNCcm9rZW4pO1xuICAgICAgfTtcbiAgICB9XG4gICAgdmFyIHRleHRzID0gW107XG4gICAgZm9yKHZhciBmaWVsZCBpbiB0aGlzLmZyYWdtZW50cykge1xuICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQoZmllbGQpO1xuICAgICAgdGV4dHMucHVzaChmcmFnbWVudCAmJiBmcmFnbWVudC5hc1RleHQgPyBmcmFnbWVudC5hc1RleHQobGlua1Jlc29sdmVyKSA6ICcnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRzLmpvaW4oJycpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBMaW5rZWQgZG9jdW1lbnRzLCBhcyBhbiBhcnJheSBvZiB7QGxpbmsgRG9jdW1lbnRMaW5rfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBsaW5rZWREb2N1bWVudHM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpLCBqLCBsaW5rO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICBmb3IgKHZhciBmaWVsZCBpbiB0aGlzLmRhdGEpIHtcbiAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KGZpZWxkKTtcbiAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmspIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZnJhZ21lbnQpO1xuICAgICAgfVxuICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBmcmFnbWVudC5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgYmxvY2sgPSBmcmFnbWVudC5ibG9ja3NbaV07XG4gICAgICAgICAgaWYgKGJsb2NrLnR5cGUgPT0gXCJpbWFnZVwiICYmIGJsb2NrLmxpbmtUbykge1xuICAgICAgICAgICAgbGluayA9IEZyYWdtZW50cy5pbml0RmllbGQoYmxvY2subGlua1RvKTtcbiAgICAgICAgICAgIGlmIChsaW5rIGluc3RhbmNlb2YgRnJhZ21lbnRzLkRvY3VtZW50TGluaykge1xuICAgICAgICAgICAgICByZXN1bHQucHVzaChsaW5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIHNwYW5zID0gYmxvY2suc3BhbnMgfHwgW107XG4gICAgICAgICAgZm9yIChqID0gMDsgaiA8IHNwYW5zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICB2YXIgc3BhbiA9IHNwYW5zW2pdO1xuICAgICAgICAgICAgaWYgKHNwYW4udHlwZSA9PSBcImh5cGVybGlua1wiKSB7XG4gICAgICAgICAgICAgIGxpbmsgPSBGcmFnbWVudHMuaW5pdEZpZWxkKHNwYW4uZGF0YSk7XG4gICAgICAgICAgICAgIGlmIChsaW5rIGluc3RhbmNlb2YgRnJhZ21lbnRzLkRvY3VtZW50TGluaykge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxpbmspO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuR3JvdXApIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGZyYWdtZW50LnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LmNvbmNhdChmcmFnbWVudC52YWx1ZVtpXS5saW5rZWREb2N1bWVudHMoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICAvKipcbiAgICogQW4gYXJyYXkgb2YgdGhlIGZyYWdtZW50cyB3aXRoIHRoZSBnaXZlbiBmcmFnbWVudCBuYW1lLlxuICAgKiBUaGUgYXJyYXkgaXMgb2Z0ZW4gYSBzaW5nbGUtZWxlbWVudCBhcnJheSwgZXhwZWN0IHdoZW4gdGhlIGZyYWdtZW50IGlzIGEgbXVsdGlwbGUgZnJhZ21lbnQuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0RnJhZ21lbnRzOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYgKCF0aGlzLmZyYWdtZW50cyB8fCAhdGhpcy5mcmFnbWVudHNbbmFtZV0pIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmZyYWdtZW50c1tuYW1lXSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmZyYWdtZW50c1tuYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFt0aGlzLmZyYWdtZW50c1tuYW1lXV07XG4gICAgfVxuXG4gIH1cblxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGRvY3VtZW50IGFzIHJldHVybmVkIGJ5IHRoZSBBUEkuXG4gKiBNb3N0IHVzZWZ1bCBmaWVsZHM6IGlkLCB0eXBlLCB0YWdzLCBzbHVnLCBzbHVnc1xuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRG9jXG4gKi9cbmZ1bmN0aW9uIERvY3VtZW50KGlkLCB1aWQsIHR5cGUsIGhyZWYsIHRhZ3MsIHNsdWdzLCBkYXRhKSB7XG4gIC8qKlxuICAgKiBUaGUgSUQgb2YgdGhlIGRvY3VtZW50XG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0aGlzLmlkID0gaWQ7XG4gIC8qKlxuICAgKiBUaGUgVXNlciBJRCBvZiB0aGUgZG9jdW1lbnQsIGEgaHVtYW4gcmVhZGFibGUgaWRcbiAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgKi9cbiAgdGhpcy51aWQgPSB1aWQ7XG4gIC8qKlxuICAgKiBUaGUgdHlwZSBvZiB0aGUgZG9jdW1lbnQsIGNvcnJlc3BvbmRzIHRvIGEgZG9jdW1lbnQgbWFzayBkZWZpbmVkIGluIHRoZSByZXBvc2l0b3J5XG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0aGlzLnR5cGUgPSB0eXBlO1xuICAvKipcbiAgICogVGhlIFVSTCBvZiB0aGUgZG9jdW1lbnQgaW4gdGhlIEFQSVxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5ocmVmID0gaHJlZjtcbiAgLyoqXG4gICAqIFRoZSB0YWdzIG9mIHRoZSBkb2N1bWVudFxuICAgKiBAdHlwZSB7YXJyYXl9XG4gICAqL1xuICB0aGlzLnRhZ3MgPSB0YWdzO1xuICAvKipcbiAgICogVGhlIGN1cnJlbnQgc2x1ZyBvZiB0aGUgZG9jdW1lbnQsIFwiLVwiIGlmIG5vbmUgd2FzIHByb3ZpZGVkXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0aGlzLnNsdWcgPSBzbHVncyA/IHNsdWdzWzBdIDogXCItXCI7XG4gIC8qKlxuICAgKiBBbGwgdGhlIHNsdWdzIHRoYXQgd2VyZSBldmVyIHVzZWQgYnkgdGhpcyBkb2N1bWVudCAoaW5jbHVkaW5nIHRoZSBjdXJyZW50IG9uZSwgYXQgdGhlIGhlYWQpXG4gICAqIEB0eXBlIHthcnJheX1cbiAgICovXG4gIHRoaXMuc2x1Z3MgPSBzbHVncztcbiAgLyoqXG4gICAqIFRoZSBvcmlnaW5hbCBKU09OIGRhdGEgZnJvbSB0aGUgQVBJXG4gICAqL1xuICB0aGlzLmRhdGEgPSBkYXRhO1xuICAvKipcbiAgICogRnJhZ21lbnRzLCBjb252ZXJ0ZWQgdG8gYnVzaW5lc3Mgb2JqZWN0c1xuICAgKi9cbiAgdGhpcy5mcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpLnBhcnNlRnJhZ21lbnRzKGRhdGEpO1xufVxuXG5Eb2N1bWVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFdpdGhGcmFnbWVudHMucHJvdG90eXBlKTtcblxuLyoqXG4gKiBHZXRzIHRoZSBTbGljZVpvbmUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gKlxuICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0U2xpY2Vab25lKCdwcm9kdWN0LmdhbGxlcnknKS5hc0h0bWwobGlua1Jlc29sdmVyKS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmdhbGxlcnlcIlxuICogQHJldHVybnMge0dyb3VwfSAtIFRoZSBTbGljZVpvbmUgZnJhZ21lbnQgdG8gbWFuaXB1bGF0ZS5cbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmdldFNsaWNlWm9uZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5TbGljZVpvbmUpIHtcbiAgICByZXR1cm4gZnJhZ21lbnQ7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5mdW5jdGlvbiBHcm91cERvYyhkYXRhKSB7XG4gIC8qKlxuICAgKiBUaGUgb3JpZ2luYWwgSlNPTiBkYXRhIGZyb20gdGhlIEFQSVxuICAgKi9cbiAgdGhpcy5kYXRhID0gZGF0YTtcbiAgLyoqXG4gICAqIEZyYWdtZW50cywgY29udmVydGVkIHRvIGJ1c2luZXNzIG9iamVjdHNcbiAgICovXG4gIHRoaXMuZnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5wYXJzZUZyYWdtZW50cyhkYXRhKTtcbn1cblxuR3JvdXBEb2MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbi8vIC0tIFByaXZhdGUgaGVscGVyc1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGYpIHtcbiAgdmFyIGdldFR5cGUgPSB7fTtcbiAgcmV0dXJuIGYgJiYgZ2V0VHlwZS50b1N0cmluZy5jYWxsKGYpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgV2l0aEZyYWdtZW50czogV2l0aEZyYWdtZW50cyxcbiAgRG9jdW1lbnQ6IERvY3VtZW50LFxuICBHcm91cERvYzogR3JvdXBEb2Ncbn07XG4iLCJcblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBvZiBleHBlcmltZW50cyBjdXJyZW50bHkgYXZhaWxhYmxlXG4gKiBAcGFyYW0gZGF0YSB0aGUganNvbiBkYXRhIHJlY2VpdmVkIGZyb20gdGhlIFByaXNtaWMgQVBJXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRXhwZXJpbWVudHMoZGF0YSkge1xuICB2YXIgZHJhZnRzID0gW107XG4gIHZhciBydW5uaW5nID0gW107XG4gIGlmIChkYXRhKSB7XG4gICAgZGF0YS5kcmFmdHMgJiYgZGF0YS5kcmFmdHMuZm9yRWFjaChmdW5jdGlvbiAoZXhwKSB7XG4gICAgICBkcmFmdHMucHVzaChuZXcgRXhwZXJpbWVudChleHApKTtcbiAgICB9KTtcbiAgICBkYXRhLnJ1bm5pbmcgJiYgZGF0YS5ydW5uaW5nLmZvckVhY2goZnVuY3Rpb24gKGV4cCkge1xuICAgICAgcnVubmluZy5wdXNoKG5ldyBFeHBlcmltZW50KGV4cCkpO1xuICAgIH0pO1xuICB9XG4gIHRoaXMuZHJhZnRzID0gZHJhZnRzO1xuICB0aGlzLnJ1bm5pbmcgPSBydW5uaW5nO1xufVxuXG5FeHBlcmltZW50cy5wcm90b3R5cGUuY3VycmVudCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5ydW5uaW5nLmxlbmd0aCA+IDAgPyB0aGlzLnJ1bm5pbmdbMF0gOiBudWxsO1xufTtcblxuLyoqXG4gKiBHZXQgdGhlIGN1cnJlbnQgcnVubmluZyBleHBlcmltZW50IHZhcmlhdGlvbiByZWYgZnJvbSBhIGNvb2tpZSBjb250ZW50XG4gKi9cbkV4cGVyaW1lbnRzLnByb3RvdHlwZS5yZWZGcm9tQ29va2llID0gZnVuY3Rpb24oY29va2llKSB7XG4gIGlmICghY29va2llIHx8IGNvb2tpZS50cmltKCkgPT09IFwiXCIpIHJldHVybiBudWxsO1xuICB2YXIgc3BsaXR0ZWQgPSBjb29raWUudHJpbSgpLnNwbGl0KFwiIFwiKTtcbiAgaWYgKHNwbGl0dGVkLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuICB2YXIgZXhwSWQgPSBzcGxpdHRlZFswXTtcbiAgdmFyIHZhckluZGV4ID0gcGFyc2VJbnQoc3BsaXR0ZWRbMV0sIDEwKTtcbiAgdmFyIGV4cCA9IHRoaXMucnVubmluZy5maWx0ZXIoZnVuY3Rpb24oZXhwKSB7XG4gICAgcmV0dXJuIGV4cC5nb29nbGVJZCgpID09IGV4cElkICYmIGV4cC52YXJpYXRpb25zLmxlbmd0aCA+IHZhckluZGV4O1xuICB9KVswXTtcbiAgcmV0dXJuIGV4cCA/IGV4cC52YXJpYXRpb25zW3ZhckluZGV4XS5yZWYoKSA6IG51bGw7XG59O1xuXG5mdW5jdGlvbiBFeHBlcmltZW50KGRhdGEpIHtcbiAgdGhpcy5kYXRhID0gZGF0YTtcbiAgdmFyIHZhcmlhdGlvbnMgPSBbXTtcbiAgZGF0YS52YXJpYXRpb25zICYmIGRhdGEudmFyaWF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtcbiAgICB2YXJpYXRpb25zLnB1c2gobmV3IFZhcmlhdGlvbih2KSk7XG4gIH0pO1xuICB0aGlzLnZhcmlhdGlvbnMgPSB2YXJpYXRpb25zO1xufVxuXG5FeHBlcmltZW50LnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLmlkO1xufTtcblxuRXhwZXJpbWVudC5wcm90b3R5cGUuZ29vZ2xlSWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5nb29nbGVJZDtcbn07XG5cbkV4cGVyaW1lbnQucHJvdG90eXBlLm5hbWUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5uYW1lO1xufTtcblxuZnVuY3Rpb24gVmFyaWF0aW9uKGRhdGEpIHtcbiAgdGhpcy5kYXRhID0gZGF0YTtcbn1cblxuVmFyaWF0aW9uLnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLmlkO1xufTtcblxuVmFyaWF0aW9uLnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5yZWY7XG59O1xuXG5WYXJpYXRpb24ucHJvdG90eXBlLmxhYmVsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEubGFiZWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgRXhwZXJpbWVudHM6IEV4cGVyaW1lbnRzLFxuICBWYXJpYXRpb246IFZhcmlhdGlvblxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgZG9jdW1lbnRzID0gcmVxdWlyZSgnLi9kb2N1bWVudHMnKTtcbnZhciBXaXRoRnJhZ21lbnRzID0gZG9jdW1lbnRzLldpdGhGcmFnbWVudHMsXG4gICAgR3JvdXBEb2MgPSBkb2N1bWVudHMuR3JvdXBEb2M7XG5cbi8qKlxuICogRW1ib2RpZXMgYSBwbGFpbiB0ZXh0IGZyYWdtZW50IChiZXdhcmU6IG5vdCBhIHN0cnVjdHVyZWQgdGV4dClcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpUZXh0XG4gKi9cbmZ1bmN0aW9uIFRleHQoZGF0YSkge1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cblRleHQucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfVxufTtcbi8qKlxuICogRW1ib2RpZXMgYSBkb2N1bWVudCBsaW5rIGZyYWdtZW50IChhIGxpbmsgdGhhdCBpcyBpbnRlcm5hbCB0byBhIHByaXNtaWMuaW8gcmVwb3NpdG9yeSlcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpEb2N1bWVudExpbmtcbiAqL1xuZnVuY3Rpb24gRG9jdW1lbnRMaW5rKGRhdGEpIHtcbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG5cbiAgdGhpcy5kb2N1bWVudCA9IGRhdGEuZG9jdW1lbnQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgaWRcbiAgICovXG4gIHRoaXMuaWQgPSBkYXRhLmRvY3VtZW50LmlkO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHVpZFxuICAgKi9cbiAgdGhpcy51aWQgPSBkYXRhLmRvY3VtZW50LnVpZDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCB0YWdzXG4gICAqL1xuICB0aGlzLnRhZ3MgPSBkYXRhLmRvY3VtZW50LnRhZ3M7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgc2x1Z1xuICAgKi9cbiAgdGhpcy5zbHVnID0gZGF0YS5kb2N1bWVudC5zbHVnO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHR5cGVcbiAgICovXG4gIHRoaXMudHlwZSA9IGRhdGEuZG9jdW1lbnQudHlwZTtcblxuICB2YXIgZnJhZ21lbnRzRGF0YSA9IHt9O1xuICBpZiAoZGF0YS5kb2N1bWVudC5kYXRhKSB7XG4gICAgZm9yICh2YXIgZmllbGQgaW4gZGF0YS5kb2N1bWVudC5kYXRhW2RhdGEuZG9jdW1lbnQudHlwZV0pIHtcbiAgICAgIGZyYWdtZW50c0RhdGFbZGF0YS5kb2N1bWVudC50eXBlICsgJy4nICsgZmllbGRdID0gZGF0YS5kb2N1bWVudC5kYXRhW2RhdGEuZG9jdW1lbnQudHlwZV1bZmllbGRdO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgZnJhZ21lbnQgbGlzdCwgaWYgdGhlIGZldGNoTGlua3MgcGFyYW1ldGVyIHdhcyB1c2VkIGluIGF0IHF1ZXJ5IHRpbWVcbiAgICovXG4gIHRoaXMuZnJhZ21lbnRzID0gcGFyc2VGcmFnbWVudHMoZnJhZ21lbnRzRGF0YSk7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRydWUgaWYgdGhlIGxpbmsgaXMgYnJva2VuLCBmYWxzZSBvdGhlcndpc2VcbiAgICovXG4gIHRoaXMuaXNCcm9rZW4gPSBkYXRhLmlzQnJva2VuO1xufVxuXG5Eb2N1bWVudExpbmsucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbi8qKlxuICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gKlxuICogQHBhcmFtcyB7b2JqZWN0fSBjdHggLSBtYW5kYXRvcnkgY3R4IG9iamVjdCwgd2l0aCBhIHVzZWFibGUgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gKi9cbkRvY3VtZW50TGluay5wcm90b3R5cGUuYXNIdG1sID0gZnVuY3Rpb24gKGN0eCkge1xuICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybChjdHgpK1wiXFxcIj5cIit0aGlzLnVybChjdHgpK1wiPC9hPlwiO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBVUkwgb2YgdGhlIGRvY3VtZW50IGxpbmsuXG4gKlxuICogQHBhcmFtcyB7b2JqZWN0fSBsaW5rUmVzb2x2ZXIgLSBtYW5kYXRvcnkgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICovXG5Eb2N1bWVudExpbmsucHJvdG90eXBlLnVybCA9IGZ1bmN0aW9uIChsaW5rUmVzb2x2ZXIpIHtcbiAgcmV0dXJuIGxpbmtSZXNvbHZlcih0aGlzLCB0aGlzLmlzQnJva2VuKTtcbn07XG5cbi8qKlxuICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAqL1xuRG9jdW1lbnRMaW5rLnByb3RvdHlwZS5hc1RleHQgPSBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgcmV0dXJuIHRoaXMudXJsKGxpbmtSZXNvbHZlcik7XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgd2ViIGxpbmsgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpXZWJMaW5rXG4gKi9cbmZ1bmN0aW9uIFdlYkxpbmsoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgSlNPTiBvYmplY3QgZXhhY3RseSBhcyBpcyByZXR1cm5lZCBpbiB0aGUgXCJkYXRhXCIgZmllbGQgb2YgdGhlIEpTT04gcmVzcG9uc2VzIChzZWUgQVBJIGRvY3VtZW50YXRpb246IGh0dHBzOi8vZGV2ZWxvcGVycy5wcmlzbWljLmlvL2RvY3VtZW50YXRpb24vVWpCZThiR0lKM0VLdGdCWi9hcGktZG9jdW1lbnRhdGlvbiNqc29uLXJlc3BvbnNlcylcbiAgICovXG4gIHRoaXMudmFsdWUgPSBkYXRhO1xufVxuV2ViTGluay5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIj5cIit0aGlzLnVybCgpK1wiPC9hPlwiO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBsaW5rLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICAgKi9cbiAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS51cmw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy51cmwoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGZpbGUgbGluayBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOkZpbGVMaW5rXG4gKi9cbmZ1bmN0aW9uIEZpbGVMaW5rKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbkZpbGVMaW5rLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjxhIGhyZWY9XFxcIlwiK3RoaXMudXJsKCkrXCJcXFwiPlwiK3RoaXMudmFsdWUuZmlsZS5uYW1lK1wiPC9hPlwiO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBsaW5rLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICAgKi9cbiAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5maWxlLnVybDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnVybCgpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGltYWdlIGxpbmsgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpJbWFnZUxpbmtcbiAqL1xuZnVuY3Rpb24gSW1hZ2VMaW5rKGRhdGEpIHtcbiAgLyoqXG4gICAqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbkltYWdlTGluay5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIj48aW1nIHNyYz1cXFwiXCIrdGhpcy51cmwoKStcIlxcXCIgYWx0PVxcXCJcIiArIHRoaXMuYWx0ICsgXCJcXFwiPjwvYT5cIjtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIFVSTCBvZiB0aGUgbGluay5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSB0aGUgcHJvcGVyIFVSTCB0byB1c2VcbiAgICovXG4gIHVybDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUuaW1hZ2UudXJsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBzZWxlY3QgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpTZWxlY3RcbiAqL1xuZnVuY3Rpb24gU2VsZWN0KGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIHRleHQgdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cblNlbGVjdC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgY29sb3IgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpDb2xvclxuICovXG5mdW5jdGlvbiBDb2xvcihkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB0ZXh0IHZhbHVlIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5Db2xvci5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgZ2VvcG9pbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpHZW9Qb2ludFxuICovXG5mdW5jdGlvbiBHZW9Qb2ludChkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsYXRpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAqL1xuICB0aGlzLmxhdGl0dWRlID0gZGF0YS5sYXRpdHVkZTtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxvbmdpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAqL1xuICB0aGlzLmxvbmdpdHVkZSA9IGRhdGEubG9uZ2l0dWRlO1xufVxuXG5HZW9Qb2ludC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJzxkaXYgY2xhc3M9XCJnZW9wb2ludFwiPjxzcGFuIGNsYXNzPVwibGF0aXR1ZGVcIj4nICsgdGhpcy5sYXRpdHVkZSArICc8L3NwYW4+PHNwYW4gY2xhc3M9XCJsb25naXR1ZGVcIj4nICsgdGhpcy5sb25naXR1ZGUgKyAnPC9zcGFuPjwvZGl2Pic7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJygnICsgdGhpcy5sYXRpdHVkZSArIFwiLFwiICsgdGhpcy5sb25naXR1ZGUgKyAnKSc7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBOdW1iZXIgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpOdW1cbiAqL1xuZnVuY3Rpb24gTnVtKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGludGVnZXIgdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbk51bS5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBEYXRlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6RGF0ZVxuICovXG5mdW5jdGlvbiBEYXRlRnJhZ21lbnQoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgRGF0ZSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgKGFzIGEgcmVndWxhciBKUyBEYXRlIG9iamVjdClcbiAgICovXG4gIHRoaXMudmFsdWUgPSBuZXcgRGF0ZShkYXRhKTtcbn1cblxuRGF0ZUZyYWdtZW50LnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjx0aW1lPlwiICsgdGhpcy52YWx1ZSArIFwiPC90aW1lPlwiO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIFRpbWVzdGFtcCBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlRpbWVzdGFtcFxuICovXG5mdW5jdGlvbiBUaW1lc3RhbXAoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgRGF0ZSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgKGFzIGEgcmVndWxhciBKUyBEYXRlIG9iamVjdClcbiAgICovXG4gIC8vIEFkZGluZyBcIjpcIiBpbiB0aGUgbG9jYWxlIGlmIG5lZWRlZCwgc28gSlMgY29uc2lkZXJzIGl0IElTTzg2MDEtY29tcGxpYW50XG4gIHZhciBjb3JyZWN0SXNvODYwMURhdGUgPSAoZGF0YS5sZW5ndGggPT0gMjQpID8gZGF0YS5zdWJzdHJpbmcoMCwgMjIpICsgJzonICsgZGF0YS5zdWJzdHJpbmcoMjIsIDI0KSA6IGRhdGE7XG4gIHRoaXMudmFsdWUgPSBuZXcgRGF0ZShjb3JyZWN0SXNvODYwMURhdGUpO1xufVxuXG5UaW1lc3RhbXAucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHRpbWU+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3RpbWU+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS50b1N0cmluZygpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGVtYmVkIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6RW1iZWRcbiAqL1xuZnVuY3Rpb24gRW1iZWQoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgSlNPTiBvYmplY3QgZXhhY3RseSBhcyBpcyByZXR1cm5lZCBpbiB0aGUgXCJkYXRhXCIgZmllbGQgb2YgdGhlIEpTT04gcmVzcG9uc2VzIChzZWUgQVBJIGRvY3VtZW50YXRpb246IGh0dHBzOi8vZGV2ZWxvcGVycy5wcmlzbWljLmlvL2RvY3VtZW50YXRpb24vVWpCZThiR0lKM0VLdGdCWi9hcGktZG9jdW1lbnRhdGlvbiNqc29uLXJlc3BvbnNlcylcbiAgICovXG4gIHRoaXMudmFsdWUgPSBkYXRhO1xufVxuXG5FbWJlZC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5vZW1iZWQuaHRtbDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIEltYWdlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6SW1hZ2VFbFxuICovXG5mdW5jdGlvbiBJbWFnZUVsKG1haW4sIHZpZXdzKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBtYWluIEltYWdlVmlldyBmb3IgdGhpcyBpbWFnZVxuICAgKi9cbiAgdGhpcy5tYWluID0gbWFpbjtcblxuXG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB1cmwgb2YgdGhlIG1haW4gSW1hZ2VWaWV3IGZvciB0aGlzIGltYWdlXG4gICAqL1xuICB0aGlzLnVybCA9IG1haW4udXJsO1xuXG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIGFuIGFycmF5IG9mIGFsbCB0aGUgb3RoZXIgSW1hZ2VWaWV3cyBmb3IgdGhpcyBpbWFnZVxuICAgKi9cbiAgdGhpcy52aWV3cyA9IHZpZXdzIHx8IHt9O1xufVxuSW1hZ2VFbC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBHZXRzIHRoZSB2aWV3IG9mIHRoZSBpbWFnZSwgZnJvbSBpdHMgbmFtZVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIHRoZSBuYW1lIG9mIHRoZSB2aWV3IHRvIGdldFxuICAgKiBAcmV0dXJucyB7SW1hZ2VWaWV3fSAtIHRoZSBwcm9wZXIgdmlld1xuICAgKi9cbiAgZ2V0VmlldzogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmIChuYW1lID09PSBcIm1haW5cIikge1xuICAgICAgcmV0dXJuIHRoaXMubWFpbjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMudmlld3NbbmFtZV07XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMubWFpbi5hc0h0bWwoKTtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGltYWdlIHZpZXcgKGFuIGltYWdlIGluIHByaXNtaWMuaW8gY2FuIGJlIGRlZmluZWQgd2l0aCBzZXZlcmFsIGRpZmZlcmVudCB0aHVtYm5haWwgc2l6ZXMsIGVhY2ggc2l6ZSBpcyBjYWxsZWQgYSBcInZpZXdcIilcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpJbWFnZVZpZXdcbiAqL1xuZnVuY3Rpb24gSW1hZ2VWaWV3KHVybCwgd2lkdGgsIGhlaWdodCwgYWx0KSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBVUkwgb2YgdGhlIEltYWdlVmlldyAodXNlYWJsZSBhcyBpdCwgaW4gYSA8aW1nPiB0YWcgaW4gSFRNTCwgZm9yIGluc3RhbmNlKVxuICAgKi9cbiAgdGhpcy51cmwgPSB1cmw7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB3aWR0aCBvZiB0aGUgSW1hZ2VWaWV3XG4gICAqL1xuICB0aGlzLndpZHRoID0gd2lkdGg7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBoZWlnaHQgb2YgdGhlIEltYWdlVmlld1xuICAgKi9cbiAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBhbHQgdGV4dCBmb3IgdGhlIEltYWdlVmlld1xuICAgKi9cbiAgdGhpcy5hbHQgPSBhbHQ7XG59XG5JbWFnZVZpZXcucHJvdG90eXBlID0ge1xuICByYXRpbzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQ7XG4gIH0sXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8aW1nIHNyYz1cXFwiXCIgKyB0aGlzLnVybCArIFwiXFxcIiB3aWR0aD1cXFwiXCIgKyB0aGlzLndpZHRoICsgXCJcXFwiIGhlaWdodD1cXFwiXCIgKyB0aGlzLmhlaWdodCArIFwiXFxcIiBhbHQ9XFxcIlwiICsgdGhpcy5hbHQgKyBcIlxcXCI+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGZyYWdtZW50IG9mIHR5cGUgXCJHcm91cFwiICh3aGljaCBpcyBhIGdyb3VwIG9mIHN1YmZyYWdtZW50cylcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpHcm91cFxuICovXG5mdW5jdGlvbiBHcm91cChkYXRhKSB7XG4gIHRoaXMudmFsdWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy52YWx1ZS5wdXNoKG5ldyBHcm91cERvYyhkYXRhW2ldKSk7XG4gIH1cbn1cbkdyb3VwLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqIEBwYXJhbXMge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXIgLSBsaW5rUmVzb2x2ZXIgZnVuY3Rpb24gKHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgdGhpcylcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIG91dHB1dCArPSB0aGlzLnZhbHVlW2ldLmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9LFxuICAvKipcbiAgICogVHVybnMgdGhlIEdyb3VwIGZyYWdtZW50IGludG8gYW4gYXJyYXkgaW4gb3JkZXIgdG8gYWNjZXNzIGl0cyBpdGVtcyAoZ3JvdXBzIG9mIGZyYWdtZW50cyksXG4gICAqIG9yIHRvIGxvb3AgdGhyb3VnaCB0aGVtLlxuICAgKiBAcGFyYW1zIHtvYmplY3R9IGN0eCAtIG1hbmRhdG9yeSBjdHggb2JqZWN0LCB3aXRoIGEgdXNlYWJsZSBsaW5rUmVzb2x2ZXIgZnVuY3Rpb24gKHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgdGhpcylcbiAgICogQHJldHVybnMge0FycmF5fSAtIHRoZSBhcnJheSBvZiBncm91cHMsIGVhY2ggZ3JvdXAgYmVpbmcgYSBKU09OIG9iamVjdCB3aXRoIHN1YmZyYWdtZW50IG5hbWUgYXMga2V5cywgYW5kIHN1YmZyYWdtZW50IGFzIHZhbHVlc1xuICAgKi9cbiAgdG9BcnJheTogZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc1RleHQobGlua1Jlc29sdmVyKSArICdcXG4nO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9LFxuXG4gIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIGZyYWdtZW50KSB7XG4gICAgICBpZiAoaW1hZ2UpIHJldHVybiBpbWFnZTtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5yZWR1Y2UoZnVuY3Rpb24oc3QsIGZyYWdtZW50KSB7XG4gICAgICBpZiAoc3QpIHJldHVybiBzdDtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0UGFyYWdyYXBoOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50b0FycmF5KCkucmVkdWNlKGZ1bmN0aW9uKHN0LCBmcmFnbWVudCkge1xuICAgICAgaWYgKHN0KSByZXR1cm4gc3Q7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gIH1cbn07XG5cblxuLyoqXG4gKiBFbWJvZGllcyBhIHN0cnVjdHVyZWQgdGV4dCBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlN0cnVjdHVyZWRUZXh0XG4gKi9cbmZ1bmN0aW9uIFN0cnVjdHVyZWRUZXh0KGJsb2Nrcykge1xuXG4gIHRoaXMuYmxvY2tzID0gYmxvY2tzO1xuXG59XG5cblN0cnVjdHVyZWRUZXh0LnByb3RvdHlwZSA9IHtcblxuICAvKipcbiAgICogQHJldHVybnMge29iamVjdH0gdGhlIGZpcnN0IGhlYWRpbmcgYmxvY2sgaW4gdGhlIHRleHRcbiAgICovXG4gIGdldFRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuICAgICAgaWYoYmxvY2sudHlwZS5pbmRleE9mKCdoZWFkaW5nJykgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybnMge29iamVjdH0gdGhlIGZpcnN0IGJsb2NrIG9mIHR5cGUgcGFyYWdyYXBoXG4gICAqL1xuICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuICAgICAgaWYoYmxvY2sudHlwZSA9PSAncGFyYWdyYXBoJykge1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7YXJyYXl9IGFsbCBwYXJhZ3JhcGhzXG4gICAqL1xuICBnZXRQYXJhZ3JhcGhzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGFyYWdyYXBocyA9IFtdO1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmKGJsb2NrLnR5cGUgPT0gJ3BhcmFncmFwaCcpIHtcbiAgICAgICAgcGFyYWdyYXBocy5wdXNoKGJsb2NrKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhcmFncmFwaHM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBudGggcGFyYWdyYXBoXG4gICAqL1xuICBnZXRQYXJhZ3JhcGg6IGZ1bmN0aW9uKG4pIHtcbiAgICByZXR1cm4gdGhpcy5nZXRQYXJhZ3JhcGhzKClbbl07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9XG4gICAqL1xuICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJsb2NrID0gdGhpcy5ibG9ja3NbaV07XG4gICAgICBpZihibG9jay50eXBlID09ICdpbWFnZScpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBJbWFnZVZpZXcoXG4gICAgICAgICAgYmxvY2sudXJsLFxuICAgICAgICAgIGJsb2NrLmRpbWVuc2lvbnMud2lkdGgsXG4gICAgICAgICAgYmxvY2suZGltZW5zaW9ucy5oZWlnaHQsXG4gICAgICAgICAgYmxvY2suYWx0XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyIC0gcGxlYXNlIHJlYWQgcHJpc21pYy5pbyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCBsaW5rIHJlc29sdmVyc1xuICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gaHRtbFNlcmlhbGl6ZXIgb3B0aW9uYWwgSFRNTCBzZXJpYWxpemVyIHRvIGN1c3RvbWl6ZSB0aGUgb3V0cHV0XG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyLCBodG1sU2VyaWFsaXplcikge1xuICAgIHZhciBibG9ja0dyb3VwcyA9IFtdLFxuICAgICAgICBibG9ja0dyb3VwLFxuICAgICAgICBibG9jayxcbiAgICAgICAgaHRtbCA9IFtdO1xuICAgIGlmICghaXNGdW5jdGlvbihsaW5rUmVzb2x2ZXIpKSB7XG4gICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgIHZhciBjdHggPSBsaW5rUmVzb2x2ZXI7XG4gICAgICBsaW5rUmVzb2x2ZXIgPSBmdW5jdGlvbihkb2MsIGlzQnJva2VuKSB7XG4gICAgICAgIHJldHVybiBjdHgubGlua1Jlc29sdmVyKGN0eCwgZG9jLCBpc0Jyb2tlbik7XG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmJsb2NrcykpIHtcblxuICAgICAgZm9yKHZhciBpPTA7IGkgPCB0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuXG4gICAgICAgIC8vIFJlc29sdmUgaW1hZ2UgbGlua3NcbiAgICAgICAgaWYgKGJsb2NrLnR5cGUgPT0gXCJpbWFnZVwiICYmIGJsb2NrLmxpbmtUbykge1xuICAgICAgICAgIHZhciBsaW5rID0gaW5pdEZpZWxkKGJsb2NrLmxpbmtUbyk7XG4gICAgICAgICAgYmxvY2subGlua1VybCA9IGxpbmsudXJsKGxpbmtSZXNvbHZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYmxvY2sudHlwZSAhPT0gXCJsaXN0LWl0ZW1cIiAmJiBibG9jay50eXBlICE9PSBcIm8tbGlzdC1pdGVtXCIpIHtcbiAgICAgICAgICAvLyBpdCdzIG5vdCBhIHR5cGUgdGhhdCBncm91cHNcbiAgICAgICAgICBibG9ja0dyb3Vwcy5wdXNoKGJsb2NrKTtcbiAgICAgICAgICBibG9ja0dyb3VwID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICghYmxvY2tHcm91cCB8fCBibG9ja0dyb3VwLnR5cGUgIT0gKFwiZ3JvdXAtXCIgKyBibG9jay50eXBlKSkge1xuICAgICAgICAgIC8vIGl0J3MgYSBuZXcgdHlwZSBvciBubyBCbG9ja0dyb3VwIHdhcyBzZXQgc28gZmFyXG4gICAgICAgICAgYmxvY2tHcm91cCA9IHtcbiAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXAtXCIgKyBibG9jay50eXBlLFxuICAgICAgICAgICAgYmxvY2tzOiBbYmxvY2tdXG4gICAgICAgICAgfTtcbiAgICAgICAgICBibG9ja0dyb3Vwcy5wdXNoKGJsb2NrR3JvdXApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGl0J3MgdGhlIHNhbWUgdHlwZSBhcyBiZWZvcmUsIG5vIHRvdWNoaW5nIGJsb2NrR3JvdXBcbiAgICAgICAgICBibG9ja0dyb3VwLmJsb2Nrcy5wdXNoKGJsb2NrKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgYmxvY2tDb250ZW50ID0gZnVuY3Rpb24oYmxvY2spIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBcIlwiO1xuICAgICAgICBpZiAoYmxvY2suYmxvY2tzKSB7XG4gICAgICAgICAgYmxvY2suYmxvY2tzLmZvckVhY2goZnVuY3Rpb24gKGJsb2NrMikge1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQgKyBzZXJpYWxpemUoYmxvY2syLCBibG9ja0NvbnRlbnQoYmxvY2syKSwgaHRtbFNlcmlhbGl6ZXIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRlbnQgPSBpbnNlcnRTcGFucyhibG9jay50ZXh0LCBibG9jay5zcGFucywgbGlua1Jlc29sdmVyLCBodG1sU2VyaWFsaXplcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9O1xuXG4gICAgICBibG9ja0dyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uIChibG9ja0dyb3VwKSB7XG4gICAgICAgIGh0bWwucHVzaChzZXJpYWxpemUoYmxvY2tHcm91cCwgYmxvY2tDb250ZW50KGJsb2NrR3JvdXApLCBodG1sU2VyaWFsaXplcikpO1xuICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICByZXR1cm4gaHRtbC5qb2luKCcnKTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG91dHB1dCA9IFtdO1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmIChibG9jay50ZXh0KSB7XG4gICAgICAgIG91dHB1dC5wdXNoKGJsb2NrLnRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0LmpvaW4oJyAnKTtcbiAgfVxuXG59O1xuXG5mdW5jdGlvbiBodG1sRXNjYXBlKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dCAmJiBpbnB1dC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayB0aGF0IGhhcyBzcGFucywgYW5kIGluc2VydHMgdGhlIHByb3BlciBIVE1MIGNvZGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSB0aGUgb3JpZ2luYWwgdGV4dCBvZiB0aGUgYmxvY2tcbiAqIEBwYXJhbSB7b2JqZWN0fSBzcGFucyAtIHRoZSBzcGFucyBhcyByZXR1cm5lZCBieSB0aGUgQVBJXG4gKiBAcGFyYW0ge29iamVjdH0gbGlua1Jlc29sdmVyIC0gdGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIGxpbmtzIHRoYXQgbWF5IGJlIGluIHRoZSBmcmFnbWVudCAocGxlYXNlIHJlYWQgcHJpc21pYy5pbydzIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBodG1sU2VyaWFsaXplciAtIG9wdGlvbmFsIHNlcmlhbGl6ZXJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIEhUTUwgb3V0cHV0XG4gKi9cbmZ1bmN0aW9uIGluc2VydFNwYW5zKHRleHQsIHNwYW5zLCBsaW5rUmVzb2x2ZXIsIGh0bWxTZXJpYWxpemVyKSB7XG4gIGlmICghc3BhbnMgfHwgIXNwYW5zLmxlbmd0aCkge1xuICAgIHJldHVybiBodG1sRXNjYXBlKHRleHQpO1xuICB9XG5cbiAgdmFyIHRhZ3NTdGFydCA9IHt9O1xuICB2YXIgdGFnc0VuZCA9IHt9O1xuXG4gIHNwYW5zLmZvckVhY2goZnVuY3Rpb24gKHNwYW4pIHtcbiAgICBpZiAoIXRhZ3NTdGFydFtzcGFuLnN0YXJ0XSkgeyB0YWdzU3RhcnRbc3Bhbi5zdGFydF0gPSBbXTsgfVxuICAgIGlmICghdGFnc0VuZFtzcGFuLmVuZF0pIHsgdGFnc0VuZFtzcGFuLmVuZF0gPSBbXTsgfVxuXG4gICAgdGFnc1N0YXJ0W3NwYW4uc3RhcnRdLnB1c2goc3Bhbik7XG4gICAgdGFnc0VuZFtzcGFuLmVuZF0udW5zaGlmdChzcGFuKTtcbiAgfSk7XG5cbiAgdmFyIGM7XG4gIHZhciBodG1sID0gXCJcIjtcbiAgdmFyIHN0YWNrID0gW107XG4gIGZvciAodmFyIHBvcyA9IDAsIGxlbiA9IHRleHQubGVuZ3RoICsgMTsgcG9zIDwgbGVuOyBwb3MrKykgeyAvLyBMb29waW5nIHRvIGxlbmd0aCArIDEgdG8gY2F0Y2ggY2xvc2luZyB0YWdzXG4gICAgaWYgKHRhZ3NFbmRbcG9zXSkge1xuICAgICAgdGFnc0VuZFtwb3NdLmZvckVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBDbG9zZSBhIHRhZ1xuICAgICAgICB2YXIgdGFnID0gc3RhY2sucG9wKCk7XG4gICAgICAgIC8vIENvbnRpbnVlIG9ubHkgaWYgYmxvY2sgY29udGFpbnMgY29udGVudC5cbiAgICAgICAgaWYgKHR5cGVvZiB0YWcgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdmFyIGlubmVySHRtbCA9IHNlcmlhbGl6ZSh0YWcuc3BhbiwgdGFnLnRleHQsIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyBUaGUgdGFnIHdhcyB0b3AgbGV2ZWxcbiAgICAgICAgICAgIGh0bWwgKz0gaW5uZXJIdG1sO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBBZGQgdGhlIGNvbnRlbnQgdG8gdGhlIHBhcmVudCB0YWdcbiAgICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLnRleHQgKz0gaW5uZXJIdG1sO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh0YWdzU3RhcnRbcG9zXSkge1xuICAgICAgLy8gU29ydCBiaWdnZXIgdGFncyBmaXJzdCB0byBlbnN1cmUgdGhlIHJpZ2h0IHRhZyBoaWVyYXJjaHlcbiAgICAgIHRhZ3NTdGFydFtwb3NdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIChiLmVuZCAtIGIuc3RhcnQpIC0gKGEuZW5kIC0gYS5zdGFydCk7XG4gICAgICB9KTtcbiAgICAgIHRhZ3NTdGFydFtwb3NdLmZvckVhY2goZnVuY3Rpb24gKHNwYW4pIHtcbiAgICAgICAgLy8gT3BlbiBhIHRhZ1xuICAgICAgICB2YXIgdXJsID0gbnVsbDtcbiAgICAgICAgaWYgKHNwYW4udHlwZSA9PSBcImh5cGVybGlua1wiKSB7XG4gICAgICAgICAgdmFyIGZyYWdtZW50ID0gaW5pdEZpZWxkKHNwYW4uZGF0YSk7XG4gICAgICAgICAgaWYgKGZyYWdtZW50KSB7XG4gICAgICAgICAgICB1cmwgPSBmcmFnbWVudC51cmwobGlua1Jlc29sdmVyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5lcnJvcikgY29uc29sZS5lcnJvcignSW1wb3NzaWJsZSB0byBjb252ZXJ0IHNwYW4uZGF0YSBhcyBhIEZyYWdtZW50Jywgc3Bhbik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwYW4udXJsID0gdXJsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbHQgPSB7XG4gICAgICAgICAgc3Bhbjogc3BhbixcbiAgICAgICAgICB0ZXh0OiBcIlwiXG4gICAgICAgIH07XG4gICAgICAgIHN0YWNrLnB1c2goZWx0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAocG9zIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgIGMgPSB0ZXh0W3Bvc107XG4gICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRvcC1sZXZlbCB0ZXh0XG4gICAgICAgIGh0bWwgKz0gaHRtbEVzY2FwZShjKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElubmVyIHRleHQgb2YgYSBzcGFuXG4gICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLnRleHQgKz0gaHRtbEVzY2FwZShjKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gaHRtbDtcbn1cblxuLyoqXG4gKiBFbWJvZGllcyBhIFNsaWNlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6U2xpY2VcbiAqL1xuZnVuY3Rpb24gU2xpY2Uoc2xpY2VUeXBlLCBsYWJlbCwgdmFsdWUpIHtcbiAgdGhpcy5zbGljZVR5cGUgPSBzbGljZVR5cGU7XG4gIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5TbGljZS5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uIChsaW5rUmVzb2x2ZXIpIHtcbiAgICB2YXIgY2xhc3NlcyA9IFsnc2xpY2UnXTtcbiAgICBpZiAodGhpcy5sYWJlbCkgY2xhc3Nlcy5wdXNoKHRoaXMubGFiZWwpO1xuICAgIHJldHVybiAnPGRpdiBkYXRhLXNsaWNldHlwZT1cIicgKyB0aGlzLnNsaWNlVHlwZSArICdcIiBjbGFzcz1cIicgKyBjbGFzc2VzLmpvaW4oJyAnKSArICdcIj4nICtcbiAgICAgIHRoaXMudmFsdWUuYXNIdG1sKGxpbmtSZXNvbHZlcikgK1xuICAgICAgJzwvZGl2Pic7XG5cbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLmFzVGV4dCgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGZpcnN0IEltYWdlIGluIHNsaWNlLlxuICAgKiBAcmV0dXJucyB7b2JqZWN0fVxuICAgKi9cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy52YWx1ZTtcbiAgICBpZih0eXBlb2YgZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgIH0gZWxzZSBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBJbWFnZUVsKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfSBlbHNlIHJldHVybiBudWxsO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMudmFsdWU7XG4gICAgaWYodHlwZW9mIGZyYWdtZW50LmdldEZpcnN0VGl0bGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0VGl0bGUoKTtcbiAgICB9IGVsc2UgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRUaXRsZSgpO1xuICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgfSxcblxuICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy52YWx1ZTtcbiAgICBpZih0eXBlb2YgZnJhZ21lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgfSBlbHNlIHJldHVybiBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgU2xpY2Vab25lIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6U2xpY2Vab25lXG4gKi9cbmZ1bmN0aW9uIFNsaWNlWm9uZShkYXRhKSB7XG4gIHRoaXMudmFsdWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHNsaWNlVHlwZSA9IGRhdGFbaV1bJ3NsaWNlX3R5cGUnXTtcbiAgICB2YXIgZnJhZ21lbnQgPSBpbml0RmllbGQoZGF0YVtpXVsndmFsdWUnXSk7XG4gICAgdmFyIGxhYmVsID0gZGF0YVtpXVsnc2xpY2VfbGFiZWwnXSB8fCBudWxsO1xuICAgIGlmIChzbGljZVR5cGUgJiYgZnJhZ21lbnQpIHtcbiAgICAgIHRoaXMudmFsdWUucHVzaChuZXcgU2xpY2Uoc2xpY2VUeXBlLCBsYWJlbCwgZnJhZ21lbnQpKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5zbGljZXMgPSB0aGlzLnZhbHVlO1xufVxuXG5TbGljZVpvbmUucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gICAgdmFyIG91dHB1dCA9IFwiXCI7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc0h0bWwobGlua1Jlc29sdmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgb3V0cHV0ICs9IHRoaXMudmFsdWVbaV0uYXNUZXh0KCkgKyAnXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcblxuICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIHNsaWNlKSB7XG4gICAgICBpZiAoaW1hZ2UpIHJldHVybiBpbWFnZTtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gc2xpY2UuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnJlZHVjZShmdW5jdGlvbih0ZXh0LCBzbGljZSkge1xuICAgICAgaWYgKHRleHQpIHJldHVybiB0ZXh0O1xuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdFRpdGxlKCk7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnJlZHVjZShmdW5jdGlvbihwYXJhZ3JhcGgsIHNsaWNlKSB7XG4gICAgICBpZiAocGFyYWdyYXBoKSByZXR1cm4gcGFyYWdyYXBoO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdFBhcmFncmFwaCgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9XG59O1xuXG4vKipcbiAqIEZyb20gYSBmcmFnbWVudCdzIG5hbWUsIGNhc3RzIGl0IGludG8gdGhlIHByb3BlciBvYmplY3QgdHlwZSAobGlrZSBQcmlzbWljLkZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dClcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkIC0gdGhlIGZyYWdtZW50J3MgbmFtZVxuICogQHJldHVybnMge29iamVjdH0gLSB0aGUgb2JqZWN0IG9mIHRoZSBwcm9wZXIgRnJhZ21lbnRzIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGluaXRGaWVsZChmaWVsZCkge1xuXG4gIHZhciBjbGFzc0ZvclR5cGUgPSB7XG4gICAgXCJDb2xvclwiOiBDb2xvcixcbiAgICBcIk51bWJlclwiOiBOdW0sXG4gICAgXCJEYXRlXCI6IERhdGVGcmFnbWVudCxcbiAgICBcIlRpbWVzdGFtcFwiOiBUaW1lc3RhbXAsXG4gICAgXCJUZXh0XCI6IFRleHQsXG4gICAgXCJFbWJlZFwiOiBFbWJlZCxcbiAgICBcIkdlb1BvaW50XCI6IEdlb1BvaW50LFxuICAgIFwiU2VsZWN0XCI6IFNlbGVjdCxcbiAgICBcIlN0cnVjdHVyZWRUZXh0XCI6IFN0cnVjdHVyZWRUZXh0LFxuICAgIFwiTGluay5kb2N1bWVudFwiOiBEb2N1bWVudExpbmssXG4gICAgXCJMaW5rLndlYlwiOiBXZWJMaW5rLFxuICAgIFwiTGluay5maWxlXCI6IEZpbGVMaW5rLFxuICAgIFwiTGluay5pbWFnZVwiOiBJbWFnZUxpbmssXG4gICAgXCJHcm91cFwiOiBHcm91cCxcbiAgICBcIlNsaWNlWm9uZVwiOiBTbGljZVpvbmVcbiAgfTtcblxuICBpZiAoY2xhc3NGb3JUeXBlW2ZpZWxkLnR5cGVdKSB7XG4gICAgcmV0dXJuIG5ldyBjbGFzc0ZvclR5cGVbZmllbGQudHlwZV0oZmllbGQudmFsdWUpO1xuICB9XG5cbiAgaWYgKGZpZWxkLnR5cGUgPT09IFwiSW1hZ2VcIikge1xuICAgIHZhciBpbWcgPSBmaWVsZC52YWx1ZS5tYWluO1xuICAgIHZhciBvdXRwdXQgPSBuZXcgSW1hZ2VFbChcbiAgICAgIG5ldyBJbWFnZVZpZXcoXG4gICAgICAgIGltZy51cmwsXG4gICAgICAgIGltZy5kaW1lbnNpb25zLndpZHRoLFxuICAgICAgICBpbWcuZGltZW5zaW9ucy5oZWlnaHQsXG4gICAgICAgIGltZy5hbHRcbiAgICAgICksXG4gICAgICB7fVxuICAgICk7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBmaWVsZC52YWx1ZS52aWV3cykge1xuICAgICAgaW1nID0gZmllbGQudmFsdWUudmlld3NbbmFtZV07XG4gICAgICBvdXRwdXQudmlld3NbbmFtZV0gPSBuZXcgSW1hZ2VWaWV3KFxuICAgICAgICBpbWcudXJsLFxuICAgICAgICBpbWcuZGltZW5zaW9ucy53aWR0aCxcbiAgICAgICAgaW1nLmRpbWVuc2lvbnMuaGVpZ2h0LFxuICAgICAgICBpbWcuYWx0XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbiAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5sb2cpIGNvbnNvbGUubG9nKFwiRnJhZ21lbnQgdHlwZSBub3Qgc3VwcG9ydGVkOiBcIiwgZmllbGQudHlwZSk7XG4gIHJldHVybiBudWxsO1xuXG59XG5cbmZ1bmN0aW9uIHBhcnNlRnJhZ21lbnRzKGpzb24pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmb3IgKHZhciBrZXkgaW4ganNvbikge1xuICAgIGlmIChqc29uLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGpzb25ba2V5XSkpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSBqc29uW2tleV0ubWFwKGZ1bmN0aW9uIChmcmFnbWVudCkge1xuICAgICAgICAgIHJldHVybiBpbml0RmllbGQoZnJhZ21lbnQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gaW5pdEZpZWxkKGpzb25ba2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cblxuZnVuY3Rpb24gaXNGdW5jdGlvbihmKSB7XG4gIHZhciBnZXRUeXBlID0ge307XG4gIHJldHVybiBmICYmIGdldFR5cGUudG9TdHJpbmcuY2FsbChmKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplKGVsZW1lbnQsIGNvbnRlbnQsIGh0bWxTZXJpYWxpemVyKSB7XG4gIC8vIFJldHVybiB0aGUgdXNlciBjdXN0b21pemVkIG91dHB1dCAoaWYgYXZhaWxhYmxlKVxuICBpZiAoaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICB2YXIgY3VzdG9tID0gaHRtbFNlcmlhbGl6ZXIoZWxlbWVudCwgY29udGVudCk7XG4gICAgaWYgKGN1c3RvbSkge1xuICAgICAgcmV0dXJuIGN1c3RvbTtcbiAgICB9XG4gIH1cblxuICAvLyBGYWxsIGJhY2sgdG8gdGhlIGRlZmF1bHQgSFRNTCBvdXRwdXRcbiAgdmFyIFRBR19OQU1FUyA9IHtcbiAgICBcImhlYWRpbmcxXCI6IFwiaDFcIixcbiAgICBcImhlYWRpbmcyXCI6IFwiaDJcIixcbiAgICBcImhlYWRpbmczXCI6IFwiaDNcIixcbiAgICBcImhlYWRpbmc0XCI6IFwiaDRcIixcbiAgICBcImhlYWRpbmc1XCI6IFwiaDVcIixcbiAgICBcImhlYWRpbmc2XCI6IFwiaDZcIixcbiAgICBcInBhcmFncmFwaFwiOiBcInBcIixcbiAgICBcInByZWZvcm1hdHRlZFwiOiBcInByZVwiLFxuICAgIFwibGlzdC1pdGVtXCI6IFwibGlcIixcbiAgICBcIm8tbGlzdC1pdGVtXCI6IFwibGlcIixcbiAgICBcImdyb3VwLWxpc3QtaXRlbVwiOiBcInVsXCIsXG4gICAgXCJncm91cC1vLWxpc3QtaXRlbVwiOiBcIm9sXCIsXG4gICAgXCJzdHJvbmdcIjogXCJzdHJvbmdcIixcbiAgICBcImVtXCI6IFwiZW1cIlxuICB9O1xuXG4gIGlmIChUQUdfTkFNRVNbZWxlbWVudC50eXBlXSkge1xuICAgIHZhciBuYW1lID0gVEFHX05BTUVTW2VsZW1lbnQudHlwZV07XG4gICAgdmFyIGNsYXNzQ29kZSA9IGVsZW1lbnQubGFiZWwgPyAoJyBjbGFzcz1cIicgKyBlbGVtZW50LmxhYmVsICsgJ1wiJykgOiAnJztcbiAgICByZXR1cm4gJzwnICsgbmFtZSArIGNsYXNzQ29kZSArICc+JyArIGNvbnRlbnQgKyAnPC8nICsgbmFtZSArICc+JztcbiAgfVxuXG4gIGlmIChlbGVtZW50LnR5cGUgPT0gXCJpbWFnZVwiKSB7XG4gICAgdmFyIGxhYmVsID0gZWxlbWVudC5sYWJlbCA/IChcIiBcIiArIGVsZW1lbnQubGFiZWwpIDogXCJcIjtcbiAgICB2YXIgaW1nVGFnID0gJzxpbWcgc3JjPVwiJyArIGVsZW1lbnQudXJsICsgJ1wiIGFsdD1cIicgKyBlbGVtZW50LmFsdCArICdcIj4nO1xuICAgIHJldHVybiAnPHAgY2xhc3M9XCJibG9jay1pbWcnICsgbGFiZWwgKyAnXCI+JyArXG4gICAgICAoZWxlbWVudC5saW5rVXJsID8gKCc8YSBocmVmPVwiJyArIGVsZW1lbnQubGlua1VybCArICdcIj4nICsgaW1nVGFnICsgJzwvYT4nKSA6IGltZ1RhZykgK1xuICAgICAgJzwvcD4nO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudHlwZSA9PSBcImVtYmVkXCIpIHtcbiAgICByZXR1cm4gJzxkaXYgZGF0YS1vZW1iZWQ9XCInKyBlbGVtZW50LmVtYmVkX3VybCArXG4gICAgICAnXCIgZGF0YS1vZW1iZWQtdHlwZT1cIicrIGVsZW1lbnQudHlwZSArXG4gICAgICAnXCIgZGF0YS1vZW1iZWQtcHJvdmlkZXI9XCInKyBlbGVtZW50LnByb3ZpZGVyX25hbWUgK1xuICAgICAgKGVsZW1lbnQubGFiZWwgPyAoJ1wiIGNsYXNzPVwiJyArIGVsZW1lbnQubGFiZWwpIDogJycpICtcbiAgICAgICdcIj4nICsgZWxlbWVudC5vZW1iZWQuaHRtbCtcIjwvZGl2PlwiO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudHlwZSA9PT0gJ2h5cGVybGluaycpIHtcbiAgICByZXR1cm4gJzxhIGhyZWY9XCInICsgZWxlbWVudC51cmwgKyAnXCI+JyArIGNvbnRlbnQgKyAnPC9hPic7XG4gIH1cblxuICBpZiAoZWxlbWVudC50eXBlID09PSAnbGFiZWwnKSB7XG4gICAgcmV0dXJuICc8c3BhbiBjbGFzcz1cIicgKyBlbGVtZW50LmRhdGEubGFiZWwgKyAnXCI+JyArIGNvbnRlbnQgKyAnPC9zcGFuPic7XG4gIH1cblxuICByZXR1cm4gXCI8IS0tIFdhcm5pbmc6IFwiICsgZWxlbWVudC50eXBlICsgXCIgbm90IGltcGxlbWVudGVkLiBVcGdyYWRlIHRoZSBEZXZlbG9wZXIgS2l0LiAtLT5cIiArIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBFbWJlZDogRW1iZWQsXG4gIEltYWdlOiBJbWFnZUVsLFxuICBJbWFnZVZpZXc6IEltYWdlVmlldyxcbiAgVGV4dDogVGV4dCxcbiAgTnVtYmVyOiBOdW0sXG4gIERhdGU6IERhdGVGcmFnbWVudCxcbiAgVGltZXN0YW1wOiBUaW1lc3RhbXAsXG4gIFNlbGVjdDogU2VsZWN0LFxuICBDb2xvcjogQ29sb3IsXG4gIFN0cnVjdHVyZWRUZXh0OiBTdHJ1Y3R1cmVkVGV4dCxcbiAgV2ViTGluazogV2ViTGluayxcbiAgRG9jdW1lbnRMaW5rOiBEb2N1bWVudExpbmssXG4gIEltYWdlTGluazogSW1hZ2VMaW5rLFxuICBGaWxlTGluazogRmlsZUxpbmssXG4gIEdyb3VwOiBHcm91cCxcbiAgR2VvUG9pbnQ6IEdlb1BvaW50LFxuICBTbGljZTogU2xpY2UsXG4gIFNsaWNlWm9uZTogU2xpY2Vab25lLFxuICBpbml0RmllbGQ6IGluaXRGaWVsZCxcbiAgcGFyc2VGcmFnbWVudHM6IHBhcnNlRnJhZ21lbnRzLFxuICBpbnNlcnRTcGFuczogaW5zZXJ0U3BhbnNcbn07XG4iLCJcbi8qKlxuICogQSBkb3VibHkgbGlua2VkIGxpc3QtYmFzZWQgTGVhc3QgUmVjZW50bHkgVXNlZCAoTFJVKSBjYWNoZS4gV2lsbCBrZWVwIG1vc3RcbiAqIHJlY2VudGx5IHVzZWQgaXRlbXMgd2hpbGUgZGlzY2FyZGluZyBsZWFzdCByZWNlbnRseSB1c2VkIGl0ZW1zIHdoZW4gaXRzIGxpbWl0XG4gKiBpcyByZWFjaGVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVC4gQ29weXJpZ2h0IChjKSAyMDEwIFJhc211cyBBbmRlcnNzb24gPGh0dHA6Ly9odW5jaC5zZS8+XG4gKiBTZWUgUkVBRE1FLm1kIGZvciBkZXRhaWxzLlxuICpcbiAqIElsbHVzdHJhdGlvbiBvZiB0aGUgZGVzaWduOlxuICpcbiAqICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5XG4gKiAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX19cbiAqICAgICAgfCBoZWFkIHwubmV3ZXIgPT4gfCAgICAgIHwubmV3ZXIgPT4gfCAgICAgIHwubmV3ZXIgPT4gfCB0YWlsIHxcbiAqICAgICAgfCAgQSAgIHwgICAgICAgICAgfCAgQiAgIHwgICAgICAgICAgfCAgQyAgIHwgICAgICAgICAgfCAgRCAgIHxcbiAqICAgICAgfF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3xcbiAqXG4gKiAgcmVtb3ZlZCAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIGFkZGVkXG4gKi9cbmZ1bmN0aW9uIExSVUNhY2hlIChsaW1pdCkge1xuICAvLyBDdXJyZW50IHNpemUgb2YgdGhlIGNhY2hlLiAoUmVhZC1vbmx5KS5cbiAgdGhpcy5zaXplID0gMDtcbiAgLy8gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdGhpcyBjYWNoZSBjYW4gaG9sZC5cbiAgdGhpcy5saW1pdCA9IGxpbWl0O1xuICB0aGlzLl9rZXltYXAgPSB7fTtcbn1cblxuLyoqXG4gKiBQdXQgPHZhbHVlPiBpbnRvIHRoZSBjYWNoZSBhc3NvY2lhdGVkIHdpdGggPGtleT4uIFJldHVybnMgdGhlIGVudHJ5IHdoaWNoIHdhc1xuICogcmVtb3ZlZCB0byBtYWtlIHJvb20gZm9yIHRoZSBuZXcgZW50cnkuIE90aGVyd2lzZSB1bmRlZmluZWQgaXMgcmV0dXJuZWRcbiAqIChpLmUuIGlmIHRoZXJlIHdhcyBlbm91Z2ggcm9vbSBhbHJlYWR5KS5cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgdmFyIGVudHJ5ID0ge2tleTprZXksIHZhbHVlOnZhbHVlfTtcbiAgLy8gTm90ZTogTm8gcHJvdGVjdGlvbiBhZ2FpbnMgcmVwbGFjaW5nLCBhbmQgdGh1cyBvcnBoYW4gZW50cmllcy4gQnkgZGVzaWduLlxuICB0aGlzLl9rZXltYXBba2V5XSA9IGVudHJ5O1xuICBpZiAodGhpcy50YWlsKSB7XG4gICAgLy8gbGluayBwcmV2aW91cyB0YWlsIHRvIHRoZSBuZXcgdGFpbCAoZW50cnkpXG4gICAgdGhpcy50YWlsLm5ld2VyID0gZW50cnk7XG4gICAgZW50cnkub2xkZXIgPSB0aGlzLnRhaWw7XG4gIH0gZWxzZSB7XG4gICAgLy8gd2UncmUgZmlyc3QgaW4gLS0geWF5XG4gICAgdGhpcy5oZWFkID0gZW50cnk7XG4gIH1cbiAgLy8gYWRkIG5ldyBlbnRyeSB0byB0aGUgZW5kIG9mIHRoZSBsaW5rZWQgbGlzdCAtLSBpdCdzIG5vdyB0aGUgZnJlc2hlc3QgZW50cnkuXG4gIHRoaXMudGFpbCA9IGVudHJ5O1xuICBpZiAodGhpcy5zaXplID09PSB0aGlzLmxpbWl0KSB7XG4gICAgLy8gd2UgaGl0IHRoZSBsaW1pdCAtLSByZW1vdmUgdGhlIGhlYWRcbiAgICByZXR1cm4gdGhpcy5zaGlmdCgpO1xuICB9IGVsc2Uge1xuICAgIC8vIGluY3JlYXNlIHRoZSBzaXplIGNvdW50ZXJcbiAgICB0aGlzLnNpemUrKztcbiAgfVxufTtcblxuLyoqXG4gKiBQdXJnZSB0aGUgbGVhc3QgcmVjZW50bHkgdXNlZCAob2xkZXN0KSBlbnRyeSBmcm9tIHRoZSBjYWNoZS4gUmV0dXJucyB0aGVcbiAqIHJlbW92ZWQgZW50cnkgb3IgdW5kZWZpbmVkIGlmIHRoZSBjYWNoZSB3YXMgZW1wdHkuXG4gKlxuICogSWYgeW91IG5lZWQgdG8gcGVyZm9ybSBhbnkgZm9ybSBvZiBmaW5hbGl6YXRpb24gb2YgcHVyZ2VkIGl0ZW1zLCB0aGlzIGlzIGFcbiAqIGdvb2QgcGxhY2UgdG8gZG8gaXQuIFNpbXBseSBvdmVycmlkZS9yZXBsYWNlIHRoaXMgZnVuY3Rpb246XG4gKlxuICogICB2YXIgYyA9IG5ldyBMUlVDYWNoZSgxMjMpO1xuICogICBjLnNoaWZ0ID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgdmFyIGVudHJ5ID0gTFJVQ2FjaGUucHJvdG90eXBlLnNoaWZ0LmNhbGwodGhpcyk7XG4gKiAgICAgZG9Tb21ldGhpbmdXaXRoKGVudHJ5KTtcbiAqICAgICByZXR1cm4gZW50cnk7XG4gKiAgIH1cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24oKSB7XG4gIC8vIHRvZG86IGhhbmRsZSBzcGVjaWFsIGNhc2Ugd2hlbiBsaW1pdCA9PSAxXG4gIHZhciBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgaWYgKGVudHJ5KSB7XG4gICAgaWYgKHRoaXMuaGVhZC5uZXdlcikge1xuICAgICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkLm5ld2VyO1xuICAgICAgdGhpcy5oZWFkLm9sZGVyID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhlYWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIFJlbW92ZSBsYXN0IHN0cm9uZyByZWZlcmVuY2UgdG8gPGVudHJ5PiBhbmQgcmVtb3ZlIGxpbmtzIGZyb20gdGhlIHB1cmdlZFxuICAgIC8vIGVudHJ5IGJlaW5nIHJldHVybmVkOlxuICAgIGVudHJ5Lm5ld2VyID0gZW50cnkub2xkZXIgPSB1bmRlZmluZWQ7XG4gICAgLy8gZGVsZXRlIGlzIHNsb3csIGJ1dCB3ZSBuZWVkIHRvIGRvIHRoaXMgdG8gYXZvaWQgdW5jb250cm9sbGFibGUgZ3Jvd3RoOlxuICAgIGRlbGV0ZSB0aGlzLl9rZXltYXBbZW50cnkua2V5XTtcbiAgfVxuICByZXR1cm4gZW50cnk7XG59O1xuXG4vKipcbiAqIEdldCBhbmQgcmVnaXN0ZXIgcmVjZW50IHVzZSBvZiA8a2V5Pi4gUmV0dXJucyB0aGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIDxrZXk+XG4gKiBvciB1bmRlZmluZWQgaWYgbm90IGluIGNhY2hlLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oa2V5LCByZXR1cm5FbnRyeSkge1xuICAvLyBGaXJzdCwgZmluZCBvdXIgY2FjaGUgZW50cnlcbiAgdmFyIGVudHJ5ID0gdGhpcy5fa2V5bWFwW2tleV07XG4gIGlmIChlbnRyeSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDsgLy8gTm90IGNhY2hlZC4gU29ycnkuXG4gIC8vIEFzIDxrZXk+IHdhcyBmb3VuZCBpbiB0aGUgY2FjaGUsIHJlZ2lzdGVyIGl0IGFzIGJlaW5nIHJlcXVlc3RlZCByZWNlbnRseVxuICBpZiAoZW50cnkgPT09IHRoaXMudGFpbCkge1xuICAgIC8vIEFscmVhZHkgdGhlIG1vc3QgcmVjZW5sdHkgdXNlZCBlbnRyeSwgc28gbm8gbmVlZCB0byB1cGRhdGUgdGhlIGxpc3RcbiAgICByZXR1cm4gcmV0dXJuRW50cnkgPyBlbnRyeSA6IGVudHJ5LnZhbHVlO1xuICB9XG4gIC8vIEhFQUQtLS0tLS0tLS0tLS0tLVRBSUxcbiAgLy8gICA8Lm9sZGVyICAgLm5ld2VyPlxuICAvLyAgPC0tLSBhZGQgZGlyZWN0aW9uIC0tXG4gIC8vICAgQSAgQiAgQyAgPEQ+ICBFXG4gIGlmIChlbnRyeS5uZXdlcikge1xuICAgIGlmIChlbnRyeSA9PT0gdGhpcy5oZWFkKVxuICAgICAgdGhpcy5oZWFkID0gZW50cnkubmV3ZXI7XG4gICAgZW50cnkubmV3ZXIub2xkZXIgPSBlbnRyeS5vbGRlcjsgLy8gQyA8LS0gRS5cbiAgfVxuICBpZiAoZW50cnkub2xkZXIpXG4gICAgZW50cnkub2xkZXIubmV3ZXIgPSBlbnRyeS5uZXdlcjsgLy8gQy4gLS0+IEVcbiAgZW50cnkubmV3ZXIgPSB1bmRlZmluZWQ7IC8vIEQgLS14XG4gIGVudHJ5Lm9sZGVyID0gdGhpcy50YWlsOyAvLyBELiAtLT4gRVxuICBpZiAodGhpcy50YWlsKVxuICAgIHRoaXMudGFpbC5uZXdlciA9IGVudHJ5OyAvLyBFLiA8LS0gRFxuICB0aGlzLnRhaWwgPSBlbnRyeTtcbiAgcmV0dXJuIHJldHVybkVudHJ5ID8gZW50cnkgOiBlbnRyeS52YWx1ZTtcbn07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEZvbGxvd2luZyBjb2RlIGlzIG9wdGlvbmFsIGFuZCBjYW4gYmUgcmVtb3ZlZCB3aXRob3V0IGJyZWFraW5nIHRoZSBjb3JlXG4vLyBmdW5jdGlvbmFsaXR5LlxuXG4vKipcbiAqIENoZWNrIGlmIDxrZXk+IGlzIGluIHRoZSBjYWNoZSB3aXRob3V0IHJlZ2lzdGVyaW5nIHJlY2VudCB1c2UuIEZlYXNpYmxlIGlmXG4gKiB5b3UgZG8gbm90IHdhbnQgdG8gY2hhZ2UgdGhlIHN0YXRlIG9mIHRoZSBjYWNoZSwgYnV0IG9ubHkgXCJwZWVrXCIgYXQgaXQuXG4gKiBSZXR1cm5zIHRoZSBlbnRyeSBhc3NvY2lhdGVkIHdpdGggPGtleT4gaWYgZm91bmQsIG9yIHVuZGVmaW5lZCBpZiBub3QgZm91bmQuXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oa2V5KSB7XG4gIHJldHVybiB0aGlzLl9rZXltYXBba2V5XTtcbn07XG5cbi8qKlxuICogVXBkYXRlIHRoZSB2YWx1ZSBvZiBlbnRyeSB3aXRoIDxrZXk+LiBSZXR1cm5zIHRoZSBvbGQgdmFsdWUsIG9yIHVuZGVmaW5lZCBpZlxuICogZW50cnkgd2FzIG5vdCBpbiB0aGUgY2FjaGUuXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gIHZhciBvbGR2YWx1ZSwgZW50cnkgPSB0aGlzLmdldChrZXksIHRydWUpO1xuICBpZiAoZW50cnkpIHtcbiAgICBvbGR2YWx1ZSA9IGVudHJ5LnZhbHVlO1xuICAgIGVudHJ5LnZhbHVlID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgb2xkdmFsdWUgPSB0aGlzLnB1dChrZXksIHZhbHVlKTtcbiAgICBpZiAob2xkdmFsdWUpIG9sZHZhbHVlID0gb2xkdmFsdWUudmFsdWU7XG4gIH1cbiAgcmV0dXJuIG9sZHZhbHVlO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgZW50cnkgPGtleT4gZnJvbSBjYWNoZSBhbmQgcmV0dXJuIGl0cyB2YWx1ZS4gUmV0dXJucyB1bmRlZmluZWQgaWYgbm90XG4gKiBmb3VuZC5cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSkge1xuICB2YXIgZW50cnkgPSB0aGlzLl9rZXltYXBba2V5XTtcbiAgaWYgKCFlbnRyeSkgcmV0dXJuIG51bGw7XG4gIGRlbGV0ZSB0aGlzLl9rZXltYXBbZW50cnkua2V5XTsgLy8gbmVlZCB0byBkbyBkZWxldGUgdW5mb3J0dW5hdGVseVxuICBpZiAoZW50cnkubmV3ZXIgJiYgZW50cnkub2xkZXIpIHtcbiAgICAvLyByZWxpbmsgdGhlIG9sZGVyIGVudHJ5IHdpdGggdGhlIG5ld2VyIGVudHJ5XG4gICAgZW50cnkub2xkZXIubmV3ZXIgPSBlbnRyeS5uZXdlcjtcbiAgICBlbnRyeS5uZXdlci5vbGRlciA9IGVudHJ5Lm9sZGVyO1xuICB9IGVsc2UgaWYgKGVudHJ5Lm5ld2VyKSB7XG4gICAgLy8gcmVtb3ZlIHRoZSBsaW5rIHRvIHVzXG4gICAgZW50cnkubmV3ZXIub2xkZXIgPSB1bmRlZmluZWQ7XG4gICAgLy8gbGluayB0aGUgbmV3ZXIgZW50cnkgdG8gaGVhZFxuICAgIHRoaXMuaGVhZCA9IGVudHJ5Lm5ld2VyO1xuICB9IGVsc2UgaWYgKGVudHJ5Lm9sZGVyKSB7XG4gICAgLy8gcmVtb3ZlIHRoZSBsaW5rIHRvIHVzXG4gICAgZW50cnkub2xkZXIubmV3ZXIgPSB1bmRlZmluZWQ7XG4gICAgLy8gbGluayB0aGUgbmV3ZXIgZW50cnkgdG8gaGVhZFxuICAgIHRoaXMudGFpbCA9IGVudHJ5Lm9sZGVyO1xuICB9IGVsc2Ugey8vIGlmKGVudHJ5Lm9sZGVyID09PSB1bmRlZmluZWQgJiYgZW50cnkubmV3ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHRoaXMuc2l6ZS0tO1xuICByZXR1cm4gZW50cnkudmFsdWU7XG59O1xuXG4vKiogUmVtb3ZlcyBhbGwgZW50cmllcyAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnJlbW92ZUFsbCA9IGZ1bmN0aW9uKCkge1xuICAvLyBUaGlzIHNob3VsZCBiZSBzYWZlLCBhcyB3ZSBuZXZlciBleHBvc2Ugc3Ryb25nIHJlZnJlbmNlcyB0byB0aGUgb3V0c2lkZVxuICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSB1bmRlZmluZWQ7XG4gIHRoaXMuc2l6ZSA9IDA7XG4gIHRoaXMuX2tleW1hcCA9IHt9O1xufTtcblxuLyoqXG4gKiBSZXR1cm4gYW4gYXJyYXkgY29udGFpbmluZyBhbGwga2V5cyBvZiBlbnRyaWVzIHN0b3JlZCBpbiB0aGUgY2FjaGUgb2JqZWN0LCBpblxuICogYXJiaXRyYXJ5IG9yZGVyLlxuICovXG5pZiAodHlwZW9mIE9iamVjdC5rZXlzID09PSAnZnVuY3Rpb24nKSB7XG4gIExSVUNhY2hlLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7IHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9rZXltYXApOyB9O1xufSBlbHNlIHtcbiAgTFJVQ2FjaGUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGsgaW4gdGhpcy5fa2V5bWFwKSBrZXlzLnB1c2goayk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG59XG5cbi8qKlxuICogQ2FsbCBgZnVuYCBmb3IgZWFjaCBlbnRyeS4gU3RhcnRpbmcgd2l0aCB0aGUgbmV3ZXN0IGVudHJ5IGlmIGBkZXNjYCBpcyBhIHRydWVcbiAqIHZhbHVlLCBvdGhlcndpc2Ugc3RhcnRzIHdpdGggdGhlIG9sZGVzdCAoaGVhZCkgZW5ydHkgYW5kIG1vdmVzIHRvd2FyZHMgdGhlXG4gKiB0YWlsLlxuICpcbiAqIGBmdW5gIGlzIGNhbGxlZCB3aXRoIDMgYXJndW1lbnRzIGluIHRoZSBjb250ZXh0IGBjb250ZXh0YDpcbiAqICAgYGZ1bi5jYWxsKGNvbnRleHQsIE9iamVjdCBrZXksIE9iamVjdCB2YWx1ZSwgTFJVQ2FjaGUgc2VsZilgXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oZnVuLCBjb250ZXh0LCBkZXNjKSB7XG4gIHZhciBlbnRyeTtcbiAgaWYgKGNvbnRleHQgPT09IHRydWUpIHsgZGVzYyA9IHRydWU7IGNvbnRleHQgPSB1bmRlZmluZWQ7IH1cbiAgZWxzZSBpZiAodHlwZW9mIGNvbnRleHQgIT09ICdvYmplY3QnKSBjb250ZXh0ID0gdGhpcztcbiAgaWYgKGRlc2MpIHtcbiAgICBlbnRyeSA9IHRoaXMudGFpbDtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGZ1bi5jYWxsKGNvbnRleHQsIGVudHJ5LmtleSwgZW50cnkudmFsdWUsIHRoaXMpO1xuICAgICAgZW50cnkgPSBlbnRyeS5vbGRlcjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZW50cnkgPSB0aGlzLmhlYWQ7XG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICBmdW4uY2FsbChjb250ZXh0LCBlbnRyeS5rZXksIGVudHJ5LnZhbHVlLCB0aGlzKTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV3ZXI7XG4gICAgfVxuICB9XG59O1xuXG4vKiogUmV0dXJucyBhIEpTT04gKGFycmF5KSByZXByZXNlbnRhdGlvbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcyA9IFtdLCBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgd2hpbGUgKGVudHJ5KSB7XG4gICAgcy5wdXNoKHtrZXk6ZW50cnkua2V5LnRvSlNPTigpLCB2YWx1ZTplbnRyeS52YWx1ZS50b0pTT04oKX0pO1xuICAgIGVudHJ5ID0gZW50cnkubmV3ZXI7XG4gIH1cbiAgcmV0dXJuIHM7XG59O1xuXG4vKiogUmV0dXJucyBhIFN0cmluZyByZXByZXNlbnRhdGlvbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzID0gJycsIGVudHJ5ID0gdGhpcy5oZWFkO1xuICB3aGlsZSAoZW50cnkpIHtcbiAgICBzICs9IFN0cmluZyhlbnRyeS5rZXkpKyc6JytlbnRyeS52YWx1ZTtcbiAgICBlbnRyeSA9IGVudHJ5Lm5ld2VyO1xuICAgIGlmIChlbnRyeSlcbiAgICAgIHMgKz0gJyA8ICc7XG4gIH1cbiAgcmV0dXJuIHM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExSVUNhY2hlO1xuIiwiKGZ1bmN0aW9uKCkge1xuXG4gIGlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSAhPSAnZnVuY3Rpb24nKSB7XG4gICAgT2JqZWN0LmNyZWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBPYmplY3QgPSBmdW5jdGlvbigpIHt9O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ1NlY29uZCBhcmd1bWVudCBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBwcm90b3R5cGUgIT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgICBPYmplY3QucHJvdG90eXBlID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfSkoKTtcbiAgfVxuXG59KSgpO1xuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBAZ2xvYmFsXG4gKiBAbmFtZXNwYWNlXG4gKiBAYWxpYXMgUHJlZGljYXRlc1xuICovXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvKipcbiAgICogQnVpbGQgYW4gXCJhdFwiIHByZWRpY2F0ZTogZXF1YWxpdHkgb2YgYSBmcmFnbWVudCB0byBhIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmF0KFwiZG9jdW1lbnQudHlwZVwiLCBcImFydGljbGVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgYXQ6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZSkgeyByZXR1cm4gW1wiYXRcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYW4gXCJub3RcIiBwcmVkaWNhdGU6IGluZXF1YWxpdHkgb2YgYSBmcmFnbWVudCB0byBhIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm5vdChcImRvY3VtZW50LnR5cGVcIiwgXCJhcnRpY2xlXCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ31cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIG5vdDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJub3RcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcIm1pc3NpbmdcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgcmVxdWVzdGVkIGZpZWxkIGlzIGVtcHR5XG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubWlzc2luZyhcIm15LmJsb2ctcG9zdC5hdXRob3JcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBtaXNzaW5nOiBmdW5jdGlvbihmcmFnbWVudCkgeyByZXR1cm4gW1wibWlzc2luZ1wiLCBmcmFnbWVudF07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJoYXNcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgcmVxdWVzdGVkIGZpZWxkIGlzIGRlZmluZWRcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5oYXMoXCJteS5ibG9nLXBvc3QuYXV0aG9yXCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgaGFzOiBmdW5jdGlvbihmcmFnbWVudCkgeyByZXR1cm4gW1wiaGFzXCIsIGZyYWdtZW50XTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYW4gXCJhbnlcIiBwcmVkaWNhdGU6IGVxdWFsaXR5IG9mIGEgZnJhZ21lbnQgdG8gYSB2YWx1ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5hbnkoXCJkb2N1bWVudC50eXBlXCIsIFtcImFydGljbGVcIiwgXCJibG9nLXBvc3RcIl0pXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgKiBAcGFyYW0gdmFsdWVzIHtBcnJheX1cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGFueTogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlcykgeyByZXR1cm4gW1wiYW55XCIsIGZyYWdtZW50LCB2YWx1ZXNdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcImluXCIgcHJlZGljYXRlOiBlcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaW4oXCJteS5wcm9kdWN0LnByaWNlXCIsIFs0LCA1XSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZXMge0FycmF5fVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgaW46IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZXMpIHsgcmV0dXJuIFtcImluXCIsIGZyYWdtZW50LCB2YWx1ZXNdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwiZnVsbHRleHRcIiBwcmVkaWNhdGU6IGZ1bGx0ZXh0IHNlYXJjaCBpbiBhIGZyYWdtZW50LlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmZ1bGx0ZXh0KFwibXkuYXJ0aWNsZS5ib2R5XCIsIFwic2F1c2FnZVwiXSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSB0aGUgdGVybSB0byBzZWFyY2hcbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGZ1bGx0ZXh0OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcImZ1bGx0ZXh0XCIsIGZyYWdtZW50LCB2YWx1ZV07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJzaW1pbGFyXCIgcHJlZGljYXRlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLnNpbWlsYXIoXCJVWGFzZEZ3ZTQyRFwiLCAxMClcbiAgICogQHBhcmFtIGRvY3VtZW50SWQge1N0cmluZ30gdGhlIGRvY3VtZW50IGlkIHRvIHJldHJpZXZlIHNpbWlsYXIgZG9jdW1lbnRzIHRvLlxuICAgKiBAcGFyYW0gbWF4UmVzdWx0cyB7TnVtYmVyfSB0aGUgbWF4aW11bSBudW1iZXIgb2YgcmVzdWx0cyB0byByZXR1cm5cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIHNpbWlsYXI6IGZ1bmN0aW9uKGRvY3VtZW50SWQsIG1heFJlc3VsdHMpIHsgcmV0dXJuIFtcInNpbWlsYXJcIiwgZG9jdW1lbnRJZCwgbWF4UmVzdWx0c107IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJudW1iZXIuZ3RcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgZnJhZ21lbnQgZmllbGQgaXMgZ3JlYXRlciB0aGFuIHRoZSBnaXZlbiB2YWx1ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5ndChcIm15LnByb2R1Y3QucHJpY2VcIiwgMTApXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgbnVtYmVyLlxuICAgKiBAcGFyYW0gdmFsdWUge051bWJlcn0gdGhlIGxvd2VyIGJvdW5kIG9mIHRoZSBwcmVkaWNhdGVcbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGd0OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcIm51bWJlci5ndFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwibnVtYmVyLmx0XCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGxvd2VyIHRoYW4gdGhlIGdpdmVuIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmx0KFwibXkucHJvZHVjdC5wcmljZVwiLCAyMClcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBudW1iZXIuXG4gICAqIEBwYXJhbSB2YWx1ZSB7TnVtYmVyfSB0aGUgdXBwZXIgYm91bmQgb2YgdGhlIHByZWRpY2F0ZVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgbHQ6IGZ1bmN0aW9uKGZyYWdtZW50LCB2YWx1ZSkgeyByZXR1cm4gW1wibnVtYmVyLmx0XCIsIGZyYWdtZW50LCB2YWx1ZV07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJudW1iZXIuaW5SYW5nZVwiIHByZWRpY2F0ZTogY29tYmluYXRpb24gb2YgbHQgYW5kIGd0LlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmluUmFuZ2UoXCJteS5wcm9kdWN0LnByaWNlXCIsIDEwLCAyMClcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBudW1iZXIuXG4gICAqIEBwYXJhbSBiZWZvcmUge051bWJlcn1cbiAgICogQHBhcmFtIGFmdGVyIHtOdW1iZXJ9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBpblJhbmdlOiBmdW5jdGlvbihmcmFnbWVudCwgYmVmb3JlLCBhZnRlcikgeyByZXR1cm4gW1wibnVtYmVyLmluUmFuZ2VcIiwgZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXJdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwiZGF0ZS5iZWZvcmVcIiBwcmVkaWNhdGU6IGRvY3VtZW50cyB3aGVyZSB0aGUgZnJhZ21lbnQgZmllbGQgaXMgYmVmb3JlIHRoZSBnaXZlbiBkYXRlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRhdGVCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIG5ldyBEYXRlKDIwMTQsIDYsIDEpKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIGRhdGUgb3IgdGltZXN0YW1wIGZpZWxkLlxuICAgKiBAcGFyYW0gYmVmb3JlIHtEYXRlfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgZGF0ZUJlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIGJlZm9yZSkgeyByZXR1cm4gW1wiZGF0ZS5iZWZvcmVcIiwgZnJhZ21lbnQsIGJlZm9yZV07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJkYXRlLmFmdGVyXCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGFmdGVyIHRoZSBnaXZlbiBkYXRlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRhdGVBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgbmV3IERhdGUoMjAxNCwgMSwgMSkpXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgZGF0ZSBvciB0aW1lc3RhbXAgZmllbGQuXG4gICAqIEBwYXJhbSBhZnRlciB7RGF0ZX1cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGRhdGVBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGFmdGVyKSB7IHJldHVybiBbXCJkYXRlLmFmdGVyXCIsIGZyYWdtZW50LCBhZnRlcl07IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgXCJkYXRlLmJldHdlZW5cIiBwcmVkaWNhdGU6IGNvbWJpbmF0aW9uIG9mIGRhdGVCZWZvcmUgYW5kIGRhdGVBZnRlclxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRhdGVCZXR3ZWVuKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBuZXcgRGF0ZSgyMDE0LCAxLCAxKSwgbmV3IERhdGUoMjAxNCwgNiwgMSkpXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgZGF0ZSBvciB0aW1lc3RhbXAgZmllbGQuXG4gICAqIEBwYXJhbSBiZWZvcmUge0RhdGV9XG4gICAqIEBwYXJhbSBhZnRlciB7RGF0ZX1cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGRhdGVCZXR3ZWVuOiBmdW5jdGlvbihmcmFnbWVudCwgYmVmb3JlLCBhZnRlcikgeyByZXR1cm4gW1wiZGF0ZS5iZXR3ZWVuXCIsIGZyYWdtZW50LCBiZWZvcmUsIGFmdGVyXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZk1vbnRoKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxNClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcn0gYmV0d2VlbiAxIGFuZCAzMVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZk1vbnRoOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi1tb250aFwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZk1vbnRoQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfSBiZXR3ZWVuIDEgYW5kIDMxXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mTW9udGhBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2YtbW9udGgtYWZ0ZXJcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZNb250aEJlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTQpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ9IGJldHdlZW4gMSBhbmQgMzFcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZNb250aEJlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2YtbW9udGgtYmVmb3JlXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mV2VlayhcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTQpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCA3IG9yIHN0cmluZyBiZXR3ZWVuIFwiTW9uZGF5XCIgYW5kIFwiU3VuZGF5XCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZXZWVrOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi13ZWVrXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mV2Vla0FmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIldlZG5lc2RheVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgNyBvciBzdHJpbmcgYmV0d2VlbiBcIk1vbmRheVwiIGFuZCBcIlN1bmRheVwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mV2Vla0FmdGVyOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi13ZWVrLWFmdGVyXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mV2Vla0JlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJXZWRuZXNkYXlcIilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDcgb3Igc3RyaW5nIGJldHdlZW4gXCJNb25kYXlcIiBhbmQgXCJTdW5kYXlcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZldlZWtCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLXdlZWstYmVmb3JlXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1vbnRoKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIkp1bmVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBtb250aCB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgMTIgb3Igc3RyaW5nIGJldHdlZW4gXCJKYW51YXJ5XCIgYW5kIFwiRGVjZW1iZXJcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBtb250aDogZnVuY3Rpb24oZnJhZ21lbnQsIG1vbnRoKSB7IHJldHVybiBbXCJkYXRlLm1vbnRoXCIsIGZyYWdtZW50LCBtb250aF07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubW9udGhCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiSnVuZVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIG1vbnRoIHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCAxMiBvciBzdHJpbmcgYmV0d2VlbiBcIkphbnVhcnlcIiBhbmQgXCJEZWNlbWJlclwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIG1vbnRoQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgbW9udGgpIHsgcmV0dXJuIFtcImRhdGUubW9udGgtYmVmb3JlXCIsIGZyYWdtZW50LCBtb250aF07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubW9udGhBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJKdW5lXCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gbW9udGgge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDEyIG9yIHN0cmluZyBiZXR3ZWVuIFwiSmFudWFyeVwiIGFuZCBcIkRlY2VtYmVyXCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBtb250aEFmdGVyOiBmdW5jdGlvbihmcmFnbWVudCwgbW9udGgpIHsgcmV0dXJuIFtcImRhdGUubW9udGgtYWZ0ZXJcIiwgZnJhZ21lbnQsIG1vbnRoXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy55ZWFyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAyMDE0KVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIHllYXIge051bWJlcn1cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgeWVhcjogZnVuY3Rpb24oZnJhZ21lbnQsIHllYXIpIHsgcmV0dXJuIFtcImRhdGUueWVhclwiLCBmcmFnbWVudCwgeWVhcl07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaG91cihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gaG91ciB7TnVtYmVyfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBob3VyOiBmdW5jdGlvbihmcmFnbWVudCwgaG91cikgeyByZXR1cm4gW1wiZGF0ZS5ob3VyXCIsIGZyYWdtZW50LCBob3VyXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5ob3VyQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxMilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBob3VyIHtOdW1iZXJ9XG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGhvdXJCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBob3VyKSB7IHJldHVybiBbXCJkYXRlLmhvdXItYmVmb3JlXCIsIGZyYWdtZW50LCBob3VyXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5ob3VyQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDEyKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGhvdXIge051bWJlcn1cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgaG91ckFmdGVyOiBmdW5jdGlvbihmcmFnbWVudCwgaG91cikgeyByZXR1cm4gW1wiZGF0ZS5ob3VyLWFmdGVyXCIsIGZyYWdtZW50LCBob3VyXTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5uZWFyKFwibXkuc3RvcmUubG9jYXRpb25cIiwgNDguODc2ODc2NywgMi4zMzM4ODAyLCAxMClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBsYXRpdHVkZSB7TnVtYmVyfVxuICAgKiBAcGFyYW0gbG9uZ2l0dWRlIHtOdW1iZXJ9XG4gICAqIEBwYXJhbSByYWRpdXMge051bWJlcn0gaW4ga2lsb21ldGVyc1xuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBuZWFyOiBmdW5jdGlvbihmcmFnbWVudCwgbGF0aXR1ZGUsIGxvbmdpdHVkZSwgcmFkaXVzKSB7IHJldHVybiBbXCJnZW9wb2ludC5uZWFyXCIsIGZyYWdtZW50LCBsYXRpdHVkZSwgbG9uZ2l0dWRlLCByYWRpdXNdOyB9XG5cbn07XG4iLCJcblwidXNlIHN0cmljdFwiO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBjcmVhdGVFcnJvciA9IGZ1bmN0aW9uKHN0YXR1cywgbWVzc2FnZSkge1xuICB2YXIgZXJyID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnIuc3RhdHVzID0gc3RhdHVzO1xuICByZXR1cm4gZXJyO1xufTtcblxuLy8gLS0gUmVxdWVzdCBoYW5kbGVyc1xuXG52YXIgYWpheFJlcXVlc3QgPSAoZnVuY3Rpb24oKSB7XG4gIGlmKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPSAndW5kZWZpbmVkJyAmJiAnd2l0aENyZWRlbnRpYWxzJyBpbiBuZXcgWE1MSHR0cFJlcXVlc3QoKSkge1xuICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgLy8gQ2FsbGVkIG9uIHN1Y2Nlc3NcbiAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0dGwsIGNhY2hlQ29udHJvbCA9IC9tYXgtYWdlXFxzKj1cXHMqKFxcZCspLy5leGVjKFxuICAgICAgICAgIHhoci5nZXRSZXNwb25zZUhlYWRlcignQ2FjaGUtQ29udHJvbCcpKTtcbiAgICAgICAgaWYgKGNhY2hlQ29udHJvbCAmJiBjYWNoZUNvbnRyb2wubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHR0bCA9IHBhcnNlSW50KGNhY2hlQ29udHJvbFsxXSwgMTApO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCksIHhociwgdHRsKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIENhbGxlZCBvbiBlcnJvclxuICAgICAgdmFyIHJlamVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0geGhyLnN0YXR1cztcbiAgICAgICAgY2FsbGJhY2soY3JlYXRlRXJyb3Ioc3RhdHVzLCBcIlVuZXhwZWN0ZWQgc3RhdHVzIGNvZGUgW1wiICsgc3RhdHVzICsgXCJdIG9uIFVSTCBcIit1cmwpLCBudWxsLCB4aHIpO1xuICAgICAgfTtcblxuICAgICAgLy8gQmluZCB0aGUgWEhSIGZpbmlzaGVkIGNhbGxiYWNrXG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgIGlmKHhoci5zdGF0dXMgJiYgeGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBPcGVuIHRoZSBYSFJcbiAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAvLyBLaXQgdmVyc2lvbiAoY2FuJ3Qgb3ZlcnJpZGUgdGhlIHVzZXItYWdlbnQgY2xpZW50IHNpZGUpXG4gICAgICAvLyB4aHIuc2V0UmVxdWVzdEhlYWRlcihcIlgtUHJpc21pYy1Vc2VyLUFnZW50XCIsIFwiUHJpc21pYy1qYXZhc2NyaXB0LWtpdC8lVkVSU0lPTiVcIi5yZXBsYWNlKFwiJVZFUlNJT04lXCIsIEdsb2JhbC5QcmlzbWljLnZlcnNpb24pKTtcblxuICAgICAgLy8gSnNvbiByZXF1ZXN0XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcblxuICAgICAgLy8gU2VuZCB0aGUgWEhSXG4gICAgICB4aHIuc2VuZCgpO1xuICAgIH07XG4gIH1cbn0pO1xuXG52YXIgeGRvbWFpblJlcXVlc3QgPSAoZnVuY3Rpb24oKSB7XG4gIGlmKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPSAndW5kZWZpbmVkJykgeyAvLyBJbnRlcm5ldCBFeHBsb3JlclxuICAgIHJldHVybiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciB4ZHIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcblxuICAgICAgLy8gQ2FsbGVkIG9uIHN1Y2Nlc3NcbiAgICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIEpTT04ucGFyc2UoeGRyLnJlc3BvbnNlVGV4dCksIHhkciwgMCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBDYWxsZWQgb24gZXJyb3JcbiAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKG1zZyksIG51bGwsIHhkcik7XG4gICAgICB9O1xuXG4gICAgICAvLyBCaW5kIHRoZSBYRFIgZmluaXNoZWQgY2FsbGJhY2tcbiAgICAgIHhkci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZSh4ZHIpO1xuICAgICAgfTtcblxuICAgICAgLy8gQmluZCB0aGUgWERSIGVycm9yIGNhbGxiYWNrXG4gICAgICB4ZHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIG9uIFVSTCBcIiArIHVybCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBPcGVuIHRoZSBYSFJcbiAgICAgIHhkci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAvLyBCaW5kIHRoZSBYRFIgdGltZW91dCBjYWxsYmFja1xuICAgICAgeGRyLm9udGltZW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmVqZWN0KFwiUmVxdWVzdCB0aW1lb3V0XCIpO1xuICAgICAgfTtcblxuICAgICAgLy8gRW1wdHkgY2FsbGJhY2suIElFIHNvbWV0aW1lcyBhYm9ydCB0aGUgcmVxZXVzdCBpZlxuICAgICAgLy8gdGhpcyBpcyBub3QgcHJlc2VudFxuICAgICAgeGRyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7IH07XG5cbiAgICAgIHhkci5zZW5kKCk7XG4gICAgfTtcbiAgfVxufSk7XG5cbnZhciBub2RlSlNSZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICBpZih0eXBlb2YgcmVxdWlyZSA9PSAnZnVuY3Rpb24nICYmIHJlcXVpcmUoJ2h0dHAnKSkge1xuICAgIHZhciBodHRwID0gcmVxdWlyZSgnaHR0cCcpLFxuICAgICAgICBodHRwcyA9IHJlcXVpcmUoJ2h0dHBzJyksXG4gICAgICAgIHVybCA9IHJlcXVpcmUoJ3VybCcpLFxuICAgICAgICBwanNvbiA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHJlcXVlc3RVcmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciBwYXJzZWQgPSB1cmwucGFyc2UocmVxdWVzdFVybCksXG4gICAgICAgICAgaCA9IHBhcnNlZC5wcm90b2NvbCA9PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cCxcbiAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgaG9zdG5hbWU6IHBhcnNlZC5ob3N0bmFtZSxcbiAgICAgICAgICAgIHBhdGg6IHBhcnNlZC5wYXRoLFxuICAgICAgICAgICAgcXVlcnk6IHBhcnNlZC5xdWVyeSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ1VzZXItQWdlbnQnOiAnUHJpc21pYy1qYXZhc2NyaXB0LWtpdC8nICsgcGpzb24udmVyc2lvbiArIFwiIE5vZGVKUy9cIiArIHByb2Nlc3MudmVyc2lvblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgIGlmICghcmVxdWVzdFVybCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkJPT01cIik7XG4gICAgICAgIHZhciBlID0gbmV3IEVycm9yKCdkdW1teScpO1xuICAgICAgICB2YXIgc3RhY2sgPSBlLnN0YWNrLnJlcGxhY2UoL15bXlxcKF0rP1tcXG4kXS9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eXFxzK2F0XFxzKy9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eT2JqZWN0Ljxhbm9ueW1vdXM+XFxzKlxcKC9nbSwgJ3thbm9ueW1vdXN9KClAJylcbiAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgY29uc29sZS5sb2coc3RhY2spO1xuXG4gICAgICB9XG4gICAgICB2YXIgcmVxdWVzdCA9IGguZ2V0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICB2YXIganNvblN0ciA9ICcnO1xuXG4gICAgICAgICAgcmVzcG9uc2Uuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICByZXNwb25zZS5vbignZGF0YScsIGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICAgICAganNvblN0ciArPSBjaHVuaztcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJlc3BvbnNlLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIganNvbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGpzb24gPSBKU09OLnBhcnNlKGpzb25TdHIpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJGYWlsZWQgdG8gcGFyc2UganNvbjogXCIgKyBqc29uU3RyLCBleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY2FjaGVDb250cm9sID0gcmVzcG9uc2UuaGVhZGVyc1snY2FjaGUtY29udHJvbCddO1xuICAgICAgICAgICAgdmFyIHR0bCA9IGNhY2hlQ29udHJvbCAmJiAvbWF4LWFnZT0oXFxkKykvLnRlc3QoY2FjaGVDb250cm9sKSA/IHBhcnNlSW50KC9tYXgtYWdlPShcXGQrKS8uZXhlYyhjYWNoZUNvbnRyb2wpWzFdLCAxMCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGpzb24sIHJlc3BvbnNlLCB0dGwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKHJlc3BvbnNlLnN0YXR1c0NvZGUsIFwiVW5leHBlY3RlZCBzdGF0dXMgY29kZSBbXCIgKyByZXNwb25zZS5zdGF0dXNDb2RlICsgXCJdIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gcHJvcGVybHkgaGFuZGxlIHRpbWVvdXRzXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGVycm9yIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgZXJyKTtcbiAgICAgIH0pO1xuXG5cbiAgICB9O1xuICB9XG59KTtcblxuLy8gTnVtYmVyIG9mIHJlcXVlc3RzIGN1cnJlbnRseSBydW5uaW5nIChjYXBwZWQgYnkgTUFYX0NPTk5FQ1RJT05TKVxudmFyIHJ1bm5pbmcgPSAwO1xuLy8gUmVxdWVzdHMgaW4gcXVldWVcbnZhciBxdWV1ZSA9IFtdO1xuXG52YXIgcHJvY2Vzc1F1ZXVlID0gZnVuY3Rpb24oKSB7XG4gIGlmIChxdWV1ZS5sZW5ndGggPT09IDAgfHwgcnVubmluZyA+PSBVdGlscy5NQVhfQ09OTkVDVElPTlMpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcnVubmluZysrO1xuICB2YXIgbmV4dCA9IHF1ZXVlLnNoaWZ0KCk7XG4gIHZhciBmbiA9IGFqYXhSZXF1ZXN0KCkgfHwgeGRvbWFpblJlcXVlc3QoKSB8fCBub2RlSlNSZXF1ZXN0KCkgfHxcbiAgICAgICAgKGZ1bmN0aW9uKCkge3Rocm93IG5ldyBFcnJvcihcIk5vIHJlcXVlc3QgaGFuZGxlciBhdmFpbGFibGUgKHRyaWVkIFhNTEh0dHBSZXF1ZXN0ICYgTm9kZUpTKVwiKTt9KSgpO1xuICBmbi5jYWxsKHRoaXMsIG5leHQudXJsLCBmdW5jdGlvbihlcnJvciwgcmVzdWx0LCB4aHIsIHR0bCkge1xuICAgIHJ1bm5pbmctLTtcbiAgICBuZXh0LmNhbGxiYWNrKGVycm9yLCByZXN1bHQsIHhociwgdHRsKTtcbiAgICBwcm9jZXNzUXVldWUoKTtcbiAgfSk7XG59O1xuXG52YXIgcmVxdWVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgcXVldWUucHVzaCh7XG4gICAgICAndXJsJzogdXJsLFxuICAgICAgJ2NhbGxiYWNrJzogY2FsbGJhY2tcbiAgICB9KTtcbiAgICBwcm9jZXNzUXVldWUoKTtcbiAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBNQVhfQ09OTkVDVElPTlM6IDIwLCAvLyBOdW1iZXIgb2YgbWF4aW11bSBzaW11bHRhbmVvdXMgY29ubmVjdGlvbnMgdG8gdGhlIHByaXNtaWMgc2VydmVyXG4gIHJlcXVlc3Q6IHJlcXVlc3Rcbn07XG4iXX0=
