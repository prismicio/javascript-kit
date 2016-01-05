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
    "gulp-jshint": "~1.11.2",
    "gulp-mocha": "^2.2.0",
    "gulp-mocha-phantomjs": "git://github.com/erwan/gulp-mocha-phantomjs.git#phantomjs198",
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
  "main": "dist/prismic.io.min.js",
  "scripts": {
    "test": "gulp test"
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
    GroupDoc = documents.GroupDoc,
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
};

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
};

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

      self.get(function (err, data, xhr) {
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
        console.log("Error from the request");
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
        console.log("Caught e ", e);
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

},{"./cache.js":42,"./documents":43,"./experiments":44,"./fragments":45,"./predicates":47,"./utils":48}],41:[function(require,module,exports){
'use strict';

window.Prismic = require('./api');

},{"./api":40}],42:[function(require,module,exports){

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
            if (link instanceof DocumentLink) {
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
  if (entry === undefined) return; // Not cached. Sorry.
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
  if (!entry) return;
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

},{}],48:[function(require,module,exports){
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
        querystring = require('querystring'),
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

},{"../package.json":39,"./utils":48,"_process":14,"http":30,"https":8,"querystring":18,"url":35}]},{},[41])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVpbHRpbi1zdGF0dXMtY29kZXMvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9jb3JlLXV0aWwtaXMvbGliL3V0aWwuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9odHRwcy1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9pcy1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzLW5leHRpY2stYXJncy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHVueWNvZGUvcHVueWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV93cml0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS90cmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3dyaXRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9jYXBhYmlsaXR5LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXF1ZXN0LmpzIiwibm9kZV9tb2R1bGVzL3N0cmVhbS1odHRwL2xpYi9yZXNwb25zZS5qcyIsIm5vZGVfbW9kdWxlcy9zdHJpbmdfZGVjb2Rlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3VybC91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3V0aWwtZGVwcmVjYXRlL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwicGFja2FnZS5qc29uIiwic3JjL2FwaS5qcyIsInNyYy9icm93c2VyLmpzIiwic3JjL2NhY2hlLmpzIiwic3JjL2RvY3VtZW50cy5qcyIsInNyYy9leHBlcmltZW50cy5qcyIsInNyYy9mcmFnbWVudHMuanMiLCJzcmMvbHJ1LmpzIiwic3JjL3ByZWRpY2F0ZXMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1Z0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7OztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcmhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvOEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqaEJBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTs7QUNEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDblJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1dEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNDQSxZQUFZLENBQUM7Ozs7QUFFYixJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDO0lBQ3RDLFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO0lBQ3BDLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO0lBQzFCLFNBQVMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQ2xDLFFBQVEsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ2hDLFNBQVMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRXZDLElBQUksUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRO0lBQzdCLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUTtJQUM3QixXQUFXLEdBQUcs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TztDQUNqQixDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gU2FmYXJpIDUtNyBsYWNrcyBzdXBwb3J0IGZvciBjaGFuZ2luZyB0aGUgYE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3JgIHByb3BlcnR5XG4gKiAgICAgb24gb2JqZWN0cy5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIGZ1bmN0aW9uIEJhciAoKSB7fVxuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgYXJyLmNvbnN0cnVjdG9yID0gQmFyXG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgYXJyLmNvbnN0cnVjdG9yID09PSBCYXIgJiYgLy8gY29uc3RydWN0b3IgY2FuIGJlIHNldFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBhcnJheS5ieXRlTGVuZ3RoXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gICAgdGhhdC5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIHZhciBpID0gMFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgYnJlYWtcblxuICAgICsraVxuICB9XG5cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHN0cmluZyA9ICcnICsgc3RyaW5nXG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbi8vIGBnZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gZ2V0IChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gc2V0ICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0U3RhcnQpXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIHRvQXJyYXlCdWZmZXIgKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIF9hdWdtZW50IChhcnIpIHtcbiAgYXJyLmNvbnN0cnVjdG9yID0gQnVmZmVyXG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBzZXQgbWV0aG9kIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmluZGV4T2YgPSBCUC5pbmRleE9mXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnRMRSA9IEJQLnJlYWRVSW50TEVcbiAgYXJyLnJlYWRVSW50QkUgPSBCUC5yZWFkVUludEJFXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludExFID0gQlAucmVhZEludExFXG4gIGFyci5yZWFkSW50QkUgPSBCUC5yZWFkSW50QkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50TEUgPSBCUC53cml0ZVVJbnRMRVxuICBhcnIud3JpdGVVSW50QkUgPSBCUC53cml0ZVVJbnRCRVxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50TEUgPSBCUC53cml0ZUludExFXG4gIGFyci53cml0ZUludEJFID0gQlAud3JpdGVJbnRCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgXCIxMDBcIjogXCJDb250aW51ZVwiLFxuICBcIjEwMVwiOiBcIlN3aXRjaGluZyBQcm90b2NvbHNcIixcbiAgXCIxMDJcIjogXCJQcm9jZXNzaW5nXCIsXG4gIFwiMjAwXCI6IFwiT0tcIixcbiAgXCIyMDFcIjogXCJDcmVhdGVkXCIsXG4gIFwiMjAyXCI6IFwiQWNjZXB0ZWRcIixcbiAgXCIyMDNcIjogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICBcIjIwNFwiOiBcIk5vIENvbnRlbnRcIixcbiAgXCIyMDVcIjogXCJSZXNldCBDb250ZW50XCIsXG4gIFwiMjA2XCI6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gIFwiMjA3XCI6IFwiTXVsdGktU3RhdHVzXCIsXG4gIFwiMzAwXCI6IFwiTXVsdGlwbGUgQ2hvaWNlc1wiLFxuICBcIjMwMVwiOiBcIk1vdmVkIFBlcm1hbmVudGx5XCIsXG4gIFwiMzAyXCI6IFwiTW92ZWQgVGVtcG9yYXJpbHlcIixcbiAgXCIzMDNcIjogXCJTZWUgT3RoZXJcIixcbiAgXCIzMDRcIjogXCJOb3QgTW9kaWZpZWRcIixcbiAgXCIzMDVcIjogXCJVc2UgUHJveHlcIixcbiAgXCIzMDdcIjogXCJUZW1wb3JhcnkgUmVkaXJlY3RcIixcbiAgXCIzMDhcIjogXCJQZXJtYW5lbnQgUmVkaXJlY3RcIixcbiAgXCI0MDBcIjogXCJCYWQgUmVxdWVzdFwiLFxuICBcIjQwMVwiOiBcIlVuYXV0aG9yaXplZFwiLFxuICBcIjQwMlwiOiBcIlBheW1lbnQgUmVxdWlyZWRcIixcbiAgXCI0MDNcIjogXCJGb3JiaWRkZW5cIixcbiAgXCI0MDRcIjogXCJOb3QgRm91bmRcIixcbiAgXCI0MDVcIjogXCJNZXRob2QgTm90IEFsbG93ZWRcIixcbiAgXCI0MDZcIjogXCJOb3QgQWNjZXB0YWJsZVwiLFxuICBcIjQwN1wiOiBcIlByb3h5IEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCIsXG4gIFwiNDA4XCI6IFwiUmVxdWVzdCBUaW1lLW91dFwiLFxuICBcIjQwOVwiOiBcIkNvbmZsaWN0XCIsXG4gIFwiNDEwXCI6IFwiR29uZVwiLFxuICBcIjQxMVwiOiBcIkxlbmd0aCBSZXF1aXJlZFwiLFxuICBcIjQxMlwiOiBcIlByZWNvbmRpdGlvbiBGYWlsZWRcIixcbiAgXCI0MTNcIjogXCJSZXF1ZXN0IEVudGl0eSBUb28gTGFyZ2VcIixcbiAgXCI0MTRcIjogXCJSZXF1ZXN0LVVSSSBUb28gTGFyZ2VcIixcbiAgXCI0MTVcIjogXCJVbnN1cHBvcnRlZCBNZWRpYSBUeXBlXCIsXG4gIFwiNDE2XCI6IFwiUmVxdWVzdGVkIFJhbmdlIE5vdCBTYXRpc2ZpYWJsZVwiLFxuICBcIjQxN1wiOiBcIkV4cGVjdGF0aW9uIEZhaWxlZFwiLFxuICBcIjQxOFwiOiBcIkknbSBhIHRlYXBvdFwiLFxuICBcIjQyMlwiOiBcIlVucHJvY2Vzc2FibGUgRW50aXR5XCIsXG4gIFwiNDIzXCI6IFwiTG9ja2VkXCIsXG4gIFwiNDI0XCI6IFwiRmFpbGVkIERlcGVuZGVuY3lcIixcbiAgXCI0MjVcIjogXCJVbm9yZGVyZWQgQ29sbGVjdGlvblwiLFxuICBcIjQyNlwiOiBcIlVwZ3JhZGUgUmVxdWlyZWRcIixcbiAgXCI0MjhcIjogXCJQcmVjb25kaXRpb24gUmVxdWlyZWRcIixcbiAgXCI0MjlcIjogXCJUb28gTWFueSBSZXF1ZXN0c1wiLFxuICBcIjQzMVwiOiBcIlJlcXVlc3QgSGVhZGVyIEZpZWxkcyBUb28gTGFyZ2VcIixcbiAgXCI1MDBcIjogXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIixcbiAgXCI1MDFcIjogXCJOb3QgSW1wbGVtZW50ZWRcIixcbiAgXCI1MDJcIjogXCJCYWQgR2F0ZXdheVwiLFxuICBcIjUwM1wiOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgXCI1MDRcIjogXCJHYXRld2F5IFRpbWUtb3V0XCIsXG4gIFwiNTA1XCI6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIixcbiAgXCI1MDZcIjogXCJWYXJpYW50IEFsc28gTmVnb3RpYXRlc1wiLFxuICBcIjUwN1wiOiBcIkluc3VmZmljaWVudCBTdG9yYWdlXCIsXG4gIFwiNTA5XCI6IFwiQmFuZHdpZHRoIExpbWl0IEV4Y2VlZGVkXCIsXG4gIFwiNTEwXCI6IFwiTm90IEV4dGVuZGVkXCIsXG4gIFwiNTExXCI6IFwiTmV0d29yayBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiXG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cblxuZnVuY3Rpb24gaXNBcnJheShhcmcpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhcmcpO1xuICB9XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gQnVmZmVyLmlzQnVmZmVyO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKTtcblxudmFyIGh0dHBzID0gbW9kdWxlLmV4cG9ydHM7XG5cbmZvciAodmFyIGtleSBpbiBodHRwKSB7XG4gICAgaWYgKGh0dHAuaGFzT3duUHJvcGVydHkoa2V5KSkgaHR0cHNba2V5XSA9IGh0dHBba2V5XTtcbn07XG5cbmh0dHBzLnJlcXVlc3QgPSBmdW5jdGlvbiAocGFyYW1zLCBjYikge1xuICAgIGlmICghcGFyYW1zKSBwYXJhbXMgPSB7fTtcbiAgICBwYXJhbXMuc2NoZW1lID0gJ2h0dHBzJztcbiAgICBwYXJhbXMucHJvdG9jb2wgPSAnaHR0cHM6JztcbiAgICByZXR1cm4gaHR0cC5yZXF1ZXN0LmNhbGwodGhpcywgcGFyYW1zLCBjYik7XG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLyoqXG4gKiBEZXRlcm1pbmUgaWYgYW4gb2JqZWN0IGlzIEJ1ZmZlclxuICpcbiAqIEF1dGhvcjogICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogTGljZW5zZTogIE1JVFxuICpcbiAqIGBucG0gaW5zdGFsbCBpcy1idWZmZXJgXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiAhIShvYmogIT0gbnVsbCAmJlxuICAgIChvYmouX2lzQnVmZmVyIHx8IC8vIEZvciBTYWZhcmkgNS03IChtaXNzaW5nIE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3IpXG4gICAgICAob2JqLmNvbnN0cnVjdG9yICYmXG4gICAgICB0eXBlb2Ygb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nICYmXG4gICAgICBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKSlcbiAgICApKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pZiAoIXByb2Nlc3MudmVyc2lvbiB8fFxuICAgIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MC4nKSA9PT0gMCB8fFxuICAgIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MS4nKSA9PT0gMCAmJiBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjEuOC4nKSAhPT0gMCkge1xuICBtb2R1bGUuZXhwb3J0cyA9IG5leHRUaWNrO1xufSBlbHNlIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBwcm9jZXNzLm5leHRUaWNrO1xufVxuXG5mdW5jdGlvbiBuZXh0VGljayhmbikge1xuICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gIHZhciBpID0gMDtcbiAgd2hpbGUgKGkgPCBhcmdzLmxlbmd0aCkge1xuICAgIGFyZ3NbaSsrXSA9IGFyZ3VtZW50c1tpXTtcbiAgfVxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uIGFmdGVyVGljaygpIHtcbiAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgfSk7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qISBodHRwczovL210aHMuYmUvcHVueWNvZGUgdjEuNC4wIGJ5IEBtYXRoaWFzICovXG47KGZ1bmN0aW9uKHJvb3QpIHtcblxuXHQvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGVzICovXG5cdHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHMgJiZcblx0XHQhZXhwb3J0cy5ub2RlVHlwZSAmJiBleHBvcnRzO1xuXHR2YXIgZnJlZU1vZHVsZSA9IHR5cGVvZiBtb2R1bGUgPT0gJ29iamVjdCcgJiYgbW9kdWxlICYmXG5cdFx0IW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG5cdHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG5cdGlmIChcblx0XHRmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsIHx8XG5cdFx0ZnJlZUdsb2JhbC5zZWxmID09PSBmcmVlR2xvYmFsXG5cdCkge1xuXHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcHVueWNvZGVgIG9iamVjdC5cblx0ICogQG5hbWUgcHVueWNvZGVcblx0ICogQHR5cGUgT2JqZWN0XG5cdCAqL1xuXHR2YXIgcHVueWNvZGUsXG5cblx0LyoqIEhpZ2hlc3QgcG9zaXRpdmUgc2lnbmVkIDMyLWJpdCBmbG9hdCB2YWx1ZSAqL1xuXHRtYXhJbnQgPSAyMTQ3NDgzNjQ3LCAvLyBha2EuIDB4N0ZGRkZGRkYgb3IgMl4zMS0xXG5cblx0LyoqIEJvb3RzdHJpbmcgcGFyYW1ldGVycyAqL1xuXHRiYXNlID0gMzYsXG5cdHRNaW4gPSAxLFxuXHR0TWF4ID0gMjYsXG5cdHNrZXcgPSAzOCxcblx0ZGFtcCA9IDcwMCxcblx0aW5pdGlhbEJpYXMgPSA3Mixcblx0aW5pdGlhbE4gPSAxMjgsIC8vIDB4ODBcblx0ZGVsaW1pdGVyID0gJy0nLCAvLyAnXFx4MkQnXG5cblx0LyoqIFJlZ3VsYXIgZXhwcmVzc2lvbnMgKi9cblx0cmVnZXhQdW55Y29kZSA9IC9eeG4tLS8sXG5cdHJlZ2V4Tm9uQVNDSUkgPSAvW15cXHgyMC1cXHg3RV0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvW1xceDJFXFx1MzAwMlxcdUZGMEVcXHVGRjYxXS9nLCAvLyBSRkMgMzQ5MCBzZXBhcmF0b3JzXG5cblx0LyoqIEVycm9yIG1lc3NhZ2VzICovXG5cdGVycm9ycyA9IHtcblx0XHQnb3ZlcmZsb3cnOiAnT3ZlcmZsb3c6IGlucHV0IG5lZWRzIHdpZGVyIGludGVnZXJzIHRvIHByb2Nlc3MnLFxuXHRcdCdub3QtYmFzaWMnOiAnSWxsZWdhbCBpbnB1dCA+PSAweDgwIChub3QgYSBiYXNpYyBjb2RlIHBvaW50KScsXG5cdFx0J2ludmFsaWQtaW5wdXQnOiAnSW52YWxpZCBpbnB1dCdcblx0fSxcblxuXHQvKiogQ29udmVuaWVuY2Ugc2hvcnRjdXRzICovXG5cdGJhc2VNaW51c1RNaW4gPSBiYXNlIC0gdE1pbixcblx0Zmxvb3IgPSBNYXRoLmZsb29yLFxuXHRzdHJpbmdGcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLFxuXG5cdC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgKi9cblx0a2V5O1xuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgZXJyb3IgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVGhlIGVycm9yIHR5cGUuXG5cdCAqIEByZXR1cm5zIHtFcnJvcn0gVGhyb3dzIGEgYFJhbmdlRXJyb3JgIHdpdGggdGhlIGFwcGxpY2FibGUgZXJyb3IgbWVzc2FnZS5cblx0ICovXG5cdGZ1bmN0aW9uIGVycm9yKHR5cGUpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0dmFyIHJlc3VsdCA9IFtdO1xuXHRcdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdFx0cmVzdWx0W2xlbmd0aF0gPSBmbihhcnJheVtsZW5ndGhdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3Mgb3IgZW1haWxcblx0ICogYWRkcmVzc2VzLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0dmFyIHBhcnRzID0gc3RyaW5nLnNwbGl0KCdAJyk7XG5cdFx0dmFyIHJlc3VsdCA9ICcnO1xuXHRcdGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG5cdFx0XHQvLyBJbiBlbWFpbCBhZGRyZXNzZXMsIG9ubHkgdGhlIGRvbWFpbiBuYW1lIHNob3VsZCBiZSBwdW55Y29kZWQuIExlYXZlXG5cdFx0XHQvLyB0aGUgbG9jYWwgcGFydCAoaS5lLiBldmVyeXRoaW5nIHVwIHRvIGBAYCkgaW50YWN0LlxuXHRcdFx0cmVzdWx0ID0gcGFydHNbMF0gKyAnQCc7XG5cdFx0XHRzdHJpbmcgPSBwYXJ0c1sxXTtcblx0XHR9XG5cdFx0Ly8gQXZvaWQgYHNwbGl0KHJlZ2V4KWAgZm9yIElFOCBjb21wYXRpYmlsaXR5LiBTZWUgIzE3LlxuXHRcdHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKHJlZ2V4U2VwYXJhdG9ycywgJ1xceDJFJyk7XG5cdFx0dmFyIGxhYmVscyA9IHN0cmluZy5zcGxpdCgnLicpO1xuXHRcdHZhciBlbmNvZGVkID0gbWFwKGxhYmVscywgZm4pLmpvaW4oJy4nKTtcblx0XHRyZXR1cm4gcmVzdWx0ICsgZW5jb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBkZWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgVW5pY29kZSBpbnB1dCBzdHJpbmcgKFVDUy0yKS5cblx0ICogQHJldHVybnMge0FycmF5fSBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGNvdW50ZXIgPSAwLFxuXHRcdCAgICBsZW5ndGggPSBzdHJpbmcubGVuZ3RoLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgZXh0cmE7XG5cdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7IC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJpbmcgYmFzZWQgb24gYW4gYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGVuY29kZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2RlUG9pbnRzIFRoZSBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmV3IFVuaWNvZGUgc3RyaW5nIChVQ1MtMikuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0cmV0dXJuIG1hcChhcnJheSwgZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgYmFzaWMgY29kZSBwb2ludCBpbnRvIGEgZGlnaXQvaW50ZWdlci5cblx0ICogQHNlZSBgZGlnaXRUb0Jhc2ljKClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlUG9pbnQgVGhlIGJhc2ljIG51bWVyaWMgY29kZSBwb2ludCB2YWx1ZS5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50IChmb3IgdXNlIGluXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcblx0ICogdGhlIGNvZGUgcG9pbnQgZG9lcyBub3QgcmVwcmVzZW50IGEgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50KSB7XG5cdFx0aWYgKGNvZGVQb2ludCAtIDQ4IDwgMTApIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSAyMjtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDY1IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA2NTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDk3IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA5Nztcblx0XHR9XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAc2VlIGBiYXNpY1RvRGlnaXQoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRpZ2l0IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGJhc2ljIGNvZGUgcG9pbnQgd2hvc2UgdmFsdWUgKHdoZW4gdXNlZCBmb3Jcblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpcyBgZGlnaXRgLCB3aGljaCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2Vcblx0ICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG5cdCAqIHVzZWQ7IGVsc2UsIHRoZSBsb3dlcmNhc2UgZm9ybSBpcyB1c2VkLiBUaGUgYmVoYXZpb3IgaXMgdW5kZWZpbmVkXG5cdCAqIGlmIGBmbGFnYCBpcyBub24temVybyBhbmQgYGRpZ2l0YCBoYXMgbm8gdXBwZXJjYXNlIGZvcm0uXG5cdCAqL1xuXHRmdW5jdGlvbiBkaWdpdFRvQmFzaWMoZGlnaXQsIGZsYWcpIHtcblx0XHQvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuXHRcdC8vIDI2Li4zNSBtYXAgdG8gQVNDSUkgMC4uOVxuXHRcdHJldHVybiBkaWdpdCArIDIyICsgNzUgKiAoZGlnaXQgPCAyNikgLSAoKGZsYWcgIT0gMCkgPDwgNSk7XG5cdH1cblxuXHQvKipcblx0ICogQmlhcyBhZGFwdGF0aW9uIGZ1bmN0aW9uIGFzIHBlciBzZWN0aW9uIDMuNCBvZiBSRkMgMzQ5Mi5cblx0ICogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0OTIjc2VjdGlvbi0zLjRcblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIGFkYXB0KGRlbHRhLCBudW1Qb2ludHMsIGZpcnN0VGltZSkge1xuXHRcdHZhciBrID0gMDtcblx0XHRkZWx0YSA9IGZpcnN0VGltZSA/IGZsb29yKGRlbHRhIC8gZGFtcCkgOiBkZWx0YSA+PiAxO1xuXHRcdGRlbHRhICs9IGZsb29yKGRlbHRhIC8gbnVtUG9pbnRzKTtcblx0XHRmb3IgKC8qIG5vIGluaXRpYWxpemF0aW9uICovOyBkZWx0YSA+IGJhc2VNaW51c1RNaW4gKiB0TWF4ID4+IDE7IGsgKz0gYmFzZSkge1xuXHRcdFx0ZGVsdGEgPSBmbG9vcihkZWx0YSAvIGJhc2VNaW51c1RNaW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gZmxvb3IoayArIChiYXNlTWludXNUTWluICsgMSkgKiBkZWx0YSAvIChkZWx0YSArIHNrZXcpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMgdG8gYSBzdHJpbmcgb2YgVW5pY29kZVxuXHQgKiBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBkZWNvZGUoaW5wdXQpIHtcblx0XHQvLyBEb24ndCB1c2UgVUNTLTJcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoLFxuXHRcdCAgICBvdXQsXG5cdFx0ICAgIGkgPSAwLFxuXHRcdCAgICBuID0gaW5pdGlhbE4sXG5cdFx0ICAgIGJpYXMgPSBpbml0aWFsQmlhcyxcblx0XHQgICAgYmFzaWMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIGluZGV4LFxuXHRcdCAgICBvbGRpLFxuXHRcdCAgICB3LFxuXHRcdCAgICBrLFxuXHRcdCAgICBkaWdpdCxcblx0XHQgICAgdCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGJhc2VNaW51c1Q7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzOiBsZXQgYGJhc2ljYCBiZSB0aGUgbnVtYmVyIG9mIGlucHV0IGNvZGVcblx0XHQvLyBwb2ludHMgYmVmb3JlIHRoZSBsYXN0IGRlbGltaXRlciwgb3IgYDBgIGlmIHRoZXJlIGlzIG5vbmUsIHRoZW4gY29weVxuXHRcdC8vIHRoZSBmaXJzdCBiYXNpYyBjb2RlIHBvaW50cyB0byB0aGUgb3V0cHV0LlxuXG5cdFx0YmFzaWMgPSBpbnB1dC5sYXN0SW5kZXhPZihkZWxpbWl0ZXIpO1xuXHRcdGlmIChiYXNpYyA8IDApIHtcblx0XHRcdGJhc2ljID0gMDtcblx0XHR9XG5cblx0XHRmb3IgKGogPSAwOyBqIDwgYmFzaWM7ICsraikge1xuXHRcdFx0Ly8gaWYgaXQncyBub3QgYSBiYXNpYyBjb2RlIHBvaW50XG5cdFx0XHRpZiAoaW5wdXQuY2hhckNvZGVBdChqKSA+PSAweDgwKSB7XG5cdFx0XHRcdGVycm9yKCdub3QtYmFzaWMnKTtcblx0XHRcdH1cblx0XHRcdG91dHB1dC5wdXNoKGlucHV0LmNoYXJDb2RlQXQoaikpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZGVjb2RpbmcgbG9vcDogc3RhcnQganVzdCBhZnRlciB0aGUgbGFzdCBkZWxpbWl0ZXIgaWYgYW55IGJhc2ljIGNvZGVcblx0XHQvLyBwb2ludHMgd2VyZSBjb3BpZWQ7IHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcgb3RoZXJ3aXNlLlxuXG5cdFx0Zm9yIChpbmRleCA9IGJhc2ljID4gMCA/IGJhc2ljICsgMSA6IDA7IGluZGV4IDwgaW5wdXRMZW5ndGg7IC8qIG5vIGZpbmFsIGV4cHJlc3Npb24gKi8pIHtcblxuXHRcdFx0Ly8gYGluZGV4YCBpcyB0aGUgaW5kZXggb2YgdGhlIG5leHQgY2hhcmFjdGVyIHRvIGJlIGNvbnN1bWVkLlxuXHRcdFx0Ly8gRGVjb2RlIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXIgaW50byBgZGVsdGFgLFxuXHRcdFx0Ly8gd2hpY2ggZ2V0cyBhZGRlZCB0byBgaWAuIFRoZSBvdmVyZmxvdyBjaGVja2luZyBpcyBlYXNpZXJcblx0XHRcdC8vIGlmIHdlIGluY3JlYXNlIGBpYCBhcyB3ZSBnbywgdGhlbiBzdWJ0cmFjdCBvZmYgaXRzIHN0YXJ0aW5nXG5cdFx0XHQvLyB2YWx1ZSBhdCB0aGUgZW5kIHRvIG9idGFpbiBgZGVsdGFgLlxuXHRcdFx0Zm9yIChvbGRpID0gaSwgdyA9IDEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXG5cdFx0XHRcdGlmIChpbmRleCA+PSBpbnB1dExlbmd0aCkge1xuXHRcdFx0XHRcdGVycm9yKCdpbnZhbGlkLWlucHV0Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkaWdpdCA9IGJhc2ljVG9EaWdpdChpbnB1dC5jaGFyQ29kZUF0KGluZGV4KyspKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPj0gYmFzZSB8fCBkaWdpdCA+IGZsb29yKChtYXhJbnQgLSBpKSAvIHcpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpICs9IGRpZ2l0ICogdztcblx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0IDwgdCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRpZiAodyA+IGZsb29yKG1heEludCAvIGJhc2VNaW51c1QpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3ICo9IGJhc2VNaW51c1Q7XG5cblx0XHRcdH1cblxuXHRcdFx0b3V0ID0gb3V0cHV0Lmxlbmd0aCArIDE7XG5cdFx0XHRiaWFzID0gYWRhcHQoaSAtIG9sZGksIG91dCwgb2xkaSA9PSAwKTtcblxuXHRcdFx0Ly8gYGlgIHdhcyBzdXBwb3NlZCB0byB3cmFwIGFyb3VuZCBmcm9tIGBvdXRgIHRvIGAwYCxcblx0XHRcdC8vIGluY3JlbWVudGluZyBgbmAgZWFjaCB0aW1lLCBzbyB3ZSdsbCBmaXggdGhhdCBub3c6XG5cdFx0XHRpZiAoZmxvb3IoaSAvIG91dCkgPiBtYXhJbnQgLSBuKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRuICs9IGZsb29yKGkgLyBvdXQpO1xuXHRcdFx0aSAlPSBvdXQ7XG5cblx0XHRcdC8vIEluc2VydCBgbmAgYXQgcG9zaXRpb24gYGlgIG9mIHRoZSBvdXRwdXRcblx0XHRcdG91dHB1dC5zcGxpY2UoaSsrLCAwLCBuKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiB1Y3MyZW5jb2RlKG91dHB1dCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzIChlLmcuIGEgZG9tYWluIG5hbWUgbGFiZWwpIHRvIGFcblx0ICogUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZW5jb2RlKGlucHV0KSB7XG5cdFx0dmFyIG4sXG5cdFx0ICAgIGRlbHRhLFxuXHRcdCAgICBoYW5kbGVkQ1BDb3VudCxcblx0XHQgICAgYmFzaWNMZW5ndGgsXG5cdFx0ICAgIGJpYXMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIG0sXG5cdFx0ICAgIHEsXG5cdFx0ICAgIGssXG5cdFx0ICAgIHQsXG5cdFx0ICAgIGN1cnJlbnRWYWx1ZSxcblx0XHQgICAgb3V0cHV0ID0gW10sXG5cdFx0ICAgIC8qKiBgaW5wdXRMZW5ndGhgIHdpbGwgaG9sZCB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIGluIGBpbnB1dGAuICovXG5cdFx0ICAgIGlucHV0TGVuZ3RoLFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgaGFuZGxlZENQQ291bnRQbHVzT25lLFxuXHRcdCAgICBiYXNlTWludXNULFxuXHRcdCAgICBxTWludXNUO1xuXG5cdFx0Ly8gQ29udmVydCB0aGUgaW5wdXQgaW4gVUNTLTIgdG8gVW5pY29kZVxuXHRcdGlucHV0ID0gdWNzMmRlY29kZShpbnB1dCk7XG5cblx0XHQvLyBDYWNoZSB0aGUgbGVuZ3RoXG5cdFx0aW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGg7XG5cblx0XHQvLyBJbml0aWFsaXplIHRoZSBzdGF0ZVxuXHRcdG4gPSBpbml0aWFsTjtcblx0XHRkZWx0YSA9IDA7XG5cdFx0YmlhcyA9IGluaXRpYWxCaWFzO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50c1xuXHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCAweDgwKSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShjdXJyZW50VmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRoYW5kbGVkQ1BDb3VudCA9IGJhc2ljTGVuZ3RoID0gb3V0cHV0Lmxlbmd0aDtcblxuXHRcdC8vIGBoYW5kbGVkQ1BDb3VudGAgaXMgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyB0aGF0IGhhdmUgYmVlbiBoYW5kbGVkO1xuXHRcdC8vIGBiYXNpY0xlbmd0aGAgaXMgdGhlIG51bWJlciBvZiBiYXNpYyBjb2RlIHBvaW50cy5cblxuXHRcdC8vIEZpbmlzaCB0aGUgYmFzaWMgc3RyaW5nIC0gaWYgaXQgaXMgbm90IGVtcHR5IC0gd2l0aCBhIGRlbGltaXRlclxuXHRcdGlmIChiYXNpY0xlbmd0aCkge1xuXHRcdFx0b3V0cHV0LnB1c2goZGVsaW1pdGVyKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGVuY29kaW5nIGxvb3A6XG5cdFx0d2hpbGUgKGhhbmRsZWRDUENvdW50IDwgaW5wdXRMZW5ndGgpIHtcblxuXHRcdFx0Ly8gQWxsIG5vbi1iYXNpYyBjb2RlIHBvaW50cyA8IG4gaGF2ZSBiZWVuIGhhbmRsZWQgYWxyZWFkeS4gRmluZCB0aGUgbmV4dFxuXHRcdFx0Ly8gbGFyZ2VyIG9uZTpcblx0XHRcdGZvciAobSA9IG1heEludCwgaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID49IG4gJiYgY3VycmVudFZhbHVlIDwgbSkge1xuXHRcdFx0XHRcdG0gPSBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW5jcmVhc2UgYGRlbHRhYCBlbm91Z2ggdG8gYWR2YW5jZSB0aGUgZGVjb2RlcidzIDxuLGk+IHN0YXRlIHRvIDxtLDA+LFxuXHRcdFx0Ly8gYnV0IGd1YXJkIGFnYWluc3Qgb3ZlcmZsb3dcblx0XHRcdGhhbmRsZWRDUENvdW50UGx1c09uZSA9IGhhbmRsZWRDUENvdW50ICsgMTtcblx0XHRcdGlmIChtIC0gbiA+IGZsb29yKChtYXhJbnQgLSBkZWx0YSkgLyBoYW5kbGVkQ1BDb3VudFBsdXNPbmUpKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRkZWx0YSArPSAobSAtIG4pICogaGFuZGxlZENQQ291bnRQbHVzT25lO1xuXHRcdFx0biA9IG07XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCBuICYmICsrZGVsdGEgPiBtYXhJbnQpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPT0gbikge1xuXHRcdFx0XHRcdC8vIFJlcHJlc2VudCBkZWx0YSBhcyBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyXG5cdFx0XHRcdFx0Zm9yIChxID0gZGVsdGEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXHRcdFx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cdFx0XHRcdFx0XHRpZiAocSA8IHQpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRxTWludXNUID0gcSAtIHQ7XG5cdFx0XHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaChcblx0XHRcdFx0XHRcdFx0c3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyh0ICsgcU1pbnVzVCAlIGJhc2VNaW51c1QsIDApKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdHEgPSBmbG9vcihxTWludXNUIC8gYmFzZU1pbnVzVCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyhxLCAwKSkpO1xuXHRcdFx0XHRcdGJpYXMgPSBhZGFwdChkZWx0YSwgaGFuZGxlZENQQ291bnRQbHVzT25lLCBoYW5kbGVkQ1BDb3VudCA9PSBiYXNpY0xlbmd0aCk7XG5cdFx0XHRcdFx0ZGVsdGEgPSAwO1xuXHRcdFx0XHRcdCsraGFuZGxlZENQQ291bnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0KytkZWx0YTtcblx0XHRcdCsrbjtcblxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0LmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIG9yIGFuIGVtYWlsIGFkZHJlc3Ncblx0ICogdG8gVW5pY29kZS4gT25seSB0aGUgUHVueWNvZGVkIHBhcnRzIG9mIHRoZSBpbnB1dCB3aWxsIGJlIGNvbnZlcnRlZCwgaS5lLlxuXHQgKiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCBvbiBhIHN0cmluZyB0aGF0IGhhcyBhbHJlYWR5IGJlZW5cblx0ICogY29udmVydGVkIHRvIFVuaWNvZGUuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlZCBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvXG5cdCAqIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShpbnB1dCkge1xuXHRcdHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4UHVueWNvZGUudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gZGVjb2RlKHN0cmluZy5zbGljZSg0KS50b0xvd2VyQ2FzZSgpKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFVuaWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIG9yIGFuIGVtYWlsIGFkZHJlc3MgdG9cblx0ICogUHVueWNvZGUuIE9ubHkgdGhlIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsXG5cdCAqIGkuZS4gaXQgZG9lc24ndCBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpblxuXHQgKiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0byBjb252ZXJ0LCBhcyBhXG5cdCAqIFVuaWNvZGUgc3RyaW5nLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgUHVueWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGRvbWFpbiBuYW1lIG9yXG5cdCAqIGVtYWlsIGFkZHJlc3MuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGlucHV0KSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihpbnB1dCwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhOb25BU0NJSS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyAneG4tLScgKyBlbmNvZGUoc3RyaW5nKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKiBEZWZpbmUgdGhlIHB1YmxpYyBBUEkgKi9cblx0cHVueWNvZGUgPSB7XG5cdFx0LyoqXG5cdFx0ICogQSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBjdXJyZW50IFB1bnljb2RlLmpzIHZlcnNpb24gbnVtYmVyLlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIFN0cmluZ1xuXHRcdCAqL1xuXHRcdCd2ZXJzaW9uJzogJzEuMy4yJyxcblx0XHQvKipcblx0XHQgKiBBbiBvYmplY3Qgb2YgbWV0aG9kcyB0byBjb252ZXJ0IGZyb20gSmF2YVNjcmlwdCdzIGludGVybmFsIGNoYXJhY3RlclxuXHRcdCAqIHJlcHJlc2VudGF0aW9uIChVQ1MtMikgdG8gVW5pY29kZSBjb2RlIHBvaW50cywgYW5kIGJhY2suXG5cdFx0ICogQHNlZSA8aHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgT2JqZWN0XG5cdFx0ICovXG5cdFx0J3VjczInOiB7XG5cdFx0XHQnZGVjb2RlJzogdWNzMmRlY29kZSxcblx0XHRcdCdlbmNvZGUnOiB1Y3MyZW5jb2RlXG5cdFx0fSxcblx0XHQnZGVjb2RlJzogZGVjb2RlLFxuXHRcdCdlbmNvZGUnOiBlbmNvZGUsXG5cdFx0J3RvQVNDSUknOiB0b0FTQ0lJLFxuXHRcdCd0b1VuaWNvZGUnOiB0b1VuaWNvZGVcblx0fTtcblxuXHQvKiogRXhwb3NlIGBwdW55Y29kZWAgKi9cblx0Ly8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zXG5cdC8vIGxpa2UgdGhlIGZvbGxvd2luZzpcblx0aWYgKFxuXHRcdHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmXG5cdFx0ZGVmaW5lLmFtZFxuXHQpIHtcblx0XHRkZWZpbmUoJ3B1bnljb2RlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gcHVueWNvZGU7XG5cdFx0fSk7XG5cdH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xuXHRcdGlmIChtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cykge1xuXHRcdFx0Ly8gaW4gTm9kZS5qcywgaW8uanMsIG9yIFJpbmdvSlMgdjAuOC4wK1xuXHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gcHVueWNvZGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGluIE5hcndoYWwgb3IgUmluZ29KUyB2MC43LjAtXG5cdFx0XHRmb3IgKGtleSBpbiBwdW55Y29kZSkge1xuXHRcdFx0XHRwdW55Y29kZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIChmcmVlRXhwb3J0c1trZXldID0gcHVueWNvZGVba2V5XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIGluIFJoaW5vIG9yIGEgd2ViIGJyb3dzZXJcblx0XHRyb290LnB1bnljb2RlID0gcHVueWNvZGU7XG5cdH1cblxufSh0aGlzKSk7XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fZHVwbGV4LmpzXCIpXG4iLCIvLyBhIGR1cGxleCBzdHJlYW0gaXMganVzdCBhIHN0cmVhbSB0aGF0IGlzIGJvdGggcmVhZGFibGUgYW5kIHdyaXRhYmxlLlxuLy8gU2luY2UgSlMgZG9lc24ndCBoYXZlIG11bHRpcGxlIHByb3RvdHlwYWwgaW5oZXJpdGFuY2UsIHRoaXMgY2xhc3Ncbi8vIHByb3RvdHlwYWxseSBpbmhlcml0cyBmcm9tIFJlYWRhYmxlLCBhbmQgdGhlbiBwYXJhc2l0aWNhbGx5IGZyb21cbi8vIFdyaXRhYmxlLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikga2V5cy5wdXNoKGtleSk7XG4gIHJldHVybiBrZXlzO1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cblxubW9kdWxlLmV4cG9ydHMgPSBEdXBsZXg7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgUmVhZGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fcmVhZGFibGUnKTtcbnZhciBXcml0YWJsZSA9IHJlcXVpcmUoJy4vX3N0cmVhbV93cml0YWJsZScpO1xuXG51dGlsLmluaGVyaXRzKER1cGxleCwgUmVhZGFibGUpO1xuXG52YXIga2V5cyA9IG9iamVjdEtleXMoV3JpdGFibGUucHJvdG90eXBlKTtcbmZvciAodmFyIHYgPSAwOyB2IDwga2V5cy5sZW5ndGg7IHYrKykge1xuICB2YXIgbWV0aG9kID0ga2V5c1t2XTtcbiAgaWYgKCFEdXBsZXgucHJvdG90eXBlW21ldGhvZF0pXG4gICAgRHVwbGV4LnByb3RvdHlwZVttZXRob2RdID0gV3JpdGFibGUucHJvdG90eXBlW21ldGhvZF07XG59XG5cbmZ1bmN0aW9uIER1cGxleChvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBEdXBsZXgpKVxuICAgIHJldHVybiBuZXcgRHVwbGV4KG9wdGlvbnMpO1xuXG4gIFJlYWRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gIFdyaXRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yZWFkYWJsZSA9PT0gZmFsc2UpXG4gICAgdGhpcy5yZWFkYWJsZSA9IGZhbHNlO1xuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMud3JpdGFibGUgPT09IGZhbHNlKVxuICAgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcblxuICB0aGlzLmFsbG93SGFsZk9wZW4gPSB0cnVlO1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmFsbG93SGFsZk9wZW4gPT09IGZhbHNlKVxuICAgIHRoaXMuYWxsb3dIYWxmT3BlbiA9IGZhbHNlO1xuXG4gIHRoaXMub25jZSgnZW5kJywgb25lbmQpO1xufVxuXG4vLyB0aGUgbm8taGFsZi1vcGVuIGVuZm9yY2VyXG5mdW5jdGlvbiBvbmVuZCgpIHtcbiAgLy8gaWYgd2UgYWxsb3cgaGFsZi1vcGVuIHN0YXRlLCBvciBpZiB0aGUgd3JpdGFibGUgc2lkZSBlbmRlZCxcbiAgLy8gdGhlbiB3ZSdyZSBvay5cbiAgaWYgKHRoaXMuYWxsb3dIYWxmT3BlbiB8fCB0aGlzLl93cml0YWJsZVN0YXRlLmVuZGVkKVxuICAgIHJldHVybjtcblxuICAvLyBubyBtb3JlIGRhdGEgY2FuIGJlIHdyaXR0ZW4uXG4gIC8vIEJ1dCBhbGxvdyBtb3JlIHdyaXRlcyB0byBoYXBwZW4gaW4gdGhpcyB0aWNrLlxuICBwcm9jZXNzTmV4dFRpY2sob25FbmROVCwgdGhpcyk7XG59XG5cbmZ1bmN0aW9uIG9uRW5kTlQoc2VsZikge1xuICBzZWxmLmVuZCgpO1xufVxuXG5mdW5jdGlvbiBmb3JFYWNoICh4cywgZikge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGYoeHNbaV0sIGkpO1xuICB9XG59XG4iLCIvLyBhIHBhc3N0aHJvdWdoIHN0cmVhbS5cbi8vIGJhc2ljYWxseSBqdXN0IHRoZSBtb3N0IG1pbmltYWwgc29ydCBvZiBUcmFuc2Zvcm0gc3RyZWFtLlxuLy8gRXZlcnkgd3JpdHRlbiBjaHVuayBnZXRzIG91dHB1dCBhcy1pcy5cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhc3NUaHJvdWdoO1xuXG52YXIgVHJhbnNmb3JtID0gcmVxdWlyZSgnLi9fc3RyZWFtX3RyYW5zZm9ybScpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnV0aWwuaW5oZXJpdHMoUGFzc1Rocm91Z2gsIFRyYW5zZm9ybSk7XG5cbmZ1bmN0aW9uIFBhc3NUaHJvdWdoKG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFBhc3NUaHJvdWdoKSlcbiAgICByZXR1cm4gbmV3IFBhc3NUaHJvdWdoKG9wdGlvbnMpO1xuXG4gIFRyYW5zZm9ybS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xufVxuXG5QYXNzVGhyb3VnaC5wcm90b3R5cGUuX3RyYW5zZm9ybSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobnVsbCwgY2h1bmspO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFkYWJsZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBwcm9jZXNzTmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzLW5leHRpY2stYXJncycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuUmVhZGFibGUuUmVhZGFibGVTdGF0ZSA9IFJlYWRhYmxlU3RhdGU7XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIEVFbGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJzKHR5cGUpLmxlbmd0aDtcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgU3RyZWFtO1xuKGZ1bmN0aW9uICgpe3RyeXtcbiAgU3RyZWFtID0gcmVxdWlyZSgnc3QnICsgJ3JlYW0nKTtcbn1jYXRjaChfKXt9ZmluYWxseXtcbiAgaWYgKCFTdHJlYW0pXG4gICAgU3RyZWFtID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xufX0oKSlcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGRlYnVnVXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcbnZhciBkZWJ1ZztcbmlmIChkZWJ1Z1V0aWwgJiYgZGVidWdVdGlsLmRlYnVnbG9nKSB7XG4gIGRlYnVnID0gZGVidWdVdGlsLmRlYnVnbG9nKCdzdHJlYW0nKTtcbn0gZWxzZSB7XG4gIGRlYnVnID0gZnVuY3Rpb24gKCkge307XG59XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFN0cmluZ0RlY29kZXI7XG5cbnV0aWwuaW5oZXJpdHMoUmVhZGFibGUsIFN0cmVhbSk7XG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHN0cmVhbSkge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIG9iamVjdCBzdHJlYW0gZmxhZy4gVXNlZCB0byBtYWtlIHJlYWQobikgaWdub3JlIG4gYW5kIHRvXG4gIC8vIG1ha2UgYWxsIHRoZSBidWZmZXIgbWVyZ2luZyBhbmQgbGVuZ3RoIGNoZWNrcyBnbyBhd2F5XG4gIHRoaXMub2JqZWN0TW9kZSA9ICEhb3B0aW9ucy5vYmplY3RNb2RlO1xuXG4gIGlmIChzdHJlYW0gaW5zdGFuY2VvZiBEdXBsZXgpXG4gICAgdGhpcy5vYmplY3RNb2RlID0gdGhpcy5vYmplY3RNb2RlIHx8ICEhb3B0aW9ucy5yZWFkYWJsZU9iamVjdE1vZGU7XG5cbiAgLy8gdGhlIHBvaW50IGF0IHdoaWNoIGl0IHN0b3BzIGNhbGxpbmcgX3JlYWQoKSB0byBmaWxsIHRoZSBidWZmZXJcbiAgLy8gTm90ZTogMCBpcyBhIHZhbGlkIHZhbHVlLCBtZWFucyBcImRvbid0IGNhbGwgX3JlYWQgcHJlZW1wdGl2ZWx5IGV2ZXJcIlxuICB2YXIgaHdtID0gb3B0aW9ucy5oaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSAoaHdtIHx8IGh3bSA9PT0gMCkgPyBod20gOiBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gfn50aGlzLmhpZ2hXYXRlck1hcms7XG5cbiAgdGhpcy5idWZmZXIgPSBbXTtcbiAgdGhpcy5sZW5ndGggPSAwO1xuICB0aGlzLnBpcGVzID0gbnVsbDtcbiAgdGhpcy5waXBlc0NvdW50ID0gMDtcbiAgdGhpcy5mbG93aW5nID0gbnVsbDtcbiAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICB0aGlzLmVuZEVtaXR0ZWQgPSBmYWxzZTtcbiAgdGhpcy5yZWFkaW5nID0gZmFsc2U7XG5cbiAgLy8gYSBmbGFnIHRvIGJlIGFibGUgdG8gdGVsbCBpZiB0aGUgb253cml0ZSBjYiBpcyBjYWxsZWQgaW1tZWRpYXRlbHksXG4gIC8vIG9yIG9uIGEgbGF0ZXIgdGljay4gIFdlIHNldCB0aGlzIHRvIHRydWUgYXQgZmlyc3QsIGJlY2F1c2UgYW55XG4gIC8vIGFjdGlvbnMgdGhhdCBzaG91bGRuJ3QgaGFwcGVuIHVudGlsIFwibGF0ZXJcIiBzaG91bGQgZ2VuZXJhbGx5IGFsc29cbiAgLy8gbm90IGhhcHBlbiBiZWZvcmUgdGhlIGZpcnN0IHdyaXRlIGNhbGwuXG4gIHRoaXMuc3luYyA9IHRydWU7XG5cbiAgLy8gd2hlbmV2ZXIgd2UgcmV0dXJuIG51bGwsIHRoZW4gd2Ugc2V0IGEgZmxhZyB0byBzYXlcbiAgLy8gdGhhdCB3ZSdyZSBhd2FpdGluZyBhICdyZWFkYWJsZScgZXZlbnQgZW1pc3Npb24uXG4gIHRoaXMubmVlZFJlYWRhYmxlID0gZmFsc2U7XG4gIHRoaXMuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG4gIHRoaXMucmVhZGFibGVMaXN0ZW5pbmcgPSBmYWxzZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyB3aGVuIHBpcGluZywgd2Ugb25seSBjYXJlIGFib3V0ICdyZWFkYWJsZScgZXZlbnRzIHRoYXQgaGFwcGVuXG4gIC8vIGFmdGVyIHJlYWQoKWluZyBhbGwgdGhlIGJ5dGVzIGFuZCBub3QgZ2V0dGluZyBhbnkgcHVzaGJhY2suXG4gIHRoaXMucmFuT3V0ID0gZmFsc2U7XG5cbiAgLy8gdGhlIG51bWJlciBvZiB3cml0ZXJzIHRoYXQgYXJlIGF3YWl0aW5nIGEgZHJhaW4gZXZlbnQgaW4gLnBpcGUoKXNcbiAgdGhpcy5hd2FpdERyYWluID0gMDtcblxuICAvLyBpZiB0cnVlLCBhIG1heWJlUmVhZE1vcmUgaGFzIGJlZW4gc2NoZWR1bGVkXG4gIHRoaXMucmVhZGluZ01vcmUgPSBmYWxzZTtcblxuICB0aGlzLmRlY29kZXIgPSBudWxsO1xuICB0aGlzLmVuY29kaW5nID0gbnVsbDtcbiAgaWYgKG9wdGlvbnMuZW5jb2RpbmcpIHtcbiAgICBpZiAoIVN0cmluZ0RlY29kZXIpXG4gICAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgICB0aGlzLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihvcHRpb25zLmVuY29kaW5nKTtcbiAgICB0aGlzLmVuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZztcbiAgfVxufVxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gUmVhZGFibGUob3B0aW9ucykge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZWFkYWJsZSkpXG4gICAgcmV0dXJuIG5ldyBSZWFkYWJsZShvcHRpb25zKTtcblxuICB0aGlzLl9yZWFkYWJsZVN0YXRlID0gbmV3IFJlYWRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5XG4gIHRoaXMucmVhZGFibGUgPSB0cnVlO1xuXG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnJlYWQgPT09ICdmdW5jdGlvbicpXG4gICAgdGhpcy5fcmVhZCA9IG9wdGlvbnMucmVhZDtcblxuICBTdHJlYW0uY2FsbCh0aGlzKTtcbn1cblxuLy8gTWFudWFsbHkgc2hvdmUgc29tZXRoaW5nIGludG8gdGhlIHJlYWQoKSBidWZmZXIuXG4vLyBUaGlzIHJldHVybnMgdHJ1ZSBpZiB0aGUgaGlnaFdhdGVyTWFyayBoYXMgbm90IGJlZW4gaGl0IHlldCxcbi8vIHNpbWlsYXIgdG8gaG93IFdyaXRhYmxlLndyaXRlKCkgcmV0dXJucyB0cnVlIGlmIHlvdSBzaG91bGRcbi8vIHdyaXRlKCkgc29tZSBtb3JlLlxuUmVhZGFibGUucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gZW5jb2RpbmcgfHwgc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuICAgIGlmIChlbmNvZGluZyAhPT0gc3RhdGUuZW5jb2RpbmcpIHtcbiAgICAgIGNodW5rID0gbmV3IEJ1ZmZlcihjaHVuaywgZW5jb2RpbmcpO1xuICAgICAgZW5jb2RpbmcgPSAnJztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVhZGFibGVBZGRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBmYWxzZSk7XG59O1xuXG4vLyBVbnNoaWZ0IHNob3VsZCAqYWx3YXlzKiBiZSBzb21ldGhpbmcgZGlyZWN0bHkgb3V0IG9mIHJlYWQoKVxuUmVhZGFibGUucHJvdG90eXBlLnVuc2hpZnQgPSBmdW5jdGlvbihjaHVuaykge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICByZXR1cm4gcmVhZGFibGVBZGRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssICcnLCB0cnVlKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5pc1BhdXNlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nID09PSBmYWxzZTtcbn07XG5cbmZ1bmN0aW9uIHJlYWRhYmxlQWRkQ2h1bmsoc3RyZWFtLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBhZGRUb0Zyb250KSB7XG4gIHZhciBlciA9IGNodW5rSW52YWxpZChzdGF0ZSwgY2h1bmspO1xuICBpZiAoZXIpIHtcbiAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gIH0gZWxzZSBpZiAoY2h1bmsgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG4gICAgb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKTtcbiAgfSBlbHNlIGlmIChzdGF0ZS5vYmplY3RNb2RlIHx8IGNodW5rICYmIGNodW5rLmxlbmd0aCA+IDApIHtcbiAgICBpZiAoc3RhdGUuZW5kZWQgJiYgIWFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0ucHVzaCgpIGFmdGVyIEVPRicpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5lbmRFbWl0dGVkICYmIGFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0udW5zaGlmdCgpIGFmdGVyIGVuZCBldmVudCcpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFhZGRUb0Zyb250ICYmICFlbmNvZGluZylcbiAgICAgICAgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLndyaXRlKGNodW5rKTtcblxuICAgICAgaWYgKCFhZGRUb0Zyb250KVxuICAgICAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG5cbiAgICAgIC8vIGlmIHdlIHdhbnQgdGhlIGRhdGEgbm93LCBqdXN0IGVtaXQgaXQuXG4gICAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5sZW5ndGggPT09IDAgJiYgIXN0YXRlLnN5bmMpIHtcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2RhdGEnLCBjaHVuayk7XG4gICAgICAgIHN0cmVhbS5yZWFkKDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBidWZmZXIgaW5mby5cbiAgICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgICAgICBpZiAoYWRkVG9Gcm9udClcbiAgICAgICAgICBzdGF0ZS5idWZmZXIudW5zaGlmdChjaHVuayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG5cbiAgICAgICAgaWYgKHN0YXRlLm5lZWRSZWFkYWJsZSlcbiAgICAgICAgICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbiAgICAgIH1cblxuICAgICAgbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoIWFkZFRvRnJvbnQpIHtcbiAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gbmVlZE1vcmVEYXRhKHN0YXRlKTtcbn1cblxuXG4vLyBpZiBpdCdzIHBhc3QgdGhlIGhpZ2ggd2F0ZXIgbWFyaywgd2UgY2FuIHB1c2ggaW4gc29tZSBtb3JlLlxuLy8gQWxzbywgaWYgd2UgaGF2ZSBubyBkYXRhIHlldCwgd2UgY2FuIHN0YW5kIHNvbWVcbi8vIG1vcmUgYnl0ZXMuICBUaGlzIGlzIHRvIHdvcmsgYXJvdW5kIGNhc2VzIHdoZXJlIGh3bT0wLFxuLy8gc3VjaCBhcyB0aGUgcmVwbC4gIEFsc28sIGlmIHRoZSBwdXNoKCkgdHJpZ2dlcmVkIGFcbi8vIHJlYWRhYmxlIGV2ZW50LCBhbmQgdGhlIHVzZXIgY2FsbGVkIHJlYWQobGFyZ2VOdW1iZXIpIHN1Y2ggdGhhdFxuLy8gbmVlZFJlYWRhYmxlIHdhcyBzZXQsIHRoZW4gd2Ugb3VnaHQgdG8gcHVzaCBtb3JlLCBzbyB0aGF0IGFub3RoZXJcbi8vICdyZWFkYWJsZScgZXZlbnQgd2lsbCBiZSB0cmlnZ2VyZWQuXG5mdW5jdGlvbiBuZWVkTW9yZURhdGEoc3RhdGUpIHtcbiAgcmV0dXJuICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgKHN0YXRlLm5lZWRSZWFkYWJsZSB8fFxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcmsgfHxcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPT09IDApO1xufVxuXG4vLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cblJlYWRhYmxlLnByb3RvdHlwZS5zZXRFbmNvZGluZyA9IGZ1bmN0aW9uKGVuYykge1xuICBpZiAoIVN0cmluZ0RlY29kZXIpXG4gICAgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuZGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKGVuYyk7XG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUuZW5jb2RpbmcgPSBlbmM7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gRG9uJ3QgcmFpc2UgdGhlIGh3bSA+IDhNQlxudmFyIE1BWF9IV00gPSAweDgwMDAwMDtcbmZ1bmN0aW9uIGNvbXB1dGVOZXdIaWdoV2F0ZXJNYXJrKG4pIHtcbiAgaWYgKG4gPj0gTUFYX0hXTSkge1xuICAgIG4gPSBNQVhfSFdNO1xuICB9IGVsc2Uge1xuICAgIC8vIEdldCB0aGUgbmV4dCBoaWdoZXN0IHBvd2VyIG9mIDJcbiAgICBuLS07XG4gICAgbiB8PSBuID4+PiAxO1xuICAgIG4gfD0gbiA+Pj4gMjtcbiAgICBuIHw9IG4gPj4+IDQ7XG4gICAgbiB8PSBuID4+PiA4O1xuICAgIG4gfD0gbiA+Pj4gMTY7XG4gICAgbisrO1xuICB9XG4gIHJldHVybiBuO1xufVxuXG5mdW5jdGlvbiBob3dNdWNoVG9SZWFkKG4sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUuZW5kZWQpXG4gICAgcmV0dXJuIDA7XG5cbiAgaWYgKHN0YXRlLm9iamVjdE1vZGUpXG4gICAgcmV0dXJuIG4gPT09IDAgPyAwIDogMTtcblxuICBpZiAobiA9PT0gbnVsbCB8fCBpc05hTihuKSkge1xuICAgIC8vIG9ubHkgZmxvdyBvbmUgYnVmZmVyIGF0IGEgdGltZVxuICAgIGlmIChzdGF0ZS5mbG93aW5nICYmIHN0YXRlLmJ1ZmZlci5sZW5ndGgpXG4gICAgICByZXR1cm4gc3RhdGUuYnVmZmVyWzBdLmxlbmd0aDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICB9XG5cbiAgaWYgKG4gPD0gMClcbiAgICByZXR1cm4gMDtcblxuICAvLyBJZiB3ZSdyZSBhc2tpbmcgZm9yIG1vcmUgdGhhbiB0aGUgdGFyZ2V0IGJ1ZmZlciBsZXZlbCxcbiAgLy8gdGhlbiByYWlzZSB0aGUgd2F0ZXIgbWFyay4gIEJ1bXAgdXAgdG8gdGhlIG5leHQgaGlnaGVzdFxuICAvLyBwb3dlciBvZiAyLCB0byBwcmV2ZW50IGluY3JlYXNpbmcgaXQgZXhjZXNzaXZlbHkgaW4gdGlueVxuICAvLyBhbW91bnRzLlxuICBpZiAobiA+IHN0YXRlLmhpZ2hXYXRlck1hcmspXG4gICAgc3RhdGUuaGlnaFdhdGVyTWFyayA9IGNvbXB1dGVOZXdIaWdoV2F0ZXJNYXJrKG4pO1xuXG4gIC8vIGRvbid0IGhhdmUgdGhhdCBtdWNoLiAgcmV0dXJuIG51bGwsIHVubGVzcyB3ZSd2ZSBlbmRlZC5cbiAgaWYgKG4gPiBzdGF0ZS5sZW5ndGgpIHtcbiAgICBpZiAoIXN0YXRlLmVuZGVkKSB7XG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdGF0ZS5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG47XG59XG5cbi8vIHlvdSBjYW4gb3ZlcnJpZGUgZWl0aGVyIHRoaXMgbWV0aG9kLCBvciB0aGUgYXN5bmMgX3JlYWQobikgYmVsb3cuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKG4pIHtcbiAgZGVidWcoJ3JlYWQnLCBuKTtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgdmFyIG5PcmlnID0gbjtcblxuICBpZiAodHlwZW9mIG4gIT09ICdudW1iZXInIHx8IG4gPiAwKVxuICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuXG4gIC8vIGlmIHdlJ3JlIGRvaW5nIHJlYWQoMCkgdG8gdHJpZ2dlciBhIHJlYWRhYmxlIGV2ZW50LCBidXQgd2VcbiAgLy8gYWxyZWFkeSBoYXZlIGEgYnVuY2ggb2YgZGF0YSBpbiB0aGUgYnVmZmVyLCB0aGVuIGp1c3QgdHJpZ2dlclxuICAvLyB0aGUgJ3JlYWRhYmxlJyBldmVudCBhbmQgbW92ZSBvbi5cbiAgaWYgKG4gPT09IDAgJiZcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSAmJlxuICAgICAgKHN0YXRlLmxlbmd0aCA+PSBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8IHN0YXRlLmVuZGVkKSkge1xuICAgIGRlYnVnKCdyZWFkOiBlbWl0UmVhZGFibGUnLCBzdGF0ZS5sZW5ndGgsIHN0YXRlLmVuZGVkKTtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbiA9IGhvd011Y2hUb1JlYWQobiwgc3RhdGUpO1xuXG4gIC8vIGlmIHdlJ3ZlIGVuZGVkLCBhbmQgd2UncmUgbm93IGNsZWFyLCB0aGVuIGZpbmlzaCBpdCB1cC5cbiAgaWYgKG4gPT09IDAgJiYgc3RhdGUuZW5kZWQpIHtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBBbGwgdGhlIGFjdHVhbCBjaHVuayBnZW5lcmF0aW9uIGxvZ2ljIG5lZWRzIHRvIGJlXG4gIC8vICpiZWxvdyogdGhlIGNhbGwgdG8gX3JlYWQuICBUaGUgcmVhc29uIGlzIHRoYXQgaW4gY2VydGFpblxuICAvLyBzeW50aGV0aWMgc3RyZWFtIGNhc2VzLCBzdWNoIGFzIHBhc3N0aHJvdWdoIHN0cmVhbXMsIF9yZWFkXG4gIC8vIG1heSBiZSBhIGNvbXBsZXRlbHkgc3luY2hyb25vdXMgb3BlcmF0aW9uIHdoaWNoIG1heSBjaGFuZ2VcbiAgLy8gdGhlIHN0YXRlIG9mIHRoZSByZWFkIGJ1ZmZlciwgcHJvdmlkaW5nIGVub3VnaCBkYXRhIHdoZW5cbiAgLy8gYmVmb3JlIHRoZXJlIHdhcyAqbm90KiBlbm91Z2guXG4gIC8vXG4gIC8vIFNvLCB0aGUgc3RlcHMgYXJlOlxuICAvLyAxLiBGaWd1cmUgb3V0IHdoYXQgdGhlIHN0YXRlIG9mIHRoaW5ncyB3aWxsIGJlIGFmdGVyIHdlIGRvXG4gIC8vIGEgcmVhZCBmcm9tIHRoZSBidWZmZXIuXG4gIC8vXG4gIC8vIDIuIElmIHRoYXQgcmVzdWx0aW5nIHN0YXRlIHdpbGwgdHJpZ2dlciBhIF9yZWFkLCB0aGVuIGNhbGwgX3JlYWQuXG4gIC8vIE5vdGUgdGhhdCB0aGlzIG1heSBiZSBhc3luY2hyb25vdXMsIG9yIHN5bmNocm9ub3VzLiAgWWVzLCBpdCBpc1xuICAvLyBkZWVwbHkgdWdseSB0byB3cml0ZSBBUElzIHRoaXMgd2F5LCBidXQgdGhhdCBzdGlsbCBkb2Vzbid0IG1lYW5cbiAgLy8gdGhhdCB0aGUgUmVhZGFibGUgY2xhc3Mgc2hvdWxkIGJlaGF2ZSBpbXByb3Blcmx5LCBhcyBzdHJlYW1zIGFyZVxuICAvLyBkZXNpZ25lZCB0byBiZSBzeW5jL2FzeW5jIGFnbm9zdGljLlxuICAvLyBUYWtlIG5vdGUgaWYgdGhlIF9yZWFkIGNhbGwgaXMgc3luYyBvciBhc3luYyAoaWUsIGlmIHRoZSByZWFkIGNhbGxcbiAgLy8gaGFzIHJldHVybmVkIHlldCksIHNvIHRoYXQgd2Uga25vdyB3aGV0aGVyIG9yIG5vdCBpdCdzIHNhZmUgdG8gZW1pdFxuICAvLyAncmVhZGFibGUnIGV0Yy5cbiAgLy9cbiAgLy8gMy4gQWN0dWFsbHkgcHVsbCB0aGUgcmVxdWVzdGVkIGNodW5rcyBvdXQgb2YgdGhlIGJ1ZmZlciBhbmQgcmV0dXJuLlxuXG4gIC8vIGlmIHdlIG5lZWQgYSByZWFkYWJsZSBldmVudCwgdGhlbiB3ZSBuZWVkIHRvIGRvIHNvbWUgcmVhZGluZy5cbiAgdmFyIGRvUmVhZCA9IHN0YXRlLm5lZWRSZWFkYWJsZTtcbiAgZGVidWcoJ25lZWQgcmVhZGFibGUnLCBkb1JlYWQpO1xuXG4gIC8vIGlmIHdlIGN1cnJlbnRseSBoYXZlIGxlc3MgdGhhbiB0aGUgaGlnaFdhdGVyTWFyaywgdGhlbiBhbHNvIHJlYWQgc29tZVxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwIHx8IHN0YXRlLmxlbmd0aCAtIG4gPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgZG9SZWFkID0gdHJ1ZTtcbiAgICBkZWJ1ZygnbGVuZ3RoIGxlc3MgdGhhbiB3YXRlcm1hcmsnLCBkb1JlYWQpO1xuICB9XG5cbiAgLy8gaG93ZXZlciwgaWYgd2UndmUgZW5kZWQsIHRoZW4gdGhlcmUncyBubyBwb2ludCwgYW5kIGlmIHdlJ3JlIGFscmVhZHlcbiAgLy8gcmVhZGluZywgdGhlbiBpdCdzIHVubmVjZXNzYXJ5LlxuICBpZiAoc3RhdGUuZW5kZWQgfHwgc3RhdGUucmVhZGluZykge1xuICAgIGRvUmVhZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdyZWFkaW5nIG9yIGVuZGVkJywgZG9SZWFkKTtcbiAgfVxuXG4gIGlmIChkb1JlYWQpIHtcbiAgICBkZWJ1ZygnZG8gcmVhZCcpO1xuICAgIHN0YXRlLnJlYWRpbmcgPSB0cnVlO1xuICAgIHN0YXRlLnN5bmMgPSB0cnVlO1xuICAgIC8vIGlmIHRoZSBsZW5ndGggaXMgY3VycmVudGx5IHplcm8sIHRoZW4gd2UgKm5lZWQqIGEgcmVhZGFibGUgZXZlbnQuXG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgLy8gY2FsbCBpbnRlcm5hbCByZWFkIG1ldGhvZFxuICAgIHRoaXMuX3JlYWQoc3RhdGUuaGlnaFdhdGVyTWFyayk7XG4gICAgc3RhdGUuc3luYyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gSWYgX3JlYWQgcHVzaGVkIGRhdGEgc3luY2hyb25vdXNseSwgdGhlbiBgcmVhZGluZ2Agd2lsbCBiZSBmYWxzZSxcbiAgLy8gYW5kIHdlIG5lZWQgdG8gcmUtZXZhbHVhdGUgaG93IG11Y2ggZGF0YSB3ZSBjYW4gcmV0dXJuIHRvIHRoZSB1c2VyLlxuICBpZiAoZG9SZWFkICYmICFzdGF0ZS5yZWFkaW5nKVxuICAgIG4gPSBob3dNdWNoVG9SZWFkKG5PcmlnLCBzdGF0ZSk7XG5cbiAgdmFyIHJldDtcbiAgaWYgKG4gPiAwKVxuICAgIHJldCA9IGZyb21MaXN0KG4sIHN0YXRlKTtcbiAgZWxzZVxuICAgIHJldCA9IG51bGw7XG5cbiAgaWYgKHJldCA9PT0gbnVsbCkge1xuICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgbiA9IDA7XG4gIH1cblxuICBzdGF0ZS5sZW5ndGggLT0gbjtcblxuICAvLyBJZiB3ZSBoYXZlIG5vdGhpbmcgaW4gdGhlIGJ1ZmZlciwgdGhlbiB3ZSB3YW50IHRvIGtub3dcbiAgLy8gYXMgc29vbiBhcyB3ZSAqZG8qIGdldCBzb21ldGhpbmcgaW50byB0aGUgYnVmZmVyLlxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmICFzdGF0ZS5lbmRlZClcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuXG4gIC8vIElmIHdlIHRyaWVkIHRvIHJlYWQoKSBwYXN0IHRoZSBFT0YsIHRoZW4gZW1pdCBlbmQgb24gdGhlIG5leHQgdGljay5cbiAgaWYgKG5PcmlnICE9PSBuICYmIHN0YXRlLmVuZGVkICYmIHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICBlbmRSZWFkYWJsZSh0aGlzKTtcblxuICBpZiAocmV0ICE9PSBudWxsKVxuICAgIHRoaXMuZW1pdCgnZGF0YScsIHJldCk7XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGNodW5rSW52YWxpZChzdGF0ZSwgY2h1bmspIHtcbiAgdmFyIGVyID0gbnVsbDtcbiAgaWYgKCEoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSkgJiZcbiAgICAgIHR5cGVvZiBjaHVuayAhPT0gJ3N0cmluZycgJiZcbiAgICAgIGNodW5rICE9PSBudWxsICYmXG4gICAgICBjaHVuayAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAhc3RhdGUub2JqZWN0TW9kZSkge1xuICAgIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICB9XG4gIHJldHVybiBlcjtcbn1cblxuXG5mdW5jdGlvbiBvbkVvZkNodW5rKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmVuZGVkKSByZXR1cm47XG4gIGlmIChzdGF0ZS5kZWNvZGVyKSB7XG4gICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICBpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKSB7XG4gICAgICBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG4gICAgICBzdGF0ZS5sZW5ndGggKz0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG4gICAgfVxuICB9XG4gIHN0YXRlLmVuZGVkID0gdHJ1ZTtcblxuICAvLyBlbWl0ICdyZWFkYWJsZScgbm93IHRvIG1ha2Ugc3VyZSBpdCBnZXRzIHBpY2tlZCB1cC5cbiAgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG59XG5cbi8vIERvbid0IGVtaXQgcmVhZGFibGUgcmlnaHQgYXdheSBpbiBzeW5jIG1vZGUsIGJlY2F1c2UgdGhpcyBjYW4gdHJpZ2dlclxuLy8gYW5vdGhlciByZWFkKCkgY2FsbCA9PiBzdGFjayBvdmVyZmxvdy4gIFRoaXMgd2F5LCBpdCBtaWdodCB0cmlnZ2VyXG4vLyBhIG5leHRUaWNrIHJlY3Vyc2lvbiB3YXJuaW5nLCBidXQgdGhhdCdzIG5vdCBzbyBiYWQuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGUoc3RyZWFtKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgc3RhdGUubmVlZFJlYWRhYmxlID0gZmFsc2U7XG4gIGlmICghc3RhdGUuZW1pdHRlZFJlYWRhYmxlKSB7XG4gICAgZGVidWcoJ2VtaXRSZWFkYWJsZScsIHN0YXRlLmZsb3dpbmcpO1xuICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgaWYgKHN0YXRlLnN5bmMpXG4gICAgICBwcm9jZXNzTmV4dFRpY2soZW1pdFJlYWRhYmxlXywgc3RyZWFtKTtcbiAgICBlbHNlXG4gICAgICBlbWl0UmVhZGFibGVfKHN0cmVhbSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdFJlYWRhYmxlXyhzdHJlYW0pIHtcbiAgZGVidWcoJ2VtaXQgcmVhZGFibGUnKTtcbiAgc3RyZWFtLmVtaXQoJ3JlYWRhYmxlJyk7XG4gIGZsb3coc3RyZWFtKTtcbn1cblxuXG4vLyBhdCB0aGlzIHBvaW50LCB0aGUgdXNlciBoYXMgcHJlc3VtYWJseSBzZWVuIHRoZSAncmVhZGFibGUnIGV2ZW50LFxuLy8gYW5kIGNhbGxlZCByZWFkKCkgdG8gY29uc3VtZSBzb21lIGRhdGEuICB0aGF0IG1heSBoYXZlIHRyaWdnZXJlZFxuLy8gaW4gdHVybiBhbm90aGVyIF9yZWFkKG4pIGNhbGwsIGluIHdoaWNoIGNhc2UgcmVhZGluZyA9IHRydWUgaWZcbi8vIGl0J3MgaW4gcHJvZ3Jlc3MuXG4vLyBIb3dldmVyLCBpZiB3ZSdyZSBub3QgZW5kZWQsIG9yIHJlYWRpbmcsIGFuZCB0aGUgbGVuZ3RoIDwgaHdtLFxuLy8gdGhlbiBnbyBhaGVhZCBhbmQgdHJ5IHRvIHJlYWQgc29tZSBtb3JlIHByZWVtcHRpdmVseS5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmUoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlYWRpbmdNb3JlKSB7XG4gICAgc3RhdGUucmVhZGluZ01vcmUgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhtYXliZVJlYWRNb3JlXywgc3RyZWFtLCBzdGF0ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZV8oc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbGVuID0gc3RhdGUubGVuZ3RoO1xuICB3aGlsZSAoIXN0YXRlLnJlYWRpbmcgJiYgIXN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLmVuZGVkICYmXG4gICAgICAgICBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgZGVidWcoJ21heWJlUmVhZE1vcmUgcmVhZCAwJyk7XG4gICAgc3RyZWFtLnJlYWQoMCk7XG4gICAgaWYgKGxlbiA9PT0gc3RhdGUubGVuZ3RoKVxuICAgICAgLy8gZGlkbid0IGdldCBhbnkgZGF0YSwgc3RvcCBzcGlubmluZy5cbiAgICAgIGJyZWFrO1xuICAgIGVsc2VcbiAgICAgIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgfVxuICBzdGF0ZS5yZWFkaW5nTW9yZSA9IGZhbHNlO1xufVxuXG4vLyBhYnN0cmFjdCBtZXRob2QuICB0byBiZSBvdmVycmlkZGVuIGluIHNwZWNpZmljIGltcGxlbWVudGF0aW9uIGNsYXNzZXMuXG4vLyBjYWxsIGNiKGVyLCBkYXRhKSB3aGVyZSBkYXRhIGlzIDw9IG4gaW4gbGVuZ3RoLlxuLy8gZm9yIHZpcnR1YWwgKG5vbi1zdHJpbmcsIG5vbi1idWZmZXIpIHN0cmVhbXMsIFwibGVuZ3RoXCIgaXMgc29tZXdoYXRcbi8vIGFyYml0cmFyeSwgYW5kIHBlcmhhcHMgbm90IHZlcnkgbWVhbmluZ2Z1bC5cblJlYWRhYmxlLnByb3RvdHlwZS5fcmVhZCA9IGZ1bmN0aW9uKG4pIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJykpO1xufTtcblxuUmVhZGFibGUucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihkZXN0LCBwaXBlT3B0cykge1xuICB2YXIgc3JjID0gdGhpcztcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICBzd2l0Y2ggKHN0YXRlLnBpcGVzQ291bnQpIHtcbiAgICBjYXNlIDA6XG4gICAgICBzdGF0ZS5waXBlcyA9IGRlc3Q7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDE6XG4gICAgICBzdGF0ZS5waXBlcyA9IFtzdGF0ZS5waXBlcywgZGVzdF07XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgc3RhdGUucGlwZXMucHVzaChkZXN0KTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHN0YXRlLnBpcGVzQ291bnQgKz0gMTtcbiAgZGVidWcoJ3BpcGUgY291bnQ9JWQgb3B0cz0laicsIHN0YXRlLnBpcGVzQ291bnQsIHBpcGVPcHRzKTtcblxuICB2YXIgZG9FbmQgPSAoIXBpcGVPcHRzIHx8IHBpcGVPcHRzLmVuZCAhPT0gZmFsc2UpICYmXG4gICAgICAgICAgICAgIGRlc3QgIT09IHByb2Nlc3Muc3Rkb3V0ICYmXG4gICAgICAgICAgICAgIGRlc3QgIT09IHByb2Nlc3Muc3RkZXJyO1xuXG4gIHZhciBlbmRGbiA9IGRvRW5kID8gb25lbmQgOiBjbGVhbnVwO1xuICBpZiAoc3RhdGUuZW5kRW1pdHRlZClcbiAgICBwcm9jZXNzTmV4dFRpY2soZW5kRm4pO1xuICBlbHNlXG4gICAgc3JjLm9uY2UoJ2VuZCcsIGVuZEZuKTtcblxuICBkZXN0Lm9uKCd1bnBpcGUnLCBvbnVucGlwZSk7XG4gIGZ1bmN0aW9uIG9udW5waXBlKHJlYWRhYmxlKSB7XG4gICAgZGVidWcoJ29udW5waXBlJyk7XG4gICAgaWYgKHJlYWRhYmxlID09PSBzcmMpIHtcbiAgICAgIGNsZWFudXAoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbmVuZCgpIHtcbiAgICBkZWJ1Zygnb25lbmQnKTtcbiAgICBkZXN0LmVuZCgpO1xuICB9XG5cbiAgLy8gd2hlbiB0aGUgZGVzdCBkcmFpbnMsIGl0IHJlZHVjZXMgdGhlIGF3YWl0RHJhaW4gY291bnRlclxuICAvLyBvbiB0aGUgc291cmNlLiAgVGhpcyB3b3VsZCBiZSBtb3JlIGVsZWdhbnQgd2l0aCBhIC5vbmNlKClcbiAgLy8gaGFuZGxlciBpbiBmbG93KCksIGJ1dCBhZGRpbmcgYW5kIHJlbW92aW5nIHJlcGVhdGVkbHkgaXNcbiAgLy8gdG9vIHNsb3cuXG4gIHZhciBvbmRyYWluID0gcGlwZU9uRHJhaW4oc3JjKTtcbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICB2YXIgY2xlYW5lZFVwID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgZGVidWcoJ2NsZWFudXAnKTtcbiAgICAvLyBjbGVhbnVwIGV2ZW50IGhhbmRsZXJzIG9uY2UgdGhlIHBpcGUgaXMgYnJva2VuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZHJhaW4nLCBvbmRyYWluKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ3VucGlwZScsIG9udW5waXBlKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNyYy5yZW1vdmVMaXN0ZW5lcignZGF0YScsIG9uZGF0YSk7XG5cbiAgICBjbGVhbmVkVXAgPSB0cnVlO1xuXG4gICAgLy8gaWYgdGhlIHJlYWRlciBpcyB3YWl0aW5nIGZvciBhIGRyYWluIGV2ZW50IGZyb20gdGhpc1xuICAgIC8vIHNwZWNpZmljIHdyaXRlciwgdGhlbiBpdCB3b3VsZCBjYXVzZSBpdCB0byBuZXZlciBzdGFydFxuICAgIC8vIGZsb3dpbmcgYWdhaW4uXG4gICAgLy8gU28sIGlmIHRoaXMgaXMgYXdhaXRpbmcgYSBkcmFpbiwgdGhlbiB3ZSBqdXN0IGNhbGwgaXQgbm93LlxuICAgIC8vIElmIHdlIGRvbid0IGtub3csIHRoZW4gYXNzdW1lIHRoYXQgd2UgYXJlIHdhaXRpbmcgZm9yIG9uZS5cbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbiAmJlxuICAgICAgICAoIWRlc3QuX3dyaXRhYmxlU3RhdGUgfHwgZGVzdC5fd3JpdGFibGVTdGF0ZS5uZWVkRHJhaW4pKVxuICAgICAgb25kcmFpbigpO1xuICB9XG5cbiAgc3JjLm9uKCdkYXRhJywgb25kYXRhKTtcbiAgZnVuY3Rpb24gb25kYXRhKGNodW5rKSB7XG4gICAgZGVidWcoJ29uZGF0YScpO1xuICAgIHZhciByZXQgPSBkZXN0LndyaXRlKGNodW5rKTtcbiAgICBpZiAoZmFsc2UgPT09IHJldCkge1xuICAgICAgLy8gSWYgdGhlIHVzZXIgdW5waXBlZCBkdXJpbmcgYGRlc3Qud3JpdGUoKWAsIGl0IGlzIHBvc3NpYmxlXG4gICAgICAvLyB0byBnZXQgc3R1Y2sgaW4gYSBwZXJtYW5lbnRseSBwYXVzZWQgc3RhdGUgaWYgdGhhdCB3cml0ZVxuICAgICAgLy8gYWxzbyByZXR1cm5lZCBmYWxzZS5cbiAgICAgIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAxICYmXG4gICAgICAgICAgc3RhdGUucGlwZXNbMF0gPT09IGRlc3QgJiZcbiAgICAgICAgICBzcmMubGlzdGVuZXJDb3VudCgnZGF0YScpID09PSAxICYmXG4gICAgICAgICAgIWNsZWFuZWRVcCkge1xuICAgICAgICBkZWJ1ZygnZmFsc2Ugd3JpdGUgcmVzcG9uc2UsIHBhdXNlJywgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4pO1xuICAgICAgICBzcmMuX3JlYWRhYmxlU3RhdGUuYXdhaXREcmFpbisrO1xuICAgICAgfVxuICAgICAgc3JjLnBhdXNlKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIGRlc3QgaGFzIGFuIGVycm9yLCB0aGVuIHN0b3AgcGlwaW5nIGludG8gaXQuXG4gIC8vIGhvd2V2ZXIsIGRvbid0IHN1cHByZXNzIHRoZSB0aHJvd2luZyBiZWhhdmlvciBmb3IgdGhpcy5cbiAgZnVuY3Rpb24gb25lcnJvcihlcikge1xuICAgIGRlYnVnKCdvbmVycm9yJywgZXIpO1xuICAgIHVucGlwZSgpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG4gICAgaWYgKEVFbGlzdGVuZXJDb3VudChkZXN0LCAnZXJyb3InKSA9PT0gMClcbiAgICAgIGRlc3QuZW1pdCgnZXJyb3InLCBlcik7XG4gIH1cbiAgLy8gVGhpcyBpcyBhIGJydXRhbGx5IHVnbHkgaGFjayB0byBtYWtlIHN1cmUgdGhhdCBvdXIgZXJyb3IgaGFuZGxlclxuICAvLyBpcyBhdHRhY2hlZCBiZWZvcmUgYW55IHVzZXJsYW5kIG9uZXMuICBORVZFUiBETyBUSElTLlxuICBpZiAoIWRlc3QuX2V2ZW50cyB8fCAhZGVzdC5fZXZlbnRzLmVycm9yKVxuICAgIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGVsc2UgaWYgKGlzQXJyYXkoZGVzdC5fZXZlbnRzLmVycm9yKSlcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IudW5zaGlmdChvbmVycm9yKTtcbiAgZWxzZVxuICAgIGRlc3QuX2V2ZW50cy5lcnJvciA9IFtvbmVycm9yLCBkZXN0Ll9ldmVudHMuZXJyb3JdO1xuXG5cbiAgLy8gQm90aCBjbG9zZSBhbmQgZmluaXNoIHNob3VsZCB0cmlnZ2VyIHVucGlwZSwgYnV0IG9ubHkgb25jZS5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdjbG9zZScsIG9uY2xvc2UpO1xuICBmdW5jdGlvbiBvbmZpbmlzaCgpIHtcbiAgICBkZWJ1Zygnb25maW5pc2gnKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuICAgIHVucGlwZSgpO1xuICB9XG4gIGRlc3Qub25jZSgnZmluaXNoJywgb25maW5pc2gpO1xuXG4gIGZ1bmN0aW9uIHVucGlwZSgpIHtcbiAgICBkZWJ1ZygndW5waXBlJyk7XG4gICAgc3JjLnVucGlwZShkZXN0KTtcbiAgfVxuXG4gIC8vIHRlbGwgdGhlIGRlc3QgdGhhdCBpdCdzIGJlaW5nIHBpcGVkIHRvXG4gIGRlc3QuZW1pdCgncGlwZScsIHNyYyk7XG5cbiAgLy8gc3RhcnQgdGhlIGZsb3cgaWYgaXQgaGFzbid0IGJlZW4gc3RhcnRlZCBhbHJlYWR5LlxuICBpZiAoIXN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGlwZSByZXN1bWUnKTtcbiAgICBzcmMucmVzdW1lKCk7XG4gIH1cblxuICByZXR1cm4gZGVzdDtcbn07XG5cbmZ1bmN0aW9uIHBpcGVPbkRyYWluKHNyYykge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHN0YXRlID0gc3JjLl9yZWFkYWJsZVN0YXRlO1xuICAgIGRlYnVnKCdwaXBlT25EcmFpbicsIHN0YXRlLmF3YWl0RHJhaW4pO1xuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluKVxuICAgICAgc3RhdGUuYXdhaXREcmFpbi0tO1xuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluID09PSAwICYmIEVFbGlzdGVuZXJDb3VudChzcmMsICdkYXRhJykpIHtcbiAgICAgIHN0YXRlLmZsb3dpbmcgPSB0cnVlO1xuICAgICAgZmxvdyhzcmMpO1xuICAgIH1cbiAgfTtcbn1cblxuXG5SZWFkYWJsZS5wcm90b3R5cGUudW5waXBlID0gZnVuY3Rpb24oZGVzdCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIGlmIHdlJ3JlIG5vdCBwaXBpbmcgYW55d2hlcmUsIHRoZW4gZG8gbm90aGluZy5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDApXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8ganVzdCBvbmUgZGVzdGluYXRpb24uICBtb3N0IGNvbW1vbiBjYXNlLlxuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSkge1xuICAgIC8vIHBhc3NlZCBpbiBvbmUsIGJ1dCBpdCdzIG5vdCB0aGUgcmlnaHQgb25lLlxuICAgIGlmIChkZXN0ICYmIGRlc3QgIT09IHN0YXRlLnBpcGVzKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoIWRlc3QpXG4gICAgICBkZXN0ID0gc3RhdGUucGlwZXM7XG5cbiAgICAvLyBnb3QgYSBtYXRjaC5cbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuICAgIGlmIChkZXN0KVxuICAgICAgZGVzdC5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHNsb3cgY2FzZS4gbXVsdGlwbGUgcGlwZSBkZXN0aW5hdGlvbnMuXG5cbiAgaWYgKCFkZXN0KSB7XG4gICAgLy8gcmVtb3ZlIGFsbC5cbiAgICB2YXIgZGVzdHMgPSBzdGF0ZS5waXBlcztcbiAgICB2YXIgbGVuID0gc3RhdGUucGlwZXNDb3VudDtcbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGRlc3RzW2ldLmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gdHJ5IHRvIGZpbmQgdGhlIHJpZ2h0IG9uZS5cbiAgdmFyIGkgPSBpbmRleE9mKHN0YXRlLnBpcGVzLCBkZXN0KTtcbiAgaWYgKGkgPT09IC0xKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIHN0YXRlLnBpcGVzLnNwbGljZShpLCAxKTtcbiAgc3RhdGUucGlwZXNDb3VudCAtPSAxO1xuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSlcbiAgICBzdGF0ZS5waXBlcyA9IHN0YXRlLnBpcGVzWzBdO1xuXG4gIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBzZXQgdXAgZGF0YSBldmVudHMgaWYgdGhleSBhcmUgYXNrZWQgZm9yXG4vLyBFbnN1cmUgcmVhZGFibGUgbGlzdGVuZXJzIGV2ZW50dWFsbHkgZ2V0IHNvbWV0aGluZ1xuUmVhZGFibGUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXYsIGZuKSB7XG4gIHZhciByZXMgPSBTdHJlYW0ucHJvdG90eXBlLm9uLmNhbGwodGhpcywgZXYsIGZuKTtcblxuICAvLyBJZiBsaXN0ZW5pbmcgdG8gZGF0YSwgYW5kIGl0IGhhcyBub3QgZXhwbGljaXRseSBiZWVuIHBhdXNlZCxcbiAgLy8gdGhlbiBjYWxsIHJlc3VtZSB0byBzdGFydCB0aGUgZmxvdyBvZiBkYXRhIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChldiA9PT0gJ2RhdGEnICYmIGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICB0aGlzLnJlc3VtZSgpO1xuICB9XG5cbiAgaWYgKGV2ID09PSAncmVhZGFibGUnICYmIHRoaXMucmVhZGFibGUpIHtcbiAgICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICAgIGlmICghc3RhdGUucmVhZGFibGVMaXN0ZW5pbmcpIHtcbiAgICAgIHN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIGlmICghc3RhdGUucmVhZGluZykge1xuICAgICAgICBwcm9jZXNzTmV4dFRpY2soblJlYWRpbmdOZXh0VGljaywgdGhpcyk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlLmxlbmd0aCkge1xuICAgICAgICBlbWl0UmVhZGFibGUodGhpcywgc3RhdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuUmVhZGFibGUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gUmVhZGFibGUucHJvdG90eXBlLm9uO1xuXG5mdW5jdGlvbiBuUmVhZGluZ05leHRUaWNrKHNlbGYpIHtcbiAgZGVidWcoJ3JlYWRhYmxlIG5leHR0aWNrIHJlYWQgMCcpO1xuICBzZWxmLnJlYWQoMCk7XG59XG5cbi8vIHBhdXNlKCkgYW5kIHJlc3VtZSgpIGFyZSByZW1uYW50cyBvZiB0aGUgbGVnYWN5IHJlYWRhYmxlIHN0cmVhbSBBUElcbi8vIElmIHRoZSB1c2VyIHVzZXMgdGhlbSwgdGhlbiBzd2l0Y2ggaW50byBvbGQgbW9kZS5cblJlYWRhYmxlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgaWYgKCFzdGF0ZS5mbG93aW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZScpO1xuICAgIHN0YXRlLmZsb3dpbmcgPSB0cnVlO1xuICAgIHJlc3VtZSh0aGlzLCBzdGF0ZSk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiByZXN1bWUoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlc3VtZVNjaGVkdWxlZCkge1xuICAgIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IHRydWU7XG4gICAgcHJvY2Vzc05leHRUaWNrKHJlc3VtZV8sIHN0cmVhbSwgc3RhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlc3VtZV8oc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICBkZWJ1ZygncmVzdW1lIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICB9XG5cbiAgc3RhdGUucmVzdW1lU2NoZWR1bGVkID0gZmFsc2U7XG4gIHN0cmVhbS5lbWl0KCdyZXN1bWUnKTtcbiAgZmxvdyhzdHJlYW0pO1xuICBpZiAoc3RhdGUuZmxvd2luZyAmJiAhc3RhdGUucmVhZGluZylcbiAgICBzdHJlYW0ucmVhZCgwKTtcbn1cblxuUmVhZGFibGUucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gIGRlYnVnKCdjYWxsIHBhdXNlIGZsb3dpbmc9JWonLCB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpO1xuICBpZiAoZmFsc2UgIT09IHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdwYXVzZScpO1xuICAgIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuICAgIHRoaXMuZW1pdCgncGF1c2UnKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uIGZsb3coc3RyZWFtKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgZGVidWcoJ2Zsb3cnLCBzdGF0ZS5mbG93aW5nKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcpIHtcbiAgICBkbyB7XG4gICAgICB2YXIgY2h1bmsgPSBzdHJlYW0ucmVhZCgpO1xuICAgIH0gd2hpbGUgKG51bGwgIT09IGNodW5rICYmIHN0YXRlLmZsb3dpbmcpO1xuICB9XG59XG5cbi8vIHdyYXAgYW4gb2xkLXN0eWxlIHN0cmVhbSBhcyB0aGUgYXN5bmMgZGF0YSBzb3VyY2UuXG4vLyBUaGlzIGlzICpub3QqIHBhcnQgb2YgdGhlIHJlYWRhYmxlIHN0cmVhbSBpbnRlcmZhY2UuXG4vLyBJdCBpcyBhbiB1Z2x5IHVuZm9ydHVuYXRlIG1lc3Mgb2YgaGlzdG9yeS5cblJlYWRhYmxlLnByb3RvdHlwZS53cmFwID0gZnVuY3Rpb24oc3RyZWFtKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBwYXVzZWQgPSBmYWxzZTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHN0cmVhbS5vbignZW5kJywgZnVuY3Rpb24oKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgZW5kJyk7XG4gICAgaWYgKHN0YXRlLmRlY29kZXIgJiYgIXN0YXRlLmVuZGVkKSB7XG4gICAgICB2YXIgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLmVuZCgpO1xuICAgICAgaWYgKGNodW5rICYmIGNodW5rLmxlbmd0aClcbiAgICAgICAgc2VsZi5wdXNoKGNodW5rKTtcbiAgICB9XG5cbiAgICBzZWxmLnB1c2gobnVsbCk7XG4gIH0pO1xuXG4gIHN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgZGF0YScpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyKVxuICAgICAgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLndyaXRlKGNodW5rKTtcblxuICAgIC8vIGRvbid0IHNraXAgb3ZlciBmYWxzeSB2YWx1ZXMgaW4gb2JqZWN0TW9kZVxuICAgIGlmIChzdGF0ZS5vYmplY3RNb2RlICYmIChjaHVuayA9PT0gbnVsbCB8fCBjaHVuayA9PT0gdW5kZWZpbmVkKSlcbiAgICAgIHJldHVybjtcbiAgICBlbHNlIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJiAoIWNodW5rIHx8ICFjaHVuay5sZW5ndGgpKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJldCA9IHNlbGYucHVzaChjaHVuayk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICBzdHJlYW0ucGF1c2UoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHByb3h5IGFsbCB0aGUgb3RoZXIgbWV0aG9kcy5cbiAgLy8gaW1wb3J0YW50IHdoZW4gd3JhcHBpbmcgZmlsdGVycyBhbmQgZHVwbGV4ZXMuXG4gIGZvciAodmFyIGkgaW4gc3RyZWFtKSB7XG4gICAgaWYgKHRoaXNbaV0gPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygc3RyZWFtW2ldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzW2ldID0gZnVuY3Rpb24obWV0aG9kKSB7IHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHN0cmVhbVttZXRob2RdLmFwcGx5KHN0cmVhbSwgYXJndW1lbnRzKTtcbiAgICAgIH07IH0oaSk7XG4gICAgfVxuICB9XG5cbiAgLy8gcHJveHkgY2VydGFpbiBpbXBvcnRhbnQgZXZlbnRzLlxuICB2YXIgZXZlbnRzID0gWydlcnJvcicsICdjbG9zZScsICdkZXN0cm95JywgJ3BhdXNlJywgJ3Jlc3VtZSddO1xuICBmb3JFYWNoKGV2ZW50cywgZnVuY3Rpb24oZXYpIHtcbiAgICBzdHJlYW0ub24oZXYsIHNlbGYuZW1pdC5iaW5kKHNlbGYsIGV2KSk7XG4gIH0pO1xuXG4gIC8vIHdoZW4gd2UgdHJ5IHRvIGNvbnN1bWUgc29tZSBtb3JlIGJ5dGVzLCBzaW1wbHkgdW5wYXVzZSB0aGVcbiAgLy8gdW5kZXJseWluZyBzdHJlYW0uXG4gIHNlbGYuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgX3JlYWQnLCBuKTtcbiAgICBpZiAocGF1c2VkKSB7XG4gICAgICBwYXVzZWQgPSBmYWxzZTtcbiAgICAgIHN0cmVhbS5yZXN1bWUoKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5cbi8vIGV4cG9zZWQgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seS5cblJlYWRhYmxlLl9mcm9tTGlzdCA9IGZyb21MaXN0O1xuXG4vLyBQbHVjayBvZmYgbiBieXRlcyBmcm9tIGFuIGFycmF5IG9mIGJ1ZmZlcnMuXG4vLyBMZW5ndGggaXMgdGhlIGNvbWJpbmVkIGxlbmd0aHMgb2YgYWxsIHRoZSBidWZmZXJzIGluIHRoZSBsaXN0LlxuZnVuY3Rpb24gZnJvbUxpc3Qobiwgc3RhdGUpIHtcbiAgdmFyIGxpc3QgPSBzdGF0ZS5idWZmZXI7XG4gIHZhciBsZW5ndGggPSBzdGF0ZS5sZW5ndGg7XG4gIHZhciBzdHJpbmdNb2RlID0gISFzdGF0ZS5kZWNvZGVyO1xuICB2YXIgb2JqZWN0TW9kZSA9ICEhc3RhdGUub2JqZWN0TW9kZTtcbiAgdmFyIHJldDtcblxuICAvLyBub3RoaW5nIGluIHRoZSBsaXN0LCBkZWZpbml0ZWx5IGVtcHR5LlxuICBpZiAobGlzdC5sZW5ndGggPT09IDApXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgaWYgKGxlbmd0aCA9PT0gMClcbiAgICByZXQgPSBudWxsO1xuICBlbHNlIGlmIChvYmplY3RNb2RlKVxuICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgZWxzZSBpZiAoIW4gfHwgbiA+PSBsZW5ndGgpIHtcbiAgICAvLyByZWFkIGl0IGFsbCwgdHJ1bmNhdGUgdGhlIGFycmF5LlxuICAgIGlmIChzdHJpbmdNb2RlKVxuICAgICAgcmV0ID0gbGlzdC5qb2luKCcnKTtcbiAgICBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSlcbiAgICAgIHJldCA9IGxpc3RbMF07XG4gICAgZWxzZVxuICAgICAgcmV0ID0gQnVmZmVyLmNvbmNhdChsaXN0LCBsZW5ndGgpO1xuICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgfSBlbHNlIHtcbiAgICAvLyByZWFkIGp1c3Qgc29tZSBvZiBpdC5cbiAgICBpZiAobiA8IGxpc3RbMF0ubGVuZ3RoKSB7XG4gICAgICAvLyBqdXN0IHRha2UgYSBwYXJ0IG9mIHRoZSBmaXJzdCBsaXN0IGl0ZW0uXG4gICAgICAvLyBzbGljZSBpcyB0aGUgc2FtZSBmb3IgYnVmZmVycyBhbmQgc3RyaW5ncy5cbiAgICAgIHZhciBidWYgPSBsaXN0WzBdO1xuICAgICAgcmV0ID0gYnVmLnNsaWNlKDAsIG4pO1xuICAgICAgbGlzdFswXSA9IGJ1Zi5zbGljZShuKTtcbiAgICB9IGVsc2UgaWYgKG4gPT09IGxpc3RbMF0ubGVuZ3RoKSB7XG4gICAgICAvLyBmaXJzdCBsaXN0IGlzIGEgcGVyZmVjdCBtYXRjaFxuICAgICAgcmV0ID0gbGlzdC5zaGlmdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjb21wbGV4IGNhc2UuXG4gICAgICAvLyB3ZSBoYXZlIGVub3VnaCB0byBjb3ZlciBpdCwgYnV0IGl0IHNwYW5zIHBhc3QgdGhlIGZpcnN0IGJ1ZmZlci5cbiAgICAgIGlmIChzdHJpbmdNb2RlKVxuICAgICAgICByZXQgPSAnJztcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0ID0gbmV3IEJ1ZmZlcihuKTtcblxuICAgICAgdmFyIGMgPSAwO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0Lmxlbmd0aDsgaSA8IGwgJiYgYyA8IG47IGkrKykge1xuICAgICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgICAgdmFyIGNweSA9IE1hdGgubWluKG4gLSBjLCBidWYubGVuZ3RoKTtcblxuICAgICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgICByZXQgKz0gYnVmLnNsaWNlKDAsIGNweSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBidWYuY29weShyZXQsIGMsIDAsIGNweSk7XG5cbiAgICAgICAgaWYgKGNweSA8IGJ1Zi5sZW5ndGgpXG4gICAgICAgICAgbGlzdFswXSA9IGJ1Zi5zbGljZShjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbGlzdC5zaGlmdCgpO1xuXG4gICAgICAgIGMgKz0gY3B5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGVuZFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG5cbiAgLy8gSWYgd2UgZ2V0IGhlcmUgYmVmb3JlIGNvbnN1bWluZyBhbGwgdGhlIGJ5dGVzLCB0aGVuIHRoYXQgaXMgYVxuICAvLyBidWcgaW4gbm9kZS4gIFNob3VsZCBuZXZlciBoYXBwZW4uXG4gIGlmIChzdGF0ZS5sZW5ndGggPiAwKVxuICAgIHRocm93IG5ldyBFcnJvcignZW5kUmVhZGFibGUgY2FsbGVkIG9uIG5vbi1lbXB0eSBzdHJlYW0nKTtcblxuICBpZiAoIXN0YXRlLmVuZEVtaXR0ZWQpIHtcbiAgICBzdGF0ZS5lbmRlZCA9IHRydWU7XG4gICAgcHJvY2Vzc05leHRUaWNrKGVuZFJlYWRhYmxlTlQsIHN0YXRlLCBzdHJlYW0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuZFJlYWRhYmxlTlQoc3RhdGUsIHN0cmVhbSkge1xuICAvLyBDaGVjayB0aGF0IHdlIGRpZG4ndCBnZXQgb25lIGxhc3QgdW5zaGlmdC5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkICYmIHN0YXRlLmxlbmd0aCA9PT0gMCkge1xuICAgIHN0YXRlLmVuZEVtaXR0ZWQgPSB0cnVlO1xuICAgIHN0cmVhbS5yZWFkYWJsZSA9IGZhbHNlO1xuICAgIHN0cmVhbS5lbWl0KCdlbmQnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JFYWNoICh4cywgZikge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGYoeHNbaV0sIGkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluZGV4T2YgKHhzLCB4KSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgaWYgKHhzW2ldID09PSB4KSByZXR1cm4gaTtcbiAgfVxuICByZXR1cm4gLTE7XG59XG4iLCIvLyBhIHRyYW5zZm9ybSBzdHJlYW0gaXMgYSByZWFkYWJsZS93cml0YWJsZSBzdHJlYW0gd2hlcmUgeW91IGRvXG4vLyBzb21ldGhpbmcgd2l0aCB0aGUgZGF0YS4gIFNvbWV0aW1lcyBpdCdzIGNhbGxlZCBhIFwiZmlsdGVyXCIsXG4vLyBidXQgdGhhdCdzIG5vdCBhIGdyZWF0IG5hbWUgZm9yIGl0LCBzaW5jZSB0aGF0IGltcGxpZXMgYSB0aGluZyB3aGVyZVxuLy8gc29tZSBiaXRzIHBhc3MgdGhyb3VnaCwgYW5kIG90aGVycyBhcmUgc2ltcGx5IGlnbm9yZWQuICAoVGhhdCB3b3VsZFxuLy8gYmUgYSB2YWxpZCBleGFtcGxlIG9mIGEgdHJhbnNmb3JtLCBvZiBjb3Vyc2UuKVxuLy9cbi8vIFdoaWxlIHRoZSBvdXRwdXQgaXMgY2F1c2FsbHkgcmVsYXRlZCB0byB0aGUgaW5wdXQsIGl0J3Mgbm90IGFcbi8vIG5lY2Vzc2FyaWx5IHN5bW1ldHJpYyBvciBzeW5jaHJvbm91cyB0cmFuc2Zvcm1hdGlvbi4gIEZvciBleGFtcGxlLFxuLy8gYSB6bGliIHN0cmVhbSBtaWdodCB0YWtlIG11bHRpcGxlIHBsYWluLXRleHQgd3JpdGVzKCksIGFuZCB0aGVuXG4vLyBlbWl0IGEgc2luZ2xlIGNvbXByZXNzZWQgY2h1bmsgc29tZSB0aW1lIGluIHRoZSBmdXR1cmUuXG4vL1xuLy8gSGVyZSdzIGhvdyB0aGlzIHdvcmtzOlxuLy9cbi8vIFRoZSBUcmFuc2Zvcm0gc3RyZWFtIGhhcyBhbGwgdGhlIGFzcGVjdHMgb2YgdGhlIHJlYWRhYmxlIGFuZCB3cml0YWJsZVxuLy8gc3RyZWFtIGNsYXNzZXMuICBXaGVuIHlvdSB3cml0ZShjaHVuayksIHRoYXQgY2FsbHMgX3dyaXRlKGNodW5rLGNiKVxuLy8gaW50ZXJuYWxseSwgYW5kIHJldHVybnMgZmFsc2UgaWYgdGhlcmUncyBhIGxvdCBvZiBwZW5kaW5nIHdyaXRlc1xuLy8gYnVmZmVyZWQgdXAuICBXaGVuIHlvdSBjYWxsIHJlYWQoKSwgdGhhdCBjYWxscyBfcmVhZChuKSB1bnRpbFxuLy8gdGhlcmUncyBlbm91Z2ggcGVuZGluZyByZWFkYWJsZSBkYXRhIGJ1ZmZlcmVkIHVwLlxuLy9cbi8vIEluIGEgdHJhbnNmb3JtIHN0cmVhbSwgdGhlIHdyaXR0ZW4gZGF0YSBpcyBwbGFjZWQgaW4gYSBidWZmZXIuICBXaGVuXG4vLyBfcmVhZChuKSBpcyBjYWxsZWQsIGl0IHRyYW5zZm9ybXMgdGhlIHF1ZXVlZCB1cCBkYXRhLCBjYWxsaW5nIHRoZVxuLy8gYnVmZmVyZWQgX3dyaXRlIGNiJ3MgYXMgaXQgY29uc3VtZXMgY2h1bmtzLiAgSWYgY29uc3VtaW5nIGEgc2luZ2xlXG4vLyB3cml0dGVuIGNodW5rIHdvdWxkIHJlc3VsdCBpbiBtdWx0aXBsZSBvdXRwdXQgY2h1bmtzLCB0aGVuIHRoZSBmaXJzdFxuLy8gb3V0cHV0dGVkIGJpdCBjYWxscyB0aGUgcmVhZGNiLCBhbmQgc3Vic2VxdWVudCBjaHVua3MganVzdCBnbyBpbnRvXG4vLyB0aGUgcmVhZCBidWZmZXIsIGFuZCB3aWxsIGNhdXNlIGl0IHRvIGVtaXQgJ3JlYWRhYmxlJyBpZiBuZWNlc3NhcnkuXG4vL1xuLy8gVGhpcyB3YXksIGJhY2stcHJlc3N1cmUgaXMgYWN0dWFsbHkgZGV0ZXJtaW5lZCBieSB0aGUgcmVhZGluZyBzaWRlLFxuLy8gc2luY2UgX3JlYWQgaGFzIHRvIGJlIGNhbGxlZCB0byBzdGFydCBwcm9jZXNzaW5nIGEgbmV3IGNodW5rLiAgSG93ZXZlcixcbi8vIGEgcGF0aG9sb2dpY2FsIGluZmxhdGUgdHlwZSBvZiB0cmFuc2Zvcm0gY2FuIGNhdXNlIGV4Y2Vzc2l2ZSBidWZmZXJpbmdcbi8vIGhlcmUuICBGb3IgZXhhbXBsZSwgaW1hZ2luZSBhIHN0cmVhbSB3aGVyZSBldmVyeSBieXRlIG9mIGlucHV0IGlzXG4vLyBpbnRlcnByZXRlZCBhcyBhbiBpbnRlZ2VyIGZyb20gMC0yNTUsIGFuZCB0aGVuIHJlc3VsdHMgaW4gdGhhdCBtYW55XG4vLyBieXRlcyBvZiBvdXRwdXQuICBXcml0aW5nIHRoZSA0IGJ5dGVzIHtmZixmZixmZixmZn0gd291bGQgcmVzdWx0IGluXG4vLyAxa2Igb2YgZGF0YSBiZWluZyBvdXRwdXQuICBJbiB0aGlzIGNhc2UsIHlvdSBjb3VsZCB3cml0ZSBhIHZlcnkgc21hbGxcbi8vIGFtb3VudCBvZiBpbnB1dCwgYW5kIGVuZCB1cCB3aXRoIGEgdmVyeSBsYXJnZSBhbW91bnQgb2Ygb3V0cHV0LiAgSW5cbi8vIHN1Y2ggYSBwYXRob2xvZ2ljYWwgaW5mbGF0aW5nIG1lY2hhbmlzbSwgdGhlcmUnZCBiZSBubyB3YXkgdG8gdGVsbFxuLy8gdGhlIHN5c3RlbSB0byBzdG9wIGRvaW5nIHRoZSB0cmFuc2Zvcm0uICBBIHNpbmdsZSA0TUIgd3JpdGUgY291bGRcbi8vIGNhdXNlIHRoZSBzeXN0ZW0gdG8gcnVuIG91dCBvZiBtZW1vcnkuXG4vL1xuLy8gSG93ZXZlciwgZXZlbiBpbiBzdWNoIGEgcGF0aG9sb2dpY2FsIGNhc2UsIG9ubHkgYSBzaW5nbGUgd3JpdHRlbiBjaHVua1xuLy8gd291bGQgYmUgY29uc3VtZWQsIGFuZCB0aGVuIHRoZSByZXN0IHdvdWxkIHdhaXQgKHVuLXRyYW5zZm9ybWVkKSB1bnRpbFxuLy8gdGhlIHJlc3VsdHMgb2YgdGhlIHByZXZpb3VzIHRyYW5zZm9ybWVkIGNodW5rIHdlcmUgY29uc3VtZWQuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBUcmFuc2Zvcm07XG5cbnZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudXRpbC5pbmhlcml0cyhUcmFuc2Zvcm0sIER1cGxleCk7XG5cblxuZnVuY3Rpb24gVHJhbnNmb3JtU3RhdGUoc3RyZWFtKSB7XG4gIHRoaXMuYWZ0ZXJUcmFuc2Zvcm0gPSBmdW5jdGlvbihlciwgZGF0YSkge1xuICAgIHJldHVybiBhZnRlclRyYW5zZm9ybShzdHJlYW0sIGVyLCBkYXRhKTtcbiAgfTtcblxuICB0aGlzLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgdGhpcy50cmFuc2Zvcm1pbmcgPSBmYWxzZTtcbiAgdGhpcy53cml0ZWNiID0gbnVsbDtcbiAgdGhpcy53cml0ZWNodW5rID0gbnVsbDtcbn1cblxuZnVuY3Rpb24gYWZ0ZXJUcmFuc2Zvcm0oc3RyZWFtLCBlciwgZGF0YSkge1xuICB2YXIgdHMgPSBzdHJlYW0uX3RyYW5zZm9ybVN0YXRlO1xuICB0cy50cmFuc2Zvcm1pbmcgPSBmYWxzZTtcblxuICB2YXIgY2IgPSB0cy53cml0ZWNiO1xuXG4gIGlmICghY2IpXG4gICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignbm8gd3JpdGVjYiBpbiBUcmFuc2Zvcm0gY2xhc3MnKSk7XG5cbiAgdHMud3JpdGVjaHVuayA9IG51bGw7XG4gIHRzLndyaXRlY2IgPSBudWxsO1xuXG4gIGlmIChkYXRhICE9PSBudWxsICYmIGRhdGEgIT09IHVuZGVmaW5lZClcbiAgICBzdHJlYW0ucHVzaChkYXRhKTtcblxuICBpZiAoY2IpXG4gICAgY2IoZXIpO1xuXG4gIHZhciBycyA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgcnMucmVhZGluZyA9IGZhbHNlO1xuICBpZiAocnMubmVlZFJlYWRhYmxlIHx8IHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspIHtcbiAgICBzdHJlYW0uX3JlYWQocnMuaGlnaFdhdGVyTWFyayk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBUcmFuc2Zvcm0ob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgVHJhbnNmb3JtKSlcbiAgICByZXR1cm4gbmV3IFRyYW5zZm9ybShvcHRpb25zKTtcblxuICBEdXBsZXguY2FsbCh0aGlzLCBvcHRpb25zKTtcblxuICB0aGlzLl90cmFuc2Zvcm1TdGF0ZSA9IG5ldyBUcmFuc2Zvcm1TdGF0ZSh0aGlzKTtcblxuICAvLyB3aGVuIHRoZSB3cml0YWJsZSBzaWRlIGZpbmlzaGVzLCB0aGVuIGZsdXNoIG91dCBhbnl0aGluZyByZW1haW5pbmcuXG4gIHZhciBzdHJlYW0gPSB0aGlzO1xuXG4gIC8vIHN0YXJ0IG91dCBhc2tpbmcgZm9yIGEgcmVhZGFibGUgZXZlbnQgb25jZSBkYXRhIGlzIHRyYW5zZm9ybWVkLlxuICB0aGlzLl9yZWFkYWJsZVN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG5cbiAgLy8gd2UgaGF2ZSBpbXBsZW1lbnRlZCB0aGUgX3JlYWQgbWV0aG9kLCBhbmQgZG9uZSB0aGUgb3RoZXIgdGhpbmdzXG4gIC8vIHRoYXQgUmVhZGFibGUgd2FudHMgYmVmb3JlIHRoZSBmaXJzdCBfcmVhZCBjYWxsLCBzbyB1bnNldCB0aGVcbiAgLy8gc3luYyBndWFyZCBmbGFnLlxuICB0aGlzLl9yZWFkYWJsZVN0YXRlLnN5bmMgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy50cmFuc2Zvcm0gPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl90cmFuc2Zvcm0gPSBvcHRpb25zLnRyYW5zZm9ybTtcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5mbHVzaCA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX2ZsdXNoID0gb3B0aW9ucy5mbHVzaDtcbiAgfVxuXG4gIHRoaXMub25jZSgncHJlZmluaXNoJywgZnVuY3Rpb24oKSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLl9mbHVzaCA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX2ZsdXNoKGZ1bmN0aW9uKGVyKSB7XG4gICAgICAgIGRvbmUoc3RyZWFtLCBlcik7XG4gICAgICB9KTtcbiAgICBlbHNlXG4gICAgICBkb25lKHN0cmVhbSk7XG4gIH0pO1xufVxuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcpIHtcbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUubmVlZFRyYW5zZm9ybSA9IGZhbHNlO1xuICByZXR1cm4gRHVwbGV4LnByb3RvdHlwZS5wdXNoLmNhbGwodGhpcywgY2h1bmssIGVuY29kaW5nKTtcbn07XG5cbi8vIFRoaXMgaXMgdGhlIHBhcnQgd2hlcmUgeW91IGRvIHN0dWZmIVxuLy8gb3ZlcnJpZGUgdGhpcyBmdW5jdGlvbiBpbiBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gJ2NodW5rJyBpcyBhbiBpbnB1dCBjaHVuay5cbi8vXG4vLyBDYWxsIGBwdXNoKG5ld0NodW5rKWAgdG8gcGFzcyBhbG9uZyB0cmFuc2Zvcm1lZCBvdXRwdXRcbi8vIHRvIHRoZSByZWFkYWJsZSBzaWRlLiAgWW91IG1heSBjYWxsICdwdXNoJyB6ZXJvIG9yIG1vcmUgdGltZXMuXG4vL1xuLy8gQ2FsbCBgY2IoZXJyKWAgd2hlbiB5b3UgYXJlIGRvbmUgd2l0aCB0aGlzIGNodW5rLiAgSWYgeW91IHBhc3Ncbi8vIGFuIGVycm9yLCB0aGVuIHRoYXQnbGwgcHV0IHRoZSBodXJ0IG9uIHRoZSB3aG9sZSBvcGVyYXRpb24uICBJZiB5b3Vcbi8vIG5ldmVyIGNhbGwgY2IoKSwgdGhlbiB5b3UnbGwgbmV2ZXIgZ2V0IGFub3RoZXIgY2h1bmsuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl90cmFuc2Zvcm0gPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG59O1xuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdmFyIHRzID0gdGhpcy5fdHJhbnNmb3JtU3RhdGU7XG4gIHRzLndyaXRlY2IgPSBjYjtcbiAgdHMud3JpdGVjaHVuayA9IGNodW5rO1xuICB0cy53cml0ZWVuY29kaW5nID0gZW5jb2Rpbmc7XG4gIGlmICghdHMudHJhbnNmb3JtaW5nKSB7XG4gICAgdmFyIHJzID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgICBpZiAodHMubmVlZFRyYW5zZm9ybSB8fFxuICAgICAgICBycy5uZWVkUmVhZGFibGUgfHxcbiAgICAgICAgcnMubGVuZ3RoIDwgcnMuaGlnaFdhdGVyTWFyaylcbiAgICAgIHRoaXMuX3JlYWQocnMuaGlnaFdhdGVyTWFyayk7XG4gIH1cbn07XG5cbi8vIERvZXNuJ3QgbWF0dGVyIHdoYXQgdGhlIGFyZ3MgYXJlIGhlcmUuXG4vLyBfdHJhbnNmb3JtIGRvZXMgYWxsIHRoZSB3b3JrLlxuLy8gVGhhdCB3ZSBnb3QgaGVyZSBtZWFucyB0aGF0IHRoZSByZWFkYWJsZSBzaWRlIHdhbnRzIG1vcmUgZGF0YS5cblRyYW5zZm9ybS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuXG4gIGlmICh0cy53cml0ZWNodW5rICE9PSBudWxsICYmIHRzLndyaXRlY2IgJiYgIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHRzLnRyYW5zZm9ybWluZyA9IHRydWU7XG4gICAgdGhpcy5fdHJhbnNmb3JtKHRzLndyaXRlY2h1bmssIHRzLndyaXRlZW5jb2RpbmcsIHRzLmFmdGVyVHJhbnNmb3JtKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBtYXJrIHRoYXQgd2UgbmVlZCBhIHRyYW5zZm9ybSwgc28gdGhhdCBhbnkgZGF0YSB0aGF0IGNvbWVzIGluXG4gICAgLy8gd2lsbCBnZXQgcHJvY2Vzc2VkLCBub3cgdGhhdCB3ZSd2ZSBhc2tlZCBmb3IgaXQuXG4gICAgdHMubmVlZFRyYW5zZm9ybSA9IHRydWU7XG4gIH1cbn07XG5cblxuZnVuY3Rpb24gZG9uZShzdHJlYW0sIGVyKSB7XG4gIGlmIChlcilcbiAgICByZXR1cm4gc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuXG4gIC8vIGlmIHRoZXJlJ3Mgbm90aGluZyBpbiB0aGUgd3JpdGUgYnVmZmVyLCB0aGVuIHRoYXQgbWVhbnNcbiAgLy8gdGhhdCBub3RoaW5nIG1vcmUgd2lsbCBldmVyIGJlIHByb3ZpZGVkXG4gIHZhciB3cyA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHRzID0gc3RyZWFtLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAod3MubGVuZ3RoKVxuICAgIHRocm93IG5ldyBFcnJvcignY2FsbGluZyB0cmFuc2Zvcm0gZG9uZSB3aGVuIHdzLmxlbmd0aCAhPSAwJyk7XG5cbiAgaWYgKHRzLnRyYW5zZm9ybWluZylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiBzdGlsbCB0cmFuc2Zvcm1pbmcnKTtcblxuICByZXR1cm4gc3RyZWFtLnB1c2gobnVsbCk7XG59XG4iLCIvLyBBIGJpdCBzaW1wbGVyIHRoYW4gcmVhZGFibGUgc3RyZWFtcy5cbi8vIEltcGxlbWVudCBhbiBhc3luYyAuX3dyaXRlKGNodW5rLCBlbmNvZGluZywgY2IpLCBhbmQgaXQnbGwgaGFuZGxlIGFsbFxuLy8gdGhlIGRyYWluIGV2ZW50IGVtaXNzaW9uIGFuZCBidWZmZXJpbmcuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBXcml0YWJsZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBwcm9jZXNzTmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzLW5leHRpY2stYXJncycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuV3JpdGFibGUuV3JpdGFibGVTdGF0ZSA9IFdyaXRhYmxlU3RhdGU7XG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgaW50ZXJuYWxVdGlsID0ge1xuICBkZXByZWNhdGU6IHJlcXVpcmUoJ3V0aWwtZGVwcmVjYXRlJylcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgU3RyZWFtO1xuKGZ1bmN0aW9uICgpe3RyeXtcbiAgU3RyZWFtID0gcmVxdWlyZSgnc3QnICsgJ3JlYW0nKTtcbn1jYXRjaChfKXt9ZmluYWxseXtcbiAgaWYgKCFTdHJlYW0pXG4gICAgU3RyZWFtID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xufX0oKSlcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuXG51dGlsLmluaGVyaXRzKFdyaXRhYmxlLCBTdHJlYW0pO1xuXG5mdW5jdGlvbiBub3AoKSB7fVxuXG5mdW5jdGlvbiBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHRoaXMuY2h1bmsgPSBjaHVuaztcbiAgdGhpcy5lbmNvZGluZyA9IGVuY29kaW5nO1xuICB0aGlzLmNhbGxiYWNrID0gY2I7XG4gIHRoaXMubmV4dCA9IG51bGw7XG59XG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBXcml0YWJsZVN0YXRlKG9wdGlvbnMsIHN0cmVhbSkge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIG9iamVjdCBzdHJlYW0gZmxhZyB0byBpbmRpY2F0ZSB3aGV0aGVyIG9yIG5vdCB0aGlzIHN0cmVhbVxuICAvLyBjb250YWlucyBidWZmZXJzIG9yIG9iamVjdHMuXG4gIHRoaXMub2JqZWN0TW9kZSA9ICEhb3B0aW9ucy5vYmplY3RNb2RlO1xuXG4gIGlmIChzdHJlYW0gaW5zdGFuY2VvZiBEdXBsZXgpXG4gICAgdGhpcy5vYmplY3RNb2RlID0gdGhpcy5vYmplY3RNb2RlIHx8ICEhb3B0aW9ucy53cml0YWJsZU9iamVjdE1vZGU7XG5cbiAgLy8gdGhlIHBvaW50IGF0IHdoaWNoIHdyaXRlKCkgc3RhcnRzIHJldHVybmluZyBmYWxzZVxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIHRoYXQgd2UgYWx3YXlzIHJldHVybiBmYWxzZSBpZlxuICAvLyB0aGUgZW50aXJlIGJ1ZmZlciBpcyBub3QgZmx1c2hlZCBpbW1lZGlhdGVseSBvbiB3cml0ZSgpXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gdGhpcy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gY2FzdCB0byBpbnRzLlxuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSB+fnRoaXMuaGlnaFdhdGVyTWFyaztcblxuICB0aGlzLm5lZWREcmFpbiA9IGZhbHNlO1xuICAvLyBhdCB0aGUgc3RhcnQgb2YgY2FsbGluZyBlbmQoKVxuICB0aGlzLmVuZGluZyA9IGZhbHNlO1xuICAvLyB3aGVuIGVuZCgpIGhhcyBiZWVuIGNhbGxlZCwgYW5kIHJldHVybmVkXG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgLy8gd2hlbiAnZmluaXNoJyBpcyBlbWl0dGVkXG4gIHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBzaG91bGQgd2UgZGVjb2RlIHN0cmluZ3MgaW50byBidWZmZXJzIGJlZm9yZSBwYXNzaW5nIHRvIF93cml0ZT9cbiAgLy8gdGhpcyBpcyBoZXJlIHNvIHRoYXQgc29tZSBub2RlLWNvcmUgc3RyZWFtcyBjYW4gb3B0aW1pemUgc3RyaW5nXG4gIC8vIGhhbmRsaW5nIGF0IGEgbG93ZXIgbGV2ZWwuXG4gIHZhciBub0RlY29kZSA9IG9wdGlvbnMuZGVjb2RlU3RyaW5ncyA9PT0gZmFsc2U7XG4gIHRoaXMuZGVjb2RlU3RyaW5ncyA9ICFub0RlY29kZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyBub3QgYW4gYWN0dWFsIGJ1ZmZlciB3ZSBrZWVwIHRyYWNrIG9mLCBidXQgYSBtZWFzdXJlbWVudFxuICAvLyBvZiBob3cgbXVjaCB3ZSdyZSB3YWl0aW5nIHRvIGdldCBwdXNoZWQgdG8gc29tZSB1bmRlcmx5aW5nXG4gIC8vIHNvY2tldCBvciBmaWxlLlxuICB0aGlzLmxlbmd0aCA9IDA7XG5cbiAgLy8gYSBmbGFnIHRvIHNlZSB3aGVuIHdlJ3JlIGluIHRoZSBtaWRkbGUgb2YgYSB3cml0ZS5cbiAgdGhpcy53cml0aW5nID0gZmFsc2U7XG5cbiAgLy8gd2hlbiB0cnVlIGFsbCB3cml0ZXMgd2lsbCBiZSBidWZmZXJlZCB1bnRpbCAudW5jb3JrKCkgY2FsbFxuICB0aGlzLmNvcmtlZCA9IDA7XG5cbiAgLy8gYSBmbGFnIHRvIGJlIGFibGUgdG8gdGVsbCBpZiB0aGUgb253cml0ZSBjYiBpcyBjYWxsZWQgaW1tZWRpYXRlbHksXG4gIC8vIG9yIG9uIGEgbGF0ZXIgdGljay4gIFdlIHNldCB0aGlzIHRvIHRydWUgYXQgZmlyc3QsIGJlY2F1c2UgYW55XG4gIC8vIGFjdGlvbnMgdGhhdCBzaG91bGRuJ3QgaGFwcGVuIHVudGlsIFwibGF0ZXJcIiBzaG91bGQgZ2VuZXJhbGx5IGFsc29cbiAgLy8gbm90IGhhcHBlbiBiZWZvcmUgdGhlIGZpcnN0IHdyaXRlIGNhbGwuXG4gIHRoaXMuc3luYyA9IHRydWU7XG5cbiAgLy8gYSBmbGFnIHRvIGtub3cgaWYgd2UncmUgcHJvY2Vzc2luZyBwcmV2aW91c2x5IGJ1ZmZlcmVkIGl0ZW1zLCB3aGljaFxuICAvLyBtYXkgY2FsbCB0aGUgX3dyaXRlKCkgY2FsbGJhY2sgaW4gdGhlIHNhbWUgdGljaywgc28gdGhhdCB3ZSBkb24ndFxuICAvLyBlbmQgdXAgaW4gYW4gb3ZlcmxhcHBlZCBvbndyaXRlIHNpdHVhdGlvbi5cbiAgdGhpcy5idWZmZXJQcm9jZXNzaW5nID0gZmFsc2U7XG5cbiAgLy8gdGhlIGNhbGxiYWNrIHRoYXQncyBwYXNzZWQgdG8gX3dyaXRlKGNodW5rLGNiKVxuICB0aGlzLm9ud3JpdGUgPSBmdW5jdGlvbihlcikge1xuICAgIG9ud3JpdGUoc3RyZWFtLCBlcik7XG4gIH07XG5cbiAgLy8gdGhlIGNhbGxiYWNrIHRoYXQgdGhlIHVzZXIgc3VwcGxpZXMgdG8gd3JpdGUoY2h1bmssZW5jb2RpbmcsY2IpXG4gIHRoaXMud3JpdGVjYiA9IG51bGw7XG5cbiAgLy8gdGhlIGFtb3VudCB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gd2hlbiBfd3JpdGUgaXMgY2FsbGVkLlxuICB0aGlzLndyaXRlbGVuID0gMDtcblxuICB0aGlzLmJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gIHRoaXMubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG5cbiAgLy8gbnVtYmVyIG9mIHBlbmRpbmcgdXNlci1zdXBwbGllZCB3cml0ZSBjYWxsYmFja3NcbiAgLy8gdGhpcyBtdXN0IGJlIDAgYmVmb3JlICdmaW5pc2gnIGNhbiBiZSBlbWl0dGVkXG4gIHRoaXMucGVuZGluZ2NiID0gMDtcblxuICAvLyBlbWl0IHByZWZpbmlzaCBpZiB0aGUgb25seSB0aGluZyB3ZSdyZSB3YWl0aW5nIGZvciBpcyBfd3JpdGUgY2JzXG4gIC8vIFRoaXMgaXMgcmVsZXZhbnQgZm9yIHN5bmNocm9ub3VzIFRyYW5zZm9ybSBzdHJlYW1zXG4gIHRoaXMucHJlZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBUcnVlIGlmIHRoZSBlcnJvciB3YXMgYWxyZWFkeSBlbWl0dGVkIGFuZCBzaG91bGQgbm90IGJlIHRocm93biBhZ2FpblxuICB0aGlzLmVycm9yRW1pdHRlZCA9IGZhbHNlO1xufVxuXG5Xcml0YWJsZVN0YXRlLnByb3RvdHlwZS5nZXRCdWZmZXIgPSBmdW5jdGlvbiB3cml0YWJsZVN0YXRlR2V0QnVmZmVyKCkge1xuICB2YXIgY3VycmVudCA9IHRoaXMuYnVmZmVyZWRSZXF1ZXN0O1xuICB2YXIgb3V0ID0gW107XG4gIHdoaWxlIChjdXJyZW50KSB7XG4gICAgb3V0LnB1c2goY3VycmVudCk7XG4gICAgY3VycmVudCA9IGN1cnJlbnQubmV4dDtcbiAgfVxuICByZXR1cm4gb3V0O1xufTtcblxuKGZ1bmN0aW9uICgpe3RyeSB7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGVTdGF0ZS5wcm90b3R5cGUsICdidWZmZXInLCB7XG4gIGdldDogaW50ZXJuYWxVdGlsLmRlcHJlY2F0ZShmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXIoKTtcbiAgfSwgJ193cml0YWJsZVN0YXRlLmJ1ZmZlciBpcyBkZXByZWNhdGVkLiBVc2UgX3dyaXRhYmxlU3RhdGUuZ2V0QnVmZmVyICcgK1xuICAgICAnaW5zdGVhZC4nKVxufSk7XG59Y2F0Y2goXyl7fX0oKSk7XG5cblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFdyaXRhYmxlKG9wdGlvbnMpIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICAvLyBXcml0YWJsZSBjdG9yIGlzIGFwcGxpZWQgdG8gRHVwbGV4ZXMsIHRob3VnaCB0aGV5J3JlIG5vdFxuICAvLyBpbnN0YW5jZW9mIFdyaXRhYmxlLCB0aGV5J3JlIGluc3RhbmNlb2YgUmVhZGFibGUuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBXcml0YWJsZSkgJiYgISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSlcbiAgICByZXR1cm4gbmV3IFdyaXRhYmxlKG9wdGlvbnMpO1xuXG4gIHRoaXMuX3dyaXRhYmxlU3RhdGUgPSBuZXcgV3JpdGFibGVTdGF0ZShvcHRpb25zLCB0aGlzKTtcblxuICAvLyBsZWdhY3kuXG4gIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLndyaXRlID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fd3JpdGUgPSBvcHRpb25zLndyaXRlO1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLndyaXRldiA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX3dyaXRldiA9IG9wdGlvbnMud3JpdGV2O1xuICB9XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE90aGVyd2lzZSBwZW9wbGUgY2FuIHBpcGUgV3JpdGFibGUgc3RyZWFtcywgd2hpY2ggaXMganVzdCB3cm9uZy5cbldyaXRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ0Nhbm5vdCBwaXBlLiBOb3QgcmVhZGFibGUuJykpO1xufTtcblxuXG5mdW5jdGlvbiB3cml0ZUFmdGVyRW5kKHN0cmVhbSwgY2IpIHtcbiAgdmFyIGVyID0gbmV3IEVycm9yKCd3cml0ZSBhZnRlciBlbmQnKTtcbiAgLy8gVE9ETzogZGVmZXIgZXJyb3IgZXZlbnRzIGNvbnNpc3RlbnRseSBldmVyeXdoZXJlLCBub3QganVzdCB0aGUgY2JcbiAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICBwcm9jZXNzTmV4dFRpY2soY2IsIGVyKTtcbn1cblxuLy8gSWYgd2UgZ2V0IHNvbWV0aGluZyB0aGF0IGlzIG5vdCBhIGJ1ZmZlciwgc3RyaW5nLCBudWxsLCBvciB1bmRlZmluZWQsXG4vLyBhbmQgd2UncmUgbm90IGluIG9iamVjdE1vZGUsIHRoZW4gdGhhdCdzIGFuIGVycm9yLlxuLy8gT3RoZXJ3aXNlIHN0cmVhbSBjaHVua3MgYXJlIGFsbCBjb25zaWRlcmVkIHRvIGJlIG9mIGxlbmd0aD0xLCBhbmQgdGhlXG4vLyB3YXRlcm1hcmtzIGRldGVybWluZSBob3cgbWFueSBvYmplY3RzIHRvIGtlZXAgaW4gdGhlIGJ1ZmZlciwgcmF0aGVyIHRoYW5cbi8vIGhvdyBtYW55IGJ5dGVzIG9yIGNoYXJhY3RlcnMuXG5mdW5jdGlvbiB2YWxpZENodW5rKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBjYikge1xuICB2YXIgdmFsaWQgPSB0cnVlO1xuXG4gIGlmICghKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpICYmXG4gICAgICB0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmXG4gICAgICBjaHVuayAhPT0gbnVsbCAmJlxuICAgICAgY2h1bmsgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICB2YXIgZXIgPSBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG5vbi1zdHJpbmcvYnVmZmVyIGNodW5rJyk7XG4gICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICAgIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xuICAgIHZhbGlkID0gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHZhbGlkO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG4gIHZhciByZXQgPSBmYWxzZTtcblxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBlbmNvZGluZztcbiAgICBlbmNvZGluZyA9IG51bGw7XG4gIH1cblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSlcbiAgICBlbmNvZGluZyA9ICdidWZmZXInO1xuICBlbHNlIGlmICghZW5jb2RpbmcpXG4gICAgZW5jb2RpbmcgPSBzdGF0ZS5kZWZhdWx0RW5jb2Rpbmc7XG5cbiAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJylcbiAgICBjYiA9IG5vcDtcblxuICBpZiAoc3RhdGUuZW5kZWQpXG4gICAgd3JpdGVBZnRlckVuZCh0aGlzLCBjYik7XG4gIGVsc2UgaWYgKHZhbGlkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBjYikpIHtcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICByZXQgPSB3cml0ZU9yQnVmZmVyKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIHN0YXRlLmNvcmtlZCsrO1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLnVuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQtLTtcblxuICAgIGlmICghc3RhdGUud3JpdGluZyAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QpXG4gICAgICBjbGVhckJ1ZmZlcih0aGlzLCBzdGF0ZSk7XG4gIH1cbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5zZXREZWZhdWx0RW5jb2RpbmcgPSBmdW5jdGlvbiBzZXREZWZhdWx0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgLy8gbm9kZTo6UGFyc2VFbmNvZGluZygpIHJlcXVpcmVzIGxvd2VyIGNhc2UuXG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnKVxuICAgIGVuY29kaW5nID0gZW5jb2RpbmcudG9Mb3dlckNhc2UoKTtcbiAgaWYgKCEoWydoZXgnLCAndXRmOCcsICd1dGYtOCcsICdhc2NpaScsICdiaW5hcnknLCAnYmFzZTY0Jyxcbid1Y3MyJywgJ3Vjcy0yJywndXRmMTZsZScsICd1dGYtMTZsZScsICdyYXcnXVxuLmluZGV4T2YoKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKCkpID4gLTEpKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XG4gIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVmYXVsdEVuY29kaW5nID0gZW5jb2Rpbmc7XG59O1xuXG5mdW5jdGlvbiBkZWNvZGVDaHVuayhzdGF0ZSwgY2h1bmssIGVuY29kaW5nKSB7XG4gIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJlxuICAgICAgc3RhdGUuZGVjb2RlU3RyaW5ncyAhPT0gZmFsc2UgJiZcbiAgICAgIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpIHtcbiAgICBjaHVuayA9IG5ldyBCdWZmZXIoY2h1bmssIGVuY29kaW5nKTtcbiAgfVxuICByZXR1cm4gY2h1bms7XG59XG5cbi8vIGlmIHdlJ3JlIGFscmVhZHkgd3JpdGluZyBzb21ldGhpbmcsIHRoZW4ganVzdCBwdXQgdGhpc1xuLy8gaW4gdGhlIHF1ZXVlLCBhbmQgd2FpdCBvdXIgdHVybi4gIE90aGVyd2lzZSwgY2FsbCBfd3JpdGVcbi8vIElmIHdlIHJldHVybiBmYWxzZSwgdGhlbiB3ZSBuZWVkIGEgZHJhaW4gZXZlbnQsIHNvIHNldCB0aGF0IGZsYWcuXG5mdW5jdGlvbiB3cml0ZU9yQnVmZmVyKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2h1bmsgPSBkZWNvZGVDaHVuayhzdGF0ZSwgY2h1bmssIGVuY29kaW5nKTtcblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSlcbiAgICBlbmNvZGluZyA9ICdidWZmZXInO1xuICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgc3RhdGUubGVuZ3RoICs9IGxlbjtcblxuICB2YXIgcmV0ID0gc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgLy8gd2UgbXVzdCBlbnN1cmUgdGhhdCBwcmV2aW91cyBuZWVkRHJhaW4gd2lsbCBub3QgYmUgcmVzZXQgdG8gZmFsc2UuXG4gIGlmICghcmV0KVxuICAgIHN0YXRlLm5lZWREcmFpbiA9IHRydWU7XG5cbiAgaWYgKHN0YXRlLndyaXRpbmcgfHwgc3RhdGUuY29ya2VkKSB7XG4gICAgdmFyIGxhc3QgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBuZXcgV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYik7XG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIGxhc3QubmV4dCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmFsc2UsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHdyaXRldiwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHN0YXRlLndyaXRlbGVuID0gbGVuO1xuICBzdGF0ZS53cml0ZWNiID0gY2I7XG4gIHN0YXRlLndyaXRpbmcgPSB0cnVlO1xuICBzdGF0ZS5zeW5jID0gdHJ1ZTtcbiAgaWYgKHdyaXRldilcbiAgICBzdHJlYW0uX3dyaXRldihjaHVuaywgc3RhdGUub253cml0ZSk7XG4gIGVsc2VcbiAgICBzdHJlYW0uX3dyaXRlKGNodW5rLCBlbmNvZGluZywgc3RhdGUub253cml0ZSk7XG4gIHN0YXRlLnN5bmMgPSBmYWxzZTtcbn1cblxuZnVuY3Rpb24gb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYikge1xuICAtLXN0YXRlLnBlbmRpbmdjYjtcbiAgaWYgKHN5bmMpXG4gICAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG4gIGVsc2VcbiAgICBjYihlcik7XG5cbiAgc3RyZWFtLl93cml0YWJsZVN0YXRlLmVycm9yRW1pdHRlZCA9IHRydWU7XG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbn1cblxuZnVuY3Rpb24gb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKSB7XG4gIHN0YXRlLndyaXRpbmcgPSBmYWxzZTtcbiAgc3RhdGUud3JpdGVjYiA9IG51bGw7XG4gIHN0YXRlLmxlbmd0aCAtPSBzdGF0ZS53cml0ZWxlbjtcbiAgc3RhdGUud3JpdGVsZW4gPSAwO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlKHN0cmVhbSwgZXIpIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl93cml0YWJsZVN0YXRlO1xuICB2YXIgc3luYyA9IHN0YXRlLnN5bmM7XG4gIHZhciBjYiA9IHN0YXRlLndyaXRlY2I7XG5cbiAgb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKTtcblxuICBpZiAoZXIpXG4gICAgb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYik7XG4gIGVsc2Uge1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGFjdHVhbGx5IHJlYWR5IHRvIGZpbmlzaCwgYnV0IGRvbid0IGVtaXQgeWV0XG4gICAgdmFyIGZpbmlzaGVkID0gbmVlZEZpbmlzaChzdGF0ZSk7XG5cbiAgICBpZiAoIWZpbmlzaGVkICYmXG4gICAgICAgICFzdGF0ZS5jb3JrZWQgJiZcbiAgICAgICAgIXN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgJiZcbiAgICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0KSB7XG4gICAgICBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG5cbiAgICBpZiAoc3luYykge1xuICAgICAgcHJvY2Vzc05leHRUaWNrKGFmdGVyV3JpdGUsIHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpIHtcbiAgaWYgKCFmaW5pc2hlZClcbiAgICBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSk7XG4gIHN0YXRlLnBlbmRpbmdjYi0tO1xuICBjYigpO1xuICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbn1cblxuLy8gTXVzdCBmb3JjZSBjYWxsYmFjayB0byBiZSBjYWxsZWQgb24gbmV4dFRpY2ssIHNvIHRoYXQgd2UgZG9uJ3Rcbi8vIGVtaXQgJ2RyYWluJyBiZWZvcmUgdGhlIHdyaXRlKCkgY29uc3VtZXIgZ2V0cyB0aGUgJ2ZhbHNlJyByZXR1cm5cbi8vIHZhbHVlLCBhbmQgaGFzIGEgY2hhbmNlIHRvIGF0dGFjaCBhICdkcmFpbicgbGlzdGVuZXIuXG5mdW5jdGlvbiBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLm5lZWREcmFpbikge1xuICAgIHN0YXRlLm5lZWREcmFpbiA9IGZhbHNlO1xuICAgIHN0cmVhbS5lbWl0KCdkcmFpbicpO1xuICB9XG59XG5cblxuLy8gaWYgdGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlciB3YWl0aW5nLCB0aGVuIHByb2Nlc3MgaXRcbmZ1bmN0aW9uIGNsZWFyQnVmZmVyKHN0cmVhbSwgc3RhdGUpIHtcbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IHRydWU7XG4gIHZhciBlbnRyeSA9IHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdDtcblxuICBpZiAoc3RyZWFtLl93cml0ZXYgJiYgZW50cnkgJiYgZW50cnkubmV4dCkge1xuICAgIC8vIEZhc3QgY2FzZSwgd3JpdGUgZXZlcnl0aGluZyB1c2luZyBfd3JpdGV2KClcbiAgICB2YXIgYnVmZmVyID0gW107XG4gICAgdmFyIGNicyA9IFtdO1xuICAgIHdoaWxlIChlbnRyeSkge1xuICAgICAgY2JzLnB1c2goZW50cnkuY2FsbGJhY2spO1xuICAgICAgYnVmZmVyLnB1c2goZW50cnkpO1xuICAgICAgZW50cnkgPSBlbnRyeS5uZXh0O1xuICAgIH1cblxuICAgIC8vIGNvdW50IHRoZSBvbmUgd2UgYXJlIGFkZGluZywgYXMgd2VsbC5cbiAgICAvLyBUT0RPKGlzYWFjcykgY2xlYW4gdGhpcyB1cFxuICAgIHN0YXRlLnBlbmRpbmdjYisrO1xuICAgIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICAgIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgdHJ1ZSwgc3RhdGUubGVuZ3RoLCBidWZmZXIsICcnLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN0YXRlLnBlbmRpbmdjYi0tO1xuICAgICAgICBjYnNbaV0oZXJyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENsZWFyIGJ1ZmZlclxuICB9IGVsc2Uge1xuICAgIC8vIFNsb3cgY2FzZSwgd3JpdGUgY2h1bmtzIG9uZS1ieS1vbmVcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIHZhciBjaHVuayA9IGVudHJ5LmNodW5rO1xuICAgICAgdmFyIGVuY29kaW5nID0gZW50cnkuZW5jb2Rpbmc7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICAgICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICAgIC8vIGlmIHdlIGRpZG4ndCBjYWxsIHRoZSBvbndyaXRlIGltbWVkaWF0ZWx5LCB0aGVuXG4gICAgICAvLyBpdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gd2FpdCB1bnRpbCBpdCBkb2VzLlxuICAgICAgLy8gYWxzbywgdGhhdCBtZWFucyB0aGF0IHRoZSBjaHVuayBhbmQgY2IgYXJlIGN1cnJlbnRseVxuICAgICAgLy8gYmVpbmcgcHJvY2Vzc2VkLCBzbyBtb3ZlIHRoZSBidWZmZXIgY291bnRlciBwYXN0IHRoZW0uXG4gICAgICBpZiAoc3RhdGUud3JpdGluZykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZW50cnkgPT09IG51bGwpXG4gICAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgfVxuICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPSBlbnRyeTtcbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5fd3JpdGV2ID0gbnVsbDtcblxuV3JpdGFibGUucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBpZiAodHlwZW9mIGNodW5rID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBjaHVuaztcbiAgICBjaHVuayA9IG51bGw7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKGNodW5rICE9PSBudWxsICYmIGNodW5rICE9PSB1bmRlZmluZWQpXG4gICAgdGhpcy53cml0ZShjaHVuaywgZW5jb2RpbmcpO1xuXG4gIC8vIC5lbmQoKSBmdWxseSB1bmNvcmtzXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQgPSAxO1xuICAgIHRoaXMudW5jb3JrKCk7XG4gIH1cblxuICAvLyBpZ25vcmUgdW5uZWNlc3NhcnkgZW5kKCkgY2FsbHMuXG4gIGlmICghc3RhdGUuZW5kaW5nICYmICFzdGF0ZS5maW5pc2hlZClcbiAgICBlbmRXcml0YWJsZSh0aGlzLCBzdGF0ZSwgY2IpO1xufTtcblxuXG5mdW5jdGlvbiBuZWVkRmluaXNoKHN0YXRlKSB7XG4gIHJldHVybiAoc3RhdGUuZW5kaW5nICYmXG4gICAgICAgICAgc3RhdGUubGVuZ3RoID09PSAwICYmXG4gICAgICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID09PSBudWxsICYmXG4gICAgICAgICAgIXN0YXRlLmZpbmlzaGVkICYmXG4gICAgICAgICAgIXN0YXRlLndyaXRpbmcpO1xufVxuXG5mdW5jdGlvbiBwcmVmaW5pc2goc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnByZWZpbmlzaGVkKSB7XG4gICAgc3RhdGUucHJlZmluaXNoZWQgPSB0cnVlO1xuICAgIHN0cmVhbS5lbWl0KCdwcmVmaW5pc2gnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKSB7XG4gIHZhciBuZWVkID0gbmVlZEZpbmlzaChzdGF0ZSk7XG4gIGlmIChuZWVkKSB7XG4gICAgaWYgKHN0YXRlLnBlbmRpbmdjYiA9PT0gMCkge1xuICAgICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgICAgc3RhdGUuZmluaXNoZWQgPSB0cnVlO1xuICAgICAgc3RyZWFtLmVtaXQoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcmVmaW5pc2goc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZWVkO1xufVxuXG5mdW5jdGlvbiBlbmRXcml0YWJsZShzdHJlYW0sIHN0YXRlLCBjYikge1xuICBzdGF0ZS5lbmRpbmcgPSB0cnVlO1xuICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbiAgaWYgKGNiKSB7XG4gICAgaWYgKHN0YXRlLmZpbmlzaGVkKVxuICAgICAgcHJvY2Vzc05leHRUaWNrKGNiKTtcbiAgICBlbHNlXG4gICAgICBzdHJlYW0ub25jZSgnZmluaXNoJywgY2IpO1xuICB9XG4gIHN0YXRlLmVuZGVkID0gdHJ1ZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fcGFzc3Rocm91Z2guanNcIilcbiIsInZhciBTdHJlYW0gPSAoZnVuY3Rpb24gKCl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7IC8vIGhhY2sgdG8gZml4IGEgY2lyY3VsYXIgZGVwZW5kZW5jeSBpc3N1ZSB3aGVuIHVzZWQgd2l0aCBicm93c2VyaWZ5XG4gIH0gY2F0Y2goXyl7fVxufSgpKTtcbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fcmVhZGFibGUuanMnKTtcbmV4cG9ydHMuU3RyZWFtID0gU3RyZWFtIHx8IGV4cG9ydHM7XG5leHBvcnRzLlJlYWRhYmxlID0gZXhwb3J0cztcbmV4cG9ydHMuV3JpdGFibGUgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzJyk7XG5leHBvcnRzLkR1cGxleCA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fZHVwbGV4LmpzJyk7XG5leHBvcnRzLlRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzJyk7XG5leHBvcnRzLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcycpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV90cmFuc2Zvcm0uanNcIilcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fd3JpdGFibGUuanNcIilcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0cmVhbTtcblxudmFyIEVFID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuaW5oZXJpdHMoU3RyZWFtLCBFRSk7XG5TdHJlYW0uUmVhZGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vcmVhZGFibGUuanMnKTtcblN0cmVhbS5Xcml0YWJsZSA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS93cml0YWJsZS5qcycpO1xuU3RyZWFtLkR1cGxleCA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS9kdXBsZXguanMnKTtcblN0cmVhbS5UcmFuc2Zvcm0gPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzJyk7XG5TdHJlYW0uUGFzc1Rocm91Z2ggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMnKTtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC40LnhcblN0cmVhbS5TdHJlYW0gPSBTdHJlYW07XG5cblxuXG4vLyBvbGQtc3R5bGUgc3RyZWFtcy4gIE5vdGUgdGhhdCB0aGUgcGlwZSBtZXRob2QgKHRoZSBvbmx5IHJlbGV2YW50XG4vLyBwYXJ0IG9mIHRoaXMgY2xhc3MpIGlzIG92ZXJyaWRkZW4gaW4gdGhlIFJlYWRhYmxlIGNsYXNzLlxuXG5mdW5jdGlvbiBTdHJlYW0oKSB7XG4gIEVFLmNhbGwodGhpcyk7XG59XG5cblN0cmVhbS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKGRlc3QsIG9wdGlvbnMpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXM7XG5cbiAgZnVuY3Rpb24gb25kYXRhKGNodW5rKSB7XG4gICAgaWYgKGRlc3Qud3JpdGFibGUpIHtcbiAgICAgIGlmIChmYWxzZSA9PT0gZGVzdC53cml0ZShjaHVuaykgJiYgc291cmNlLnBhdXNlKSB7XG4gICAgICAgIHNvdXJjZS5wYXVzZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHNvdXJjZS5vbignZGF0YScsIG9uZGF0YSk7XG5cbiAgZnVuY3Rpb24gb25kcmFpbigpIHtcbiAgICBpZiAoc291cmNlLnJlYWRhYmxlICYmIHNvdXJjZS5yZXN1bWUpIHtcbiAgICAgIHNvdXJjZS5yZXN1bWUoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIC8vIElmIHRoZSAnZW5kJyBvcHRpb24gaXMgbm90IHN1cHBsaWVkLCBkZXN0LmVuZCgpIHdpbGwgYmUgY2FsbGVkIHdoZW5cbiAgLy8gc291cmNlIGdldHMgdGhlICdlbmQnIG9yICdjbG9zZScgZXZlbnRzLiAgT25seSBkZXN0LmVuZCgpIG9uY2UuXG4gIGlmICghZGVzdC5faXNTdGRpbyAmJiAoIW9wdGlvbnMgfHwgb3B0aW9ucy5lbmQgIT09IGZhbHNlKSkge1xuICAgIHNvdXJjZS5vbignZW5kJywgb25lbmQpO1xuICAgIHNvdXJjZS5vbignY2xvc2UnLCBvbmNsb3NlKTtcbiAgfVxuXG4gIHZhciBkaWRPbkVuZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBvbmVuZCgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBkZXN0LmVuZCgpO1xuICB9XG5cblxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGlmIChkaWRPbkVuZCkgcmV0dXJuO1xuICAgIGRpZE9uRW5kID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgZGVzdC5kZXN0cm95ID09PSAnZnVuY3Rpb24nKSBkZXN0LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8vIGRvbid0IGxlYXZlIGRhbmdsaW5nIHBpcGVzIHdoZW4gdGhlcmUgYXJlIGVycm9ycy5cbiAgZnVuY3Rpb24gb25lcnJvcihlcikge1xuICAgIGNsZWFudXAoKTtcbiAgICBpZiAoRUUubGlzdGVuZXJDb3VudCh0aGlzLCAnZXJyb3InKSA9PT0gMCkge1xuICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCBzdHJlYW0gZXJyb3IgaW4gcGlwZS5cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgLy8gcmVtb3ZlIGFsbCB0aGUgZXZlbnQgbGlzdGVuZXJzIHRoYXQgd2VyZSBhZGRlZC5cbiAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcblxuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZW5kJywgY2xlYW51cCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIGNsZWFudXApO1xuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcbiAgfVxuXG4gIHNvdXJjZS5vbignZW5kJywgY2xlYW51cCk7XG4gIHNvdXJjZS5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0Lm9uKCdjbG9zZScsIGNsZWFudXApO1xuXG4gIGRlc3QuZW1pdCgncGlwZScsIHNvdXJjZSk7XG5cbiAgLy8gQWxsb3cgZm9yIHVuaXgtbGlrZSB1c2FnZTogQS5waXBlKEIpLnBpcGUoQylcbiAgcmV0dXJuIGRlc3Q7XG59O1xuIiwidmFyIENsaWVudFJlcXVlc3QgPSByZXF1aXJlKCcuL2xpYi9yZXF1ZXN0JylcbnZhciBleHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpXG52YXIgc3RhdHVzQ29kZXMgPSByZXF1aXJlKCdidWlsdGluLXN0YXR1cy1jb2RlcycpXG52YXIgdXJsID0gcmVxdWlyZSgndXJsJylcblxudmFyIGh0dHAgPSBleHBvcnRzXG5cbmh0dHAucmVxdWVzdCA9IGZ1bmN0aW9uIChvcHRzLCBjYikge1xuXHRpZiAodHlwZW9mIG9wdHMgPT09ICdzdHJpbmcnKVxuXHRcdG9wdHMgPSB1cmwucGFyc2Uob3B0cylcblx0ZWxzZVxuXHRcdG9wdHMgPSBleHRlbmQob3B0cylcblxuXHR2YXIgcHJvdG9jb2wgPSBvcHRzLnByb3RvY29sIHx8ICcnXG5cdHZhciBob3N0ID0gb3B0cy5ob3N0bmFtZSB8fCBvcHRzLmhvc3Rcblx0dmFyIHBvcnQgPSBvcHRzLnBvcnRcblx0dmFyIHBhdGggPSBvcHRzLnBhdGggfHwgJy8nXG5cblx0Ly8gTmVjZXNzYXJ5IGZvciBJUHY2IGFkZHJlc3Nlc1xuXHRpZiAoaG9zdCAmJiBob3N0LmluZGV4T2YoJzonKSAhPT0gLTEpXG5cdFx0aG9zdCA9ICdbJyArIGhvc3QgKyAnXSdcblxuXHQvLyBUaGlzIG1heSBiZSBhIHJlbGF0aXZlIHVybC4gVGhlIGJyb3dzZXIgc2hvdWxkIGFsd2F5cyBiZSBhYmxlIHRvIGludGVycHJldCBpdCBjb3JyZWN0bHkuXG5cdG9wdHMudXJsID0gKGhvc3QgPyAocHJvdG9jb2wgKyAnLy8nICsgaG9zdCkgOiAnJykgKyAocG9ydCA/ICc6JyArIHBvcnQgOiAnJykgKyBwYXRoXG5cdG9wdHMubWV0aG9kID0gKG9wdHMubWV0aG9kIHx8ICdHRVQnKS50b1VwcGVyQ2FzZSgpXG5cdG9wdHMuaGVhZGVycyA9IG9wdHMuaGVhZGVycyB8fCB7fVxuXG5cdC8vIEFsc28gdmFsaWQgb3B0cy5hdXRoLCBvcHRzLm1vZGVcblxuXHR2YXIgcmVxID0gbmV3IENsaWVudFJlcXVlc3Qob3B0cylcblx0aWYgKGNiKVxuXHRcdHJlcS5vbigncmVzcG9uc2UnLCBjYilcblx0cmV0dXJuIHJlcVxufVxuXG5odHRwLmdldCA9IGZ1bmN0aW9uIGdldCAob3B0cywgY2IpIHtcblx0dmFyIHJlcSA9IGh0dHAucmVxdWVzdChvcHRzLCBjYilcblx0cmVxLmVuZCgpXG5cdHJldHVybiByZXFcbn1cblxuaHR0cC5BZ2VudCA9IGZ1bmN0aW9uICgpIHt9XG5odHRwLkFnZW50LmRlZmF1bHRNYXhTb2NrZXRzID0gNFxuXG5odHRwLlNUQVRVU19DT0RFUyA9IHN0YXR1c0NvZGVzXG5cbmh0dHAuTUVUSE9EUyA9IFtcblx0J0NIRUNLT1VUJyxcblx0J0NPTk5FQ1QnLFxuXHQnQ09QWScsXG5cdCdERUxFVEUnLFxuXHQnR0VUJyxcblx0J0hFQUQnLFxuXHQnTE9DSycsXG5cdCdNLVNFQVJDSCcsXG5cdCdNRVJHRScsXG5cdCdNS0FDVElWSVRZJyxcblx0J01LQ09MJyxcblx0J01PVkUnLFxuXHQnTk9USUZZJyxcblx0J09QVElPTlMnLFxuXHQnUEFUQ0gnLFxuXHQnUE9TVCcsXG5cdCdQUk9QRklORCcsXG5cdCdQUk9QUEFUQ0gnLFxuXHQnUFVSR0UnLFxuXHQnUFVUJyxcblx0J1JFUE9SVCcsXG5cdCdTRUFSQ0gnLFxuXHQnU1VCU0NSSUJFJyxcblx0J1RSQUNFJyxcblx0J1VOTE9DSycsXG5cdCdVTlNVQlNDUklCRSdcbl0iLCJleHBvcnRzLmZldGNoID0gaXNGdW5jdGlvbihnbG9iYWwuZmV0Y2gpICYmIGlzRnVuY3Rpb24oZ2xvYmFsLlJlYWRhYmxlQnl0ZVN0cmVhbSlcblxuZXhwb3J0cy5ibG9iQ29uc3RydWN0b3IgPSBmYWxzZVxudHJ5IHtcblx0bmV3IEJsb2IoW25ldyBBcnJheUJ1ZmZlcigxKV0pXG5cdGV4cG9ydHMuYmxvYkNvbnN0cnVjdG9yID0gdHJ1ZVxufSBjYXRjaCAoZSkge31cblxudmFyIHhociA9IG5ldyBnbG9iYWwuWE1MSHR0cFJlcXVlc3QoKVxuLy8gSWYgbG9jYXRpb24uaG9zdCBpcyBlbXB0eSwgZS5nLiBpZiB0aGlzIHBhZ2Uvd29ya2VyIHdhcyBsb2FkZWRcbi8vIGZyb20gYSBCbG9iLCB0aGVuIHVzZSBleGFtcGxlLmNvbSB0byBhdm9pZCBhbiBlcnJvclxueGhyLm9wZW4oJ0dFVCcsIGdsb2JhbC5sb2NhdGlvbi5ob3N0ID8gJy8nIDogJ2h0dHBzOi8vZXhhbXBsZS5jb20nKVxuXG5mdW5jdGlvbiBjaGVja1R5cGVTdXBwb3J0ICh0eXBlKSB7XG5cdHRyeSB7XG5cdFx0eGhyLnJlc3BvbnNlVHlwZSA9IHR5cGVcblx0XHRyZXR1cm4geGhyLnJlc3BvbnNlVHlwZSA9PT0gdHlwZVxuXHR9IGNhdGNoIChlKSB7fVxuXHRyZXR1cm4gZmFsc2Vcbn1cblxuLy8gRm9yIHNvbWUgc3RyYW5nZSByZWFzb24sIFNhZmFyaSA3LjAgcmVwb3J0cyB0eXBlb2YgZ2xvYmFsLkFycmF5QnVmZmVyID09PSAnb2JqZWN0Jy5cbi8vIFNhZmFyaSA3LjEgYXBwZWFycyB0byBoYXZlIGZpeGVkIHRoaXMgYnVnLlxudmFyIGhhdmVBcnJheUJ1ZmZlciA9IHR5cGVvZiBnbG9iYWwuQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnXG52YXIgaGF2ZVNsaWNlID0gaGF2ZUFycmF5QnVmZmVyICYmIGlzRnVuY3Rpb24oZ2xvYmFsLkFycmF5QnVmZmVyLnByb3RvdHlwZS5zbGljZSlcblxuZXhwb3J0cy5hcnJheWJ1ZmZlciA9IGhhdmVBcnJheUJ1ZmZlciAmJiBjaGVja1R5cGVTdXBwb3J0KCdhcnJheWJ1ZmZlcicpXG4vLyBUaGVzZSBuZXh0IHR3byB0ZXN0cyB1bmF2b2lkYWJseSBzaG93IHdhcm5pbmdzIGluIENocm9tZS4gU2luY2UgZmV0Y2ggd2lsbCBhbHdheXNcbi8vIGJlIHVzZWQgaWYgaXQncyBhdmFpbGFibGUsIGp1c3QgcmV0dXJuIGZhbHNlIGZvciB0aGVzZSB0byBhdm9pZCB0aGUgd2FybmluZ3MuXG5leHBvcnRzLm1zc3RyZWFtID0gIWV4cG9ydHMuZmV0Y2ggJiYgaGF2ZVNsaWNlICYmIGNoZWNrVHlwZVN1cHBvcnQoJ21zLXN0cmVhbScpXG5leHBvcnRzLm1vemNodW5rZWRhcnJheWJ1ZmZlciA9ICFleHBvcnRzLmZldGNoICYmIGhhdmVBcnJheUJ1ZmZlciAmJlxuXHRjaGVja1R5cGVTdXBwb3J0KCdtb3otY2h1bmtlZC1hcnJheWJ1ZmZlcicpXG5leHBvcnRzLm92ZXJyaWRlTWltZVR5cGUgPSBpc0Z1bmN0aW9uKHhoci5vdmVycmlkZU1pbWVUeXBlKVxuZXhwb3J0cy52YkFycmF5ID0gaXNGdW5jdGlvbihnbG9iYWwuVkJBcnJheSlcblxuZnVuY3Rpb24gaXNGdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJ1xufVxuXG54aHIgPSBudWxsIC8vIEhlbHAgZ2NcbiIsIi8vIHZhciBCYXNlNjQgPSByZXF1aXJlKCdCYXNlNjQnKVxudmFyIGNhcGFiaWxpdHkgPSByZXF1aXJlKCcuL2NhcGFiaWxpdHknKVxudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKVxudmFyIHJlc3BvbnNlID0gcmVxdWlyZSgnLi9yZXNwb25zZScpXG52YXIgc3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJylcblxudmFyIEluY29taW5nTWVzc2FnZSA9IHJlc3BvbnNlLkluY29taW5nTWVzc2FnZVxudmFyIHJTdGF0ZXMgPSByZXNwb25zZS5yZWFkeVN0YXRlc1xuXG5mdW5jdGlvbiBkZWNpZGVNb2RlIChwcmVmZXJCaW5hcnkpIHtcblx0aWYgKGNhcGFiaWxpdHkuZmV0Y2gpIHtcblx0XHRyZXR1cm4gJ2ZldGNoJ1xuXHR9IGVsc2UgaWYgKGNhcGFiaWxpdHkubW96Y2h1bmtlZGFycmF5YnVmZmVyKSB7XG5cdFx0cmV0dXJuICdtb3otY2h1bmtlZC1hcnJheWJ1ZmZlcidcblx0fSBlbHNlIGlmIChjYXBhYmlsaXR5Lm1zc3RyZWFtKSB7XG5cdFx0cmV0dXJuICdtcy1zdHJlYW0nXG5cdH0gZWxzZSBpZiAoY2FwYWJpbGl0eS5hcnJheWJ1ZmZlciAmJiBwcmVmZXJCaW5hcnkpIHtcblx0XHRyZXR1cm4gJ2FycmF5YnVmZmVyJ1xuXHR9IGVsc2UgaWYgKGNhcGFiaWxpdHkudmJBcnJheSAmJiBwcmVmZXJCaW5hcnkpIHtcblx0XHRyZXR1cm4gJ3RleHQ6dmJhcnJheSdcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gJ3RleHQnXG5cdH1cbn1cblxudmFyIENsaWVudFJlcXVlc3QgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRzKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRzdHJlYW0uV3JpdGFibGUuY2FsbChzZWxmKVxuXG5cdHNlbGYuX29wdHMgPSBvcHRzXG5cdHNlbGYuX2JvZHkgPSBbXVxuXHRzZWxmLl9oZWFkZXJzID0ge31cblx0aWYgKG9wdHMuYXV0aClcblx0XHRzZWxmLnNldEhlYWRlcignQXV0aG9yaXphdGlvbicsICdCYXNpYyAnICsgbmV3IEJ1ZmZlcihvcHRzLmF1dGgpLnRvU3RyaW5nKCdiYXNlNjQnKSlcblx0T2JqZWN0LmtleXMob3B0cy5oZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0c2VsZi5zZXRIZWFkZXIobmFtZSwgb3B0cy5oZWFkZXJzW25hbWVdKVxuXHR9KVxuXG5cdHZhciBwcmVmZXJCaW5hcnlcblx0aWYgKG9wdHMubW9kZSA9PT0gJ3ByZWZlci1zdHJlYW1pbmcnKSB7XG5cdFx0Ly8gSWYgc3RyZWFtaW5nIGlzIGEgaGlnaCBwcmlvcml0eSBidXQgYmluYXJ5IGNvbXBhdGliaWxpdHkgYW5kXG5cdFx0Ly8gdGhlIGFjY3VyYWN5IG9mIHRoZSAnY29udGVudC10eXBlJyBoZWFkZXIgYXJlbid0XG5cdFx0cHJlZmVyQmluYXJ5ID0gZmFsc2Vcblx0fSBlbHNlIGlmIChvcHRzLm1vZGUgPT09ICdhbGxvdy13cm9uZy1jb250ZW50LXR5cGUnKSB7XG5cdFx0Ly8gSWYgc3RyZWFtaW5nIGlzIG1vcmUgaW1wb3J0YW50IHRoYW4gcHJlc2VydmluZyB0aGUgJ2NvbnRlbnQtdHlwZScgaGVhZGVyXG5cdFx0cHJlZmVyQmluYXJ5ID0gIWNhcGFiaWxpdHkub3ZlcnJpZGVNaW1lVHlwZVxuXHR9IGVsc2UgaWYgKCFvcHRzLm1vZGUgfHwgb3B0cy5tb2RlID09PSAnZGVmYXVsdCcgfHwgb3B0cy5tb2RlID09PSAncHJlZmVyLWZhc3QnKSB7XG5cdFx0Ly8gVXNlIGJpbmFyeSBpZiB0ZXh0IHN0cmVhbWluZyBtYXkgY29ycnVwdCBkYXRhIG9yIHRoZSBjb250ZW50LXR5cGUgaGVhZGVyLCBvciBmb3Igc3BlZWRcblx0XHRwcmVmZXJCaW5hcnkgPSB0cnVlXG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZhbHVlIGZvciBvcHRzLm1vZGUnKVxuXHR9XG5cdHNlbGYuX21vZGUgPSBkZWNpZGVNb2RlKHByZWZlckJpbmFyeSlcblxuXHRzZWxmLm9uKCdmaW5pc2gnLCBmdW5jdGlvbiAoKSB7XG5cdFx0c2VsZi5fb25GaW5pc2goKVxuXHR9KVxufVxuXG5pbmhlcml0cyhDbGllbnRSZXF1ZXN0LCBzdHJlYW0uV3JpdGFibGUpXG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnNldEhlYWRlciA9IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZSkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0dmFyIGxvd2VyTmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKVxuXHQvLyBUaGlzIGNoZWNrIGlzIG5vdCBuZWNlc3NhcnksIGJ1dCBpdCBwcmV2ZW50cyB3YXJuaW5ncyBmcm9tIGJyb3dzZXJzIGFib3V0IHNldHRpbmcgdW5zYWZlXG5cdC8vIGhlYWRlcnMuIFRvIGJlIGhvbmVzdCBJJ20gbm90IGVudGlyZWx5IHN1cmUgaGlkaW5nIHRoZXNlIHdhcm5pbmdzIGlzIGEgZ29vZCB0aGluZywgYnV0XG5cdC8vIGh0dHAtYnJvd3NlcmlmeSBkaWQgaXQsIHNvIEkgd2lsbCB0b28uXG5cdGlmICh1bnNhZmVIZWFkZXJzLmluZGV4T2YobG93ZXJOYW1lKSAhPT0gLTEpXG5cdFx0cmV0dXJuXG5cblx0c2VsZi5faGVhZGVyc1tsb3dlck5hbWVdID0ge1xuXHRcdG5hbWU6IG5hbWUsXG5cdFx0dmFsdWU6IHZhbHVlXG5cdH1cbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZ2V0SGVhZGVyID0gZnVuY3Rpb24gKG5hbWUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdHJldHVybiBzZWxmLl9oZWFkZXJzW25hbWUudG9Mb3dlckNhc2UoKV0udmFsdWVcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUucmVtb3ZlSGVhZGVyID0gZnVuY3Rpb24gKG5hbWUpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cdGRlbGV0ZSBzZWxmLl9oZWFkZXJzW25hbWUudG9Mb3dlckNhc2UoKV1cbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuX29uRmluaXNoID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHRpZiAoc2VsZi5fZGVzdHJveWVkKVxuXHRcdHJldHVyblxuXHR2YXIgb3B0cyA9IHNlbGYuX29wdHNcblxuXHR2YXIgaGVhZGVyc09iaiA9IHNlbGYuX2hlYWRlcnNcblx0dmFyIGJvZHlcblx0aWYgKG9wdHMubWV0aG9kID09PSAnUE9TVCcgfHwgb3B0cy5tZXRob2QgPT09ICdQVVQnIHx8IG9wdHMubWV0aG9kID09PSAnUEFUQ0gnKSB7XG5cdFx0aWYgKGNhcGFiaWxpdHkuYmxvYkNvbnN0cnVjdG9yKSB7XG5cdFx0XHRib2R5ID0gbmV3IGdsb2JhbC5CbG9iKHNlbGYuX2JvZHkubWFwKGZ1bmN0aW9uIChidWZmZXIpIHtcblx0XHRcdFx0cmV0dXJuIGJ1ZmZlci50b0FycmF5QnVmZmVyKClcblx0XHRcdH0pLCB7XG5cdFx0XHRcdHR5cGU6IChoZWFkZXJzT2JqWydjb250ZW50LXR5cGUnXSB8fCB7fSkudmFsdWUgfHwgJydcblx0XHRcdH0pXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGdldCB1dGY4IHN0cmluZ1xuXHRcdFx0Ym9keSA9IEJ1ZmZlci5jb25jYXQoc2VsZi5fYm9keSkudG9TdHJpbmcoKVxuXHRcdH1cblx0fVxuXG5cdGlmIChzZWxmLl9tb2RlID09PSAnZmV0Y2gnKSB7XG5cdFx0dmFyIGhlYWRlcnMgPSBPYmplY3Qua2V5cyhoZWFkZXJzT2JqKS5tYXAoZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRcdHJldHVybiBbaGVhZGVyc09ialtuYW1lXS5uYW1lLCBoZWFkZXJzT2JqW25hbWVdLnZhbHVlXVxuXHRcdH0pXG5cblx0XHRnbG9iYWwuZmV0Y2goc2VsZi5fb3B0cy51cmwsIHtcblx0XHRcdG1ldGhvZDogc2VsZi5fb3B0cy5tZXRob2QsXG5cdFx0XHRoZWFkZXJzOiBoZWFkZXJzLFxuXHRcdFx0Ym9keTogYm9keSxcblx0XHRcdG1vZGU6ICdjb3JzJyxcblx0XHRcdGNyZWRlbnRpYWxzOiBvcHRzLndpdGhDcmVkZW50aWFscyA/ICdpbmNsdWRlJyA6ICdzYW1lLW9yaWdpbidcblx0XHR9KS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuXHRcdFx0c2VsZi5fZmV0Y2hSZXNwb25zZSA9IHJlc3BvbnNlXG5cdFx0XHRzZWxmLl9jb25uZWN0KClcblx0XHR9LCBmdW5jdGlvbiAocmVhc29uKSB7XG5cdFx0XHRzZWxmLmVtaXQoJ2Vycm9yJywgcmVhc29uKVxuXHRcdH0pXG5cdH0gZWxzZSB7XG5cdFx0dmFyIHhociA9IHNlbGYuX3hociA9IG5ldyBnbG9iYWwuWE1MSHR0cFJlcXVlc3QoKVxuXHRcdHRyeSB7XG5cdFx0XHR4aHIub3BlbihzZWxmLl9vcHRzLm1ldGhvZCwgc2VsZi5fb3B0cy51cmwsIHRydWUpXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2VsZi5lbWl0KCdlcnJvcicsIGVycilcblx0XHRcdH0pXG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cblx0XHQvLyBDYW4ndCBzZXQgcmVzcG9uc2VUeXBlIG9uIHJlYWxseSBvbGQgYnJvd3NlcnNcblx0XHRpZiAoJ3Jlc3BvbnNlVHlwZScgaW4geGhyKVxuXHRcdFx0eGhyLnJlc3BvbnNlVHlwZSA9IHNlbGYuX21vZGUuc3BsaXQoJzonKVswXVxuXG5cdFx0aWYgKCd3aXRoQ3JlZGVudGlhbHMnIGluIHhocilcblx0XHRcdHhoci53aXRoQ3JlZGVudGlhbHMgPSAhIW9wdHMud2l0aENyZWRlbnRpYWxzXG5cblx0XHRpZiAoc2VsZi5fbW9kZSA9PT0gJ3RleHQnICYmICdvdmVycmlkZU1pbWVUeXBlJyBpbiB4aHIpXG5cdFx0XHR4aHIub3ZlcnJpZGVNaW1lVHlwZSgndGV4dC9wbGFpbjsgY2hhcnNldD14LXVzZXItZGVmaW5lZCcpXG5cblx0XHRPYmplY3Qua2V5cyhoZWFkZXJzT2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG5cdFx0XHR4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXJzT2JqW25hbWVdLm5hbWUsIGhlYWRlcnNPYmpbbmFtZV0udmFsdWUpXG5cdFx0fSlcblxuXHRcdHNlbGYuX3Jlc3BvbnNlID0gbnVsbFxuXHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzd2l0Y2ggKHhoci5yZWFkeVN0YXRlKSB7XG5cdFx0XHRcdGNhc2UgclN0YXRlcy5MT0FESU5HOlxuXHRcdFx0XHRjYXNlIHJTdGF0ZXMuRE9ORTpcblx0XHRcdFx0XHRzZWxmLl9vblhIUlByb2dyZXNzKClcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBOZWNlc3NhcnkgZm9yIHN0cmVhbWluZyBpbiBGaXJlZm94LCBzaW5jZSB4aHIucmVzcG9uc2UgaXMgT05MWSBkZWZpbmVkXG5cdFx0Ly8gaW4gb25wcm9ncmVzcywgbm90IGluIG9ucmVhZHlzdGF0ZWNoYW5nZSB3aXRoIHhoci5yZWFkeVN0YXRlID0gM1xuXHRcdGlmIChzZWxmLl9tb2RlID09PSAnbW96LWNodW5rZWQtYXJyYXlidWZmZXInKSB7XG5cdFx0XHR4aHIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2VsZi5fb25YSFJQcm9ncmVzcygpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0eGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoc2VsZi5fZGVzdHJveWVkKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdHNlbGYuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ1hIUiBlcnJvcicpKVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHR4aHIuc2VuZChib2R5KVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0cHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuZW1pdCgnZXJyb3InLCBlcnIpXG5cdFx0XHR9KVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHhoci5zdGF0dXMgaXMgcmVhZGFibGUuIEV2ZW4gdGhvdWdoIHRoZSBzcGVjIHNheXMgaXQgc2hvdWxkXG4gKiBiZSBhdmFpbGFibGUgaW4gcmVhZHlTdGF0ZSAzLCBhY2Nlc3NpbmcgaXQgdGhyb3dzIGFuIGV4Y2VwdGlvbiBpbiBJRThcbiAqL1xuZnVuY3Rpb24gc3RhdHVzVmFsaWQgKHhocikge1xuXHR0cnkge1xuXHRcdHJldHVybiAoeGhyLnN0YXR1cyAhPT0gbnVsbClcblx0fSBjYXRjaCAoZSkge1xuXHRcdHJldHVybiBmYWxzZVxuXHR9XG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl9vblhIUlByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgc2VsZiA9IHRoaXNcblxuXHRpZiAoIXN0YXR1c1ZhbGlkKHNlbGYuX3hocikgfHwgc2VsZi5fZGVzdHJveWVkKVxuXHRcdHJldHVyblxuXG5cdGlmICghc2VsZi5fcmVzcG9uc2UpXG5cdFx0c2VsZi5fY29ubmVjdCgpXG5cblx0c2VsZi5fcmVzcG9uc2UuX29uWEhSUHJvZ3Jlc3MoKVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5fY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0aWYgKHNlbGYuX2Rlc3Ryb3llZClcblx0XHRyZXR1cm5cblxuXHRzZWxmLl9yZXNwb25zZSA9IG5ldyBJbmNvbWluZ01lc3NhZ2Uoc2VsZi5feGhyLCBzZWxmLl9mZXRjaFJlc3BvbnNlLCBzZWxmLl9tb2RlKVxuXHRzZWxmLmVtaXQoJ3Jlc3BvbnNlJywgc2VsZi5fcmVzcG9uc2UpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXG5cdHNlbGYuX2JvZHkucHVzaChjaHVuaylcblx0Y2IoKVxufVxuXG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5hYm9ydCA9IENsaWVudFJlcXVlc3QucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRzZWxmLl9kZXN0cm95ZWQgPSB0cnVlXG5cdGlmIChzZWxmLl9yZXNwb25zZSlcblx0XHRzZWxmLl9yZXNwb25zZS5fZGVzdHJveWVkID0gdHJ1ZVxuXHRpZiAoc2VsZi5feGhyKVxuXHRcdHNlbGYuX3hoci5hYm9ydCgpXG5cdC8vIEN1cnJlbnRseSwgdGhlcmUgaXNuJ3QgYSB3YXkgdG8gdHJ1bHkgYWJvcnQgYSBmZXRjaC5cblx0Ly8gSWYgeW91IGxpa2UgYmlrZXNoZWRkaW5nLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3doYXR3Zy9mZXRjaC9pc3N1ZXMvMjdcbn1cblxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKGRhdGEsIGVuY29kaW5nLCBjYikge1xuXHR2YXIgc2VsZiA9IHRoaXNcblx0aWYgKHR5cGVvZiBkYXRhID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0Y2IgPSBkYXRhXG5cdFx0ZGF0YSA9IHVuZGVmaW5lZFxuXHR9XG5cblx0c3RyZWFtLldyaXRhYmxlLnByb3RvdHlwZS5lbmQuY2FsbChzZWxmLCBkYXRhLCBlbmNvZGluZywgY2IpXG59XG5cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLmZsdXNoSGVhZGVycyA9IGZ1bmN0aW9uICgpIHt9XG5DbGllbnRSZXF1ZXN0LnByb3RvdHlwZS5zZXRUaW1lb3V0ID0gZnVuY3Rpb24gKCkge31cbkNsaWVudFJlcXVlc3QucHJvdG90eXBlLnNldE5vRGVsYXkgPSBmdW5jdGlvbiAoKSB7fVxuQ2xpZW50UmVxdWVzdC5wcm90b3R5cGUuc2V0U29ja2V0S2VlcEFsaXZlID0gZnVuY3Rpb24gKCkge31cblxuLy8gVGFrZW4gZnJvbSBodHRwOi8vd3d3LnczLm9yZy9UUi9YTUxIdHRwUmVxdWVzdC8jdGhlLXNldHJlcXVlc3RoZWFkZXIlMjglMjktbWV0aG9kXG52YXIgdW5zYWZlSGVhZGVycyA9IFtcblx0J2FjY2VwdC1jaGFyc2V0Jyxcblx0J2FjY2VwdC1lbmNvZGluZycsXG5cdCdhY2Nlc3MtY29udHJvbC1yZXF1ZXN0LWhlYWRlcnMnLFxuXHQnYWNjZXNzLWNvbnRyb2wtcmVxdWVzdC1tZXRob2QnLFxuXHQnY29ubmVjdGlvbicsXG5cdCdjb250ZW50LWxlbmd0aCcsXG5cdCdjb29raWUnLFxuXHQnY29va2llMicsXG5cdCdkYXRlJyxcblx0J2RudCcsXG5cdCdleHBlY3QnLFxuXHQnaG9zdCcsXG5cdCdrZWVwLWFsaXZlJyxcblx0J29yaWdpbicsXG5cdCdyZWZlcmVyJyxcblx0J3RlJyxcblx0J3RyYWlsZXInLFxuXHQndHJhbnNmZXItZW5jb2RpbmcnLFxuXHQndXBncmFkZScsXG5cdCd1c2VyLWFnZW50Jyxcblx0J3ZpYSdcbl1cbiIsInZhciBjYXBhYmlsaXR5ID0gcmVxdWlyZSgnLi9jYXBhYmlsaXR5JylcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJylcbnZhciBzdHJlYW0gPSByZXF1aXJlKCdzdHJlYW0nKVxuXG52YXIgclN0YXRlcyA9IGV4cG9ydHMucmVhZHlTdGF0ZXMgPSB7XG5cdFVOU0VOVDogMCxcblx0T1BFTkVEOiAxLFxuXHRIRUFERVJTX1JFQ0VJVkVEOiAyLFxuXHRMT0FESU5HOiAzLFxuXHRET05FOiA0XG59XG5cbnZhciBJbmNvbWluZ01lc3NhZ2UgPSBleHBvcnRzLkluY29taW5nTWVzc2FnZSA9IGZ1bmN0aW9uICh4aHIsIHJlc3BvbnNlLCBtb2RlKSB7XG5cdHZhciBzZWxmID0gdGhpc1xuXHRzdHJlYW0uUmVhZGFibGUuY2FsbChzZWxmKVxuXG5cdHNlbGYuX21vZGUgPSBtb2RlXG5cdHNlbGYuaGVhZGVycyA9IHt9XG5cdHNlbGYucmF3SGVhZGVycyA9IFtdXG5cdHNlbGYudHJhaWxlcnMgPSB7fVxuXHRzZWxmLnJhd1RyYWlsZXJzID0gW11cblxuXHQvLyBGYWtlIHRoZSAnY2xvc2UnIGV2ZW50LCBidXQgb25seSBvbmNlICdlbmQnIGZpcmVzXG5cdHNlbGYub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBUaGUgbmV4dFRpY2sgaXMgbmVjZXNzYXJ5IHRvIHByZXZlbnQgdGhlICdyZXF1ZXN0JyBtb2R1bGUgZnJvbSBjYXVzaW5nIGFuIGluZmluaXRlIGxvb3Bcblx0XHRwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcblx0XHRcdHNlbGYuZW1pdCgnY2xvc2UnKVxuXHRcdH0pXG5cdH0pXG5cblx0aWYgKG1vZGUgPT09ICdmZXRjaCcpIHtcblx0XHRzZWxmLl9mZXRjaFJlc3BvbnNlID0gcmVzcG9uc2VcblxuXHRcdHNlbGYuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1c1xuXHRcdHNlbGYuc3RhdHVzTWVzc2FnZSA9IHJlc3BvbnNlLnN0YXR1c1RleHRcblx0XHQvLyBiYWNrd2FyZHMgY29tcGF0aWJsZSB2ZXJzaW9uIG9mIGZvciAoPGl0ZW0+IG9mIDxpdGVyYWJsZT4pOlxuXHRcdC8vIGZvciAodmFyIDxpdGVtPixfaSxfaXQgPSA8aXRlcmFibGU+W1N5bWJvbC5pdGVyYXRvcl0oKTsgPGl0ZW0+ID0gKF9pID0gX2l0Lm5leHQoKSkudmFsdWUsIV9pLmRvbmU7KVxuXHRcdGZvciAodmFyIGhlYWRlciwgX2ksIF9pdCA9IHJlc3BvbnNlLmhlYWRlcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyBoZWFkZXIgPSAoX2kgPSBfaXQubmV4dCgpKS52YWx1ZSwgIV9pLmRvbmU7KSB7XG5cdFx0XHRzZWxmLmhlYWRlcnNbaGVhZGVyWzBdLnRvTG93ZXJDYXNlKCldID0gaGVhZGVyWzFdXG5cdFx0XHRzZWxmLnJhd0hlYWRlcnMucHVzaChoZWFkZXJbMF0sIGhlYWRlclsxXSlcblx0XHR9XG5cblx0XHQvLyBUT0RPOiB0aGlzIGRvZXNuJ3QgcmVzcGVjdCBiYWNrcHJlc3N1cmUuIE9uY2UgV3JpdGFibGVTdHJlYW0gaXMgYXZhaWxhYmxlLCB0aGlzIGNhbiBiZSBmaXhlZFxuXHRcdHZhciByZWFkZXIgPSByZXNwb25zZS5ib2R5LmdldFJlYWRlcigpXG5cdFx0ZnVuY3Rpb24gcmVhZCAoKSB7XG5cdFx0XHRyZWFkZXIucmVhZCgpLnRoZW4oZnVuY3Rpb24gKHJlc3VsdCkge1xuXHRcdFx0XHRpZiAoc2VsZi5fZGVzdHJveWVkKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHRpZiAocmVzdWx0LmRvbmUpIHtcblx0XHRcdFx0XHRzZWxmLnB1c2gobnVsbClcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihyZXN1bHQudmFsdWUpKVxuXHRcdFx0XHRyZWFkKClcblx0XHRcdH0pXG5cdFx0fVxuXHRcdHJlYWQoKVxuXG5cdH0gZWxzZSB7XG5cdFx0c2VsZi5feGhyID0geGhyXG5cdFx0c2VsZi5fcG9zID0gMFxuXG5cdFx0c2VsZi5zdGF0dXNDb2RlID0geGhyLnN0YXR1c1xuXHRcdHNlbGYuc3RhdHVzTWVzc2FnZSA9IHhoci5zdGF0dXNUZXh0XG5cdFx0dmFyIGhlYWRlcnMgPSB4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkuc3BsaXQoL1xccj9cXG4vKVxuXHRcdGhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbiAoaGVhZGVyKSB7XG5cdFx0XHR2YXIgbWF0Y2hlcyA9IGhlYWRlci5tYXRjaCgvXihbXjpdKyk6XFxzKiguKikvKVxuXHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0dmFyIGtleSA9IG1hdGNoZXNbMV0udG9Mb3dlckNhc2UoKVxuXHRcdFx0XHRpZiAoc2VsZi5oZWFkZXJzW2tleV0gIT09IHVuZGVmaW5lZClcblx0XHRcdFx0XHRzZWxmLmhlYWRlcnNba2V5XSArPSAnLCAnICsgbWF0Y2hlc1syXVxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0c2VsZi5oZWFkZXJzW2tleV0gPSBtYXRjaGVzWzJdXG5cdFx0XHRcdHNlbGYucmF3SGVhZGVycy5wdXNoKG1hdGNoZXNbMV0sIG1hdGNoZXNbMl0pXG5cdFx0XHR9XG5cdFx0fSlcblxuXHRcdHNlbGYuX2NoYXJzZXQgPSAneC11c2VyLWRlZmluZWQnXG5cdFx0aWYgKCFjYXBhYmlsaXR5Lm92ZXJyaWRlTWltZVR5cGUpIHtcblx0XHRcdHZhciBtaW1lVHlwZSA9IHNlbGYucmF3SGVhZGVyc1snbWltZS10eXBlJ11cblx0XHRcdGlmIChtaW1lVHlwZSkge1xuXHRcdFx0XHR2YXIgY2hhcnNldE1hdGNoID0gbWltZVR5cGUubWF0Y2goLztcXHMqY2hhcnNldD0oW147XSkoO3wkKS8pXG5cdFx0XHRcdGlmIChjaGFyc2V0TWF0Y2gpIHtcblx0XHRcdFx0XHRzZWxmLl9jaGFyc2V0ID0gY2hhcnNldE1hdGNoWzFdLnRvTG93ZXJDYXNlKClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFzZWxmLl9jaGFyc2V0KVxuXHRcdFx0XHRzZWxmLl9jaGFyc2V0ID0gJ3V0Zi04JyAvLyBiZXN0IGd1ZXNzXG5cdFx0fVxuXHR9XG59XG5cbmluaGVyaXRzKEluY29taW5nTWVzc2FnZSwgc3RyZWFtLlJlYWRhYmxlKVxuXG5JbmNvbWluZ01lc3NhZ2UucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24gKCkge31cblxuSW5jb21pbmdNZXNzYWdlLnByb3RvdHlwZS5fb25YSFJQcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHNlbGYgPSB0aGlzXG5cblx0dmFyIHhociA9IHNlbGYuX3hoclxuXG5cdHZhciByZXNwb25zZSA9IG51bGxcblx0c3dpdGNoIChzZWxmLl9tb2RlKSB7XG5cdFx0Y2FzZSAndGV4dDp2YmFycmF5JzogLy8gRm9yIElFOVxuXHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlICE9PSByU3RhdGVzLkRPTkUpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR0cnkge1xuXHRcdFx0XHQvLyBUaGlzIGZhaWxzIGluIElFOFxuXHRcdFx0XHRyZXNwb25zZSA9IG5ldyBnbG9iYWwuVkJBcnJheSh4aHIucmVzcG9uc2VCb2R5KS50b0FycmF5KClcblx0XHRcdH0gY2F0Y2ggKGUpIHt9XG5cdFx0XHRpZiAocmVzcG9uc2UgIT09IG51bGwpIHtcblx0XHRcdFx0c2VsZi5wdXNoKG5ldyBCdWZmZXIocmVzcG9uc2UpKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0Ly8gRmFsbHMgdGhyb3VnaCBpbiBJRThcdFxuXHRcdGNhc2UgJ3RleHQnOlxuXHRcdFx0dHJ5IHsgLy8gVGhpcyB3aWxsIGZhaWwgd2hlbiByZWFkeVN0YXRlID0gMyBpbiBJRTkuIFN3aXRjaCBtb2RlIGFuZCB3YWl0IGZvciByZWFkeVN0YXRlID0gNFxuXHRcdFx0XHRyZXNwb25zZSA9IHhoci5yZXNwb25zZVRleHRcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0c2VsZi5fbW9kZSA9ICd0ZXh0OnZiYXJyYXknXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzcG9uc2UubGVuZ3RoID4gc2VsZi5fcG9zKSB7XG5cdFx0XHRcdHZhciBuZXdEYXRhID0gcmVzcG9uc2Uuc3Vic3RyKHNlbGYuX3Bvcylcblx0XHRcdFx0aWYgKHNlbGYuX2NoYXJzZXQgPT09ICd4LXVzZXItZGVmaW5lZCcpIHtcblx0XHRcdFx0XHR2YXIgYnVmZmVyID0gbmV3IEJ1ZmZlcihuZXdEYXRhLmxlbmd0aClcblx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG5ld0RhdGEubGVuZ3RoOyBpKyspXG5cdFx0XHRcdFx0XHRidWZmZXJbaV0gPSBuZXdEYXRhLmNoYXJDb2RlQXQoaSkgJiAweGZmXG5cblx0XHRcdFx0XHRzZWxmLnB1c2goYnVmZmVyKVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlbGYucHVzaChuZXdEYXRhLCBzZWxmLl9jaGFyc2V0KVxuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX3BvcyA9IHJlc3BvbnNlLmxlbmd0aFxuXHRcdFx0fVxuXHRcdFx0YnJlYWtcblx0XHRjYXNlICdhcnJheWJ1ZmZlcic6XG5cdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgIT09IHJTdGF0ZXMuRE9ORSlcblx0XHRcdFx0YnJlYWtcblx0XHRcdHJlc3BvbnNlID0geGhyLnJlc3BvbnNlXG5cdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihuZXcgVWludDhBcnJheShyZXNwb25zZSkpKVxuXHRcdFx0YnJlYWtcblx0XHRjYXNlICdtb3otY2h1bmtlZC1hcnJheWJ1ZmZlcic6IC8vIHRha2Ugd2hvbGVcblx0XHRcdHJlc3BvbnNlID0geGhyLnJlc3BvbnNlXG5cdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgIT09IHJTdGF0ZXMuTE9BRElORyB8fCAhcmVzcG9uc2UpXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihuZXcgVWludDhBcnJheShyZXNwb25zZSkpKVxuXHRcdFx0YnJlYWtcblx0XHRjYXNlICdtcy1zdHJlYW0nOlxuXHRcdFx0cmVzcG9uc2UgPSB4aHIucmVzcG9uc2Vcblx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gclN0YXRlcy5MT0FESU5HKVxuXHRcdFx0XHRicmVha1xuXHRcdFx0dmFyIHJlYWRlciA9IG5ldyBnbG9iYWwuTVNTdHJlYW1SZWFkZXIoKVxuXHRcdFx0cmVhZGVyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmIChyZWFkZXIucmVzdWx0LmJ5dGVMZW5ndGggPiBzZWxmLl9wb3MpIHtcblx0XHRcdFx0XHRzZWxmLnB1c2gobmV3IEJ1ZmZlcihuZXcgVWludDhBcnJheShyZWFkZXIucmVzdWx0LnNsaWNlKHNlbGYuX3BvcykpKSlcblx0XHRcdFx0XHRzZWxmLl9wb3MgPSByZWFkZXIucmVzdWx0LmJ5dGVMZW5ndGhcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2VsZi5wdXNoKG51bGwpXG5cdFx0XHR9XG5cdFx0XHQvLyByZWFkZXIub25lcnJvciA9ID8/PyAvLyBUT0RPOiB0aGlzXG5cdFx0XHRyZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIocmVzcG9uc2UpXG5cdFx0XHRicmVha1xuXHR9XG5cblx0Ly8gVGhlIG1zLXN0cmVhbSBjYXNlIGhhbmRsZXMgZW5kIHNlcGFyYXRlbHkgaW4gcmVhZGVyLm9ubG9hZCgpXG5cdGlmIChzZWxmLl94aHIucmVhZHlTdGF0ZSA9PT0gclN0YXRlcy5ET05FICYmIHNlbGYuX21vZGUgIT09ICdtcy1zdHJlYW0nKSB7XG5cdFx0c2VsZi5wdXNoKG51bGwpXG5cdH1cbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuXG52YXIgaXNCdWZmZXJFbmNvZGluZyA9IEJ1ZmZlci5pc0VuY29kaW5nXG4gIHx8IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gICAgICAgc3dpdGNoIChlbmNvZGluZyAmJiBlbmNvZGluZy50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICBjYXNlICdoZXgnOiBjYXNlICd1dGY4JzogY2FzZSAndXRmLTgnOiBjYXNlICdhc2NpaSc6IGNhc2UgJ2JpbmFyeSc6IGNhc2UgJ2Jhc2U2NCc6IGNhc2UgJ3VjczInOiBjYXNlICd1Y3MtMic6IGNhc2UgJ3V0ZjE2bGUnOiBjYXNlICd1dGYtMTZsZSc6IGNhc2UgJ3Jhdyc6IHJldHVybiB0cnVlO1xuICAgICAgICAgZGVmYXVsdDogcmV0dXJuIGZhbHNlO1xuICAgICAgIH1cbiAgICAgfVxuXG5cbmZ1bmN0aW9uIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIGlmIChlbmNvZGluZyAmJiAhaXNCdWZmZXJFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XG4gIH1cbn1cblxuLy8gU3RyaW5nRGVjb2RlciBwcm92aWRlcyBhbiBpbnRlcmZhY2UgZm9yIGVmZmljaWVudGx5IHNwbGl0dGluZyBhIHNlcmllcyBvZlxuLy8gYnVmZmVycyBpbnRvIGEgc2VyaWVzIG9mIEpTIHN0cmluZ3Mgd2l0aG91dCBicmVha2luZyBhcGFydCBtdWx0aS1ieXRlXG4vLyBjaGFyYWN0ZXJzLiBDRVNVLTggaXMgaGFuZGxlZCBhcyBwYXJ0IG9mIHRoZSBVVEYtOCBlbmNvZGluZy5cbi8vXG4vLyBAVE9ETyBIYW5kbGluZyBhbGwgZW5jb2RpbmdzIGluc2lkZSBhIHNpbmdsZSBvYmplY3QgbWFrZXMgaXQgdmVyeSBkaWZmaWN1bHRcbi8vIHRvIHJlYXNvbiBhYm91dCB0aGlzIGNvZGUsIHNvIGl0IHNob3VsZCBiZSBzcGxpdCB1cCBpbiB0aGUgZnV0dXJlLlxuLy8gQFRPRE8gVGhlcmUgc2hvdWxkIGJlIGEgdXRmOC1zdHJpY3QgZW5jb2RpbmcgdGhhdCByZWplY3RzIGludmFsaWQgVVRGLTggY29kZVxuLy8gcG9pbnRzIGFzIHVzZWQgYnkgQ0VTVS04LlxudmFyIFN0cmluZ0RlY29kZXIgPSBleHBvcnRzLlN0cmluZ0RlY29kZXIgPSBmdW5jdGlvbihlbmNvZGluZykge1xuICB0aGlzLmVuY29kaW5nID0gKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bLV9dLywgJycpO1xuICBhc3NlcnRFbmNvZGluZyhlbmNvZGluZyk7XG4gIHN3aXRjaCAodGhpcy5lbmNvZGluZykge1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgLy8gQ0VTVS04IHJlcHJlc2VudHMgZWFjaCBvZiBTdXJyb2dhdGUgUGFpciBieSAzLWJ5dGVzXG4gICAgICB0aGlzLnN1cnJvZ2F0ZVNpemUgPSAzO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICAvLyBVVEYtMTYgcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDItYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDI7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAvLyBCYXNlLTY0IHN0b3JlcyAzIGJ5dGVzIGluIDQgY2hhcnMsIGFuZCBwYWRzIHRoZSByZW1haW5kZXIuXG4gICAgICB0aGlzLnN1cnJvZ2F0ZVNpemUgPSAzO1xuICAgICAgdGhpcy5kZXRlY3RJbmNvbXBsZXRlQ2hhciA9IGJhc2U2NERldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRoaXMud3JpdGUgPSBwYXNzVGhyb3VnaFdyaXRlO1xuICAgICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRW5vdWdoIHNwYWNlIHRvIHN0b3JlIGFsbCBieXRlcyBvZiBhIHNpbmdsZSBjaGFyYWN0ZXIuIFVURi04IG5lZWRzIDRcbiAgLy8gYnl0ZXMsIGJ1dCBDRVNVLTggbWF5IHJlcXVpcmUgdXAgdG8gNiAoMyBieXRlcyBwZXIgc3Vycm9nYXRlKS5cbiAgdGhpcy5jaGFyQnVmZmVyID0gbmV3IEJ1ZmZlcig2KTtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIHJlY2VpdmVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJSZWNlaXZlZCA9IDA7XG4gIC8vIE51bWJlciBvZiBieXRlcyBleHBlY3RlZCBmb3IgdGhlIGN1cnJlbnQgaW5jb21wbGV0ZSBtdWx0aS1ieXRlIGNoYXJhY3Rlci5cbiAgdGhpcy5jaGFyTGVuZ3RoID0gMDtcbn07XG5cblxuLy8gd3JpdGUgZGVjb2RlcyB0aGUgZ2l2ZW4gYnVmZmVyIGFuZCByZXR1cm5zIGl0IGFzIEpTIHN0cmluZyB0aGF0IGlzXG4vLyBndWFyYW50ZWVkIHRvIG5vdCBjb250YWluIGFueSBwYXJ0aWFsIG11bHRpLWJ5dGUgY2hhcmFjdGVycy4gQW55IHBhcnRpYWxcbi8vIGNoYXJhY3RlciBmb3VuZCBhdCB0aGUgZW5kIG9mIHRoZSBidWZmZXIgaXMgYnVmZmVyZWQgdXAsIGFuZCB3aWxsIGJlXG4vLyByZXR1cm5lZCB3aGVuIGNhbGxpbmcgd3JpdGUgYWdhaW4gd2l0aCB0aGUgcmVtYWluaW5nIGJ5dGVzLlxuLy9cbi8vIE5vdGU6IENvbnZlcnRpbmcgYSBCdWZmZXIgY29udGFpbmluZyBhbiBvcnBoYW4gc3Vycm9nYXRlIHRvIGEgU3RyaW5nXG4vLyBjdXJyZW50bHkgd29ya3MsIGJ1dCBjb252ZXJ0aW5nIGEgU3RyaW5nIHRvIGEgQnVmZmVyICh2aWEgYG5ldyBCdWZmZXJgLCBvclxuLy8gQnVmZmVyI3dyaXRlKSB3aWxsIHJlcGxhY2UgaW5jb21wbGV0ZSBzdXJyb2dhdGVzIHdpdGggdGhlIHVuaWNvZGVcbi8vIHJlcGxhY2VtZW50IGNoYXJhY3Rlci4gU2VlIGh0dHBzOi8vY29kZXJldmlldy5jaHJvbWl1bS5vcmcvMTIxMTczMDA5LyAuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICB2YXIgY2hhclN0ciA9ICcnO1xuICAvLyBpZiBvdXIgbGFzdCB3cml0ZSBlbmRlZCB3aXRoIGFuIGluY29tcGxldGUgbXVsdGlieXRlIGNoYXJhY3RlclxuICB3aGlsZSAodGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgLy8gZGV0ZXJtaW5lIGhvdyBtYW55IHJlbWFpbmluZyBieXRlcyB0aGlzIGJ1ZmZlciBoYXMgdG8gb2ZmZXIgZm9yIHRoaXMgY2hhclxuICAgIHZhciBhdmFpbGFibGUgPSAoYnVmZmVyLmxlbmd0aCA+PSB0aGlzLmNoYXJMZW5ndGggLSB0aGlzLmNoYXJSZWNlaXZlZCkgP1xuICAgICAgICB0aGlzLmNoYXJMZW5ndGggLSB0aGlzLmNoYXJSZWNlaXZlZCA6XG4gICAgICAgIGJ1ZmZlci5sZW5ndGg7XG5cbiAgICAvLyBhZGQgdGhlIG5ldyBieXRlcyB0byB0aGUgY2hhciBidWZmZXJcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIHRoaXMuY2hhclJlY2VpdmVkLCAwLCBhdmFpbGFibGUpO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IGF2YWlsYWJsZTtcblxuICAgIGlmICh0aGlzLmNoYXJSZWNlaXZlZCA8IHRoaXMuY2hhckxlbmd0aCkge1xuICAgICAgLy8gc3RpbGwgbm90IGVub3VnaCBjaGFycyBpbiB0aGlzIGJ1ZmZlcj8gd2FpdCBmb3IgbW9yZSAuLi5cbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYnl0ZXMgYmVsb25naW5nIHRvIHRoZSBjdXJyZW50IGNoYXJhY3RlciBmcm9tIHRoZSBidWZmZXJcbiAgICBidWZmZXIgPSBidWZmZXIuc2xpY2UoYXZhaWxhYmxlLCBidWZmZXIubGVuZ3RoKTtcblxuICAgIC8vIGdldCB0aGUgY2hhcmFjdGVyIHRoYXQgd2FzIHNwbGl0XG4gICAgY2hhclN0ciA9IHRoaXMuY2hhckJ1ZmZlci5zbGljZSgwLCB0aGlzLmNoYXJMZW5ndGgpLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpO1xuXG4gICAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICAgIHZhciBjaGFyQ29kZSA9IGNoYXJTdHIuY2hhckNvZGVBdChjaGFyU3RyLmxlbmd0aCAtIDEpO1xuICAgIGlmIChjaGFyQ29kZSA+PSAweEQ4MDAgJiYgY2hhckNvZGUgPD0gMHhEQkZGKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggKz0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgICAgY2hhclN0ciA9ICcnO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHRoaXMuY2hhclJlY2VpdmVkID0gdGhpcy5jaGFyTGVuZ3RoID0gMDtcblxuICAgIC8vIGlmIHRoZXJlIGFyZSBubyBtb3JlIGJ5dGVzIGluIHRoaXMgYnVmZmVyLCBqdXN0IGVtaXQgb3VyIGNoYXJcbiAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGNoYXJTdHI7XG4gICAgfVxuICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGFuZCBzZXQgY2hhckxlbmd0aCAvIGNoYXJSZWNlaXZlZFxuICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyKGJ1ZmZlcik7XG5cbiAgdmFyIGVuZCA9IGJ1ZmZlci5sZW5ndGg7XG4gIGlmICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBidWZmZXIgdGhlIGluY29tcGxldGUgY2hhcmFjdGVyIGJ5dGVzIHdlIGdvdFxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgMCwgYnVmZmVyLmxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkLCBlbmQpO1xuICAgIGVuZCAtPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgfVxuXG4gIGNoYXJTdHIgKz0gYnVmZmVyLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcsIDAsIGVuZCk7XG5cbiAgdmFyIGVuZCA9IGNoYXJTdHIubGVuZ3RoIC0gMTtcbiAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGVuZCk7XG4gIC8vIENFU1UtODogbGVhZCBzdXJyb2dhdGUgKEQ4MDAtREJGRikgaXMgYWxzbyB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXJcbiAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuc3Vycm9nYXRlU2l6ZTtcbiAgICB0aGlzLmNoYXJMZW5ndGggKz0gc2l6ZTtcbiAgICB0aGlzLmNoYXJSZWNlaXZlZCArPSBzaXplO1xuICAgIHRoaXMuY2hhckJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgc2l6ZSwgMCwgc2l6ZSk7XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCAwLCBzaXplKTtcbiAgICByZXR1cm4gY2hhclN0ci5zdWJzdHJpbmcoMCwgZW5kKTtcbiAgfVxuXG4gIC8vIG9yIGp1c3QgZW1pdCB0aGUgY2hhclN0clxuICByZXR1cm4gY2hhclN0cjtcbn07XG5cbi8vIGRldGVjdEluY29tcGxldGVDaGFyIGRldGVybWluZXMgaWYgdGhlcmUgaXMgYW4gaW5jb21wbGV0ZSBVVEYtOCBjaGFyYWN0ZXIgYXRcbi8vIHRoZSBlbmQgb2YgdGhlIGdpdmVuIGJ1ZmZlci4gSWYgc28sIGl0IHNldHMgdGhpcy5jaGFyTGVuZ3RoIHRvIHRoZSBieXRlXG4vLyBsZW5ndGggdGhhdCBjaGFyYWN0ZXIsIGFuZCBzZXRzIHRoaXMuY2hhclJlY2VpdmVkIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXNcbi8vIHRoYXQgYXJlIGF2YWlsYWJsZSBmb3IgdGhpcyBjaGFyYWN0ZXIuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5kZXRlY3RJbmNvbXBsZXRlQ2hhciA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgYnl0ZXMgd2UgaGF2ZSB0byBjaGVjayBhdCB0aGUgZW5kIG9mIHRoaXMgYnVmZmVyXG4gIHZhciBpID0gKGJ1ZmZlci5sZW5ndGggPj0gMykgPyAzIDogYnVmZmVyLmxlbmd0aDtcblxuICAvLyBGaWd1cmUgb3V0IGlmIG9uZSBvZiB0aGUgbGFzdCBpIGJ5dGVzIG9mIG91ciBidWZmZXIgYW5ub3VuY2VzIGFuXG4gIC8vIGluY29tcGxldGUgY2hhci5cbiAgZm9yICg7IGkgPiAwOyBpLS0pIHtcbiAgICB2YXIgYyA9IGJ1ZmZlcltidWZmZXIubGVuZ3RoIC0gaV07XG5cbiAgICAvLyBTZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9VVEYtOCNEZXNjcmlwdGlvblxuXG4gICAgLy8gMTEwWFhYWFhcbiAgICBpZiAoaSA9PSAxICYmIGMgPj4gNSA9PSAweDA2KSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSAyO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gMTExMFhYWFhcbiAgICBpZiAoaSA8PSAyICYmIGMgPj4gNCA9PSAweDBFKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSAzO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gMTExMTBYWFhcbiAgICBpZiAoaSA8PSAzICYmIGMgPj4gMyA9PSAweDFFKSB7XG4gICAgICB0aGlzLmNoYXJMZW5ndGggPSA0O1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gaTtcbn07XG5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICB2YXIgcmVzID0gJyc7XG4gIGlmIChidWZmZXIgJiYgYnVmZmVyLmxlbmd0aClcbiAgICByZXMgPSB0aGlzLndyaXRlKGJ1ZmZlcik7XG5cbiAgaWYgKHRoaXMuY2hhclJlY2VpdmVkKSB7XG4gICAgdmFyIGNyID0gdGhpcy5jaGFyUmVjZWl2ZWQ7XG4gICAgdmFyIGJ1ZiA9IHRoaXMuY2hhckJ1ZmZlcjtcbiAgICB2YXIgZW5jID0gdGhpcy5lbmNvZGluZztcbiAgICByZXMgKz0gYnVmLnNsaWNlKDAsIGNyKS50b1N0cmluZyhlbmMpO1xuICB9XG5cbiAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIHBhc3NUaHJvdWdoV3JpdGUoYnVmZmVyKSB7XG4gIHJldHVybiBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG59XG5cbmZ1bmN0aW9uIHV0ZjE2RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDI7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMiA6IDA7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NERldGVjdEluY29tcGxldGVDaGFyKGJ1ZmZlcikge1xuICB0aGlzLmNoYXJSZWNlaXZlZCA9IGJ1ZmZlci5sZW5ndGggJSAzO1xuICB0aGlzLmNoYXJMZW5ndGggPSB0aGlzLmNoYXJSZWNlaXZlZCA/IDMgOiAwO1xufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHB1bnljb2RlID0gcmVxdWlyZSgncHVueWNvZGUnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmV4cG9ydHMucGFyc2UgPSB1cmxQYXJzZTtcbmV4cG9ydHMucmVzb2x2ZSA9IHVybFJlc29sdmU7XG5leHBvcnRzLnJlc29sdmVPYmplY3QgPSB1cmxSZXNvbHZlT2JqZWN0O1xuZXhwb3J0cy5mb3JtYXQgPSB1cmxGb3JtYXQ7XG5cbmV4cG9ydHMuVXJsID0gVXJsO1xuXG5mdW5jdGlvbiBVcmwoKSB7XG4gIHRoaXMucHJvdG9jb2wgPSBudWxsO1xuICB0aGlzLnNsYXNoZXMgPSBudWxsO1xuICB0aGlzLmF1dGggPSBudWxsO1xuICB0aGlzLmhvc3QgPSBudWxsO1xuICB0aGlzLnBvcnQgPSBudWxsO1xuICB0aGlzLmhvc3RuYW1lID0gbnVsbDtcbiAgdGhpcy5oYXNoID0gbnVsbDtcbiAgdGhpcy5zZWFyY2ggPSBudWxsO1xuICB0aGlzLnF1ZXJ5ID0gbnVsbDtcbiAgdGhpcy5wYXRobmFtZSA9IG51bGw7XG4gIHRoaXMucGF0aCA9IG51bGw7XG4gIHRoaXMuaHJlZiA9IG51bGw7XG59XG5cbi8vIFJlZmVyZW5jZTogUkZDIDM5ODYsIFJGQyAxODA4LCBSRkMgMjM5NlxuXG4vLyBkZWZpbmUgdGhlc2UgaGVyZSBzbyBhdCBsZWFzdCB0aGV5IG9ubHkgaGF2ZSB0byBiZVxuLy8gY29tcGlsZWQgb25jZSBvbiB0aGUgZmlyc3QgbW9kdWxlIGxvYWQuXG52YXIgcHJvdG9jb2xQYXR0ZXJuID0gL14oW2EtejAtOS4rLV0rOikvaSxcbiAgICBwb3J0UGF0dGVybiA9IC86WzAtOV0qJC8sXG5cbiAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIGEgc2ltcGxlIHBhdGggVVJMXG4gICAgc2ltcGxlUGF0aFBhdHRlcm4gPSAvXihcXC9cXC8/KD8hXFwvKVteXFw/XFxzXSopKFxcP1teXFxzXSopPyQvLFxuXG4gICAgLy8gUkZDIDIzOTY6IGNoYXJhY3RlcnMgcmVzZXJ2ZWQgZm9yIGRlbGltaXRpbmcgVVJMcy5cbiAgICAvLyBXZSBhY3R1YWxseSBqdXN0IGF1dG8tZXNjYXBlIHRoZXNlLlxuICAgIGRlbGltcyA9IFsnPCcsICc+JywgJ1wiJywgJ2AnLCAnICcsICdcXHInLCAnXFxuJywgJ1xcdCddLFxuXG4gICAgLy8gUkZDIDIzOTY6IGNoYXJhY3RlcnMgbm90IGFsbG93ZWQgZm9yIHZhcmlvdXMgcmVhc29ucy5cbiAgICB1bndpc2UgPSBbJ3snLCAnfScsICd8JywgJ1xcXFwnLCAnXicsICdgJ10uY29uY2F0KGRlbGltcyksXG5cbiAgICAvLyBBbGxvd2VkIGJ5IFJGQ3MsIGJ1dCBjYXVzZSBvZiBYU1MgYXR0YWNrcy4gIEFsd2F5cyBlc2NhcGUgdGhlc2UuXG4gICAgYXV0b0VzY2FwZSA9IFsnXFwnJ10uY29uY2F0KHVud2lzZSksXG4gICAgLy8gQ2hhcmFjdGVycyB0aGF0IGFyZSBuZXZlciBldmVyIGFsbG93ZWQgaW4gYSBob3N0bmFtZS5cbiAgICAvLyBOb3RlIHRoYXQgYW55IGludmFsaWQgY2hhcnMgYXJlIGFsc28gaGFuZGxlZCwgYnV0IHRoZXNlXG4gICAgLy8gYXJlIHRoZSBvbmVzIHRoYXQgYXJlICpleHBlY3RlZCogdG8gYmUgc2Vlbiwgc28gd2UgZmFzdC1wYXRoXG4gICAgLy8gdGhlbS5cbiAgICBub25Ib3N0Q2hhcnMgPSBbJyUnLCAnLycsICc/JywgJzsnLCAnIyddLmNvbmNhdChhdXRvRXNjYXBlKSxcbiAgICBob3N0RW5kaW5nQ2hhcnMgPSBbJy8nLCAnPycsICcjJ10sXG4gICAgaG9zdG5hbWVNYXhMZW4gPSAyNTUsXG4gICAgaG9zdG5hbWVQYXJ0UGF0dGVybiA9IC9eWythLXowLTlBLVpfLV17MCw2M30kLyxcbiAgICBob3N0bmFtZVBhcnRTdGFydCA9IC9eKFsrYS16MC05QS1aXy1dezAsNjN9KSguKikkLyxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBjYW4gYWxsb3cgXCJ1bnNhZmVcIiBhbmQgXCJ1bndpc2VcIiBjaGFycy5cbiAgICB1bnNhZmVQcm90b2NvbCA9IHtcbiAgICAgICdqYXZhc2NyaXB0JzogdHJ1ZSxcbiAgICAgICdqYXZhc2NyaXB0Oic6IHRydWVcbiAgICB9LFxuICAgIC8vIHByb3RvY29scyB0aGF0IG5ldmVyIGhhdmUgYSBob3N0bmFtZS5cbiAgICBob3N0bGVzc1Byb3RvY29sID0ge1xuICAgICAgJ2phdmFzY3JpcHQnOiB0cnVlLFxuICAgICAgJ2phdmFzY3JpcHQ6JzogdHJ1ZVxuICAgIH0sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgYWx3YXlzIGNvbnRhaW4gYSAvLyBiaXQuXG4gICAgc2xhc2hlZFByb3RvY29sID0ge1xuICAgICAgJ2h0dHAnOiB0cnVlLFxuICAgICAgJ2h0dHBzJzogdHJ1ZSxcbiAgICAgICdmdHAnOiB0cnVlLFxuICAgICAgJ2dvcGhlcic6IHRydWUsXG4gICAgICAnZmlsZSc6IHRydWUsXG4gICAgICAnaHR0cDonOiB0cnVlLFxuICAgICAgJ2h0dHBzOic6IHRydWUsXG4gICAgICAnZnRwOic6IHRydWUsXG4gICAgICAnZ29waGVyOic6IHRydWUsXG4gICAgICAnZmlsZTonOiB0cnVlXG4gICAgfSxcbiAgICBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmZ1bmN0aW9uIHVybFBhcnNlKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpIHtcbiAgaWYgKHVybCAmJiB1dGlsLmlzT2JqZWN0KHVybCkgJiYgdXJsIGluc3RhbmNlb2YgVXJsKSByZXR1cm4gdXJsO1xuXG4gIHZhciB1ID0gbmV3IFVybDtcbiAgdS5wYXJzZSh1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KTtcbiAgcmV0dXJuIHU7XG59XG5cblVybC5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbih1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIGlmICghdXRpbC5pc1N0cmluZyh1cmwpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlBhcmFtZXRlciAndXJsJyBtdXN0IGJlIGEgc3RyaW5nLCBub3QgXCIgKyB0eXBlb2YgdXJsKTtcbiAgfVxuXG4gIC8vIENvcHkgY2hyb21lLCBJRSwgb3BlcmEgYmFja3NsYXNoLWhhbmRsaW5nIGJlaGF2aW9yLlxuICAvLyBCYWNrIHNsYXNoZXMgYmVmb3JlIHRoZSBxdWVyeSBzdHJpbmcgZ2V0IGNvbnZlcnRlZCB0byBmb3J3YXJkIHNsYXNoZXNcbiAgLy8gU2VlOiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjU5MTZcbiAgdmFyIHF1ZXJ5SW5kZXggPSB1cmwuaW5kZXhPZignPycpLFxuICAgICAgc3BsaXR0ZXIgPVxuICAgICAgICAgIChxdWVyeUluZGV4ICE9PSAtMSAmJiBxdWVyeUluZGV4IDwgdXJsLmluZGV4T2YoJyMnKSkgPyAnPycgOiAnIycsXG4gICAgICB1U3BsaXQgPSB1cmwuc3BsaXQoc3BsaXR0ZXIpLFxuICAgICAgc2xhc2hSZWdleCA9IC9cXFxcL2c7XG4gIHVTcGxpdFswXSA9IHVTcGxpdFswXS5yZXBsYWNlKHNsYXNoUmVnZXgsICcvJyk7XG4gIHVybCA9IHVTcGxpdC5qb2luKHNwbGl0dGVyKTtcblxuICB2YXIgcmVzdCA9IHVybDtcblxuICAvLyB0cmltIGJlZm9yZSBwcm9jZWVkaW5nLlxuICAvLyBUaGlzIGlzIHRvIHN1cHBvcnQgcGFyc2Ugc3R1ZmYgbGlrZSBcIiAgaHR0cDovL2Zvby5jb20gIFxcblwiXG4gIHJlc3QgPSByZXN0LnRyaW0oKTtcblxuICBpZiAoIXNsYXNoZXNEZW5vdGVIb3N0ICYmIHVybC5zcGxpdCgnIycpLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIFRyeSBmYXN0IHBhdGggcmVnZXhwXG4gICAgdmFyIHNpbXBsZVBhdGggPSBzaW1wbGVQYXRoUGF0dGVybi5leGVjKHJlc3QpO1xuICAgIGlmIChzaW1wbGVQYXRoKSB7XG4gICAgICB0aGlzLnBhdGggPSByZXN0O1xuICAgICAgdGhpcy5ocmVmID0gcmVzdDtcbiAgICAgIHRoaXMucGF0aG5hbWUgPSBzaW1wbGVQYXRoWzFdO1xuICAgICAgaWYgKHNpbXBsZVBhdGhbMl0pIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSBzaW1wbGVQYXRoWzJdO1xuICAgICAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSBxdWVyeXN0cmluZy5wYXJzZSh0aGlzLnNlYXJjaC5zdWJzdHIoMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0aGlzLnNlYXJjaC5zdWJzdHIoMSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICB0aGlzLnNlYXJjaCA9ICcnO1xuICAgICAgICB0aGlzLnF1ZXJ5ID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH1cblxuICB2YXIgcHJvdG8gPSBwcm90b2NvbFBhdHRlcm4uZXhlYyhyZXN0KTtcbiAgaWYgKHByb3RvKSB7XG4gICAgcHJvdG8gPSBwcm90b1swXTtcbiAgICB2YXIgbG93ZXJQcm90byA9IHByb3RvLnRvTG93ZXJDYXNlKCk7XG4gICAgdGhpcy5wcm90b2NvbCA9IGxvd2VyUHJvdG87XG4gICAgcmVzdCA9IHJlc3Quc3Vic3RyKHByb3RvLmxlbmd0aCk7XG4gIH1cblxuICAvLyBmaWd1cmUgb3V0IGlmIGl0J3MgZ290IGEgaG9zdFxuICAvLyB1c2VyQHNlcnZlciBpcyAqYWx3YXlzKiBpbnRlcnByZXRlZCBhcyBhIGhvc3RuYW1lLCBhbmQgdXJsXG4gIC8vIHJlc29sdXRpb24gd2lsbCB0cmVhdCAvL2Zvby9iYXIgYXMgaG9zdD1mb28scGF0aD1iYXIgYmVjYXVzZSB0aGF0J3NcbiAgLy8gaG93IHRoZSBicm93c2VyIHJlc29sdmVzIHJlbGF0aXZlIFVSTHMuXG4gIGlmIChzbGFzaGVzRGVub3RlSG9zdCB8fCBwcm90byB8fCByZXN0Lm1hdGNoKC9eXFwvXFwvW15AXFwvXStAW15AXFwvXSsvKSkge1xuICAgIHZhciBzbGFzaGVzID0gcmVzdC5zdWJzdHIoMCwgMikgPT09ICcvLyc7XG4gICAgaWYgKHNsYXNoZXMgJiYgIShwcm90byAmJiBob3N0bGVzc1Byb3RvY29sW3Byb3RvXSkpIHtcbiAgICAgIHJlc3QgPSByZXN0LnN1YnN0cigyKTtcbiAgICAgIHRoaXMuc2xhc2hlcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFob3N0bGVzc1Byb3RvY29sW3Byb3RvXSAmJlxuICAgICAgKHNsYXNoZXMgfHwgKHByb3RvICYmICFzbGFzaGVkUHJvdG9jb2xbcHJvdG9dKSkpIHtcblxuICAgIC8vIHRoZXJlJ3MgYSBob3N0bmFtZS5cbiAgICAvLyB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgLywgPywgOywgb3IgIyBlbmRzIHRoZSBob3N0LlxuICAgIC8vXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gQCBpbiB0aGUgaG9zdG5hbWUsIHRoZW4gbm9uLWhvc3QgY2hhcnMgKmFyZSogYWxsb3dlZFxuICAgIC8vIHRvIHRoZSBsZWZ0IG9mIHRoZSBsYXN0IEAgc2lnbiwgdW5sZXNzIHNvbWUgaG9zdC1lbmRpbmcgY2hhcmFjdGVyXG4gICAgLy8gY29tZXMgKmJlZm9yZSogdGhlIEAtc2lnbi5cbiAgICAvLyBVUkxzIGFyZSBvYm5veGlvdXMuXG4gICAgLy9cbiAgICAvLyBleDpcbiAgICAvLyBodHRwOi8vYUBiQGMvID0+IHVzZXI6YUBiIGhvc3Q6Y1xuICAgIC8vIGh0dHA6Ly9hQGI/QGMgPT4gdXNlcjphIGhvc3Q6YyBwYXRoOi8/QGNcblxuICAgIC8vIHYwLjEyIFRPRE8oaXNhYWNzKTogVGhpcyBpcyBub3QgcXVpdGUgaG93IENocm9tZSBkb2VzIHRoaW5ncy5cbiAgICAvLyBSZXZpZXcgb3VyIHRlc3QgY2FzZSBhZ2FpbnN0IGJyb3dzZXJzIG1vcmUgY29tcHJlaGVuc2l2ZWx5LlxuXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgYW55IGhvc3RFbmRpbmdDaGFyc1xuICAgIHZhciBob3N0RW5kID0gLTE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBob3N0RW5kaW5nQ2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBoZWMgPSByZXN0LmluZGV4T2YoaG9zdEVuZGluZ0NoYXJzW2ldKTtcbiAgICAgIGlmIChoZWMgIT09IC0xICYmIChob3N0RW5kID09PSAtMSB8fCBoZWMgPCBob3N0RW5kKSlcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICB9XG5cbiAgICAvLyBhdCB0aGlzIHBvaW50LCBlaXRoZXIgd2UgaGF2ZSBhbiBleHBsaWNpdCBwb2ludCB3aGVyZSB0aGVcbiAgICAvLyBhdXRoIHBvcnRpb24gY2Fubm90IGdvIHBhc3QsIG9yIHRoZSBsYXN0IEAgY2hhciBpcyB0aGUgZGVjaWRlci5cbiAgICB2YXIgYXV0aCwgYXRTaWduO1xuICAgIGlmIChob3N0RW5kID09PSAtMSkge1xuICAgICAgLy8gYXRTaWduIGNhbiBiZSBhbnl3aGVyZS5cbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYXRTaWduIG11c3QgYmUgaW4gYXV0aCBwb3J0aW9uLlxuICAgICAgLy8gaHR0cDovL2FAYi9jQGQgPT4gaG9zdDpiIGF1dGg6YSBwYXRoOi9jQGRcbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnLCBob3N0RW5kKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgd2UgaGF2ZSBhIHBvcnRpb24gd2hpY2ggaXMgZGVmaW5pdGVseSB0aGUgYXV0aC5cbiAgICAvLyBQdWxsIHRoYXQgb2ZmLlxuICAgIGlmIChhdFNpZ24gIT09IC0xKSB7XG4gICAgICBhdXRoID0gcmVzdC5zbGljZSgwLCBhdFNpZ24pO1xuICAgICAgcmVzdCA9IHJlc3Quc2xpY2UoYXRTaWduICsgMSk7XG4gICAgICB0aGlzLmF1dGggPSBkZWNvZGVVUklDb21wb25lbnQoYXV0aCk7XG4gICAgfVxuXG4gICAgLy8gdGhlIGhvc3QgaXMgdGhlIHJlbWFpbmluZyB0byB0aGUgbGVmdCBvZiB0aGUgZmlyc3Qgbm9uLWhvc3QgY2hhclxuICAgIGhvc3RFbmQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vbkhvc3RDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhlYyA9IHJlc3QuaW5kZXhPZihub25Ib3N0Q2hhcnNbaV0pO1xuICAgICAgaWYgKGhlYyAhPT0gLTEgJiYgKGhvc3RFbmQgPT09IC0xIHx8IGhlYyA8IGhvc3RFbmQpKVxuICAgICAgICBob3N0RW5kID0gaGVjO1xuICAgIH1cbiAgICAvLyBpZiB3ZSBzdGlsbCBoYXZlIG5vdCBoaXQgaXQsIHRoZW4gdGhlIGVudGlyZSB0aGluZyBpcyBhIGhvc3QuXG4gICAgaWYgKGhvc3RFbmQgPT09IC0xKVxuICAgICAgaG9zdEVuZCA9IHJlc3QubGVuZ3RoO1xuXG4gICAgdGhpcy5ob3N0ID0gcmVzdC5zbGljZSgwLCBob3N0RW5kKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZShob3N0RW5kKTtcblxuICAgIC8vIHB1bGwgb3V0IHBvcnQuXG4gICAgdGhpcy5wYXJzZUhvc3QoKTtcblxuICAgIC8vIHdlJ3ZlIGluZGljYXRlZCB0aGF0IHRoZXJlIGlzIGEgaG9zdG5hbWUsXG4gICAgLy8gc28gZXZlbiBpZiBpdCdzIGVtcHR5LCBpdCBoYXMgdG8gYmUgcHJlc2VudC5cbiAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZSB8fCAnJztcblxuICAgIC8vIGlmIGhvc3RuYW1lIGJlZ2lucyB3aXRoIFsgYW5kIGVuZHMgd2l0aCBdXG4gICAgLy8gYXNzdW1lIHRoYXQgaXQncyBhbiBJUHY2IGFkZHJlc3MuXG4gICAgdmFyIGlwdjZIb3N0bmFtZSA9IHRoaXMuaG9zdG5hbWVbMF0gPT09ICdbJyAmJlxuICAgICAgICB0aGlzLmhvc3RuYW1lW3RoaXMuaG9zdG5hbWUubGVuZ3RoIC0gMV0gPT09ICddJztcblxuICAgIC8vIHZhbGlkYXRlIGEgbGl0dGxlLlxuICAgIGlmICghaXB2Nkhvc3RuYW1lKSB7XG4gICAgICB2YXIgaG9zdHBhcnRzID0gdGhpcy5ob3N0bmFtZS5zcGxpdCgvXFwuLyk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGhvc3RwYXJ0cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIHBhcnQgPSBob3N0cGFydHNbaV07XG4gICAgICAgIGlmICghcGFydCkgY29udGludWU7XG4gICAgICAgIGlmICghcGFydC5tYXRjaChob3N0bmFtZVBhcnRQYXR0ZXJuKSkge1xuICAgICAgICAgIHZhciBuZXdwYXJ0ID0gJyc7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IDAsIGsgPSBwYXJ0Lmxlbmd0aDsgaiA8IGs7IGorKykge1xuICAgICAgICAgICAgaWYgKHBhcnQuY2hhckNvZGVBdChqKSA+IDEyNykge1xuICAgICAgICAgICAgICAvLyB3ZSByZXBsYWNlIG5vbi1BU0NJSSBjaGFyIHdpdGggYSB0ZW1wb3JhcnkgcGxhY2Vob2xkZXJcbiAgICAgICAgICAgICAgLy8gd2UgbmVlZCB0aGlzIHRvIG1ha2Ugc3VyZSBzaXplIG9mIGhvc3RuYW1lIGlzIG5vdFxuICAgICAgICAgICAgICAvLyBicm9rZW4gYnkgcmVwbGFjaW5nIG5vbi1BU0NJSSBieSBub3RoaW5nXG4gICAgICAgICAgICAgIG5ld3BhcnQgKz0gJ3gnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbmV3cGFydCArPSBwYXJ0W2pdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyB3ZSB0ZXN0IGFnYWluIHdpdGggQVNDSUkgY2hhciBvbmx5XG4gICAgICAgICAgaWYgKCFuZXdwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFBhdHRlcm4pKSB7XG4gICAgICAgICAgICB2YXIgdmFsaWRQYXJ0cyA9IGhvc3RwYXJ0cy5zbGljZSgwLCBpKTtcbiAgICAgICAgICAgIHZhciBub3RIb3N0ID0gaG9zdHBhcnRzLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgICAgIHZhciBiaXQgPSBwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFN0YXJ0KTtcbiAgICAgICAgICAgIGlmIChiaXQpIHtcbiAgICAgICAgICAgICAgdmFsaWRQYXJ0cy5wdXNoKGJpdFsxXSk7XG4gICAgICAgICAgICAgIG5vdEhvc3QudW5zaGlmdChiaXRbMl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5vdEhvc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHJlc3QgPSAnLycgKyBub3RIb3N0LmpvaW4oJy4nKSArIHJlc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdmFsaWRQYXJ0cy5qb2luKCcuJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5ob3N0bmFtZS5sZW5ndGggPiBob3N0bmFtZU1heExlbikge1xuICAgICAgdGhpcy5ob3N0bmFtZSA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBob3N0bmFtZXMgYXJlIGFsd2F5cyBsb3dlciBjYXNlLlxuICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICBpZiAoIWlwdjZIb3N0bmFtZSkge1xuICAgICAgLy8gSUROQSBTdXBwb3J0OiBSZXR1cm5zIGEgcHVueWNvZGVkIHJlcHJlc2VudGF0aW9uIG9mIFwiZG9tYWluXCIuXG4gICAgICAvLyBJdCBvbmx5IGNvbnZlcnRzIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB0aGF0XG4gICAgICAvLyBoYXZlIG5vbi1BU0NJSSBjaGFyYWN0ZXJzLCBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmXG4gICAgICAvLyB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQgYWxyZWFkeSBpcyBBU0NJSS1vbmx5LlxuICAgICAgdGhpcy5ob3N0bmFtZSA9IHB1bnljb2RlLnRvQVNDSUkodGhpcy5ob3N0bmFtZSk7XG4gICAgfVxuXG4gICAgdmFyIHAgPSB0aGlzLnBvcnQgPyAnOicgKyB0aGlzLnBvcnQgOiAnJztcbiAgICB2YXIgaCA9IHRoaXMuaG9zdG5hbWUgfHwgJyc7XG4gICAgdGhpcy5ob3N0ID0gaCArIHA7XG4gICAgdGhpcy5ocmVmICs9IHRoaXMuaG9zdDtcblxuICAgIC8vIHN0cmlwIFsgYW5kIF0gZnJvbSB0aGUgaG9zdG5hbWVcbiAgICAvLyB0aGUgaG9zdCBmaWVsZCBzdGlsbCByZXRhaW5zIHRoZW0sIHRob3VnaFxuICAgIGlmIChpcHY2SG9zdG5hbWUpIHtcbiAgICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lLnN1YnN0cigxLCB0aGlzLmhvc3RuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgaWYgKHJlc3RbMF0gIT09ICcvJykge1xuICAgICAgICByZXN0ID0gJy8nICsgcmVzdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBub3cgcmVzdCBpcyBzZXQgdG8gdGhlIHBvc3QtaG9zdCBzdHVmZi5cbiAgLy8gY2hvcCBvZmYgYW55IGRlbGltIGNoYXJzLlxuICBpZiAoIXVuc2FmZVByb3RvY29sW2xvd2VyUHJvdG9dKSB7XG5cbiAgICAvLyBGaXJzdCwgbWFrZSAxMDAlIHN1cmUgdGhhdCBhbnkgXCJhdXRvRXNjYXBlXCIgY2hhcnMgZ2V0XG4gICAgLy8gZXNjYXBlZCwgZXZlbiBpZiBlbmNvZGVVUklDb21wb25lbnQgZG9lc24ndCB0aGluayB0aGV5XG4gICAgLy8gbmVlZCB0byBiZS5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGF1dG9Fc2NhcGUubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2YXIgYWUgPSBhdXRvRXNjYXBlW2ldO1xuICAgICAgaWYgKHJlc3QuaW5kZXhPZihhZSkgPT09IC0xKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIHZhciBlc2MgPSBlbmNvZGVVUklDb21wb25lbnQoYWUpO1xuICAgICAgaWYgKGVzYyA9PT0gYWUpIHtcbiAgICAgICAgZXNjID0gZXNjYXBlKGFlKTtcbiAgICAgIH1cbiAgICAgIHJlc3QgPSByZXN0LnNwbGl0KGFlKS5qb2luKGVzYyk7XG4gICAgfVxuICB9XG5cblxuICAvLyBjaG9wIG9mZiBmcm9tIHRoZSB0YWlsIGZpcnN0LlxuICB2YXIgaGFzaCA9IHJlc3QuaW5kZXhPZignIycpO1xuICBpZiAoaGFzaCAhPT0gLTEpIHtcbiAgICAvLyBnb3QgYSBmcmFnbWVudCBzdHJpbmcuXG4gICAgdGhpcy5oYXNoID0gcmVzdC5zdWJzdHIoaGFzaCk7XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoMCwgaGFzaCk7XG4gIH1cbiAgdmFyIHFtID0gcmVzdC5pbmRleE9mKCc/Jyk7XG4gIGlmIChxbSAhPT0gLTEpIHtcbiAgICB0aGlzLnNlYXJjaCA9IHJlc3Quc3Vic3RyKHFtKTtcbiAgICB0aGlzLnF1ZXJ5ID0gcmVzdC5zdWJzdHIocW0gKyAxKTtcbiAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMucXVlcnkpO1xuICAgIH1cbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBxbSk7XG4gIH0gZWxzZSBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgIC8vIG5vIHF1ZXJ5IHN0cmluZywgYnV0IHBhcnNlUXVlcnlTdHJpbmcgc3RpbGwgcmVxdWVzdGVkXG4gICAgdGhpcy5zZWFyY2ggPSAnJztcbiAgICB0aGlzLnF1ZXJ5ID0ge307XG4gIH1cbiAgaWYgKHJlc3QpIHRoaXMucGF0aG5hbWUgPSByZXN0O1xuICBpZiAoc2xhc2hlZFByb3RvY29sW2xvd2VyUHJvdG9dICYmXG4gICAgICB0aGlzLmhvc3RuYW1lICYmICF0aGlzLnBhdGhuYW1lKSB7XG4gICAgdGhpcy5wYXRobmFtZSA9ICcvJztcbiAgfVxuXG4gIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgaWYgKHRoaXMucGF0aG5hbWUgfHwgdGhpcy5zZWFyY2gpIHtcbiAgICB2YXIgcCA9IHRoaXMucGF0aG5hbWUgfHwgJyc7XG4gICAgdmFyIHMgPSB0aGlzLnNlYXJjaCB8fCAnJztcbiAgICB0aGlzLnBhdGggPSBwICsgcztcbiAgfVxuXG4gIC8vIGZpbmFsbHksIHJlY29uc3RydWN0IHRoZSBocmVmIGJhc2VkIG9uIHdoYXQgaGFzIGJlZW4gdmFsaWRhdGVkLlxuICB0aGlzLmhyZWYgPSB0aGlzLmZvcm1hdCgpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGZvcm1hdCBhIHBhcnNlZCBvYmplY3QgaW50byBhIHVybCBzdHJpbmdcbmZ1bmN0aW9uIHVybEZvcm1hdChvYmopIHtcbiAgLy8gZW5zdXJlIGl0J3MgYW4gb2JqZWN0LCBhbmQgbm90IGEgc3RyaW5nIHVybC5cbiAgLy8gSWYgaXQncyBhbiBvYmosIHRoaXMgaXMgYSBuby1vcC5cbiAgLy8gdGhpcyB3YXksIHlvdSBjYW4gY2FsbCB1cmxfZm9ybWF0KCkgb24gc3RyaW5nc1xuICAvLyB0byBjbGVhbiB1cCBwb3RlbnRpYWxseSB3b25reSB1cmxzLlxuICBpZiAodXRpbC5pc1N0cmluZyhvYmopKSBvYmogPSB1cmxQYXJzZShvYmopO1xuICBpZiAoIShvYmogaW5zdGFuY2VvZiBVcmwpKSByZXR1cm4gVXJsLnByb3RvdHlwZS5mb3JtYXQuY2FsbChvYmopO1xuICByZXR1cm4gb2JqLmZvcm1hdCgpO1xufVxuXG5VcmwucHJvdG90eXBlLmZvcm1hdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgYXV0aCA9IHRoaXMuYXV0aCB8fCAnJztcbiAgaWYgKGF1dGgpIHtcbiAgICBhdXRoID0gZW5jb2RlVVJJQ29tcG9uZW50KGF1dGgpO1xuICAgIGF1dGggPSBhdXRoLnJlcGxhY2UoLyUzQS9pLCAnOicpO1xuICAgIGF1dGggKz0gJ0AnO1xuICB9XG5cbiAgdmFyIHByb3RvY29sID0gdGhpcy5wcm90b2NvbCB8fCAnJyxcbiAgICAgIHBhdGhuYW1lID0gdGhpcy5wYXRobmFtZSB8fCAnJyxcbiAgICAgIGhhc2ggPSB0aGlzLmhhc2ggfHwgJycsXG4gICAgICBob3N0ID0gZmFsc2UsXG4gICAgICBxdWVyeSA9ICcnO1xuXG4gIGlmICh0aGlzLmhvc3QpIHtcbiAgICBob3N0ID0gYXV0aCArIHRoaXMuaG9zdDtcbiAgfSBlbHNlIGlmICh0aGlzLmhvc3RuYW1lKSB7XG4gICAgaG9zdCA9IGF1dGggKyAodGhpcy5ob3N0bmFtZS5pbmRleE9mKCc6JykgPT09IC0xID9cbiAgICAgICAgdGhpcy5ob3N0bmFtZSA6XG4gICAgICAgICdbJyArIHRoaXMuaG9zdG5hbWUgKyAnXScpO1xuICAgIGlmICh0aGlzLnBvcnQpIHtcbiAgICAgIGhvc3QgKz0gJzonICsgdGhpcy5wb3J0O1xuICAgIH1cbiAgfVxuXG4gIGlmICh0aGlzLnF1ZXJ5ICYmXG4gICAgICB1dGlsLmlzT2JqZWN0KHRoaXMucXVlcnkpICYmXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJ5KS5sZW5ndGgpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeSh0aGlzLnF1ZXJ5KTtcbiAgfVxuXG4gIHZhciBzZWFyY2ggPSB0aGlzLnNlYXJjaCB8fCAocXVlcnkgJiYgKCc/JyArIHF1ZXJ5KSkgfHwgJyc7XG5cbiAgaWYgKHByb3RvY29sICYmIHByb3RvY29sLnN1YnN0cigtMSkgIT09ICc6JykgcHJvdG9jb2wgKz0gJzonO1xuXG4gIC8vIG9ubHkgdGhlIHNsYXNoZWRQcm90b2NvbHMgZ2V0IHRoZSAvLy4gIE5vdCBtYWlsdG86LCB4bXBwOiwgZXRjLlxuICAvLyB1bmxlc3MgdGhleSBoYWQgdGhlbSB0byBiZWdpbiB3aXRoLlxuICBpZiAodGhpcy5zbGFzaGVzIHx8XG4gICAgICAoIXByb3RvY29sIHx8IHNsYXNoZWRQcm90b2NvbFtwcm90b2NvbF0pICYmIGhvc3QgIT09IGZhbHNlKSB7XG4gICAgaG9zdCA9ICcvLycgKyAoaG9zdCB8fCAnJyk7XG4gICAgaWYgKHBhdGhuYW1lICYmIHBhdGhuYW1lLmNoYXJBdCgwKSAhPT0gJy8nKSBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICB9IGVsc2UgaWYgKCFob3N0KSB7XG4gICAgaG9zdCA9ICcnO1xuICB9XG5cbiAgaWYgKGhhc2ggJiYgaGFzaC5jaGFyQXQoMCkgIT09ICcjJykgaGFzaCA9ICcjJyArIGhhc2g7XG4gIGlmIChzZWFyY2ggJiYgc2VhcmNoLmNoYXJBdCgwKSAhPT0gJz8nKSBzZWFyY2ggPSAnPycgKyBzZWFyY2g7XG5cbiAgcGF0aG5hbWUgPSBwYXRobmFtZS5yZXBsYWNlKC9bPyNdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChtYXRjaCk7XG4gIH0pO1xuICBzZWFyY2ggPSBzZWFyY2gucmVwbGFjZSgnIycsICclMjMnKTtcblxuICByZXR1cm4gcHJvdG9jb2wgKyBob3N0ICsgcGF0aG5hbWUgKyBzZWFyY2ggKyBoYXNoO1xufTtcblxuZnVuY3Rpb24gdXJsUmVzb2x2ZShzb3VyY2UsIHJlbGF0aXZlKSB7XG4gIHJldHVybiB1cmxQYXJzZShzb3VyY2UsIGZhbHNlLCB0cnVlKS5yZXNvbHZlKHJlbGF0aXZlKTtcbn1cblxuVXJsLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcbiAgcmV0dXJuIHRoaXMucmVzb2x2ZU9iamVjdCh1cmxQYXJzZShyZWxhdGl2ZSwgZmFsc2UsIHRydWUpKS5mb3JtYXQoKTtcbn07XG5cbmZ1bmN0aW9uIHVybFJlc29sdmVPYmplY3Qoc291cmNlLCByZWxhdGl2ZSkge1xuICBpZiAoIXNvdXJjZSkgcmV0dXJuIHJlbGF0aXZlO1xuICByZXR1cm4gdXJsUGFyc2Uoc291cmNlLCBmYWxzZSwgdHJ1ZSkucmVzb2x2ZU9iamVjdChyZWxhdGl2ZSk7XG59XG5cblVybC5wcm90b3R5cGUucmVzb2x2ZU9iamVjdCA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XG4gIGlmICh1dGlsLmlzU3RyaW5nKHJlbGF0aXZlKSkge1xuICAgIHZhciByZWwgPSBuZXcgVXJsKCk7XG4gICAgcmVsLnBhcnNlKHJlbGF0aXZlLCBmYWxzZSwgdHJ1ZSk7XG4gICAgcmVsYXRpdmUgPSByZWw7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gbmV3IFVybCgpO1xuICB2YXIgdGtleXMgPSBPYmplY3Qua2V5cyh0aGlzKTtcbiAgZm9yICh2YXIgdGsgPSAwOyB0ayA8IHRrZXlzLmxlbmd0aDsgdGsrKykge1xuICAgIHZhciB0a2V5ID0gdGtleXNbdGtdO1xuICAgIHJlc3VsdFt0a2V5XSA9IHRoaXNbdGtleV07XG4gIH1cblxuICAvLyBoYXNoIGlzIGFsd2F5cyBvdmVycmlkZGVuLCBubyBtYXR0ZXIgd2hhdC5cbiAgLy8gZXZlbiBocmVmPVwiXCIgd2lsbCByZW1vdmUgaXQuXG4gIHJlc3VsdC5oYXNoID0gcmVsYXRpdmUuaGFzaDtcblxuICAvLyBpZiB0aGUgcmVsYXRpdmUgdXJsIGlzIGVtcHR5LCB0aGVuIHRoZXJlJ3Mgbm90aGluZyBsZWZ0IHRvIGRvIGhlcmUuXG4gIGlmIChyZWxhdGl2ZS5ocmVmID09PSAnJykge1xuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBocmVmcyBsaWtlIC8vZm9vL2JhciBhbHdheXMgY3V0IHRvIHRoZSBwcm90b2NvbC5cbiAgaWYgKHJlbGF0aXZlLnNsYXNoZXMgJiYgIXJlbGF0aXZlLnByb3RvY29sKSB7XG4gICAgLy8gdGFrZSBldmVyeXRoaW5nIGV4Y2VwdCB0aGUgcHJvdG9jb2wgZnJvbSByZWxhdGl2ZVxuICAgIHZhciBya2V5cyA9IE9iamVjdC5rZXlzKHJlbGF0aXZlKTtcbiAgICBmb3IgKHZhciByayA9IDA7IHJrIDwgcmtleXMubGVuZ3RoOyByaysrKSB7XG4gICAgICB2YXIgcmtleSA9IHJrZXlzW3JrXTtcbiAgICAgIGlmIChya2V5ICE9PSAncHJvdG9jb2wnKVxuICAgICAgICByZXN1bHRbcmtleV0gPSByZWxhdGl2ZVtya2V5XTtcbiAgICB9XG5cbiAgICAvL3VybFBhcnNlIGFwcGVuZHMgdHJhaWxpbmcgLyB0byB1cmxzIGxpa2UgaHR0cDovL3d3dy5leGFtcGxlLmNvbVxuICAgIGlmIChzbGFzaGVkUHJvdG9jb2xbcmVzdWx0LnByb3RvY29sXSAmJlxuICAgICAgICByZXN1bHQuaG9zdG5hbWUgJiYgIXJlc3VsdC5wYXRobmFtZSkge1xuICAgICAgcmVzdWx0LnBhdGggPSByZXN1bHQucGF0aG5hbWUgPSAnLyc7XG4gICAgfVxuXG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGlmIChyZWxhdGl2ZS5wcm90b2NvbCAmJiByZWxhdGl2ZS5wcm90b2NvbCAhPT0gcmVzdWx0LnByb3RvY29sKSB7XG4gICAgLy8gaWYgaXQncyBhIGtub3duIHVybCBwcm90b2NvbCwgdGhlbiBjaGFuZ2luZ1xuICAgIC8vIHRoZSBwcm90b2NvbCBkb2VzIHdlaXJkIHRoaW5nc1xuICAgIC8vIGZpcnN0LCBpZiBpdCdzIG5vdCBmaWxlOiwgdGhlbiB3ZSBNVVNUIGhhdmUgYSBob3N0LFxuICAgIC8vIGFuZCBpZiB0aGVyZSB3YXMgYSBwYXRoXG4gICAgLy8gdG8gYmVnaW4gd2l0aCwgdGhlbiB3ZSBNVVNUIGhhdmUgYSBwYXRoLlxuICAgIC8vIGlmIGl0IGlzIGZpbGU6LCB0aGVuIHRoZSBob3N0IGlzIGRyb3BwZWQsXG4gICAgLy8gYmVjYXVzZSB0aGF0J3Mga25vd24gdG8gYmUgaG9zdGxlc3MuXG4gICAgLy8gYW55dGhpbmcgZWxzZSBpcyBhc3N1bWVkIHRvIGJlIGFic29sdXRlLlxuICAgIGlmICghc2xhc2hlZFByb3RvY29sW3JlbGF0aXZlLnByb3RvY29sXSkge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgICBmb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgICAgICAgdmFyIGsgPSBrZXlzW3ZdO1xuICAgICAgICByZXN1bHRba10gPSByZWxhdGl2ZVtrXTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXN1bHQucHJvdG9jb2wgPSByZWxhdGl2ZS5wcm90b2NvbDtcbiAgICBpZiAoIXJlbGF0aXZlLmhvc3QgJiYgIWhvc3RsZXNzUHJvdG9jb2xbcmVsYXRpdmUucHJvdG9jb2xdKSB7XG4gICAgICB2YXIgcmVsUGF0aCA9IChyZWxhdGl2ZS5wYXRobmFtZSB8fCAnJykuc3BsaXQoJy8nKTtcbiAgICAgIHdoaWxlIChyZWxQYXRoLmxlbmd0aCAmJiAhKHJlbGF0aXZlLmhvc3QgPSByZWxQYXRoLnNoaWZ0KCkpKTtcbiAgICAgIGlmICghcmVsYXRpdmUuaG9zdCkgcmVsYXRpdmUuaG9zdCA9ICcnO1xuICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0bmFtZSkgcmVsYXRpdmUuaG9zdG5hbWUgPSAnJztcbiAgICAgIGlmIChyZWxQYXRoWzBdICE9PSAnJykgcmVsUGF0aC51bnNoaWZ0KCcnKTtcbiAgICAgIGlmIChyZWxQYXRoLmxlbmd0aCA8IDIpIHJlbFBhdGgudW5zaGlmdCgnJyk7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxQYXRoLmpvaW4oJy8nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnBhdGhuYW1lID0gcmVsYXRpdmUucGF0aG5hbWU7XG4gICAgfVxuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgcmVzdWx0Lmhvc3QgPSByZWxhdGl2ZS5ob3N0IHx8ICcnO1xuICAgIHJlc3VsdC5hdXRoID0gcmVsYXRpdmUuYXV0aDtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSByZWxhdGl2ZS5ob3N0bmFtZSB8fCByZWxhdGl2ZS5ob3N0O1xuICAgIHJlc3VsdC5wb3J0ID0gcmVsYXRpdmUucG9ydDtcbiAgICAvLyB0byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmIChyZXN1bHQucGF0aG5hbWUgfHwgcmVzdWx0LnNlYXJjaCkge1xuICAgICAgdmFyIHAgPSByZXN1bHQucGF0aG5hbWUgfHwgJyc7XG4gICAgICB2YXIgcyA9IHJlc3VsdC5zZWFyY2ggfHwgJyc7XG4gICAgICByZXN1bHQucGF0aCA9IHAgKyBzO1xuICAgIH1cbiAgICByZXN1bHQuc2xhc2hlcyA9IHJlc3VsdC5zbGFzaGVzIHx8IHJlbGF0aXZlLnNsYXNoZXM7XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZhciBpc1NvdXJjZUFicyA9IChyZXN1bHQucGF0aG5hbWUgJiYgcmVzdWx0LnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSxcbiAgICAgIGlzUmVsQWJzID0gKFxuICAgICAgICAgIHJlbGF0aXZlLmhvc3QgfHxcbiAgICAgICAgICByZWxhdGl2ZS5wYXRobmFtZSAmJiByZWxhdGl2ZS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJ1xuICAgICAgKSxcbiAgICAgIG11c3RFbmRBYnMgPSAoaXNSZWxBYnMgfHwgaXNTb3VyY2VBYnMgfHxcbiAgICAgICAgICAgICAgICAgICAgKHJlc3VsdC5ob3N0ICYmIHJlbGF0aXZlLnBhdGhuYW1lKSksXG4gICAgICByZW1vdmVBbGxEb3RzID0gbXVzdEVuZEFicyxcbiAgICAgIHNyY1BhdGggPSByZXN1bHQucGF0aG5hbWUgJiYgcmVzdWx0LnBhdGhuYW1lLnNwbGl0KCcvJykgfHwgW10sXG4gICAgICByZWxQYXRoID0gcmVsYXRpdmUucGF0aG5hbWUgJiYgcmVsYXRpdmUucGF0aG5hbWUuc3BsaXQoJy8nKSB8fCBbXSxcbiAgICAgIHBzeWNob3RpYyA9IHJlc3VsdC5wcm90b2NvbCAmJiAhc2xhc2hlZFByb3RvY29sW3Jlc3VsdC5wcm90b2NvbF07XG5cbiAgLy8gaWYgdGhlIHVybCBpcyBhIG5vbi1zbGFzaGVkIHVybCwgdGhlbiByZWxhdGl2ZVxuICAvLyBsaW5rcyBsaWtlIC4uLy4uIHNob3VsZCBiZSBhYmxlXG4gIC8vIHRvIGNyYXdsIHVwIHRvIHRoZSBob3N0bmFtZSwgYXMgd2VsbC4gIFRoaXMgaXMgc3RyYW5nZS5cbiAgLy8gcmVzdWx0LnByb3RvY29sIGhhcyBhbHJlYWR5IGJlZW4gc2V0IGJ5IG5vdy5cbiAgLy8gTGF0ZXIgb24sIHB1dCB0aGUgZmlyc3QgcGF0aCBwYXJ0IGludG8gdGhlIGhvc3QgZmllbGQuXG4gIGlmIChwc3ljaG90aWMpIHtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSAnJztcbiAgICByZXN1bHQucG9ydCA9IG51bGw7XG4gICAgaWYgKHJlc3VsdC5ob3N0KSB7XG4gICAgICBpZiAoc3JjUGF0aFswXSA9PT0gJycpIHNyY1BhdGhbMF0gPSByZXN1bHQuaG9zdDtcbiAgICAgIGVsc2Ugc3JjUGF0aC51bnNoaWZ0KHJlc3VsdC5ob3N0KTtcbiAgICB9XG4gICAgcmVzdWx0Lmhvc3QgPSAnJztcbiAgICBpZiAocmVsYXRpdmUucHJvdG9jb2wpIHtcbiAgICAgIHJlbGF0aXZlLmhvc3RuYW1lID0gbnVsbDtcbiAgICAgIHJlbGF0aXZlLnBvcnQgPSBudWxsO1xuICAgICAgaWYgKHJlbGF0aXZlLmhvc3QpIHtcbiAgICAgICAgaWYgKHJlbFBhdGhbMF0gPT09ICcnKSByZWxQYXRoWzBdID0gcmVsYXRpdmUuaG9zdDtcbiAgICAgICAgZWxzZSByZWxQYXRoLnVuc2hpZnQocmVsYXRpdmUuaG9zdCk7XG4gICAgICB9XG4gICAgICByZWxhdGl2ZS5ob3N0ID0gbnVsbDtcbiAgICB9XG4gICAgbXVzdEVuZEFicyA9IG11c3RFbmRBYnMgJiYgKHJlbFBhdGhbMF0gPT09ICcnIHx8IHNyY1BhdGhbMF0gPT09ICcnKTtcbiAgfVxuXG4gIGlmIChpc1JlbEFicykge1xuICAgIC8vIGl0J3MgYWJzb2x1dGUuXG4gICAgcmVzdWx0Lmhvc3QgPSAocmVsYXRpdmUuaG9zdCB8fCByZWxhdGl2ZS5ob3N0ID09PSAnJykgP1xuICAgICAgICAgICAgICAgICAgcmVsYXRpdmUuaG9zdCA6IHJlc3VsdC5ob3N0O1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IChyZWxhdGl2ZS5ob3N0bmFtZSB8fCByZWxhdGl2ZS5ob3N0bmFtZSA9PT0gJycpID9cbiAgICAgICAgICAgICAgICAgICAgICByZWxhdGl2ZS5ob3N0bmFtZSA6IHJlc3VsdC5ob3N0bmFtZTtcbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIHNyY1BhdGggPSByZWxQYXRoO1xuICAgIC8vIGZhbGwgdGhyb3VnaCB0byB0aGUgZG90LWhhbmRsaW5nIGJlbG93LlxuICB9IGVsc2UgaWYgKHJlbFBhdGgubGVuZ3RoKSB7XG4gICAgLy8gaXQncyByZWxhdGl2ZVxuICAgIC8vIHRocm93IGF3YXkgdGhlIGV4aXN0aW5nIGZpbGUsIGFuZCB0YWtlIHRoZSBuZXcgcGF0aCBpbnN0ZWFkLlxuICAgIGlmICghc3JjUGF0aCkgc3JjUGF0aCA9IFtdO1xuICAgIHNyY1BhdGgucG9wKCk7XG4gICAgc3JjUGF0aCA9IHNyY1BhdGguY29uY2F0KHJlbFBhdGgpO1xuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gIH0gZWxzZSBpZiAoIXV0aWwuaXNOdWxsT3JVbmRlZmluZWQocmVsYXRpdmUuc2VhcmNoKSkge1xuICAgIC8vIGp1c3QgcHVsbCBvdXQgdGhlIHNlYXJjaC5cbiAgICAvLyBsaWtlIGhyZWY9Jz9mb28nLlxuICAgIC8vIFB1dCB0aGlzIGFmdGVyIHRoZSBvdGhlciB0d28gY2FzZXMgYmVjYXVzZSBpdCBzaW1wbGlmaWVzIHRoZSBib29sZWFuc1xuICAgIGlmIChwc3ljaG90aWMpIHtcbiAgICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gc3JjUGF0aC5zaGlmdCgpO1xuICAgICAgLy9vY2NhdGlvbmFseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdFxuICAgICAgLy90aGlzIGVzcGVjaWFsbHkgaGFwcGVucyBpbiBjYXNlcyBsaWtlXG4gICAgICAvL3VybC5yZXNvbHZlT2JqZWN0KCdtYWlsdG86bG9jYWwxQGRvbWFpbjEnLCAnbG9jYWwyQGRvbWFpbjInKVxuICAgICAgdmFyIGF1dGhJbkhvc3QgPSByZXN1bHQuaG9zdCAmJiByZXN1bHQuaG9zdC5pbmRleE9mKCdAJykgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lmhvc3Quc3BsaXQoJ0AnKSA6IGZhbHNlO1xuICAgICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgICAgcmVzdWx0LmF1dGggPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAoIXV0aWwuaXNOdWxsKHJlc3VsdC5wYXRobmFtZSkgfHwgIXV0aWwuaXNOdWxsKHJlc3VsdC5zZWFyY2gpKSB7XG4gICAgICByZXN1bHQucGF0aCA9IChyZXN1bHQucGF0aG5hbWUgPyByZXN1bHQucGF0aG5hbWUgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmVzdWx0LnNlYXJjaCA/IHJlc3VsdC5zZWFyY2ggOiAnJyk7XG4gICAgfVxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpZiAoIXNyY1BhdGgubGVuZ3RoKSB7XG4gICAgLy8gbm8gcGF0aCBhdCBhbGwuICBlYXN5LlxuICAgIC8vIHdlJ3ZlIGFscmVhZHkgaGFuZGxlZCB0aGUgb3RoZXIgc3R1ZmYgYWJvdmUuXG4gICAgcmVzdWx0LnBhdGhuYW1lID0gbnVsbDtcbiAgICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHJlc3VsdC5zZWFyY2gpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gJy8nICsgcmVzdWx0LnNlYXJjaDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICAgIH1cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gaWYgYSB1cmwgRU5EcyBpbiAuIG9yIC4uLCB0aGVuIGl0IG11c3QgZ2V0IGEgdHJhaWxpbmcgc2xhc2guXG4gIC8vIGhvd2V2ZXIsIGlmIGl0IGVuZHMgaW4gYW55dGhpbmcgZWxzZSBub24tc2xhc2h5LFxuICAvLyB0aGVuIGl0IG11c3QgTk9UIGdldCBhIHRyYWlsaW5nIHNsYXNoLlxuICB2YXIgbGFzdCA9IHNyY1BhdGguc2xpY2UoLTEpWzBdO1xuICB2YXIgaGFzVHJhaWxpbmdTbGFzaCA9IChcbiAgICAgIChyZXN1bHQuaG9zdCB8fCByZWxhdGl2ZS5ob3N0IHx8IHNyY1BhdGgubGVuZ3RoID4gMSkgJiZcbiAgICAgIChsYXN0ID09PSAnLicgfHwgbGFzdCA9PT0gJy4uJykgfHwgbGFzdCA9PT0gJycpO1xuXG4gIC8vIHN0cmlwIHNpbmdsZSBkb3RzLCByZXNvbHZlIGRvdWJsZSBkb3RzIHRvIHBhcmVudCBkaXJcbiAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgdmFyIHVwID0gMDtcbiAgZm9yICh2YXIgaSA9IHNyY1BhdGgubGVuZ3RoOyBpID49IDA7IGktLSkge1xuICAgIGxhc3QgPSBzcmNQYXRoW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cCsrO1xuICAgIH0gZWxzZSBpZiAodXApIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmICghbXVzdEVuZEFicyAmJiAhcmVtb3ZlQWxsRG90cykge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgc3JjUGF0aC51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChtdXN0RW5kQWJzICYmIHNyY1BhdGhbMF0gIT09ICcnICYmXG4gICAgICAoIXNyY1BhdGhbMF0gfHwgc3JjUGF0aFswXS5jaGFyQXQoMCkgIT09ICcvJykpIHtcbiAgICBzcmNQYXRoLnVuc2hpZnQoJycpO1xuICB9XG5cbiAgaWYgKGhhc1RyYWlsaW5nU2xhc2ggJiYgKHNyY1BhdGguam9pbignLycpLnN1YnN0cigtMSkgIT09ICcvJykpIHtcbiAgICBzcmNQYXRoLnB1c2goJycpO1xuICB9XG5cbiAgdmFyIGlzQWJzb2x1dGUgPSBzcmNQYXRoWzBdID09PSAnJyB8fFxuICAgICAgKHNyY1BhdGhbMF0gJiYgc3JjUGF0aFswXS5jaGFyQXQoMCkgPT09ICcvJyk7XG5cbiAgLy8gcHV0IHRoZSBob3N0IGJhY2tcbiAgaWYgKHBzeWNob3RpYykge1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gaXNBYnNvbHV0ZSA/ICcnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1BhdGgubGVuZ3RoID8gc3JjUGF0aC5zaGlmdCgpIDogJyc7XG4gICAgLy9vY2NhdGlvbmFseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdFxuICAgIC8vdGhpcyBlc3BlY2lhbGx5IGhhcHBlbnMgaW4gY2FzZXMgbGlrZVxuICAgIC8vdXJsLnJlc29sdmVPYmplY3QoJ21haWx0bzpsb2NhbDFAZG9tYWluMScsICdsb2NhbDJAZG9tYWluMicpXG4gICAgdmFyIGF1dGhJbkhvc3QgPSByZXN1bHQuaG9zdCAmJiByZXN1bHQuaG9zdC5pbmRleE9mKCdAJykgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ob3N0LnNwbGl0KCdAJykgOiBmYWxzZTtcbiAgICBpZiAoYXV0aEluSG9zdCkge1xuICAgICAgcmVzdWx0LmF1dGggPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQuaG9zdCA9IHJlc3VsdC5ob3N0bmFtZSA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICB9XG4gIH1cblxuICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyB8fCAocmVzdWx0Lmhvc3QgJiYgc3JjUGF0aC5sZW5ndGgpO1xuXG4gIGlmIChtdXN0RW5kQWJzICYmICFpc0Fic29sdXRlKSB7XG4gICAgc3JjUGF0aC51bnNoaWZ0KCcnKTtcbiAgfVxuXG4gIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgIHJlc3VsdC5wYXRoID0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQucGF0aG5hbWUgPSBzcmNQYXRoLmpvaW4oJy8nKTtcbiAgfVxuXG4gIC8vdG8gc3VwcG9ydCByZXF1ZXN0Lmh0dHBcbiAgaWYgKCF1dGlsLmlzTnVsbChyZXN1bHQucGF0aG5hbWUpIHx8ICF1dGlsLmlzTnVsbChyZXN1bHQuc2VhcmNoKSkge1xuICAgIHJlc3VsdC5wYXRoID0gKHJlc3VsdC5wYXRobmFtZSA/IHJlc3VsdC5wYXRobmFtZSA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAocmVzdWx0LnNlYXJjaCA/IHJlc3VsdC5zZWFyY2ggOiAnJyk7XG4gIH1cbiAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoIHx8IHJlc3VsdC5hdXRoO1xuICByZXN1bHQuc2xhc2hlcyA9IHJlc3VsdC5zbGFzaGVzIHx8IHJlbGF0aXZlLnNsYXNoZXM7XG4gIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICByZXR1cm4gcmVzdWx0O1xufTtcblxuVXJsLnByb3RvdHlwZS5wYXJzZUhvc3QgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhvc3QgPSB0aGlzLmhvc3Q7XG4gIHZhciBwb3J0ID0gcG9ydFBhdHRlcm4uZXhlYyhob3N0KTtcbiAgaWYgKHBvcnQpIHtcbiAgICBwb3J0ID0gcG9ydFswXTtcbiAgICBpZiAocG9ydCAhPT0gJzonKSB7XG4gICAgICB0aGlzLnBvcnQgPSBwb3J0LnN1YnN0cigxKTtcbiAgICB9XG4gICAgaG9zdCA9IGhvc3Quc3Vic3RyKDAsIGhvc3QubGVuZ3RoIC0gcG9ydC5sZW5ndGgpO1xuICB9XG4gIGlmIChob3N0KSB0aGlzLmhvc3RuYW1lID0gaG9zdDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpc1N0cmluZzogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIHR5cGVvZihhcmcpID09PSAnc3RyaW5nJztcbiAgfSxcbiAgaXNPYmplY3Q6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiB0eXBlb2YoYXJnKSA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xuICB9LFxuICBpc051bGw6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBhcmcgPT09IG51bGw7XG4gIH0sXG4gIGlzTnVsbE9yVW5kZWZpbmVkOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gYXJnID09IG51bGw7XG4gIH1cbn07XG4iLCJcbi8qKlxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBkZXByZWNhdGU7XG5cbi8qKlxuICogTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbiAqIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4gKlxuICogSWYgYGxvY2FsU3RvcmFnZS5ub0RlcHJlY2F0aW9uID0gdHJ1ZWAgaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG4gKlxuICogSWYgYGxvY2FsU3RvcmFnZS50aHJvd0RlcHJlY2F0aW9uID0gdHJ1ZWAgaXMgc2V0LCB0aGVuIGRlcHJlY2F0ZWQgZnVuY3Rpb25zXG4gKiB3aWxsIHRocm93IGFuIEVycm9yIHdoZW4gaW52b2tlZC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLnRyYWNlRGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gZGVwcmVjYXRlZCBmdW5jdGlvbnNcbiAqIHdpbGwgaW52b2tlIGBjb25zb2xlLnRyYWNlKClgIGluc3RlYWQgb2YgYGNvbnNvbGUuZXJyb3IoKWAuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gLSB0aGUgZnVuY3Rpb24gdG8gZGVwcmVjYXRlXG4gKiBAcGFyYW0ge1N0cmluZ30gbXNnIC0gdGhlIHN0cmluZyB0byBwcmludCB0byB0aGUgY29uc29sZSB3aGVuIGBmbmAgaXMgaW52b2tlZFxuICogQHJldHVybnMge0Z1bmN0aW9ufSBhIG5ldyBcImRlcHJlY2F0ZWRcIiB2ZXJzaW9uIG9mIGBmbmBcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVwcmVjYXRlIChmbiwgbXNnKSB7XG4gIGlmIChjb25maWcoJ25vRGVwcmVjYXRpb24nKSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKGNvbmZpZygndGhyb3dEZXByZWNhdGlvbicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChjb25maWcoJ3RyYWNlRGVwcmVjYXRpb24nKSkge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLndhcm4obXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGBsb2NhbFN0b3JhZ2VgIGZvciBib29sZWFuIHZhbHVlcyBmb3IgdGhlIGdpdmVuIGBuYW1lYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybnMge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBjb25maWcgKG5hbWUpIHtcbiAgLy8gYWNjZXNzaW5nIGdsb2JhbC5sb2NhbFN0b3JhZ2UgY2FuIHRyaWdnZXIgYSBET01FeGNlcHRpb24gaW4gc2FuZGJveGVkIGlmcmFtZXNcbiAgdHJ5IHtcbiAgICBpZiAoIWdsb2JhbC5sb2NhbFN0b3JhZ2UpIHJldHVybiBmYWxzZTtcbiAgfSBjYXRjaCAoXykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdmFsID0gZ2xvYmFsLmxvY2FsU3RvcmFnZVtuYW1lXTtcbiAgaWYgKG51bGwgPT0gdmFsKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBTdHJpbmcodmFsKS50b0xvd2VyQ2FzZSgpID09PSAndHJ1ZSc7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5mdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgdmFyIHRhcmdldCA9IHt9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldXG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldFxufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcIm5hbWVcIjogXCJwcmlzbWljLmlvXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJKYXZhU2NyaXB0IGRldmVsb3BtZW50IGtpdCBmb3IgcHJpc21pYy5pb1wiLFxuICBcImxpY2Vuc2VcIjogXCJBcGFjaGUtMi4wXCIsXG4gIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL3ByaXNtaWNpby9qYXZhc2NyaXB0LWtpdFwiLFxuICBcImtleXdvcmRzXCI6IFtcbiAgICBcInByaXNtaWNcIixcbiAgICBcInByaXNtaWMuaW9cIixcbiAgICBcImNtc1wiLFxuICAgIFwiY29udGVudFwiLFxuICAgIFwiYXBpXCJcbiAgXSxcbiAgXCJ2ZXJzaW9uXCI6IFwiMi4wLjBcIixcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYmFiZWwtcHJlc2V0LWVzMjAxNVwiOiBcIl42LjMuMTNcIixcbiAgICBcImJhYmVsaWZ5XCI6IFwiXjcuMi4wXCIsXG4gICAgXCJicm93c2VyaWZ5XCI6IFwiXjEyLjAuMVwiLFxuICAgIFwiY2hhaVwiOiBcIipcIixcbiAgICBcImNvZGVjbGltYXRlLXRlc3QtcmVwb3J0ZXJcIjogXCJ+MC4wLjRcIixcbiAgICBcImd1bHBcIjogXCJ+My45LjBcIixcbiAgICBcImd1bHAtZ2gtcGFnZXNcIjogXCJ+MC41LjBcIixcbiAgICBcImd1bHAtZ2lzdFwiOiBcIn4xLjAuM1wiLFxuICAgIFwiZ3VscC1qc2RvY1wiOiBcIn4wLjEuNFwiLFxuICAgIFwiZ3VscC1qc2hpbnRcIjogXCJ+MS4xMS4yXCIsXG4gICAgXCJndWxwLW1vY2hhXCI6IFwiXjIuMi4wXCIsXG4gICAgXCJndWxwLW1vY2hhLXBoYW50b21qc1wiOiBcImdpdDovL2dpdGh1Yi5jb20vZXJ3YW4vZ3VscC1tb2NoYS1waGFudG9tanMuZ2l0I3BoYW50b21qczE5OFwiLFxuICAgIFwiZ3VscC1zb3VyY2VtYXBzXCI6IFwiXjEuNi4wXCIsXG4gICAgXCJndWxwLXVnbGlmeVwiOiBcIn4xLjIuMFwiLFxuICAgIFwiZ3VscC11dGlsXCI6IFwifjMuMC42XCIsXG4gICAgXCJtb2NoYVwiOiBcIipcIixcbiAgICBcInNvdXJjZS1tYXAtc3VwcG9ydFwiOiBcIl4wLjQuMFwiLFxuICAgIFwidmlueWwtYnVmZmVyXCI6IFwiXjEuMC4wXCIsXG4gICAgXCJ2aW55bC1zb3VyY2Utc3RyZWFtXCI6IFwiXjEuMS4wXCJcbiAgfSxcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImh0dHA6Ly9naXRodWIuY29tL3ByaXNtaWNpby9qYXZhc2NyaXB0LWtpdC5naXRcIlxuICB9LFxuICBcIm1haW5cIjogXCJkaXN0L3ByaXNtaWMuaW8ubWluLmpzXCIsXG4gIFwic2NyaXB0c1wiOiB7XG4gICAgXCJ0ZXN0XCI6IFwiZ3VscCB0ZXN0XCJcbiAgfVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBleHBlcmltZW50cyA9IHJlcXVpcmUoJy4vZXhwZXJpbWVudHMnKSxcbiAgICBQcmVkaWNhdGVzID0gcmVxdWlyZSgnLi9wcmVkaWNhdGVzJyksXG4gICAgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyksXG4gICAgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKSxcbiAgICBBcGlDYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUuanMnKSxcbiAgICBkb2N1bWVudHMgPSByZXF1aXJlKCcuL2RvY3VtZW50cycpO1xuXG52YXIgRG9jdW1lbnQgPSBkb2N1bWVudHMuRG9jdW1lbnQsXG4gICAgR3JvdXBEb2MgPSBkb2N1bWVudHMuR3JvdXBEb2MsXG4gICAgRXhwZXJpbWVudHMgPSBleHBlcmltZW50cy5FeHBlcmltZW50cztcblxuXG4vKipcbiAqIEluaXRpYWxpc2F0aW9uIG9mIHRoZSBBUEkgb2JqZWN0LlxuICogVGhpcyBpcyBmb3IgaW50ZXJuYWwgdXNlLCBmcm9tIG91dHNpZGUgdGhpcyBraXQsIHlvdSBzaG91bGQgY2FsbCBQcmlzbWljLkFwaSgpXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBBcGkodXJsLCBhY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKSB7XG4gIHRoaXMudXJsID0gdXJsICsgKGFjY2Vzc1Rva2VuID8gKHVybC5pbmRleE9mKCc/JykgPiAtMSA/ICcmJyA6ICc/JykgKyAnYWNjZXNzX3Rva2VuPScgKyBhY2Nlc3NUb2tlbiA6ICcnKTtcbiAgdGhpcy5hY2Nlc3NUb2tlbiA9IGFjY2Vzc1Rva2VuO1xuICB0aGlzLmFwaUNhY2hlID0gbWF5YmVBcGlDYWNoZSB8fCBnbG9iYWxDYWNoZSgpO1xuICB0aGlzLnJlcXVlc3RIYW5kbGVyID0gbWF5YmVSZXF1ZXN0SGFuZGxlciB8fCBVdGlscy5yZXF1ZXN0KCk7XG4gIHRoaXMuYXBpQ2FjaGVLZXkgPSB0aGlzLnVybCArICh0aGlzLmFjY2Vzc1Rva2VuID8gKCcjJyArIHRoaXMuYWNjZXNzVG9rZW4pIDogJycpO1xuICB0aGlzLmFwaURhdGFUVEwgPSBtYXliZUFwaURhdGFUVEwgfHwgNTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFRoZSBraXQncyBtYWluIGVudHJ5IHBvaW50OyBpbml0aWFsaXplIHlvdXIgQVBJIGxpa2UgdGhpczogUHJpc21pYy5BcGkodXJsLCBjYWxsYmFjaywgYWNjZXNzVG9rZW4sIG1heWJlUmVxdWVzdEhhbmRsZXIpXG4gKlxuICogQGdsb2JhbFxuICogQGFsaWFzIEFwaVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIG1hbmRhdG9yeSBVUkwgb2YgdGhlIHByaXNtaWMuaW8gQVBJIGVuZHBvaW50IChsaWtlOiBodHRwczovL2xlc2Jvbm5lc2Nob3Nlcy5wcmlzbWljLmlvL2FwaSlcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIEFQSSB3YXMgcmV0cmlldmVkLCB3aGljaCB3aWxsIGJlIGNhbGxlZCB3aXRoIHR3byBwYXJhbWV0ZXJzOiBhIHBvdGVudGlhbCBlcnJvciBvYmplY3QgYW5kIHRoZSBBUEkgb2JqZWN0XG4gKiBAcGFyYW0ge3N0cmluZ30gbWF5YmVBY2Nlc3NUb2tlbiAtIFRoZSBhY2Nlc3NUb2tlbiBmb3IgYW4gT0F1dGgyIGNvbm5lY3Rpb25cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IG1heWJlUmVxdWVzdEhhbmRsZXIgLSBFbnZpcm9ubWVudCBzcGVjaWZpYyBIVFRQIHJlcXVlc3QgaGFuZGxpbmcgZnVuY3Rpb25cbiAqIEBwYXJhbSB7b2JqZWN0fSBtYXliZUFwaUNhY2hlIC0gQSBjYWNoZSBvYmplY3Qgd2l0aCBnZXQvc2V0IGZ1bmN0aW9ucyBmb3IgY2FjaGluZyBBUEkgcmVzcG9uc2VzXG4gKiBAcGFyYW0ge2ludH0gbWF5YmVBcGlEYXRhVFRMIC0gSG93IGxvbmcgKGluIHNlY29uZHMpIHRvIGNhY2hlIGRhdGEgdXNlZCBieSB0aGUgY2xpZW50IHRvIG1ha2UgY2FsbHMgKGUuZy4gcmVmcykuIERlZmF1bHRzIHRvIDUgc2Vjb25kc1xuICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICovXG5mdW5jdGlvbiBnZXRBcGkodXJsLCBjYWxsYmFjaywgbWF5YmVBY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKSB7XG4gIHZhciBhcGkgPSBuZXcgQXBpKHVybCwgbWF5YmVBY2Nlc3NUb2tlbiwgbWF5YmVSZXF1ZXN0SGFuZGxlciwgbWF5YmVBcGlDYWNoZSwgbWF5YmVBcGlEYXRhVFRMKTtcbiAgLy9Vc2UgY2FjaGVkIGFwaSBkYXRhIGlmIGF2YWlsYWJsZVxuICBhcGkuZ2V0KGZ1bmN0aW9uIChlcnIsIGRhdGEpIHtcbiAgICBpZiAoY2FsbGJhY2sgJiYgZXJyKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkYXRhKSB7XG4gICAgICBhcGkuZGF0YSA9IGRhdGE7XG4gICAgICBhcGkuYm9va21hcmtzID0gZGF0YS5ib29rbWFya3M7XG4gICAgICBhcGkuZXhwZXJpbWVudHMgPSBuZXcgRXhwZXJpbWVudHMoZGF0YS5leHBlcmltZW50cyk7XG4gICAgfVxuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhudWxsLCBhcGkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGFwaTtcbn07XG5cblxuQXBpLnByb3RvdHlwZSA9IHtcblxuICAvLyBQcmVkaWNhdGVzXG4gIEFUOiBcImF0XCIsXG4gIEFOWTogXCJhbnlcIixcbiAgU0lNSUxBUjogXCJzaW1pbGFyXCIsXG4gIEZVTExURVhUOiBcImZ1bGx0ZXh0XCIsXG4gIE5VTUJFUjoge1xuICAgIEdUOiBcIm51bWJlci5ndFwiLFxuICAgIExUOiBcIm51bWJlci5sdFwiXG4gIH0sXG4gIERBVEU6IHtcbiAgICAvLyBPdGhlciBkYXRlIG9wZXJhdG9ycyBhcmUgYXZhaWxhYmxlOiBzZWUgdGhlIGRvY3VtZW50YXRpb24uXG4gICAgQUZURVI6IFwiZGF0ZS5hZnRlclwiLFxuICAgIEJFRk9SRTogXCJkYXRlLmJlZm9yZVwiLFxuICAgIEJFVFdFRU46IFwiZGF0ZS5iZXR3ZWVuXCJcbiAgfSxcblxuICAvLyBGcmFnbWVudDogdXNhYmxlIGFzIHRoZSBzZWNvbmQgZWxlbWVudCBvZiBhIHF1ZXJ5IGFycmF5IG9uIG1vc3QgcHJlZGljYXRlcyAoZXhjZXB0IFNJTUlMQVIpLlxuICAvLyBZb3UgY2FuIGFsc28gdXNlIFwibXkuKlwiIGZvciB5b3VyIGN1c3RvbSBmaWVsZHMuXG4gIERPQ1VNRU5UOiB7XG4gICAgSUQ6IFwiZG9jdW1lbnQuaWRcIixcbiAgICBUWVBFOiBcImRvY3VtZW50LnR5cGVcIixcbiAgICBUQUdTOiBcImRvY3VtZW50LnRhZ3NcIlxuICB9LFxuXG4gIGRhdGE6IG51bGwsXG5cbiAgLyoqXG4gICAqIEZldGNoZXMgZGF0YSB1c2VkIHRvIGNvbnN0cnVjdCB0aGUgYXBpIGNsaWVudCwgZnJvbSBjYWNoZSBpZiBpdCdzXG4gICAqIHByZXNlbnQsIG90aGVyd2lzZSBmcm9tIGNhbGxpbmcgdGhlIHByaXNtaWMgYXBpIGVuZHBvaW50ICh3aGljaCBpc1xuICAgKiB0aGVuIGNhY2hlZCkuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gcmVjZWl2ZSB0aGUgZGF0YVxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB0aGlzLmFwaUNhY2hlS2V5O1xuXG4gICAgdGhpcy5hcGlDYWNoZS5nZXQoY2FjaGVLZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XG4gICAgICBpZiAoZXJyIHx8IHZhbHVlKSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgdmFsdWUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHNlbGYucmVxdWVzdEhhbmRsZXIoc2VsZi51cmwsIGZ1bmN0aW9uKGVyciwgZGF0YSwgeGhyLCB0dGwpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCwgeGhyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcGFyc2VkID0gc2VsZi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHRsID0gdHRsIHx8IHNlbGYuYXBpRGF0YVRUTDtcblxuICAgICAgICBzZWxmLmFwaUNhY2hlLnNldChjYWNoZUtleSwgcGFyc2VkLCB0dGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIsIHBhcnNlZCwgeGhyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogQ2xlYW5zIGFwaSBkYXRhIGZyb20gdGhlIGNhY2hlIGFuZCBmZXRjaGVzIGFuIHVwIHRvIGRhdGUgY29weS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgZGF0YSBoYXMgYmVlbiByZWZyZXNoZWRcbiAgICovXG4gIHJlZnJlc2g6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY2FjaGVLZXkgPSB0aGlzLmFwaUNhY2hlS2V5O1xuXG4gICAgdGhpcy5hcGlDYWNoZS5yZW1vdmUoY2FjaGVLZXksIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChjYWxsYmFjayAmJiBlcnIpIHsgY2FsbGJhY2soZXJyKTsgcmV0dXJuOyB9XG4gICAgICBpZiAoIWNhbGxiYWNrICYmIGVycikgeyB0aHJvdyBlcnI7IH1cblxuICAgICAgc2VsZi5nZXQoZnVuY3Rpb24gKGVyciwgZGF0YSwgeGhyKSB7XG4gICAgICAgIGlmIChjYWxsYmFjayAmJiBlcnIpIHsgY2FsbGJhY2soZXJyKTsgcmV0dXJuOyB9XG4gICAgICAgIGlmICghY2FsbGJhY2sgJiYgZXJyKSB7IHRocm93IGVycjsgfVxuXG4gICAgICAgIHNlbGYuZGF0YSA9IGRhdGE7XG4gICAgICAgIHNlbGYuYm9va21hcmtzID0gZGF0YS5ib29rbWFya3M7XG4gICAgICAgIHNlbGYuZXhwZXJpbWVudHMgPSBuZXcgRXhwZXJpbWVudHMoZGF0YS5leHBlcmltZW50cyk7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7IGNhbGxiYWNrKCk7IH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBQYXJzZXMgYW5kIHJldHVybnMgdGhlIC9hcGkgZG9jdW1lbnQuXG4gICAqIFRoaXMgaXMgZm9yIGludGVybmFsIHVzZSwgZnJvbSBvdXRzaWRlIHRoaXMga2l0LCB5b3Ugc2hvdWxkIGNhbGwgUHJpc21pYy5BcGkoKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZGF0YSAtIFRoZSBKU09OIGRvY3VtZW50IHJlc3BvbmRlZCBvbiB0aGUgQVBJJ3MgZW5kcG9pbnRcbiAgICogQHJldHVybnMge0FwaX0gLSBUaGUgQXBpIG9iamVjdCB0aGF0IGNhbiBiZSBtYW5pcHVsYXRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcGFyc2U6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgcmVmcyxcbiAgICAgICAgbWFzdGVyLFxuICAgICAgICBmb3JtcyA9IHt9LFxuICAgICAgICBmb3JtLFxuICAgICAgICB0eXBlcyxcbiAgICAgICAgdGFncyxcbiAgICAgICAgZixcbiAgICAgICAgaTtcblxuICAgIC8vIFBhcnNlIHRoZSBmb3Jtc1xuICAgIGZvciAoaSBpbiBkYXRhLmZvcm1zKSB7XG4gICAgICBpZiAoZGF0YS5mb3Jtcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBmID0gZGF0YS5mb3Jtc1tpXTtcblxuICAgICAgICBpZih0aGlzLmFjY2Vzc1Rva2VuKSB7XG4gICAgICAgICAgZi5maWVsZHNbJ2FjY2Vzc190b2tlbiddID0ge307XG4gICAgICAgICAgZi5maWVsZHNbJ2FjY2Vzc190b2tlbiddWyd0eXBlJ10gPSAnc3RyaW5nJztcbiAgICAgICAgICBmLmZpZWxkc1snYWNjZXNzX3Rva2VuJ11bJ2RlZmF1bHQnXSA9IHRoaXMuYWNjZXNzVG9rZW47XG4gICAgICAgIH1cblxuICAgICAgICBmb3JtID0gbmV3IEZvcm0oXG4gICAgICAgICAgZi5uYW1lLFxuICAgICAgICAgIGYuZmllbGRzLFxuICAgICAgICAgIGYuZm9ybV9tZXRob2QsXG4gICAgICAgICAgZi5yZWwsXG4gICAgICAgICAgZi5lbmN0eXBlLFxuICAgICAgICAgIGYuYWN0aW9uXG4gICAgICAgICk7XG5cbiAgICAgICAgZm9ybXNbaV0gPSBmb3JtO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlZnMgPSBkYXRhLnJlZnMubWFwKGZ1bmN0aW9uIChyKSB7XG4gICAgICByZXR1cm4gbmV3IFJlZihcbiAgICAgICAgci5yZWYsXG4gICAgICAgIHIubGFiZWwsXG4gICAgICAgIHIuaXNNYXN0ZXJSZWYsXG4gICAgICAgIHIuc2NoZWR1bGVkQXQsXG4gICAgICAgIHIuaWRcbiAgICAgICk7XG4gICAgfSkgfHwgW107XG5cbiAgICBtYXN0ZXIgPSByZWZzLmZpbHRlcihmdW5jdGlvbiAocikge1xuICAgICAgcmV0dXJuIHIuaXNNYXN0ZXIgPT09IHRydWU7XG4gICAgfSk7XG5cbiAgICB0eXBlcyA9IGRhdGEudHlwZXM7XG5cbiAgICB0YWdzID0gZGF0YS50YWdzO1xuXG4gICAgaWYgKG1hc3Rlci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IChcIk5vIG1hc3RlciByZWYuXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBib29rbWFya3M6IGRhdGEuYm9va21hcmtzIHx8IHt9LFxuICAgICAgcmVmczogcmVmcyxcbiAgICAgIGZvcm1zOiBmb3JtcyxcbiAgICAgIG1hc3RlcjogbWFzdGVyWzBdLFxuICAgICAgdHlwZXM6IHR5cGVzLFxuICAgICAgdGFnczogdGFncyxcbiAgICAgIGV4cGVyaW1lbnRzOiBkYXRhLmV4cGVyaW1lbnRzLFxuICAgICAgb2F1dGhJbml0aWF0ZTogZGF0YVsnb2F1dGhfaW5pdGlhdGUnXSxcbiAgICAgIG9hdXRoVG9rZW46IGRhdGFbJ29hdXRoX3Rva2VuJ11cbiAgICB9O1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBmb3JtKCkgbm93XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtSWQgLSBUaGUgaWQgb2YgYSBmb3JtLCBsaWtlIFwiZXZlcnl0aGluZ1wiLCBvciBcInByb2R1Y3RzXCJcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gdGhlIFNlYXJjaEZvcm0gdGhhdCBjYW4gYmUgdXNlZC5cbiAgICovXG4gIGZvcm1zOiBmdW5jdGlvbihmb3JtSWQpIHtcbiAgICByZXR1cm4gdGhpcy5mb3JtKGZvcm1JZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB1c2VhYmxlIGZvcm0gZnJvbSBpdHMgaWQsIGFzIGRlc2NyaWJlZCBpbiB0aGUgUkVTVGZ1bCBkZXNjcmlwdGlvbiBvZiB0aGUgQVBJLlxuICAgKiBGb3IgaW5zdGFuY2U6IGFwaS5mb3JtKFwiZXZlcnl0aGluZ1wiKSB3b3JrcyBvbiBldmVyeSByZXBvc2l0b3J5IChhcyBcImV2ZXJ5dGhpbmdcIiBleGlzdHMgYnkgZGVmYXVsdClcbiAgICogWW91IGNhbiB0aGVuIGNoYWluIHRoZSBjYWxsczogYXBpLmZvcm0oXCJldmVyeXRoaW5nXCIpLnF1ZXJ5KCdbWzpkID0gYXQoZG9jdW1lbnQuaWQsIFwiVWtMMGdNdXZ6WVVBTkNwZlwiKV1dJykucmVmKHJlZikuc3VibWl0KClcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZvcm1JZCAtIFRoZSBpZCBvZiBhIGZvcm0sIGxpa2UgXCJldmVyeXRoaW5nXCIsIG9yIFwicHJvZHVjdHNcIlxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSB0aGUgU2VhcmNoRm9ybSB0aGF0IGNhbiBiZSB1c2VkLlxuICAgKi9cbiAgZm9ybTogZnVuY3Rpb24oZm9ybUlkKSB7XG4gICAgdmFyIGZvcm0gPSB0aGlzLmRhdGEuZm9ybXNbZm9ybUlkXTtcbiAgICBpZihmb3JtKSB7XG4gICAgICByZXR1cm4gbmV3IFNlYXJjaEZvcm0odGhpcywgZm9ybSwge30pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVGhlIElEIG9mIHRoZSBtYXN0ZXIgcmVmIG9uIHRoaXMgcHJpc21pYy5pbyBBUEkuXG4gICAqIERvIG5vdCB1c2UgbGlrZSB0aGlzOiBzZWFyY2hGb3JtLnJlZihhcGkubWFzdGVyKCkpLlxuICAgKiBJbnN0ZWFkLCBzZXQgeW91ciByZWYgb25jZSBpbiBhIHZhcmlhYmxlLCBhbmQgY2FsbCBpdCB3aGVuIHlvdSBuZWVkIGl0OyB0aGlzIHdpbGwgYWxsb3cgdG8gY2hhbmdlIHRoZSByZWYgeW91J3JlIHZpZXdpbmcgZWFzaWx5IGZvciB5b3VyIGVudGlyZSBwYWdlLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgbWFzdGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLm1hc3Rlci5yZWY7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHJlZiBJRCBmb3IgYSBnaXZlbiByZWYncyBsYWJlbC5cbiAgICogRG8gbm90IHVzZSBsaWtlIHRoaXM6IHNlYXJjaEZvcm0ucmVmKGFwaS5yZWYoXCJGdXR1cmUgcmVsZWFzZSBsYWJlbFwiKSkuXG4gICAqIEluc3RlYWQsIHNldCB5b3VyIHJlZiBvbmNlIGluIGEgdmFyaWFibGUsIGFuZCBjYWxsIGl0IHdoZW4geW91IG5lZWQgaXQ7IHRoaXMgd2lsbCBhbGxvdyB0byBjaGFuZ2UgdGhlIHJlZiB5b3UncmUgdmlld2luZyBlYXNpbHkgZm9yIHlvdXIgZW50aXJlIHBhZ2UuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCAtIHRoZSByZWYncyBsYWJlbFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgcmVmOiBmdW5jdGlvbihsYWJlbCkge1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuZGF0YS5yZWZzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZih0aGlzLmRhdGEucmVmc1tpXS5sYWJlbCA9PSBsYWJlbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLnJlZnNbaV0ucmVmO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgZXhwZXJpbWVudCwgb3IgbnVsbFxuICAgKiBAcmV0dXJucyB7RXhwZXJpbWVudH1cbiAgICovXG4gIGN1cnJlbnRFeHBlcmltZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5leHBlcmltZW50cy5jdXJyZW50KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSByZXBvc2l0b3J5XG4gICAqIEBwYXJhbSB7c3RyaW5nfGFycmF5fFByZWRpY2F0ZX0gdGhlIHF1ZXJ5IGl0c2VsZlxuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBxdWVyeTogZnVuY3Rpb24ocSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgZm9ybSA9IHRoaXMuZm9ybSgnZXZlcnl0aGluZycpO1xuICAgIGZvciAodmFyIGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBmb3JtID0gZm9ybS5zZXQoa2V5LCBvcHRpb25zW2tleV0pO1xuICAgIH1cbiAgICBpZiAoIW9wdGlvbnNbJ3JlZiddKSB7XG4gICAgICBmb3JtID0gZm9ybS5yZWYodGhpcy5tYXN0ZXIoKSk7XG4gICAgfVxuICAgIHJldHVybiBmb3JtLnF1ZXJ5KHEpLnN1Ym1pdChjYWxsYmFjayk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiBpZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgZ2V0QnlJRDogZnVuY3Rpb24oaWQsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucXVlcnkoUHJlZGljYXRlcy5hdCgnZG9jdW1lbnQuaWQnLCBpZCksIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5yZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCByZXNwb25zZS5yZXN1bHRzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIG11bHRpcGxlIGRvY3VtZW50cyBmcm9tIGFuIGFycmF5IG9mIGlkXG4gICAqIEBwYXJhbSB7YXJyYXl9IGlkc1xuICAgKiBAcGFyYW0ge29iamVjdH0gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UpXG4gICAqL1xuICBnZXRCeUlEczogZnVuY3Rpb24oaWRzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnF1ZXJ5KFsnaW4nLCAnZG9jdW1lbnQuaWQnLCBpZHNdLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiB1aWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgdGhlIGN1c3RvbSB0eXBlIG9mIHRoZSBkb2N1bWVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdWlkXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBhZGRpdGlvbmFsIHBhcmFtZXRlcnNcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2soZXJyLCByZXNwb25zZSlcbiAgICovXG4gIGdldEJ5VUlEOiBmdW5jdGlvbih0eXBlLCB1aWQsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucXVlcnkoUHJlZGljYXRlcy5hdCgnbXkuJyt0eXBlKycudWlkJywgdWlkKSwgb3B0aW9ucywgZnVuY3Rpb24oZXJyLCByZXNwb25zZSkge1xuICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3BvbnNlLnJlc3VsdHNbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIHVpZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSB0aGUgY3VzdG9tIHR5cGUgb2YgdGhlIGRvY3VtZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1aWRcbiAgICogQHBhcmFtIHtvYmplY3R9IGFkZGl0aW9uYWwgcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayhlcnIsIHJlc3BvbnNlKVxuICAgKi9cbiAgZ2V0Qm9va21hcms6IGZ1bmN0aW9uKGJvb2ttYXJrLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHZhciBpZCA9IHRoaXMuYm9va21hcmtzW2Jvb2ttYXJrXTtcbiAgICBpZiAoaWQpIHtcbiAgICAgIHRoaXMuZ2V0QnlJZCh0aGlzLmJvb2ttYXJrc1tib29rbWFya10sIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2sobmV3IEVycm9yKFwiRXJyb3IgcmV0cmlldmluZyBib29rbWFya2VkIGlkXCIpKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgVVJMIHRvIGRpc3BsYXkgYSBnaXZlbiBwcmV2aWV3XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbiBhcyByZWNlaXZlZCBmcm9tIFByaXNtaWMgc2VydmVyIHRvIGlkZW50aWZ5IHRoZSBjb250ZW50IHRvIHByZXZpZXdcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyIHRoZSBsaW5rIHJlc29sdmVyIHRvIGJ1aWxkIFVSTCBmb3IgeW91ciBzaXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkZWZhdWx0VXJsIHRoZSBVUkwgdG8gZGVmYXVsdCB0byByZXR1cm4gaWYgdGhlIHByZXZpZXcgZG9lc24ndCBjb3JyZXNwb25kIHRvIGEgZG9jdW1lbnRcbiAgICogICAgICAgICAgICAgICAgKHVzdWFsbHkgdGhlIGhvbWUgcGFnZSBvZiB5b3VyIHNpdGUpXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIHRvIGdldCB0aGUgcmVzdWx0aW5nIFVSTFxuICAgKi9cbiAgcHJldmlld1Nlc3Npb246IGZ1bmN0aW9uKHRva2VuLCBsaW5rUmVzb2x2ZXIsIGRlZmF1bHRVcmwsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGFwaSA9IHRoaXM7XG4gICAgdmFyIFByZWRpY2F0ZXMgPSBQcmVkaWNhdGVzO1xuICAgIHRoaXMucmVxdWVzdEhhbmRsZXIodG9rZW4sIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCwgeGhyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3IgZnJvbSB0aGUgcmVxdWVzdFwiKTtcbiAgICAgICAgY2FsbGJhY2soZXJyLCBkZWZhdWx0VXJsLCB4aHIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgbWFpbkRvY3VtZW50SWQgPSByZXN1bHQubWFpbkRvY3VtZW50O1xuICAgICAgICBpZiAoIW1haW5Eb2N1bWVudElkKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGVmYXVsdFVybCwgeGhyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhcGkuZm9ybShcImV2ZXJ5dGhpbmdcIikucXVlcnkoUHJlZGljYXRlcy5hdChcImRvY3VtZW50LmlkXCIsIG1haW5Eb2N1bWVudElkKSkucmVmKHRva2VuKS5zdWJtaXQoZnVuY3Rpb24oZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGVmYXVsdFVybCwgeGhyKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBsaW5rUmVzb2x2ZXIocmVzcG9uc2UucmVzdWx0c1swXSksIHhocik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYXVnaHQgZSBcIiwgZSk7XG4gICAgICAgIGNhbGxiYWNrKGUsIGRlZmF1bHRVcmwsIHhocik7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZldGNoIGEgVVJMIGNvcnJlc3BvbmRpbmcgdG8gYSBxdWVyeSwgYW5kIHBhcnNlIHRoZSByZXNwb25zZSBhcyBhIFJlc3BvbnNlIG9iamVjdFxuICAgKi9cbiAgcmVxdWVzdDogZnVuY3Rpb24odXJsLCBjYWxsYmFjaykge1xuICAgIHZhciBhcGkgPSB0aGlzO1xuICAgIHZhciBjYWNoZUtleSA9IHVybCArICh0aGlzLmFjY2Vzc1Rva2VuID8gKCcjJyArIHRoaXMuYWNjZXNzVG9rZW4pIDogJycpO1xuICAgIHZhciBjYWNoZSA9IHRoaXMuYXBpQ2FjaGU7XG4gICAgY2FjaGUuZ2V0KGNhY2hlS2V5LCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xuICAgICAgaWYgKGVyciB8fCB2YWx1ZSkge1xuICAgICAgICBjYWxsYmFjayhlcnIsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXBpLnJlcXVlc3RIYW5kbGVyKHVybCwgZnVuY3Rpb24gKGVyciwgZG9jdW1lbnRzLCB4aHIsIHR0bCkge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsLCB4aHIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzdWx0cyA9IGRvY3VtZW50cy5yZXN1bHRzLm1hcChwYXJzZURvYyk7XG4gICAgICAgIHZhciByZXNwb25zZSA9IG5ldyBSZXNwb25zZShcbiAgICAgICAgICBkb2N1bWVudHMucGFnZSxcbiAgICAgICAgICBkb2N1bWVudHMucmVzdWx0c19wZXJfcGFnZSxcbiAgICAgICAgICBkb2N1bWVudHMucmVzdWx0c19zaXplLFxuICAgICAgICAgIGRvY3VtZW50cy50b3RhbF9yZXN1bHRzX3NpemUsXG4gICAgICAgICAgZG9jdW1lbnRzLnRvdGFsX3BhZ2VzLFxuICAgICAgICAgIGRvY3VtZW50cy5uZXh0X3BhZ2UsXG4gICAgICAgICAgZG9jdW1lbnRzLnByZXZfcGFnZSxcbiAgICAgICAgICByZXN1bHRzIHx8IFtdKTtcbiAgICAgICAgaWYgKHR0bCkge1xuICAgICAgICAgIGNhY2hlLnNldChjYWNoZUtleSwgcmVzcG9uc2UsIHR0bCwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyLCByZXNwb25zZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgc3VibWl0dGFibGUgUkVTVGZ1bCBmb3JtIGFzIGRlc2NyaWJlZCBvbiB0aGUgQVBJIGVuZHBvaW50IChhcyBwZXIgUkVTVGZ1bCBzdGFuZGFyZHMpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEZvcm0obmFtZSwgZmllbGRzLCBmb3JtX21ldGhvZCwgcmVsLCBlbmN0eXBlLCBhY3Rpb24pIHtcbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5maWVsZHMgPSBmaWVsZHM7XG4gIHRoaXMuZm9ybV9tZXRob2QgPSBmb3JtX21ldGhvZDtcbiAgdGhpcy5yZWwgPSByZWw7XG4gIHRoaXMuZW5jdHlwZSA9IGVuY3R5cGU7XG4gIHRoaXMuYWN0aW9uID0gYWN0aW9uO1xufVxuXG5Gb3JtLnByb3RvdHlwZSA9IHt9O1xuXG4vKipcbiAqIFBhcnNlIGpzb24gYXMgYSBkb2N1bWVudFxuICpcbiAqIEByZXR1cm5zIHtEb2N1bWVudH1cbiAqL1xudmFyIHBhcnNlRG9jID0gZnVuY3Rpb24oanNvbikge1xuICB2YXIgZnJhZ21lbnRzID0ge307XG4gIGZvcih2YXIgZmllbGQgaW4ganNvbi5kYXRhW2pzb24udHlwZV0pIHtcbiAgICBmcmFnbWVudHNbanNvbi50eXBlICsgJy4nICsgZmllbGRdID0ganNvbi5kYXRhW2pzb24udHlwZV1bZmllbGRdO1xuICB9XG5cbiAgdmFyIHNsdWdzID0gW107XG4gIGlmIChqc29uLnNsdWdzICE9PSB1bmRlZmluZWQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGpzb24uc2x1Z3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNsdWdzLnB1c2goZGVjb2RlVVJJQ29tcG9uZW50KGpzb24uc2x1Z3NbaV0pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IERvY3VtZW50KFxuICAgIGpzb24uaWQsXG4gICAganNvbi51aWQgfHwgbnVsbCxcbiAgICBqc29uLnR5cGUsXG4gICAganNvbi5ocmVmLFxuICAgIGpzb24udGFncyxcbiAgICBzbHVncyxcbiAgICBmcmFnbWVudHNcbiAgKTtcbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBTZWFyY2hGb3JtIG9iamVjdC4gVG8gY3JlYXRlIFNlYXJjaEZvcm0gb2JqZWN0cyB0aGF0IGFyZSBhbGxvd2VkIGluIHRoZSBBUEksIHBsZWFzZSB1c2UgdGhlIEFQSS5mb3JtKCkgbWV0aG9kLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgU2VhcmNoRm9ybVxuICovXG5mdW5jdGlvbiBTZWFyY2hGb3JtKGFwaSwgZm9ybSwgZGF0YSkge1xuICB0aGlzLmFwaSA9IGFwaTtcbiAgdGhpcy5mb3JtID0gZm9ybTtcbiAgdGhpcy5kYXRhID0gZGF0YSB8fCB7fTtcblxuICBmb3IodmFyIGZpZWxkIGluIGZvcm0uZmllbGRzKSB7XG4gICAgaWYoZm9ybS5maWVsZHNbZmllbGRdWydkZWZhdWx0J10pIHtcbiAgICAgIHRoaXMuZGF0YVtmaWVsZF0gPSBbZm9ybS5maWVsZHNbZmllbGRdWydkZWZhdWx0J11dO1xuICAgIH1cbiAgfVxufVxuXG5TZWFyY2hGb3JtLnByb3RvdHlwZSA9IHtcblxuICAvKipcbiAgICogU2V0IGFuIEFQSSBjYWxsIHBhcmFtZXRlci4gVGhpcyB3aWxsIG9ubHkgd29yayBpZiBmaWVsZCBpcyBhIHZhbGlkIGZpZWxkIG9mIHRoZVxuICAgKiBSRVNUZnVsIGZvcm0gaW4gdGhlIGZpcnN0IHBsYWNlIChhcyBkZXNjcmliZWQgaW4gdGhlIC9hcGkgZG9jdW1lbnQpOyBvdGhlcndpc2UsXG4gICAqIGFuIFwiVW5rbm93biBmaWVsZFwiIGVycm9yIGlzIHRocm93bi5cbiAgICogUGxlYXNlIHByZWZlciB1c2luZyBkZWRpY2F0ZWQgbWV0aG9kcyBsaWtlIHF1ZXJ5KCksIG9yZGVyaW5ncygpLCAuLi5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkIC0gVGhlIG5hbWUgb2YgdGhlIGZpZWxkIHRvIHNldFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBUaGUgdmFsdWUgdGhhdCBnZXRzIGFzc2lnbmVkXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgc2V0OiBmdW5jdGlvbihmaWVsZCwgdmFsdWUpIHtcbiAgICB2YXIgZmllbGREZXNjID0gdGhpcy5mb3JtLmZpZWxkc1tmaWVsZF07XG4gICAgaWYoIWZpZWxkRGVzYykgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBmaWVsZCBcIiArIGZpZWxkKTtcbiAgICB2YXIgdmFsdWVzPSB0aGlzLmRhdGFbZmllbGRdIHx8IFtdO1xuICAgIGlmKHZhbHVlID09PSAnJyB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyB3ZSBtdXN0IGNvbXBhcmUgdmFsdWUgdG8gbnVsbCBiZWNhdXNlIHdlIHdhbnQgdG8gYWxsb3cgMFxuICAgICAgdmFsdWUgPSBudWxsO1xuICAgIH1cbiAgICBpZihmaWVsZERlc2MubXVsdGlwbGUpIHtcbiAgICAgIGlmICh2YWx1ZSkgdmFsdWVzLnB1c2godmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZXMgPSB2YWx1ZSAmJiBbdmFsdWVdO1xuICAgIH1cbiAgICB0aGlzLmRhdGFbZmllbGRdID0gdmFsdWVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIGEgcmVmIHRvIHF1ZXJ5IG9uIGZvciB0aGlzIFNlYXJjaEZvcm0uIFRoaXMgaXMgYSBtYW5kYXRvcnlcbiAgICogbWV0aG9kIHRvIGNhbGwgYmVmb3JlIGNhbGxpbmcgc3VibWl0KCksIGFuZCBhcGkuZm9ybSgnZXZlcnl0aGluZycpLnN1Ym1pdCgpXG4gICAqIHdpbGwgbm90IHdvcmsuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVmfSByZWYgLSBUaGUgUmVmIG9iamVjdCBkZWZpbmluZyB0aGUgcmVmIHRvIHF1ZXJ5XG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgcmVmOiBmdW5jdGlvbihyZWYpIHtcbiAgICByZXR1cm4gdGhpcy5zZXQoXCJyZWZcIiwgcmVmKTtcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyBhIHByZWRpY2F0ZS1iYXNlZCBxdWVyeSBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIHdoZXJlIHlvdVxuICAgKiBwYXN0ZSB3aGF0IHlvdSBjb21wb3NlIGluIHlvdXIgcHJpc21pYy5pbyBBUEkgYnJvd3Nlci5cbiAgICpcbiAgICogQGV4YW1wbGUgZm9ybS5xdWVyeShQcmlzbWljLlByZWRpY2F0ZXMuYXQoXCJkb2N1bWVudC5pZFwiLCBcImZvb2JhclwiKSlcbiAgICogQHBhcmFtIHtzdHJpbmd8Li4uYXJyYXl9IHF1ZXJ5IC0gRWl0aGVyIGEgcXVlcnkgYXMgYSBzdHJpbmcsIG9yIGFzIG1hbnkgcHJlZGljYXRlcyBhcyB5b3Ugd2FudC4gU2VlIFByaXNtaWMuUHJlZGljYXRlcy5cbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBxdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICBpZiAodHlwZW9mIHF1ZXJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHRoaXMuc2V0KFwicVwiLCBxdWVyeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcmVkaWNhdGVzO1xuICAgICAgaWYgKHF1ZXJ5LmNvbnN0cnVjdG9yID09PSBBcnJheSAmJiBxdWVyeS5sZW5ndGggPiAwICYmIHF1ZXJ5WzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICBwcmVkaWNhdGVzID0gcXVlcnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcmVkaWNhdGVzID0gW10uc2xpY2UuYXBwbHkoYXJndW1lbnRzKTsgLy8gQ29udmVydCB0byBhIHJlYWwgSlMgYXJyYXlcbiAgICAgIH1cbiAgICAgIHZhciBzdHJpbmdRdWVyaWVzID0gW107XG4gICAgICBwcmVkaWNhdGVzLmZvckVhY2goZnVuY3Rpb24gKHByZWRpY2F0ZSkge1xuICAgICAgICB2YXIgZmlyc3RBcmcgPSAocHJlZGljYXRlWzFdLmluZGV4T2YoXCJteS5cIikgPT09IDAgfHwgcHJlZGljYXRlWzFdLmluZGV4T2YoXCJkb2N1bWVudFwiKSA9PT0gMCkgPyBwcmVkaWNhdGVbMV1cbiAgICAgICAgICAgICAgOiAnXCInICsgcHJlZGljYXRlWzFdICsgJ1wiJztcbiAgICAgICAgc3RyaW5nUXVlcmllcy5wdXNoKFwiWzpkID0gXCIgKyBwcmVkaWNhdGVbMF0gKyBcIihcIiArIGZpcnN0QXJnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIChwcmVkaWNhdGUubGVuZ3RoID4gMiA/IFwiLCBcIiA6IFwiXCIpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWRpY2F0ZS5zbGljZSgyKS5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnXCInICsgcCArICdcIic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJbXCIgKyBwLm1hcChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1wiJyArIGUgKyAnXCInO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuam9pbignLCcpICsgXCJdXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuZ2V0VGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKCkgKyBcIildXCIpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5xdWVyeShcIltcIiArIHN0cmluZ1F1ZXJpZXMuam9pbihcIlwiKSArIFwiXVwiKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNldHMgYSBwYWdlIHNpemUgdG8gcXVlcnkgZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyBhbiBvcHRpb25hbCBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIC0gVGhlIHBhZ2Ugc2l6ZVxuICAgKiBAcmV0dXJucyB7U2VhcmNoRm9ybX0gLSBUaGUgU2VhcmNoRm9ybSBpdHNlbGZcbiAgICovXG4gIHBhZ2VTaXplOiBmdW5jdGlvbihzaXplKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KFwicGFnZVNpemVcIiwgc2l6ZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlc3RyaWN0IHRoZSByZXN1bHRzIGRvY3VtZW50IHRvIHRoZSBzcGVjaWZpZWQgZmllbGRzXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfGFycmF5fSBmaWVsZHMgLSBUaGUgbGlzdCBvZiBmaWVsZHMsIGFycmF5IG9yIGNvbW1hIHNlcGFyYXRlZCBzdHJpbmdcbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBmZXRjaDogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgaWYgKGZpZWxkcyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICBmaWVsZHMgPSBmaWVsZHMuam9pbihcIixcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNldChcImZldGNoXCIsIGZpZWxkcyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEluY2x1ZGUgdGhlIHJlcXVlc3RlZCBmaWVsZHMgaW4gdGhlIERvY3VtZW50TGluayBpbnN0YW5jZXMgaW4gdGhlIHJlc3VsdFxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ3xhcnJheX0gZmllbGRzIC0gVGhlIGxpc3Qgb2YgZmllbGRzLCBhcnJheSBvciBjb21tYSBzZXBhcmF0ZWQgc3RyaW5nXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgZmV0Y2hMaW5rczogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgaWYgKGZpZWxkcyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICBmaWVsZHMgPSBmaWVsZHMuam9pbihcIixcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNldChcImZldGNoTGlua3NcIiwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFnZSBudW1iZXIgdG8gcXVlcnkgZm9yIHRoaXMgU2VhcmNoRm9ybS4gVGhpcyBpcyBhbiBvcHRpb25hbCBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBwIC0gVGhlIHBhZ2UgbnVtYmVyXG4gICAqIEByZXR1cm5zIHtTZWFyY2hGb3JtfSAtIFRoZSBTZWFyY2hGb3JtIGl0c2VsZlxuICAgKi9cbiAgcGFnZTogZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiB0aGlzLnNldChcInBhZ2VcIiwgcCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIG9yZGVyaW5ncyB0byBxdWVyeSBmb3IgdGhpcyBTZWFyY2hGb3JtLiBUaGlzIGlzIGFuIG9wdGlvbmFsIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHthcnJheX0gb3JkZXJpbmdzIC0gQXJyYXkgb2Ygc3RyaW5nOiBsaXN0IG9mIGZpZWxkcywgb3B0aW9uYWxseSBmb2xsb3dlZCBieSBzcGFjZSBhbmQgZGVzYy4gRXhhbXBsZTogWydteS5wcm9kdWN0LnByaWNlIGRlc2MnLCAnbXkucHJvZHVjdC5kYXRlJ11cbiAgICogQHJldHVybnMge1NlYXJjaEZvcm19IC0gVGhlIFNlYXJjaEZvcm0gaXRzZWxmXG4gICAqL1xuICBvcmRlcmluZ3M6IGZ1bmN0aW9uKG9yZGVyaW5ncykge1xuICAgIGlmICh0eXBlb2Ygb3JkZXJpbmdzID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgcmV0dXJuIHRoaXMuc2V0KFwib3JkZXJpbmdzXCIsIG9yZGVyaW5ncyk7XG4gICAgfSBlbHNlIGlmICghb3JkZXJpbmdzKSB7XG4gICAgICAvLyBOb29wXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9ybWFsIHVzYWdlXG4gICAgICByZXR1cm4gdGhpcy5zZXQoXCJvcmRlcmluZ3NcIiwgXCJbXCIgKyBvcmRlcmluZ3Muam9pbihcIixcIikgKyBcIl1cIik7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBTdWJtaXRzIHRoZSBxdWVyeSwgYW5kIGNhbGxzIHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgcXVlcnkgd2FzIG1hZGUsXG4gICAqIHRvIHdoaWNoIHlvdSBtYXkgcGFzcyB0aHJlZSBwYXJhbWV0ZXJzOiBhIHBvdGVudGlhbCBlcnJvciAobnVsbCBpZiBubyBwcm9ibGVtKSxcbiAgICogYSBSZXNwb25zZSBvYmplY3QgKGNvbnRhaW5pbmcgYWxsIHRoZSBwYWdpbmF0aW9uIHNwZWNpZmljcyArIHRoZSBhcnJheSBvZiBEb2NzKSxcbiAgICogYW5kIHRoZSBYTUxIdHRwUmVxdWVzdFxuICAgKi9cbiAgc3VibWl0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciB1cmwgPSB0aGlzLmZvcm0uYWN0aW9uO1xuXG4gICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgdmFyIHNlcCA9ICh1cmwuaW5kZXhPZignPycpID4gLTEgPyAnJicgOiAnPycpO1xuICAgICAgZm9yKHZhciBrZXkgaW4gdGhpcy5kYXRhKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIHZhciB2YWx1ZXMgPSB0aGlzLmRhdGFba2V5XTtcbiAgICAgICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICB1cmwgKz0gc2VwICsga2V5ICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlc1tpXSk7XG4gICAgICAgICAgICAgIHNlcCA9ICcmJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmFwaS5yZXF1ZXN0KHVybCwgY2FsbGJhY2spO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIHRoZSByZXNwb25zZSBvZiBhIFNlYXJjaEZvcm0gcXVlcnkgYXMgcmV0dXJuZWQgYnkgdGhlIEFQSS5cbiAqIEl0IGluY2x1ZGVzIGFsbCB0aGUgZmllbGRzIHRoYXQgYXJlIHVzZWZ1bCBmb3IgcGFnaW5hdGlvbiAocGFnZSwgdG90YWxfcGFnZXMsIHRvdGFsX3Jlc3VsdHNfc2l6ZSwgLi4uKSxcbiAqIGFzIHdlbGwgYXMgdGhlIGZpZWxkIFwicmVzdWx0c1wiLCB3aGljaCBpcyBhbiBhcnJheSBvZiB7QGxpbmsgRG9jdW1lbnR9IG9iamVjdHMsIHRoZSBkb2N1bWVudHMgdGhlbXNlbHZlcy5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UocGFnZSwgcmVzdWx0c19wZXJfcGFnZSwgcmVzdWx0c19zaXplLCB0b3RhbF9yZXN1bHRzX3NpemUsIHRvdGFsX3BhZ2VzLCBuZXh0X3BhZ2UsIHByZXZfcGFnZSwgcmVzdWx0cykge1xuICAvKipcbiAgICogVGhlIGN1cnJlbnQgcGFnZVxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdGhpcy5wYWdlID0gcGFnZTtcbiAgLyoqXG4gICAqIFRoZSBudW1iZXIgb2YgcmVzdWx0cyBwZXIgcGFnZVxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdGhpcy5yZXN1bHRzX3Blcl9wYWdlID0gcmVzdWx0c19wZXJfcGFnZTtcbiAgLyoqXG4gICAqIFRoZSBzaXplIG9mIHRoZSBjdXJyZW50IHBhZ2VcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMucmVzdWx0c19zaXplID0gcmVzdWx0c19zaXplO1xuICAvKipcbiAgICogVGhlIHRvdGFsIHNpemUgb2YgcmVzdWx0cyBhY3Jvc3MgYWxsIHBhZ2VzXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0aGlzLnRvdGFsX3Jlc3VsdHNfc2l6ZSA9IHRvdGFsX3Jlc3VsdHNfc2l6ZTtcbiAgLyoqXG4gICAqIFRoZSB0b3RhbCBudW1iZXIgb2YgcGFnZXNcbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRoaXMudG90YWxfcGFnZXMgPSB0b3RhbF9wYWdlcztcbiAgLyoqXG4gICAqIFRoZSBVUkwgb2YgdGhlIG5leHQgcGFnZSBpbiB0aGUgQVBJXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0aGlzLm5leHRfcGFnZSA9IG5leHRfcGFnZTtcbiAgLyoqXG4gICAqIFRoZSBVUkwgb2YgdGhlIHByZXZpb3VzIHBhZ2UgaW4gdGhlIEFQSVxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdGhpcy5wcmV2X3BhZ2UgPSBwcmV2X3BhZ2U7XG4gIC8qKlxuICAgKiBBcnJheSBvZiB7QGxpbmsgRG9jdW1lbnR9IGZvciB0aGUgY3VycmVudCBwYWdlXG4gICAqIEB0eXBlIHtBcnJheX1cbiAgICovXG4gIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG59XG5cbi8qKlxuICogRW1ib2RpZXMgYSBwcmlzbWljLmlvIHJlZiAoYSBwYXN0IG9yIGZ1dHVyZSBwb2ludCBpbiB0aW1lIHlvdSBjYW4gcXVlcnkpXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqL1xuZnVuY3Rpb24gUmVmKHJlZiwgbGFiZWwsIGlzTWFzdGVyLCBzY2hlZHVsZWRBdCwgaWQpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIElEIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMucmVmID0gcmVmO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGFiZWwgb2YgdGhlIHJlZlxuICAgKi9cbiAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiBpcyB0cnVlIGlmIHRoZSByZWYgaXMgdGhlIG1hc3RlciByZWZcbiAgICovXG4gIHRoaXMuaXNNYXN0ZXIgPSBpc01hc3RlcjtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIHNjaGVkdWxlZCBkYXRlIG9mIHRoZSByZWZcbiAgICovXG4gIHRoaXMuc2NoZWR1bGVkQXQgPSBzY2hlZHVsZWRBdDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIG5hbWUgb2YgdGhlIHJlZlxuICAgKi9cbiAgdGhpcy5pZCA9IGlkO1xufVxuUmVmLnByb3RvdHlwZSA9IHt9O1xuXG5mdW5jdGlvbiBnbG9iYWxDYWNoZSgpIHtcbiAgdmFyIGc7XG4gIGlmICh0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnKSB7XG4gICAgZyA9IGdsb2JhbDsgLy8gTm9kZUpTXG4gIH0gZWxzZSB7XG4gICAgZyA9IHdpbmRvdzsgLy8gYnJvd3NlclxuICB9XG4gIGlmICghZy5wcmlzbWljQ2FjaGUpIHtcbiAgICBnLnByaXNtaWNDYWNoZSA9IG5ldyBBcGlDYWNoZSgpO1xuICB9XG4gIHJldHVybiBnLnByaXNtaWNDYWNoZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV4cGVyaW1lbnRDb29raWU6IFwiaW8ucHJpc21pYy5leHBlcmltZW50XCIsXG4gIHByZXZpZXdDb29raWU6IFwiaW8ucHJpc21pYy5wcmV2aWV3XCIsXG4gIEFwaTogQXBpLFxuICBFeHBlcmltZW50czogRXhwZXJpbWVudHMsXG4gIFByZWRpY2F0ZXM6IFByZWRpY2F0ZXMsXG4gIEZyYWdtZW50czogRnJhZ21lbnRzLFxuICBBcGlDYWNoZTogQXBpQ2FjaGUsXG4gIGdldEFwaTogZ2V0QXBpLFxuICBwYXJzZURvYzogcGFyc2VEb2Ncbn07XG5cbiIsIid1c2Ugc3RyaWN0Jztcblxud2luZG93LlByaXNtaWMgPSByZXF1aXJlKCcuL2FwaScpO1xuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIExSVUNhY2hlID0gcmVxdWlyZSgnLi9scnUnKTtcblxuLyoqXG4gKiBBcGkgY2FjaGVcbiAqL1xuZnVuY3Rpb24gQXBpQ2FjaGUobGltaXQpIHtcbiAgdGhpcy5scnUgPSBuZXcgTFJVQ2FjaGUobGltaXQpO1xufVxuXG5BcGlDYWNoZS5wcm90b3R5cGUgPSB7XG5cbiAgZ2V0OiBmdW5jdGlvbihrZXksIGNiKSB7XG4gICAgdmFyIG1heWJlRW50cnkgPSB0aGlzLmxydS5nZXQoa2V5KTtcbiAgICBpZihtYXliZUVudHJ5ICYmICF0aGlzLmlzRXhwaXJlZChrZXkpKSB7XG4gICAgICByZXR1cm4gY2IobnVsbCwgbWF5YmVFbnRyeS5kYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGNiKCk7XG4gIH0sXG5cbiAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlLCB0dGwsIGNiKSB7XG4gICAgdGhpcy5scnUucmVtb3ZlKGtleSk7XG4gICAgdGhpcy5scnUucHV0KGtleSwge1xuICAgICAgZGF0YTogdmFsdWUsXG4gICAgICBleHBpcmVkSW46IHR0bCA/IChEYXRlLm5vdygpICsgKHR0bCAqIDEwMDApKSA6IDBcbiAgICB9KTtcblxuICAgIHJldHVybiBjYigpO1xuICB9LFxuXG4gIGlzRXhwaXJlZDogZnVuY3Rpb24oa2V5KSB7XG4gICAgdmFyIGVudHJ5ID0gdGhpcy5scnUuZ2V0KGtleSk7XG4gICAgaWYoZW50cnkpIHtcbiAgICAgIHJldHVybiBlbnRyeS5leHBpcmVkSW4gIT09IDAgJiYgZW50cnkuZXhwaXJlZEluIDwgRGF0ZS5ub3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSxcblxuICByZW1vdmU6IGZ1bmN0aW9uKGtleSwgY2IpIHtcbiAgICB0aGlzLmxydS5yZW1vdmUoa2V5KTtcbiAgICByZXR1cm4gY2IoKTtcbiAgfSxcblxuICBjbGVhcjogZnVuY3Rpb24oY2IpIHtcbiAgICB0aGlzLmxydS5yZW1vdmVBbGwoKTtcbiAgICByZXR1cm4gY2IoKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcGlDYWNoZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEZ1bmN0aW9ucyB0byBhY2Nlc3MgZnJhZ21lbnRzOiBzdXBlcmNsYXNzIGZvciBEb2N1bWVudCBhbmQgRG9jIChmcm9tIEdyb3VwKSwgbm90IHN1cHBvc2VkIHRvIGJlIGNyZWF0ZWQgZGlyZWN0bHlcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBXaXRoRnJhZ21lbnRzKCkge31cblxuV2l0aEZyYWdtZW50cy5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBHZXRzIHRoZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QuIFNpbmNlIHlvdSBtb3N0IGxpa2VseSBrbm93IHRoZSB0eXBlXG4gICAqIG9mIHRoaXMgZnJhZ21lbnQsIGl0IGlzIGFkdmlzZWQgdGhhdCB5b3UgdXNlIGEgZGVkaWNhdGVkIG1ldGhvZCwgbGlrZSBnZXQgU3RydWN0dXJlZFRleHQoKSBvciBnZXREYXRlKCksXG4gICAqIGZvciBpbnN0YW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmF1dGhvclwiXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIEphdmFTY3JpcHQgRnJhZ21lbnQgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBmcmFncyA9IHRoaXMuX2dldEZyYWdtZW50cyhuYW1lKTtcbiAgICByZXR1cm4gZnJhZ3MubGVuZ3RoID8gZnJhZ3NbMF0gOiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZHMgYW4gYXJyYXkgb2YgYWxsIHRoZSBmcmFnbWVudHMgaW4gY2FzZSB0aGV5IGFyZSBtdWx0aXBsZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbXVsdGlwbGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmF1dGhvclwiXG4gICAqIEByZXR1cm5zIHthcnJheX0gLSBBbiBhcnJheSBvZiBlYWNoIEphdmFTY3JpcHQgZnJhZ21lbnQgb2JqZWN0IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRBbGw6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RnJhZ21lbnRzKG5hbWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBpbWFnZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0SW1hZ2UoJ2Jsb2ctcG9zdC5waG90bycpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmcmFnbWVudCAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QucGhvdG9cIlxuICAgKiBAcmV0dXJucyB7SW1hZ2VFbH0gLSBUaGUgSW1hZ2Ugb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldEltYWdlOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBpbWcgPSB0aGlzLmdldChmcmFnbWVudCk7XG4gICAgaWYgKGltZyBpbnN0YW5jZW9mIEZyYWdtZW50cy5JbWFnZSkge1xuICAgICAgcmV0dXJuIGltZztcbiAgICB9XG4gICAgaWYgKGltZyBpbnN0YW5jZW9mIEZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dCkge1xuICAgICAgLy8gZmluZCBmaXJzdCBpbWFnZSBpbiBzdC5cbiAgICAgIHJldHVybiBpbWc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8vIFVzZWZ1bCBmb3Igb2Jzb2xldGUgbXVsdGlwbGVzXG4gIGdldEFsbEltYWdlczogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgaW1hZ2VzID0gdGhpcy5nZXRBbGwoZnJhZ21lbnQpO1xuXG4gICAgcmV0dXJuIGltYWdlcy5tYXAoZnVuY3Rpb24gKGltYWdlKSB7XG4gICAgICBpZiAoaW1hZ2UgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgICAgcmV0dXJuIGltYWdlO1xuICAgICAgfVxuICAgICAgaWYgKGltYWdlIGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBkb25lLlwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50cyA9IHRoaXMuZnJhZ21lbnRzO1xuXG4gICAgdmFyIGZpcnN0SW1hZ2UgPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihpbWFnZSwga2V5KSB7XG4gICAgICBpZiAoaW1hZ2UpIHtcbiAgICAgICAgcmV0dXJuIGltYWdlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgICAgICByZXR1cm4gZWxlbWVudDtcblxuICAgICAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gICAgcmV0dXJuIGZpcnN0SW1hZ2U7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RUaXRsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50cyA9IHRoaXMuZnJhZ21lbnRzO1xuXG4gICAgdmFyIGZpcnN0VGl0bGUgPSBPYmplY3Qua2V5cyhmcmFnbWVudHMpLnJlZHVjZShmdW5jdGlvbihzdCwga2V5KSB7XG4gICAgICBpZiAoc3QpIHtcbiAgICAgICAgcmV0dXJuIHN0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVsZW1lbnQgPSBmcmFnbWVudHNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIGVsZW1lbnQuZ2V0Rmlyc3RUaXRsZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgICAgICByZXR1cm4gZWxlbWVudC5nZXRUaXRsZSgpO1xuICAgICAgICB9IGVsc2UgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gICAgcmV0dXJuIGZpcnN0VGl0bGU7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudHMgPSB0aGlzLmZyYWdtZW50cztcblxuICAgIHZhciBmaXJzdFBhcmFncmFwaCA9IE9iamVjdC5rZXlzKGZyYWdtZW50cykucmVkdWNlKGZ1bmN0aW9uKHN0LCBrZXkpIHtcbiAgICAgIGlmIChzdCkge1xuICAgICAgICByZXR1cm4gc3Q7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZWxlbWVudCA9IGZyYWdtZW50c1trZXldO1xuICAgICAgICBpZih0eXBlb2YgZWxlbWVudC5nZXRGaXJzdFBhcmFncmFwaCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGgoKTtcbiAgICAgICAgfSBlbHNlIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICAgIHJldHVybiBmaXJzdFBhcmFncmFwaDtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgdmlldyB3aXRoaW4gdGhlIGltYWdlIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRJbWFnZVZpZXcoJ2Jsb2ctcG9zdC5waG90bycsICdsYXJnZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LnBob3RvXCJcbiAgICogQHJldHVybnMge0ltYWdlVmlld30gdmlldyAtIFRoZSBWaWV3IG9iamVjdCB0byBtYW5pcHVsYXRlXG4gICAqL1xuICBnZXRJbWFnZVZpZXc6IGZ1bmN0aW9uKG5hbWUsIHZpZXcpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2UpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRWaWV3KHZpZXcpO1xuICAgIH1cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIGZvcih2YXIgaT0wOyBpPGZyYWdtZW50LmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZihmcmFnbWVudC5ibG9ja3NbaV0udHlwZSA9PSAnaW1hZ2UnKSB7XG4gICAgICAgICAgcmV0dXJuIGZyYWdtZW50LmJsb2Nrc1tpXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvLyBVc2VmdWwgZm9yIG9ic29sZXRlIG11bHRpcGxlc1xuICBnZXRBbGxJbWFnZVZpZXdzOiBmdW5jdGlvbihuYW1lLCB2aWV3KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QWxsSW1hZ2VzKG5hbWUpLm1hcChmdW5jdGlvbiAoaW1hZ2UpIHtcbiAgICAgIHJldHVybiBpbWFnZS5nZXRWaWV3KHZpZXcpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSB0aW1lc3RhbXAgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldERhdGUoJ2Jsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGUnKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QucHVibGljYXRpb25kYXRlXCJcbiAgICogQHJldHVybnMge0RhdGV9IC0gVGhlIERhdGUgb2JqZWN0IHRvIG1hbmlwdWxhdGVcbiAgICovXG4gIGdldFRpbWVzdGFtcDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlRpbWVzdGFtcCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgZGF0ZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0RGF0ZSgnYmxvZy1wb3N0LnB1YmxpY2F0aW9uZGF0ZScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5wdWJsaWNhdGlvbmRhdGVcIlxuICAgKiBAcmV0dXJucyB7RGF0ZX0gLSBUaGUgRGF0ZSBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgKi9cbiAgZ2V0RGF0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBGcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpO1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkRhdGUpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgYSBib29sZWFuIHZhbHVlIG9mIHRoZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogVGhpcyB3b3JrcyBncmVhdCB3aXRoIGEgU2VsZWN0IGZyYWdtZW50LiBUaGUgU2VsZWN0IHZhbHVlcyB0aGF0IGFyZSBjb25zaWRlcmVkIHRydWUgYXJlIChsb3dlcmNhc2VkIGJlZm9yZSBtYXRjaGluZyk6ICd5ZXMnLCAnb24nLCBhbmQgJ3RydWUnLlxuICAgKlxuICAgKiBAZXhhbXBsZSBpZihkb2N1bWVudC5nZXRCb29sZWFuKCdibG9nLXBvc3QuZW5hYmxlQ29tbWVudHMnKSkgeyAuLi4gfVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuZW5hYmxlQ29tbWVudHNcIlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUaGUgYm9vbGVhbiB2YWx1ZSBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGdldEJvb2xlYW46IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcbiAgICByZXR1cm4gZnJhZ21lbnQudmFsdWUgJiYgKGZyYWdtZW50LnZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ3llcycgfHwgZnJhZ21lbnQudmFsdWUudG9Mb3dlckNhc2UoKSA9PSAnb24nIHx8IGZyYWdtZW50LnZhbHVlLnRvTG93ZXJDYXNlKCkgPT0gJ3RydWUnKTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0cyB0aGUgdGV4dCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogVGhlIG1ldGhvZCB3b3JrcyB3aXRoIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50cywgVGV4dCBmcmFnbWVudHMsIE51bWJlciBmcmFnbWVudHMsIFNlbGVjdCBmcmFnbWVudHMgYW5kIENvbG9yIGZyYWdtZW50cy5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0VGV4dCgnYmxvZy1wb3N0LmxhYmVsJykuYXNIdG1sKGxpbmtSZXNvbHZlcikuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcImJsb2ctcG9zdC5sYWJlbFwiXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhZnRlciAtIGEgc3VmZml4IHRoYXQgd2lsbCBiZSBhcHBlbmRlZCB0byB0aGUgdmFsdWVcbiAgICogQHJldHVybnMge29iamVjdH0gLSBlaXRoZXIgU3RydWN0dXJlZFRleHQsIG9yIFRleHQsIG9yIE51bWJlciwgb3IgU2VsZWN0LCBvciBDb2xvci5cbiAgICovXG4gIGdldFRleHQ6IGZ1bmN0aW9uKG5hbWUsIGFmdGVyKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5ibG9ja3MubWFwKGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgICAgIGlmKGJsb2NrLnRleHQpIHtcbiAgICAgICAgICByZXR1cm4gYmxvY2sudGV4dCArIChhZnRlciA/IGFmdGVyIDogJycpO1xuICAgICAgICB9XG4gICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICB9XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuVGV4dCkge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLk51bWJlcikge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlNlbGVjdCkge1xuICAgICAgaWYoZnJhZ21lbnQudmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LnZhbHVlICsgKGFmdGVyID8gYWZ0ZXIgOiAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkNvbG9yKSB7XG4gICAgICBpZihmcmFnbWVudC52YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWUgKyAoYWZ0ZXIgPyBhZnRlciA6ICcnKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIFN0cnVjdHVyZWRUZXh0IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRTdHJ1Y3R1cmVkVGV4dCgnYmxvZy1wb3N0LmJvZHknKS5hc0h0bWwobGlua1Jlc29sdmVyKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYm9keVwiXG4gICAqIEByZXR1cm5zIHtTdHJ1Y3R1cmVkVGV4dH0gLSBUaGUgU3RydWN0dXJlZFRleHQgZnJhZ21lbnQgdG8gbWFuaXB1bGF0ZS5cbiAgICovXG4gIGdldFN0cnVjdHVyZWRUZXh0OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiByZXF1aXJlKCcuL2ZyYWdtZW50cycpLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBMaW5rIGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRMaW5rKCdibG9nLXBvc3QubGluaycpLnVybChyZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxpbmtcIlxuICAgKiBAcmV0dXJucyB7V2ViTGlua3xEb2N1bWVudExpbmt8SW1hZ2VMaW5rfSAtIFRoZSBMaW5rIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRMaW5rOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuV2ViTGluayB8fFxuICAgICAgICBmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmsgfHxcbiAgICAgICAgZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuSW1hZ2VMaW5rKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBOdW1iZXIgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgRG9jdW1lbnQgb2JqZWN0LCBmb3IgZnVydGhlciBtYW5pcHVsYXRpb24uXG4gICAqIEBleGFtcGxlIGRvY3VtZW50LmdldE51bWJlcigncHJvZHVjdC5wcmljZScpXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcInByb2R1Y3QucHJpY2VcIlxuICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIFRoZSBudW1iZXIgdmFsdWUgb2YgdGhlIGZyYWdtZW50LlxuICAgKi9cbiAgZ2V0TnVtYmVyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuTnVtYmVyKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBDb2xvciBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0Q29sb3IoJ3Byb2R1Y3QuY29sb3InKVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmNvbG9yXCJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgc3RyaW5nIHZhbHVlIG9mIHRoZSBDb2xvciBmcmFnbWVudC5cbiAgICovXG4gIGdldENvbG9yOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIEZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJyk7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQobmFtZSk7XG5cbiAgICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBGcmFnbWVudHMuQ29sb3IpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC52YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqIEdldHMgdGhlIEdlb1BvaW50IGZyYWdtZW50IGluIHRoZSBjdXJyZW50IERvY3VtZW50IG9iamVjdCwgZm9yIGZ1cnRoZXIgbWFuaXB1bGF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRHZW9Qb2ludCgnYmxvZy1wb3N0LmxvY2F0aW9uJykuYXNIdG1sKGxpbmtSZXNvbHZlcilcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZnJhZ21lbnQgdG8gZ2V0LCB3aXRoIGl0cyB0eXBlOyBmb3IgaW5zdGFuY2UsIFwiYmxvZy1wb3N0LmxvY2F0aW9uXCJcbiAgICogQHJldHVybnMge0dlb1BvaW50fSAtIFRoZSBHZW9Qb2ludCBvYmplY3QgdG8gbWFuaXB1bGF0ZVxuICAgKi9cbiAgZ2V0R2VvUG9pbnQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICAgIGlmKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLkdlb1BvaW50KSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBHcm91cCBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGUgZG9jdW1lbnQuZ2V0R3JvdXAoJ3Byb2R1Y3QuZ2FsbGVyeScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJwcm9kdWN0LmdhbGxlcnlcIlxuICAgKiBAcmV0dXJucyB7R3JvdXB9IC0gVGhlIEdyb3VwIGZyYWdtZW50IHRvIG1hbmlwdWxhdGUuXG4gICAqL1xuICBnZXRHcm91cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgcmVxdWlyZSgnLi9mcmFnbWVudHMnKS5Hcm91cCkge1xuICAgICAgcmV0dXJuIGZyYWdtZW50O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogU2hvcnRjdXQgdG8gZ2V0IHRoZSBIVE1MIG91dHB1dCBvZiB0aGUgZnJhZ21lbnQgaW4gdGhlIGN1cnJlbnQgZG9jdW1lbnQuXG4gICAqIFRoaXMgaXMgdGhlIHNhbWUgYXMgd3JpdGluZyBkb2N1bWVudC5nZXQoZnJhZ21lbnQpLmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmcmFnbWVudCB0byBnZXQsIHdpdGggaXRzIHR5cGU7IGZvciBpbnN0YW5jZSwgXCJibG9nLXBvc3QuYm9keVwiXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpbmtSZXNvbHZlclxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBIVE1MIG91dHB1dFxuICAgKi9cbiAgZ2V0SHRtbDogZnVuY3Rpb24obmFtZSwgbGlua1Jlc29sdmVyKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb2xkIGN0eCBhcmd1bWVudFxuICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KG5hbWUpO1xuXG4gICAgaWYoZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNIdG1sKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuYXNIdG1sKGxpbmtSZXNvbHZlcik7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm1zIHRoZSB3aG9sZSBkb2N1bWVudCBhcyBhbiBIVE1MIG91dHB1dC4gRWFjaCBmcmFnbWVudCBpcyBzZXBhcmF0ZWQgYnkgYSAmbHQ7c2VjdGlvbiZndDsgdGFnLFxuICAgKiB3aXRoIHRoZSBhdHRyaWJ1dGUgZGF0YS1maWVsZD1cIm5hbWVvZmZyYWdtZW50XCJcbiAgICogTm90ZSB0aGF0IG1vc3Qgb2YgdGhlIHRpbWUgeW91IHdpbGwgbm90IHVzZSB0aGlzIG1ldGhvZCwgYnV0IHJlYWQgZnJhZ21lbnQgaW5kZXBlbmRlbnRseSBhbmQgZ2VuZXJhdGVcbiAgICogSFRNTCBvdXRwdXQgZm9yIHtAbGluayBTdHJ1Y3R1cmVkVGV4dH0gZnJhZ21lbnQgd2l0aCB0aGF0IGNsYXNzJyBhc0h0bWwgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgSFRNTCBvdXRwdXRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGxpbmtSZXNvbHZlcikpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgb2xkIGN0eCBhcmd1bWVudFxuICAgICAgdmFyIGN0eCA9IGxpbmtSZXNvbHZlcjtcbiAgICAgIGxpbmtSZXNvbHZlciA9IGZ1bmN0aW9uKGRvYywgaXNCcm9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGN0eC5saW5rUmVzb2x2ZXIoY3R4LCBkb2MsIGlzQnJva2VuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHZhciBodG1scyA9IFtdO1xuICAgIGZvcih2YXIgZmllbGQgaW4gdGhpcy5mcmFnbWVudHMpIHtcbiAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KGZpZWxkKTtcbiAgICAgIGh0bWxzLnB1c2goZnJhZ21lbnQgJiYgZnJhZ21lbnQuYXNIdG1sID8gJzxzZWN0aW9uIGRhdGEtZmllbGQ9XCInICsgZmllbGQgKyAnXCI+JyArIGZyYWdtZW50LmFzSHRtbChsaW5rUmVzb2x2ZXIpICsgJzwvc2VjdGlvbj4nIDogJycpO1xuICAgIH1cbiAgICByZXR1cm4gaHRtbHMuam9pbignJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBkb2N1bWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb24obGlua1Jlc29sdmVyKSkge1xuICAgICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBvbGQgY3R4IGFyZ3VtZW50XG4gICAgICB2YXIgY3R4ID0gbGlua1Jlc29sdmVyO1xuICAgICAgbGlua1Jlc29sdmVyID0gZnVuY3Rpb24oZG9jLCBpc0Jyb2tlbikge1xuICAgICAgICByZXR1cm4gY3R4LmxpbmtSZXNvbHZlcihjdHgsIGRvYywgaXNCcm9rZW4pO1xuICAgICAgfTtcbiAgICB9XG4gICAgdmFyIHRleHRzID0gW107XG4gICAgZm9yKHZhciBmaWVsZCBpbiB0aGlzLmZyYWdtZW50cykge1xuICAgICAgdmFyIGZyYWdtZW50ID0gdGhpcy5nZXQoZmllbGQpO1xuICAgICAgdGV4dHMucHVzaChmcmFnbWVudCAmJiBmcmFnbWVudC5hc1RleHQgPyBmcmFnbWVudC5hc1RleHQobGlua1Jlc29sdmVyKSA6ICcnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRzLmpvaW4oJycpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBMaW5rZWQgZG9jdW1lbnRzLCBhcyBhbiBhcnJheSBvZiB7QGxpbmsgRG9jdW1lbnRMaW5rfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBsaW5rZWREb2N1bWVudHM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpLCBqLCBsaW5rO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgRnJhZ21lbnRzID0gcmVxdWlyZSgnLi9mcmFnbWVudHMnKTtcbiAgICBmb3IgKHZhciBmaWVsZCBpbiB0aGlzLmRhdGEpIHtcbiAgICAgIHZhciBmcmFnbWVudCA9IHRoaXMuZ2V0KGZpZWxkKTtcbiAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Eb2N1bWVudExpbmspIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZnJhZ21lbnQpO1xuICAgICAgfVxuICAgICAgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgRnJhZ21lbnRzLlN0cnVjdHVyZWRUZXh0KSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBmcmFnbWVudC5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgYmxvY2sgPSBmcmFnbWVudC5ibG9ja3NbaV07XG4gICAgICAgICAgaWYgKGJsb2NrLnR5cGUgPT0gXCJpbWFnZVwiICYmIGJsb2NrLmxpbmtUbykge1xuICAgICAgICAgICAgbGluayA9IEZyYWdtZW50cy5pbml0RmllbGQoYmxvY2subGlua1RvKTtcbiAgICAgICAgICAgIGlmIChsaW5rIGluc3RhbmNlb2YgRG9jdW1lbnRMaW5rKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxpbmspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgc3BhbnMgPSBibG9jay5zcGFucyB8fCBbXTtcbiAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgc3BhbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIHZhciBzcGFuID0gc3BhbnNbal07XG4gICAgICAgICAgICBpZiAoc3Bhbi50eXBlID09IFwiaHlwZXJsaW5rXCIpIHtcbiAgICAgICAgICAgICAgbGluayA9IEZyYWdtZW50cy5pbml0RmllbGQoc3Bhbi5kYXRhKTtcbiAgICAgICAgICAgICAgaWYgKGxpbmsgaW5zdGFuY2VvZiBGcmFnbWVudHMuRG9jdW1lbnRMaW5rKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobGluayk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChmcmFnbWVudCBpbnN0YW5jZW9mIEZyYWdtZW50cy5Hcm91cCkge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZnJhZ21lbnQudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICByZXN1bHQgPSByZXN1bHQuY29uY2F0KGZyYWdtZW50LnZhbHVlW2ldLmxpbmtlZERvY3VtZW50cygpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiB0aGUgZnJhZ21lbnRzIHdpdGggdGhlIGdpdmVuIGZyYWdtZW50IG5hbWUuXG4gICAqIFRoZSBhcnJheSBpcyBvZnRlbiBhIHNpbmdsZS1lbGVtZW50IGFycmF5LCBleHBlY3Qgd2hlbiB0aGUgZnJhZ21lbnQgaXMgYSBtdWx0aXBsZSBmcmFnbWVudC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRGcmFnbWVudHM6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuZnJhZ21lbnRzIHx8ICF0aGlzLmZyYWdtZW50c1tuYW1lXSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KHRoaXMuZnJhZ21lbnRzW25hbWVdKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZnJhZ21lbnRzW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gW3RoaXMuZnJhZ21lbnRzW25hbWVdXTtcbiAgICB9XG5cbiAgfVxuXG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgZG9jdW1lbnQgYXMgcmV0dXJuZWQgYnkgdGhlIEFQSS5cbiAqIE1vc3QgdXNlZnVsIGZpZWxkczogaWQsIHR5cGUsIHRhZ3MsIHNsdWcsIHNsdWdzXG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBEb2NcbiAqL1xuZnVuY3Rpb24gRG9jdW1lbnQoaWQsIHVpZCwgdHlwZSwgaHJlZiwgdGFncywgc2x1Z3MsIGRhdGEpIHtcbiAgLyoqXG4gICAqIFRoZSBJRCBvZiB0aGUgZG9jdW1lbnRcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMuaWQgPSBpZDtcbiAgLyoqXG4gICAqIFRoZSBVc2VyIElEIG9mIHRoZSBkb2N1bWVudCwgYSBodW1hbiByZWFkYWJsZSBpZFxuICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAqL1xuICB0aGlzLnVpZCA9IHVpZDtcbiAgLyoqXG4gICAqIFRoZSB0eXBlIG9mIHRoZSBkb2N1bWVudCwgY29ycmVzcG9uZHMgdG8gYSBkb2N1bWVudCBtYXNrIGRlZmluZWQgaW4gdGhlIHJlcG9zaXRvcnlcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMudHlwZSA9IHR5cGU7XG4gIC8qKlxuICAgKiBUaGUgVVJMIG9mIHRoZSBkb2N1bWVudCBpbiB0aGUgQVBJXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0aGlzLmhyZWYgPSBocmVmO1xuICAvKipcbiAgICogVGhlIHRhZ3Mgb2YgdGhlIGRvY3VtZW50XG4gICAqIEB0eXBlIHthcnJheX1cbiAgICovXG4gIHRoaXMudGFncyA9IHRhZ3M7XG4gIC8qKlxuICAgKiBUaGUgY3VycmVudCBzbHVnIG9mIHRoZSBkb2N1bWVudCwgXCItXCIgaWYgbm9uZSB3YXMgcHJvdmlkZWRcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRoaXMuc2x1ZyA9IHNsdWdzID8gc2x1Z3NbMF0gOiBcIi1cIjtcbiAgLyoqXG4gICAqIEFsbCB0aGUgc2x1Z3MgdGhhdCB3ZXJlIGV2ZXIgdXNlZCBieSB0aGlzIGRvY3VtZW50IChpbmNsdWRpbmcgdGhlIGN1cnJlbnQgb25lLCBhdCB0aGUgaGVhZClcbiAgICogQHR5cGUge2FycmF5fVxuICAgKi9cbiAgdGhpcy5zbHVncyA9IHNsdWdzO1xuICAvKipcbiAgICogVGhlIG9yaWdpbmFsIEpTT04gZGF0YSBmcm9tIHRoZSBBUElcbiAgICovXG4gIHRoaXMuZGF0YSA9IGRhdGE7XG4gIC8qKlxuICAgKiBGcmFnbWVudHMsIGNvbnZlcnRlZCB0byBidXNpbmVzcyBvYmplY3RzXG4gICAqL1xuICB0aGlzLmZyYWdtZW50cyA9IHJlcXVpcmUoJy4vZnJhZ21lbnRzJykucGFyc2VGcmFnbWVudHMoZGF0YSk7XG59XG5cbkRvY3VtZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoV2l0aEZyYWdtZW50cy5wcm90b3R5cGUpO1xuXG4vKipcbiAqIEdldHMgdGhlIFNsaWNlWm9uZSBmcmFnbWVudCBpbiB0aGUgY3VycmVudCBEb2N1bWVudCBvYmplY3QsIGZvciBmdXJ0aGVyIG1hbmlwdWxhdGlvbi5cbiAqXG4gKiBAZXhhbXBsZSBkb2N1bWVudC5nZXRTbGljZVpvbmUoJ3Byb2R1Y3QuZ2FsbGVyeScpLmFzSHRtbChsaW5rUmVzb2x2ZXIpLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZyYWdtZW50IHRvIGdldCwgd2l0aCBpdHMgdHlwZTsgZm9yIGluc3RhbmNlLCBcInByb2R1Y3QuZ2FsbGVyeVwiXG4gKiBAcmV0dXJucyB7R3JvdXB9IC0gVGhlIFNsaWNlWm9uZSBmcmFnbWVudCB0byBtYW5pcHVsYXRlLlxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuZ2V0U2xpY2Vab25lID0gZnVuY3Rpb24obmFtZSkge1xuICB2YXIgZnJhZ21lbnQgPSB0aGlzLmdldChuYW1lKTtcblxuICBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiByZXF1aXJlKCcuL2ZyYWdtZW50cycpLlNsaWNlWm9uZSkge1xuICAgIHJldHVybiBmcmFnbWVudDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbmZ1bmN0aW9uIEdyb3VwRG9jKGRhdGEpIHtcbiAgLyoqXG4gICAqIFRoZSBvcmlnaW5hbCBKU09OIGRhdGEgZnJvbSB0aGUgQVBJXG4gICAqL1xuICB0aGlzLmRhdGEgPSBkYXRhO1xuICAvKipcbiAgICogRnJhZ21lbnRzLCBjb252ZXJ0ZWQgdG8gYnVzaW5lc3Mgb2JqZWN0c1xuICAgKi9cbiAgdGhpcy5mcmFnbWVudHMgPSByZXF1aXJlKCcuL2ZyYWdtZW50cycpLnBhcnNlRnJhZ21lbnRzKGRhdGEpO1xufVxuXG5Hcm91cERvYy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFdpdGhGcmFnbWVudHMucHJvdG90eXBlKTtcblxuLy8gLS0gUHJpdmF0ZSBoZWxwZXJzXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oZikge1xuICB2YXIgZ2V0VHlwZSA9IHt9O1xuICByZXR1cm4gZiAmJiBnZXRUeXBlLnRvU3RyaW5nLmNhbGwoZikgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBXaXRoRnJhZ21lbnRzOiBXaXRoRnJhZ21lbnRzLFxuICBEb2N1bWVudDogRG9jdW1lbnQsXG4gIEdyb3VwRG9jOiBHcm91cERvY1xufVxuXG5cbiIsIlxuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIGV4cGVyaW1lbnRzIGN1cnJlbnRseSBhdmFpbGFibGVcbiAqIEBwYXJhbSBkYXRhIHRoZSBqc29uIGRhdGEgcmVjZWl2ZWQgZnJvbSB0aGUgUHJpc21pYyBBUElcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBFeHBlcmltZW50cyhkYXRhKSB7XG4gIHZhciBkcmFmdHMgPSBbXTtcbiAgdmFyIHJ1bm5pbmcgPSBbXTtcbiAgaWYgKGRhdGEpIHtcbiAgICBkYXRhLmRyYWZ0cyAmJiBkYXRhLmRyYWZ0cy5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcbiAgICAgIGRyYWZ0cy5wdXNoKG5ldyBFeHBlcmltZW50KGV4cCkpO1xuICAgIH0pO1xuICAgIGRhdGEucnVubmluZyAmJiBkYXRhLnJ1bm5pbmcuZm9yRWFjaChmdW5jdGlvbiAoZXhwKSB7XG4gICAgICBydW5uaW5nLnB1c2gobmV3IEV4cGVyaW1lbnQoZXhwKSk7XG4gICAgfSk7XG4gIH1cbiAgdGhpcy5kcmFmdHMgPSBkcmFmdHM7XG4gIHRoaXMucnVubmluZyA9IHJ1bm5pbmc7XG59XG5cbkV4cGVyaW1lbnRzLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnJ1bm5pbmcubGVuZ3RoID4gMCA/IHRoaXMucnVubmluZ1swXSA6IG51bGw7XG59O1xuXG4vKipcbiAqIEdldCB0aGUgY3VycmVudCBydW5uaW5nIGV4cGVyaW1lbnQgdmFyaWF0aW9uIHJlZiBmcm9tIGEgY29va2llIGNvbnRlbnRcbiAqL1xuRXhwZXJpbWVudHMucHJvdG90eXBlLnJlZkZyb21Db29raWUgPSBmdW5jdGlvbihjb29raWUpIHtcbiAgaWYgKCFjb29raWUgfHwgY29va2llLnRyaW0oKSA9PT0gXCJcIikgcmV0dXJuIG51bGw7XG4gIHZhciBzcGxpdHRlZCA9IGNvb2tpZS50cmltKCkuc3BsaXQoXCIgXCIpO1xuICBpZiAoc3BsaXR0ZWQubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG4gIHZhciBleHBJZCA9IHNwbGl0dGVkWzBdO1xuICB2YXIgdmFySW5kZXggPSBwYXJzZUludChzcGxpdHRlZFsxXSwgMTApO1xuICB2YXIgZXhwID0gdGhpcy5ydW5uaW5nLmZpbHRlcihmdW5jdGlvbihleHApIHtcbiAgICByZXR1cm4gZXhwLmdvb2dsZUlkKCkgPT0gZXhwSWQgJiYgZXhwLnZhcmlhdGlvbnMubGVuZ3RoID4gdmFySW5kZXg7XG4gIH0pWzBdO1xuICByZXR1cm4gZXhwID8gZXhwLnZhcmlhdGlvbnNbdmFySW5kZXhdLnJlZigpIDogbnVsbDtcbn07XG5cbmZ1bmN0aW9uIEV4cGVyaW1lbnQoZGF0YSkge1xuICB0aGlzLmRhdGEgPSBkYXRhO1xuICB2YXIgdmFyaWF0aW9ucyA9IFtdO1xuICBkYXRhLnZhcmlhdGlvbnMgJiYgZGF0YS52YXJpYXRpb25zLmZvckVhY2goZnVuY3Rpb24odikge1xuICAgIHZhcmlhdGlvbnMucHVzaChuZXcgVmFyaWF0aW9uKHYpKTtcbiAgfSk7XG4gIHRoaXMudmFyaWF0aW9ucyA9IHZhcmlhdGlvbnM7XG59XG5cbkV4cGVyaW1lbnQucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEuaWQ7XG59O1xuXG5FeHBlcmltZW50LnByb3RvdHlwZS5nb29nbGVJZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLmdvb2dsZUlkO1xufTtcblxuRXhwZXJpbWVudC5wcm90b3R5cGUubmFtZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLm5hbWU7XG59O1xuXG5mdW5jdGlvbiBWYXJpYXRpb24oZGF0YSkge1xuICB0aGlzLmRhdGEgPSBkYXRhO1xufVxuXG5WYXJpYXRpb24ucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRhdGEuaWQ7XG59O1xuXG5WYXJpYXRpb24ucHJvdG90eXBlLnJlZiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5kYXRhLnJlZjtcbn07XG5cblZhcmlhdGlvbi5wcm90b3R5cGUubGFiZWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGF0YS5sYWJlbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBFeHBlcmltZW50czogRXhwZXJpbWVudHMsXG4gIFZhcmlhdGlvbjogVmFyaWF0aW9uXG59XG5cbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgZG9jdW1lbnRzID0gcmVxdWlyZSgnLi9kb2N1bWVudHMnKTtcbnZhciBXaXRoRnJhZ21lbnRzID0gZG9jdW1lbnRzLldpdGhGcmFnbWVudHMsXG4gICAgR3JvdXBEb2MgPSBkb2N1bWVudHMuR3JvdXBEb2M7XG5cbi8qKlxuICogRW1ib2RpZXMgYSBwbGFpbiB0ZXh0IGZyYWdtZW50IChiZXdhcmU6IG5vdCBhIHN0cnVjdHVyZWQgdGV4dClcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpUZXh0XG4gKi9cbmZ1bmN0aW9uIFRleHQoZGF0YSkge1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cblRleHQucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHNwYW4+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3NwYW4+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfVxufTtcbi8qKlxuICogRW1ib2RpZXMgYSBkb2N1bWVudCBsaW5rIGZyYWdtZW50IChhIGxpbmsgdGhhdCBpcyBpbnRlcm5hbCB0byBhIHByaXNtaWMuaW8gcmVwb3NpdG9yeSlcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpEb2N1bWVudExpbmtcbiAqL1xuZnVuY3Rpb24gRG9jdW1lbnRMaW5rKGRhdGEpIHtcbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG5cbiAgdGhpcy5kb2N1bWVudCA9IGRhdGEuZG9jdW1lbnQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgaWRcbiAgICovXG4gIHRoaXMuaWQgPSBkYXRhLmRvY3VtZW50LmlkO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHVpZFxuICAgKi9cbiAgdGhpcy51aWQgPSBkYXRhLmRvY3VtZW50LnVpZDtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxpbmtlZCBkb2N1bWVudCB0YWdzXG4gICAqL1xuICB0aGlzLnRhZ3MgPSBkYXRhLmRvY3VtZW50LnRhZ3M7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsaW5rZWQgZG9jdW1lbnQgc2x1Z1xuICAgKi9cbiAgdGhpcy5zbHVnID0gZGF0YS5kb2N1bWVudC5zbHVnO1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgbGlua2VkIGRvY3VtZW50IHR5cGVcbiAgICovXG4gIHRoaXMudHlwZSA9IGRhdGEuZG9jdW1lbnQudHlwZTtcblxuICB2YXIgZnJhZ21lbnRzRGF0YSA9IHt9O1xuICBpZiAoZGF0YS5kb2N1bWVudC5kYXRhKSB7XG4gICAgZm9yICh2YXIgZmllbGQgaW4gZGF0YS5kb2N1bWVudC5kYXRhW2RhdGEuZG9jdW1lbnQudHlwZV0pIHtcbiAgICAgIGZyYWdtZW50c0RhdGFbZGF0YS5kb2N1bWVudC50eXBlICsgJy4nICsgZmllbGRdID0gZGF0YS5kb2N1bWVudC5kYXRhW2RhdGEuZG9jdW1lbnQudHlwZV1bZmllbGRdO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgZnJhZ21lbnQgbGlzdCwgaWYgdGhlIGZldGNoTGlua3MgcGFyYW1ldGVyIHdhcyB1c2VkIGluIGF0IHF1ZXJ5IHRpbWVcbiAgICovXG4gIHRoaXMuZnJhZ21lbnRzID0gcGFyc2VGcmFnbWVudHMoZnJhZ21lbnRzRGF0YSk7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRydWUgaWYgdGhlIGxpbmsgaXMgYnJva2VuLCBmYWxzZSBvdGhlcndpc2VcbiAgICovXG4gIHRoaXMuaXNCcm9rZW4gPSBkYXRhLmlzQnJva2VuO1xufVxuXG5Eb2N1bWVudExpbmsucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShXaXRoRnJhZ21lbnRzLnByb3RvdHlwZSk7XG5cbi8qKlxuICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gKlxuICogQHBhcmFtcyB7b2JqZWN0fSBjdHggLSBtYW5kYXRvcnkgY3R4IG9iamVjdCwgd2l0aCBhIHVzZWFibGUgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gKi9cbkRvY3VtZW50TGluay5wcm90b3R5cGUuYXNIdG1sID0gZnVuY3Rpb24gKGN0eCkge1xuICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybChjdHgpK1wiXFxcIj5cIit0aGlzLnVybChjdHgpK1wiPC9hPlwiO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBVUkwgb2YgdGhlIGRvY3VtZW50IGxpbmsuXG4gKlxuICogQHBhcmFtcyB7b2JqZWN0fSBsaW5rUmVzb2x2ZXIgLSBtYW5kYXRvcnkgbGlua1Jlc29sdmVyIGZ1bmN0aW9uIChwbGVhc2UgcmVhZCBwcmlzbWljLmlvIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICovXG5Eb2N1bWVudExpbmsucHJvdG90eXBlLnVybCA9IGZ1bmN0aW9uIChsaW5rUmVzb2x2ZXIpIHtcbiAgcmV0dXJuIGxpbmtSZXNvbHZlcih0aGlzLCB0aGlzLmlzQnJva2VuKTtcbn07XG5cbi8qKlxuICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAqL1xuRG9jdW1lbnRMaW5rLnByb3RvdHlwZS5hc1RleHQgPSBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgcmV0dXJuIHRoaXMudXJsKGxpbmtSZXNvbHZlcik7XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgd2ViIGxpbmsgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpXZWJMaW5rXG4gKi9cbmZ1bmN0aW9uIFdlYkxpbmsoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgSlNPTiBvYmplY3QgZXhhY3RseSBhcyBpcyByZXR1cm5lZCBpbiB0aGUgXCJkYXRhXCIgZmllbGQgb2YgdGhlIEpTT04gcmVzcG9uc2VzIChzZWUgQVBJIGRvY3VtZW50YXRpb246IGh0dHBzOi8vZGV2ZWxvcGVycy5wcmlzbWljLmlvL2RvY3VtZW50YXRpb24vVWpCZThiR0lKM0VLdGdCWi9hcGktZG9jdW1lbnRhdGlvbiNqc29uLXJlc3BvbnNlcylcbiAgICovXG4gIHRoaXMudmFsdWUgPSBkYXRhO1xufVxuV2ViTGluay5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIj5cIit0aGlzLnVybCgpK1wiPC9hPlwiO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBsaW5rLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICAgKi9cbiAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS51cmw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy51cmwoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGZpbGUgbGluayBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOkZpbGVMaW5rXG4gKi9cbmZ1bmN0aW9uIEZpbGVMaW5rKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbkZpbGVMaW5rLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjxhIGhyZWY9XFxcIlwiK3RoaXMudXJsKCkrXCJcXFwiPlwiK3RoaXMudmFsdWUuZmlsZS5uYW1lK1wiPC9hPlwiO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJucyB0aGUgVVJMIG9mIHRoZSBsaW5rLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIHRoZSBwcm9wZXIgVVJMIHRvIHVzZVxuICAgKi9cbiAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5maWxlLnVybDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnVybCgpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGltYWdlIGxpbmsgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpJbWFnZUxpbmtcbiAqL1xuZnVuY3Rpb24gSW1hZ2VMaW5rKGRhdGEpIHtcbiAgLyoqXG4gICAqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIEpTT04gb2JqZWN0IGV4YWN0bHkgYXMgaXMgcmV0dXJuZWQgaW4gdGhlIFwiZGF0YVwiIGZpZWxkIG9mIHRoZSBKU09OIHJlc3BvbnNlcyAoc2VlIEFQSSBkb2N1bWVudGF0aW9uOiBodHRwczovL2RldmVsb3BlcnMucHJpc21pYy5pby9kb2N1bWVudGF0aW9uL1VqQmU4YkdJSjNFS3RnQlovYXBpLWRvY3VtZW50YXRpb24janNvbi1yZXNwb25zZXMpXG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbkltYWdlTGluay5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8YSBocmVmPVxcXCJcIit0aGlzLnVybCgpK1wiXFxcIj48aW1nIHNyYz1cXFwiXCIrdGhpcy51cmwoKStcIlxcXCIgYWx0PVxcXCJcIiArIHRoaXMuYWx0ICsgXCJcXFwiPjwvYT5cIjtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIFVSTCBvZiB0aGUgbGluay5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSB0aGUgcHJvcGVyIFVSTCB0byB1c2VcbiAgICovXG4gIHVybDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUuaW1hZ2UudXJsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBzZWxlY3QgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpTZWxlY3RcbiAqL1xuZnVuY3Rpb24gU2VsZWN0KGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIHRleHQgdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cblNlbGVjdC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgY29sb3IgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpDb2xvclxuICovXG5mdW5jdGlvbiBDb2xvcihkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB0ZXh0IHZhbHVlIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgdGhpcy52YWx1ZSA9IGRhdGE7XG59XG5Db2xvci5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgZ2VvcG9pbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpHZW9Qb2ludFxuICovXG5mdW5jdGlvbiBHZW9Qb2ludChkYXRhKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBsYXRpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAqL1xuICB0aGlzLmxhdGl0dWRlID0gZGF0YS5sYXRpdHVkZTtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGxvbmdpdHVkZSBvZiB0aGUgZ2VvIHBvaW50XG4gICAqL1xuICB0aGlzLmxvbmdpdHVkZSA9IGRhdGEubG9uZ2l0dWRlO1xufVxuXG5HZW9Qb2ludC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJzxkaXYgY2xhc3M9XCJnZW9wb2ludFwiPjxzcGFuIGNsYXNzPVwibGF0aXR1ZGVcIj4nICsgdGhpcy5sYXRpdHVkZSArICc8L3NwYW4+PHNwYW4gY2xhc3M9XCJsb25naXR1ZGVcIj4nICsgdGhpcy5sb25naXR1ZGUgKyAnPC9zcGFuPjwvZGl2Pic7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJygnICsgdGhpcy5sYXRpdHVkZSArIFwiLFwiICsgdGhpcy5sb25naXR1ZGUgKyAnKSc7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBOdW1iZXIgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpOdW1cbiAqL1xuZnVuY3Rpb24gTnVtKGRhdGEpIHtcbiAgLyoqXG4gICAqIEBmaWVsZFxuICAgKiBAZGVzY3JpcHRpb24gdGhlIGludGVnZXIgdmFsdWUgb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICB0aGlzLnZhbHVlID0gZGF0YTtcbn1cbk51bS5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8c3Bhbj5cIiArIHRoaXMudmFsdWUgKyBcIjwvc3Bhbj5cIjtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRW1ib2RpZXMgYSBEYXRlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6RGF0ZVxuICovXG5mdW5jdGlvbiBEYXRlRnJhZ21lbnQoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgRGF0ZSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgKGFzIGEgcmVndWxhciBKUyBEYXRlIG9iamVjdClcbiAgICovXG4gIHRoaXMudmFsdWUgPSBuZXcgRGF0ZShkYXRhKTtcbn1cblxuRGF0ZUZyYWdtZW50LnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBcIjx0aW1lPlwiICsgdGhpcy52YWx1ZSArIFwiPC90aW1lPlwiO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIFRpbWVzdGFtcCBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlRpbWVzdGFtcFxuICovXG5mdW5jdGlvbiBUaW1lc3RhbXAoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgRGF0ZSB2YWx1ZSBvZiB0aGUgZnJhZ21lbnQgKGFzIGEgcmVndWxhciBKUyBEYXRlIG9iamVjdClcbiAgICovXG4gIC8vIEFkZGluZyBcIjpcIiBpbiB0aGUgbG9jYWxlIGlmIG5lZWRlZCwgc28gSlMgY29uc2lkZXJzIGl0IElTTzg2MDEtY29tcGxpYW50XG4gIHZhciBjb3JyZWN0SXNvODYwMURhdGUgPSAoZGF0YS5sZW5ndGggPT0gMjQpID8gZGF0YS5zdWJzdHJpbmcoMCwgMjIpICsgJzonICsgZGF0YS5zdWJzdHJpbmcoMjIsIDI0KSA6IGRhdGE7XG4gIHRoaXMudmFsdWUgPSBuZXcgRGF0ZShjb3JyZWN0SXNvODYwMURhdGUpO1xufVxuXG5UaW1lc3RhbXAucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFwiPHRpbWU+XCIgKyB0aGlzLnZhbHVlICsgXCI8L3RpbWU+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS50b1N0cmluZygpO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGVtYmVkIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6RW1iZWRcbiAqL1xuZnVuY3Rpb24gRW1iZWQoZGF0YSkge1xuICAvKipcbiAgICogQGZpZWxkXG4gICAqIEBkZXNjcmlwdGlvbiB0aGUgSlNPTiBvYmplY3QgZXhhY3RseSBhcyBpcyByZXR1cm5lZCBpbiB0aGUgXCJkYXRhXCIgZmllbGQgb2YgdGhlIEpTT04gcmVzcG9uc2VzIChzZWUgQVBJIGRvY3VtZW50YXRpb246IGh0dHBzOi8vZGV2ZWxvcGVycy5wcmlzbWljLmlvL2RvY3VtZW50YXRpb24vVWpCZThiR0lKM0VLdGdCWi9hcGktZG9jdW1lbnRhdGlvbiNqc29uLXJlc3BvbnNlcylcbiAgICovXG4gIHRoaXMudmFsdWUgPSBkYXRhO1xufVxuXG5FbWJlZC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5vZW1iZWQuaHRtbDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIEltYWdlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6SW1hZ2VFbFxuICovXG5mdW5jdGlvbiBJbWFnZUVsKG1haW4sIHZpZXdzKSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBtYWluIEltYWdlVmlldyBmb3IgdGhpcyBpbWFnZVxuICAgKi9cbiAgdGhpcy5tYWluID0gbWFpbjtcblxuXG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB1cmwgb2YgdGhlIG1haW4gSW1hZ2VWaWV3IGZvciB0aGlzIGltYWdlXG4gICAqL1xuICB0aGlzLnVybCA9IG1haW4udXJsO1xuXG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIGFuIGFycmF5IG9mIGFsbCB0aGUgb3RoZXIgSW1hZ2VWaWV3cyBmb3IgdGhpcyBpbWFnZVxuICAgKi9cbiAgdGhpcy52aWV3cyA9IHZpZXdzIHx8IHt9O1xufVxuSW1hZ2VFbC5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBHZXRzIHRoZSB2aWV3IG9mIHRoZSBpbWFnZSwgZnJvbSBpdHMgbmFtZVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIHRoZSBuYW1lIG9mIHRoZSB2aWV3IHRvIGdldFxuICAgKiBAcmV0dXJucyB7SW1hZ2VWaWV3fSAtIHRoZSBwcm9wZXIgdmlld1xuICAgKi9cbiAgZ2V0VmlldzogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmIChuYW1lID09PSBcIm1haW5cIikge1xuICAgICAgcmV0dXJuIHRoaXMubWFpbjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMudmlld3NbbmFtZV07XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMubWFpbi5hc0h0bWwoKTtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGFuIGltYWdlIHZpZXcgKGFuIGltYWdlIGluIHByaXNtaWMuaW8gY2FuIGJlIGRlZmluZWQgd2l0aCBzZXZlcmFsIGRpZmZlcmVudCB0aHVtYm5haWwgc2l6ZXMsIGVhY2ggc2l6ZSBpcyBjYWxsZWQgYSBcInZpZXdcIilcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpJbWFnZVZpZXdcbiAqL1xuZnVuY3Rpb24gSW1hZ2VWaWV3KHVybCwgd2lkdGgsIGhlaWdodCwgYWx0KSB7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBVUkwgb2YgdGhlIEltYWdlVmlldyAodXNlYWJsZSBhcyBpdCwgaW4gYSA8aW1nPiB0YWcgaW4gSFRNTCwgZm9yIGluc3RhbmNlKVxuICAgKi9cbiAgdGhpcy51cmwgPSB1cmw7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSB3aWR0aCBvZiB0aGUgSW1hZ2VWaWV3XG4gICAqL1xuICB0aGlzLndpZHRoID0gd2lkdGg7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBoZWlnaHQgb2YgdGhlIEltYWdlVmlld1xuICAgKi9cbiAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG4gIC8qKlxuICAgKiBAZmllbGRcbiAgICogQGRlc2NyaXB0aW9uIHRoZSBhbHQgdGV4dCBmb3IgdGhlIEltYWdlVmlld1xuICAgKi9cbiAgdGhpcy5hbHQgPSBhbHQ7XG59XG5JbWFnZVZpZXcucHJvdG90eXBlID0ge1xuICByYXRpbzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQ7XG4gIH0sXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCI8aW1nIHNyYz1cXFwiXCIgKyB0aGlzLnVybCArIFwiXFxcIiB3aWR0aD1cXFwiXCIgKyB0aGlzLndpZHRoICsgXCJcXFwiIGhlaWdodD1cXFwiXCIgKyB0aGlzLmhlaWdodCArIFwiXFxcIiBhbHQ9XFxcIlwiICsgdGhpcy5hbHQgKyBcIlxcXCI+XCI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSB0ZXh0IHZlcnNpb24gb2YgaXQuXG4gICAqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgdGV4dCB2ZXJzaW9uIG9mIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNUZXh0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufTtcblxuLyoqXG4gKiBFbWJvZGllcyBhIGZyYWdtZW50IG9mIHR5cGUgXCJHcm91cFwiICh3aGljaCBpcyBhIGdyb3VwIG9mIHN1YmZyYWdtZW50cylcbiAqIEBjb25zdHJ1Y3RvclxuICogQGdsb2JhbFxuICogQGFsaWFzIEZyYWdtZW50czpHcm91cFxuICovXG5mdW5jdGlvbiBHcm91cChkYXRhKSB7XG4gIHRoaXMudmFsdWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy52YWx1ZS5wdXNoKG5ldyBHcm91cERvYyhkYXRhW2ldKSk7XG4gIH1cbn1cbkdyb3VwLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFR1cm5zIHRoZSBmcmFnbWVudCBpbnRvIGEgdXNlYWJsZSBIVE1MIHZlcnNpb24gb2YgaXQuXG4gICAqIElmIHRoZSBuYXRpdmUgSFRNTCBjb2RlIGRvZXNuJ3Qgc3VpdCB5b3VyIGRlc2lnbiwgdGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBvdmVycmlkZW4uXG4gICAqIEBwYXJhbXMge2Z1bmN0aW9ufSBsaW5rUmVzb2x2ZXIgLSBsaW5rUmVzb2x2ZXIgZnVuY3Rpb24gKHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgdGhpcylcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbihsaW5rUmVzb2x2ZXIpIHtcbiAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIG91dHB1dCArPSB0aGlzLnZhbHVlW2ldLmFzSHRtbChsaW5rUmVzb2x2ZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9LFxuICAvKipcbiAgICogVHVybnMgdGhlIEdyb3VwIGZyYWdtZW50IGludG8gYW4gYXJyYXkgaW4gb3JkZXIgdG8gYWNjZXNzIGl0cyBpdGVtcyAoZ3JvdXBzIG9mIGZyYWdtZW50cyksXG4gICAqIG9yIHRvIGxvb3AgdGhyb3VnaCB0aGVtLlxuICAgKiBAcGFyYW1zIHtvYmplY3R9IGN0eCAtIG1hbmRhdG9yeSBjdHggb2JqZWN0LCB3aXRoIGEgdXNlYWJsZSBsaW5rUmVzb2x2ZXIgZnVuY3Rpb24gKHBsZWFzZSByZWFkIHByaXNtaWMuaW8gb25saW5lIGRvY3VtZW50YXRpb24gYWJvdXQgdGhpcylcbiAgICogQHJldHVybnMge0FycmF5fSAtIHRoZSBhcnJheSBvZiBncm91cHMsIGVhY2ggZ3JvdXAgYmVpbmcgYSBKU09OIG9iamVjdCB3aXRoIHN1YmZyYWdtZW50IG5hbWUgYXMga2V5cywgYW5kIHN1YmZyYWdtZW50IGFzIHZhbHVlc1xuICAgKi9cbiAgdG9BcnJheTogZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKGxpbmtSZXNvbHZlcikge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc1RleHQobGlua1Jlc29sdmVyKSArICdcXG4nO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9LFxuXG4gIGdldEZpcnN0SW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIGZyYWdtZW50KSB7XG4gICAgICBpZiAoaW1hZ2UpIHJldHVybiBpbWFnZTtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5yZWR1Y2UoZnVuY3Rpb24oc3QsIGZyYWdtZW50KSB7XG4gICAgICBpZiAoc3QpIHJldHVybiBzdDtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RUaXRsZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0UGFyYWdyYXBoOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50b0FycmF5KCkucmVkdWNlKGZ1bmN0aW9uKHN0LCBmcmFnbWVudCkge1xuICAgICAgaWYgKHN0KSByZXR1cm4gc3Q7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gIH1cbn07XG5cblxuLyoqXG4gKiBFbWJvZGllcyBhIHN0cnVjdHVyZWQgdGV4dCBmcmFnbWVudFxuICogQGNvbnN0cnVjdG9yXG4gKiBAZ2xvYmFsXG4gKiBAYWxpYXMgRnJhZ21lbnRzOlN0cnVjdHVyZWRUZXh0XG4gKi9cbmZ1bmN0aW9uIFN0cnVjdHVyZWRUZXh0KGJsb2Nrcykge1xuXG4gIHRoaXMuYmxvY2tzID0gYmxvY2tzO1xuXG59XG5cblN0cnVjdHVyZWRUZXh0LnByb3RvdHlwZSA9IHtcblxuICAvKipcbiAgICogQHJldHVybnMge29iamVjdH0gdGhlIGZpcnN0IGhlYWRpbmcgYmxvY2sgaW4gdGhlIHRleHRcbiAgICovXG4gIGdldFRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuICAgICAgaWYoYmxvY2sudHlwZS5pbmRleE9mKCdoZWFkaW5nJykgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGJsb2NrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybnMge29iamVjdH0gdGhlIGZpcnN0IGJsb2NrIG9mIHR5cGUgcGFyYWdyYXBoXG4gICAqL1xuICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBpPTA7IGk8dGhpcy5ibG9ja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuICAgICAgaWYoYmxvY2sudHlwZSA9PSAncGFyYWdyYXBoJykge1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7YXJyYXl9IGFsbCBwYXJhZ3JhcGhzXG4gICAqL1xuICBnZXRQYXJhZ3JhcGhzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGFyYWdyYXBocyA9IFtdO1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmKGJsb2NrLnR5cGUgPT0gJ3BhcmFncmFwaCcpIHtcbiAgICAgICAgcGFyYWdyYXBocy5wdXNoKGJsb2NrKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhcmFncmFwaHM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9IHRoZSBudGggcGFyYWdyYXBoXG4gICAqL1xuICBnZXRQYXJhZ3JhcGg6IGZ1bmN0aW9uKG4pIHtcbiAgICByZXR1cm4gdGhpcy5nZXRQYXJhZ3JhcGhzKClbbl07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtvYmplY3R9XG4gICAqL1xuICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJsb2NrID0gdGhpcy5ibG9ja3NbaV07XG4gICAgICBpZihibG9jay50eXBlID09ICdpbWFnZScpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBJbWFnZVZpZXcoXG4gICAgICAgICAgYmxvY2sudXJsLFxuICAgICAgICAgIGJsb2NrLmRpbWVuc2lvbnMud2lkdGgsXG4gICAgICAgICAgYmxvY2suZGltZW5zaW9ucy5oZWlnaHQsXG4gICAgICAgICAgYmxvY2suYWx0XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gbGlua1Jlc29sdmVyIC0gcGxlYXNlIHJlYWQgcHJpc21pYy5pbyBvbmxpbmUgZG9jdW1lbnRhdGlvbiBhYm91dCBsaW5rIHJlc29sdmVyc1xuICAgKiBAcGFyYW1zIHtmdW5jdGlvbn0gaHRtbFNlcmlhbGl6ZXIgb3B0aW9uYWwgSFRNTCBzZXJpYWxpemVyIHRvIGN1c3RvbWl6ZSB0aGUgb3V0cHV0XG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gYmFzaWMgSFRNTCBjb2RlIGZvciB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzSHRtbDogZnVuY3Rpb24obGlua1Jlc29sdmVyLCBodG1sU2VyaWFsaXplcikge1xuICAgIHZhciBibG9ja0dyb3VwcyA9IFtdLFxuICAgICAgICBibG9ja0dyb3VwLFxuICAgICAgICBibG9jayxcbiAgICAgICAgaHRtbCA9IFtdO1xuICAgIGlmICghaXNGdW5jdGlvbihsaW5rUmVzb2x2ZXIpKSB7XG4gICAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCBjdHggYXJndW1lbnRcbiAgICAgIHZhciBjdHggPSBsaW5rUmVzb2x2ZXI7XG4gICAgICBsaW5rUmVzb2x2ZXIgPSBmdW5jdGlvbihkb2MsIGlzQnJva2VuKSB7XG4gICAgICAgIHJldHVybiBjdHgubGlua1Jlc29sdmVyKGN0eCwgZG9jLCBpc0Jyb2tlbik7XG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmJsb2NrcykpIHtcblxuICAgICAgZm9yKHZhciBpPTA7IGkgPCB0aGlzLmJsb2Nrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBibG9jayA9IHRoaXMuYmxvY2tzW2ldO1xuXG4gICAgICAgIC8vIFJlc29sdmUgaW1hZ2UgbGlua3NcbiAgICAgICAgaWYgKGJsb2NrLnR5cGUgPT0gXCJpbWFnZVwiICYmIGJsb2NrLmxpbmtUbykge1xuICAgICAgICAgIHZhciBsaW5rID0gaW5pdEZpZWxkKGJsb2NrLmxpbmtUbyk7XG4gICAgICAgICAgYmxvY2subGlua1VybCA9IGxpbmsudXJsKGxpbmtSZXNvbHZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYmxvY2sudHlwZSAhPT0gXCJsaXN0LWl0ZW1cIiAmJiBibG9jay50eXBlICE9PSBcIm8tbGlzdC1pdGVtXCIpIHtcbiAgICAgICAgICAvLyBpdCdzIG5vdCBhIHR5cGUgdGhhdCBncm91cHNcbiAgICAgICAgICBibG9ja0dyb3Vwcy5wdXNoKGJsb2NrKTtcbiAgICAgICAgICBibG9ja0dyb3VwID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICghYmxvY2tHcm91cCB8fCBibG9ja0dyb3VwLnR5cGUgIT0gKFwiZ3JvdXAtXCIgKyBibG9jay50eXBlKSkge1xuICAgICAgICAgIC8vIGl0J3MgYSBuZXcgdHlwZSBvciBubyBCbG9ja0dyb3VwIHdhcyBzZXQgc28gZmFyXG4gICAgICAgICAgYmxvY2tHcm91cCA9IHtcbiAgICAgICAgICAgIHR5cGU6IFwiZ3JvdXAtXCIgKyBibG9jay50eXBlLFxuICAgICAgICAgICAgYmxvY2tzOiBbYmxvY2tdXG4gICAgICAgICAgfTtcbiAgICAgICAgICBibG9ja0dyb3Vwcy5wdXNoKGJsb2NrR3JvdXApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGl0J3MgdGhlIHNhbWUgdHlwZSBhcyBiZWZvcmUsIG5vIHRvdWNoaW5nIGJsb2NrR3JvdXBcbiAgICAgICAgICBibG9ja0dyb3VwLmJsb2Nrcy5wdXNoKGJsb2NrKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgYmxvY2tDb250ZW50ID0gZnVuY3Rpb24oYmxvY2spIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBcIlwiO1xuICAgICAgICBpZiAoYmxvY2suYmxvY2tzKSB7XG4gICAgICAgICAgYmxvY2suYmxvY2tzLmZvckVhY2goZnVuY3Rpb24gKGJsb2NrMikge1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQgKyBzZXJpYWxpemUoYmxvY2syLCBibG9ja0NvbnRlbnQoYmxvY2syKSwgaHRtbFNlcmlhbGl6ZXIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRlbnQgPSBpbnNlcnRTcGFucyhibG9jay50ZXh0LCBibG9jay5zcGFucywgbGlua1Jlc29sdmVyLCBodG1sU2VyaWFsaXplcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9O1xuXG4gICAgICBibG9ja0dyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uIChibG9ja0dyb3VwKSB7XG4gICAgICAgIGh0bWwucHVzaChzZXJpYWxpemUoYmxvY2tHcm91cCwgYmxvY2tDb250ZW50KGJsb2NrR3JvdXApLCBodG1sU2VyaWFsaXplcikpO1xuICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICByZXR1cm4gaHRtbC5qb2luKCcnKTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgdGV4dCB2ZXJzaW9uIG9mIGl0LlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIHRleHQgdmVyc2lvbiBvZiB0aGUgZnJhZ21lbnRcbiAgICovXG4gIGFzVGV4dDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG91dHB1dCA9IFtdO1xuICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuYmxvY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYmxvY2sgPSB0aGlzLmJsb2Nrc1tpXTtcbiAgICAgIGlmIChibG9jay50ZXh0KSB7XG4gICAgICAgIG91dHB1dC5wdXNoKGJsb2NrLnRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0LmpvaW4oJyAnKTtcbiAgfVxuXG59O1xuXG5mdW5jdGlvbiBodG1sRXNjYXBlKGlucHV0KSB7XG4gIHJldHVybiBpbnB1dCAmJiBpbnB1dC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcbiAgICAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcbiAgICAucmVwbGFjZSgvPi9nLCBcIiZndDtcIilcbiAgICAucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayB0aGF0IGhhcyBzcGFucywgYW5kIGluc2VydHMgdGhlIHByb3BlciBIVE1MIGNvZGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSB0aGUgb3JpZ2luYWwgdGV4dCBvZiB0aGUgYmxvY2tcbiAqIEBwYXJhbSB7b2JqZWN0fSBzcGFucyAtIHRoZSBzcGFucyBhcyByZXR1cm5lZCBieSB0aGUgQVBJXG4gKiBAcGFyYW0ge29iamVjdH0gbGlua1Jlc29sdmVyIC0gdGhlIGZ1bmN0aW9uIHRvIGJ1aWxkIGxpbmtzIHRoYXQgbWF5IGJlIGluIHRoZSBmcmFnbWVudCAocGxlYXNlIHJlYWQgcHJpc21pYy5pbydzIG9ubGluZSBkb2N1bWVudGF0aW9uIGFib3V0IHRoaXMpXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBodG1sU2VyaWFsaXplciAtIG9wdGlvbmFsIHNlcmlhbGl6ZXJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gdGhlIEhUTUwgb3V0cHV0XG4gKi9cbmZ1bmN0aW9uIGluc2VydFNwYW5zKHRleHQsIHNwYW5zLCBsaW5rUmVzb2x2ZXIsIGh0bWxTZXJpYWxpemVyKSB7XG4gIGlmICghc3BhbnMgfHwgIXNwYW5zLmxlbmd0aCkge1xuICAgIHJldHVybiBodG1sRXNjYXBlKHRleHQpO1xuICB9XG5cbiAgdmFyIHRhZ3NTdGFydCA9IHt9O1xuICB2YXIgdGFnc0VuZCA9IHt9O1xuXG4gIHNwYW5zLmZvckVhY2goZnVuY3Rpb24gKHNwYW4pIHtcbiAgICBpZiAoIXRhZ3NTdGFydFtzcGFuLnN0YXJ0XSkgeyB0YWdzU3RhcnRbc3Bhbi5zdGFydF0gPSBbXTsgfVxuICAgIGlmICghdGFnc0VuZFtzcGFuLmVuZF0pIHsgdGFnc0VuZFtzcGFuLmVuZF0gPSBbXTsgfVxuXG4gICAgdGFnc1N0YXJ0W3NwYW4uc3RhcnRdLnB1c2goc3Bhbik7XG4gICAgdGFnc0VuZFtzcGFuLmVuZF0udW5zaGlmdChzcGFuKTtcbiAgfSk7XG5cbiAgdmFyIGM7XG4gIHZhciBodG1sID0gXCJcIjtcbiAgdmFyIHN0YWNrID0gW107XG4gIGZvciAodmFyIHBvcyA9IDAsIGxlbiA9IHRleHQubGVuZ3RoICsgMTsgcG9zIDwgbGVuOyBwb3MrKykgeyAvLyBMb29waW5nIHRvIGxlbmd0aCArIDEgdG8gY2F0Y2ggY2xvc2luZyB0YWdzXG4gICAgaWYgKHRhZ3NFbmRbcG9zXSkge1xuICAgICAgdGFnc0VuZFtwb3NdLmZvckVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBDbG9zZSBhIHRhZ1xuICAgICAgICB2YXIgdGFnID0gc3RhY2sucG9wKCk7XG4gICAgICAgIC8vIENvbnRpbnVlIG9ubHkgaWYgYmxvY2sgY29udGFpbnMgY29udGVudC5cbiAgICAgICAgaWYgKHR5cGVvZiB0YWcgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdmFyIGlubmVySHRtbCA9IHNlcmlhbGl6ZSh0YWcuc3BhbiwgdGFnLnRleHQsIGh0bWxTZXJpYWxpemVyKTtcbiAgICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyBUaGUgdGFnIHdhcyB0b3AgbGV2ZWxcbiAgICAgICAgICAgIGh0bWwgKz0gaW5uZXJIdG1sO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBBZGQgdGhlIGNvbnRlbnQgdG8gdGhlIHBhcmVudCB0YWdcbiAgICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLnRleHQgKz0gaW5uZXJIdG1sO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh0YWdzU3RhcnRbcG9zXSkge1xuICAgICAgLy8gU29ydCBiaWdnZXIgdGFncyBmaXJzdCB0byBlbnN1cmUgdGhlIHJpZ2h0IHRhZyBoaWVyYXJjaHlcbiAgICAgIHRhZ3NTdGFydFtwb3NdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIChiLmVuZCAtIGIuc3RhcnQpIC0gKGEuZW5kIC0gYS5zdGFydCk7XG4gICAgICB9KTtcbiAgICAgIHRhZ3NTdGFydFtwb3NdLmZvckVhY2goZnVuY3Rpb24gKHNwYW4pIHtcbiAgICAgICAgLy8gT3BlbiBhIHRhZ1xuICAgICAgICB2YXIgdXJsID0gbnVsbDtcbiAgICAgICAgaWYgKHNwYW4udHlwZSA9PSBcImh5cGVybGlua1wiKSB7XG4gICAgICAgICAgdmFyIGZyYWdtZW50ID0gaW5pdEZpZWxkKHNwYW4uZGF0YSk7XG4gICAgICAgICAgaWYgKGZyYWdtZW50KSB7XG4gICAgICAgICAgICB1cmwgPSBmcmFnbWVudC51cmwobGlua1Jlc29sdmVyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5lcnJvcikgY29uc29sZS5lcnJvcignSW1wb3NzaWJsZSB0byBjb252ZXJ0IHNwYW4uZGF0YSBhcyBhIEZyYWdtZW50Jywgc3Bhbik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwYW4udXJsID0gdXJsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlbHQgPSB7XG4gICAgICAgICAgc3Bhbjogc3BhbixcbiAgICAgICAgICB0ZXh0OiBcIlwiXG4gICAgICAgIH07XG4gICAgICAgIHN0YWNrLnB1c2goZWx0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAocG9zIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgIGMgPSB0ZXh0W3Bvc107XG4gICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRvcC1sZXZlbCB0ZXh0XG4gICAgICAgIGh0bWwgKz0gaHRtbEVzY2FwZShjKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElubmVyIHRleHQgb2YgYSBzcGFuXG4gICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLnRleHQgKz0gaHRtbEVzY2FwZShjKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gaHRtbDtcbn1cblxuLyoqXG4gKiBFbWJvZGllcyBhIFNsaWNlIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6U2xpY2VcbiAqL1xuZnVuY3Rpb24gU2xpY2Uoc2xpY2VUeXBlLCBsYWJlbCwgdmFsdWUpIHtcbiAgdGhpcy5zbGljZVR5cGUgPSBzbGljZVR5cGU7XG4gIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5TbGljZS5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBUdXJucyB0aGUgZnJhZ21lbnQgaW50byBhIHVzZWFibGUgSFRNTCB2ZXJzaW9uIG9mIGl0LlxuICAgKiBJZiB0aGUgbmF0aXZlIEhUTUwgY29kZSBkb2Vzbid0IHN1aXQgeW91ciBkZXNpZ24sIHRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgb3ZlcnJpZGVuLlxuICAgKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIGJhc2ljIEhUTUwgY29kZSBmb3IgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc0h0bWw6IGZ1bmN0aW9uIChsaW5rUmVzb2x2ZXIpIHtcbiAgICB2YXIgY2xhc3NlcyA9IFsnc2xpY2UnXTtcbiAgICBpZiAodGhpcy5sYWJlbCkgY2xhc3Nlcy5wdXNoKHRoaXMubGFiZWwpO1xuICAgIHJldHVybiAnPGRpdiBkYXRhLXNsaWNldHlwZT1cIicgKyB0aGlzLnNsaWNlVHlwZSArICdcIiBjbGFzcz1cIicgKyBjbGFzc2VzLmpvaW4oJyAnKSArICdcIj4nICtcbiAgICAgIHRoaXMudmFsdWUuYXNIdG1sKGxpbmtSZXNvbHZlcikgK1xuICAgICAgJzwvZGl2Pic7XG5cbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLmFzVGV4dCgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGZpcnN0IEltYWdlIGluIHNsaWNlLlxuICAgKiBAcmV0dXJucyB7b2JqZWN0fVxuICAgKi9cbiAgZ2V0Rmlyc3RJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy52YWx1ZTtcbiAgICBpZih0eXBlb2YgZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgIH0gZWxzZSBpZiAoZnJhZ21lbnQgaW5zdGFuY2VvZiBJbWFnZUVsKSB7XG4gICAgICByZXR1cm4gZnJhZ21lbnQ7XG4gICAgfSBlbHNlIHJldHVybiBudWxsO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmcmFnbWVudCA9IHRoaXMudmFsdWU7XG4gICAgaWYodHlwZW9mIGZyYWdtZW50LmdldEZpcnN0VGl0bGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0VGl0bGUoKTtcbiAgICB9IGVsc2UgaWYgKGZyYWdtZW50IGluc3RhbmNlb2YgU3RydWN0dXJlZFRleHQpIHtcbiAgICAgIHJldHVybiBmcmFnbWVudC5nZXRUaXRsZSgpO1xuICAgIH0gZWxzZSByZXR1cm4gbnVsbDtcbiAgfSxcblxuICBnZXRGaXJzdFBhcmFncmFwaDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gdGhpcy52YWx1ZTtcbiAgICBpZih0eXBlb2YgZnJhZ21lbnQuZ2V0Rmlyc3RQYXJhZ3JhcGggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIGZyYWdtZW50LmdldEZpcnN0UGFyYWdyYXBoKCk7XG4gICAgfSBlbHNlIHJldHVybiBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIEVtYm9kaWVzIGEgU2xpY2Vab25lIGZyYWdtZW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBnbG9iYWxcbiAqIEBhbGlhcyBGcmFnbWVudHM6U2xpY2Vab25lXG4gKi9cbmZ1bmN0aW9uIFNsaWNlWm9uZShkYXRhKSB7XG4gIHRoaXMudmFsdWUgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHNsaWNlVHlwZSA9IGRhdGFbaV1bJ3NsaWNlX3R5cGUnXTtcbiAgICB2YXIgZnJhZ21lbnQgPSBpbml0RmllbGQoZGF0YVtpXVsndmFsdWUnXSk7XG4gICAgdmFyIGxhYmVsID0gZGF0YVtpXVsnc2xpY2VfbGFiZWwnXSB8fCBudWxsO1xuICAgIGlmIChzbGljZVR5cGUgJiYgZnJhZ21lbnQpIHtcbiAgICAgIHRoaXMudmFsdWUucHVzaChuZXcgU2xpY2Uoc2xpY2VUeXBlLCBsYWJlbCwgZnJhZ21lbnQpKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5zbGljZXMgPSB0aGlzLnZhbHVlO1xufVxuXG5TbGljZVpvbmUucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIEhUTUwgdmVyc2lvbiBvZiBpdC5cbiAgICogSWYgdGhlIG5hdGl2ZSBIVE1MIGNvZGUgZG9lc24ndCBzdWl0IHlvdXIgZGVzaWduLCB0aGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIG92ZXJyaWRlbi5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyBIVE1MIGNvZGUgZm9yIHRoZSBmcmFnbWVudFxuICAgKi9cbiAgYXNIdG1sOiBmdW5jdGlvbiAobGlua1Jlc29sdmVyKSB7XG4gICAgdmFyIG91dHB1dCA9IFwiXCI7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvdXRwdXQgKz0gdGhpcy52YWx1ZVtpXS5hc0h0bWwobGlua1Jlc29sdmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcblxuICAvKipcbiAgICogVHVybnMgdGhlIGZyYWdtZW50IGludG8gYSB1c2VhYmxlIHRleHQgdmVyc2lvbiBvZiBpdC5cbiAgICpcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBiYXNpYyB0ZXh0IHZlcnNpb24gb2YgdGhlIGZyYWdtZW50XG4gICAqL1xuICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgb3V0cHV0ICs9IHRoaXMudmFsdWVbaV0uYXNUZXh0KCkgKyAnXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSxcblxuICBnZXRGaXJzdEltYWdlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZS5yZWR1Y2UoZnVuY3Rpb24oaW1hZ2UsIHNsaWNlKSB7XG4gICAgICBpZiAoaW1hZ2UpIHJldHVybiBpbWFnZTtcbiAgICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gc2xpY2UuZ2V0Rmlyc3RJbWFnZSgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9LFxuXG4gIGdldEZpcnN0VGl0bGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnJlZHVjZShmdW5jdGlvbih0ZXh0LCBzbGljZSkge1xuICAgICAgaWYgKHRleHQpIHJldHVybiB0ZXh0O1xuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdFRpdGxlKCk7XG4gICAgICB9XG4gICAgfSwgbnVsbCk7XG4gIH0sXG5cbiAgZ2V0Rmlyc3RQYXJhZ3JhcGg6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlLnJlZHVjZShmdW5jdGlvbihwYXJhZ3JhcGgsIHNsaWNlKSB7XG4gICAgICBpZiAocGFyYWdyYXBoKSByZXR1cm4gcGFyYWdyYXBoO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGljZS5nZXRGaXJzdFBhcmFncmFwaCgpO1xuICAgICAgfVxuICAgIH0sIG51bGwpO1xuICB9XG59O1xuXG4vKipcbiAqIEZyb20gYSBmcmFnbWVudCdzIG5hbWUsIGNhc3RzIGl0IGludG8gdGhlIHByb3BlciBvYmplY3QgdHlwZSAobGlrZSBQcmlzbWljLkZyYWdtZW50cy5TdHJ1Y3R1cmVkVGV4dClcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkIC0gdGhlIGZyYWdtZW50J3MgbmFtZVxuICogQHJldHVybnMge29iamVjdH0gLSB0aGUgb2JqZWN0IG9mIHRoZSBwcm9wZXIgRnJhZ21lbnRzIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIGluaXRGaWVsZChmaWVsZCkge1xuXG4gIHZhciBjbGFzc0ZvclR5cGUgPSB7XG4gICAgXCJDb2xvclwiOiBDb2xvcixcbiAgICBcIk51bWJlclwiOiBOdW0sXG4gICAgXCJEYXRlXCI6IERhdGVGcmFnbWVudCxcbiAgICBcIlRpbWVzdGFtcFwiOiBUaW1lc3RhbXAsXG4gICAgXCJUZXh0XCI6IFRleHQsXG4gICAgXCJFbWJlZFwiOiBFbWJlZCxcbiAgICBcIkdlb1BvaW50XCI6IEdlb1BvaW50LFxuICAgIFwiU2VsZWN0XCI6IFNlbGVjdCxcbiAgICBcIlN0cnVjdHVyZWRUZXh0XCI6IFN0cnVjdHVyZWRUZXh0LFxuICAgIFwiTGluay5kb2N1bWVudFwiOiBEb2N1bWVudExpbmssXG4gICAgXCJMaW5rLndlYlwiOiBXZWJMaW5rLFxuICAgIFwiTGluay5maWxlXCI6IEZpbGVMaW5rLFxuICAgIFwiTGluay5pbWFnZVwiOiBJbWFnZUxpbmssXG4gICAgXCJHcm91cFwiOiBHcm91cCxcbiAgICBcIlNsaWNlWm9uZVwiOiBTbGljZVpvbmVcbiAgfTtcblxuICBpZiAoY2xhc3NGb3JUeXBlW2ZpZWxkLnR5cGVdKSB7XG4gICAgcmV0dXJuIG5ldyBjbGFzc0ZvclR5cGVbZmllbGQudHlwZV0oZmllbGQudmFsdWUpO1xuICB9XG5cbiAgaWYgKGZpZWxkLnR5cGUgPT09IFwiSW1hZ2VcIikge1xuICAgIHZhciBpbWcgPSBmaWVsZC52YWx1ZS5tYWluO1xuICAgIHZhciBvdXRwdXQgPSBuZXcgSW1hZ2VFbChcbiAgICAgIG5ldyBJbWFnZVZpZXcoXG4gICAgICAgIGltZy51cmwsXG4gICAgICAgIGltZy5kaW1lbnNpb25zLndpZHRoLFxuICAgICAgICBpbWcuZGltZW5zaW9ucy5oZWlnaHQsXG4gICAgICAgIGltZy5hbHRcbiAgICAgICksXG4gICAgICB7fVxuICAgICk7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBmaWVsZC52YWx1ZS52aWV3cykge1xuICAgICAgaW1nID0gZmllbGQudmFsdWUudmlld3NbbmFtZV07XG4gICAgICBvdXRwdXQudmlld3NbbmFtZV0gPSBuZXcgSW1hZ2VWaWV3KFxuICAgICAgICBpbWcudXJsLFxuICAgICAgICBpbWcuZGltZW5zaW9ucy53aWR0aCxcbiAgICAgICAgaW1nLmRpbWVuc2lvbnMuaGVpZ2h0LFxuICAgICAgICBpbWcuYWx0XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbiAgaWYgKGNvbnNvbGUgJiYgY29uc29sZS5sb2cpIGNvbnNvbGUubG9nKFwiRnJhZ21lbnQgdHlwZSBub3Qgc3VwcG9ydGVkOiBcIiwgZmllbGQudHlwZSk7XG4gIHJldHVybiBudWxsO1xuXG59XG5cbmZ1bmN0aW9uIHBhcnNlRnJhZ21lbnRzKGpzb24pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmb3IgKHZhciBrZXkgaW4ganNvbikge1xuICAgIGlmIChqc29uLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGpzb25ba2V5XSkpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSBqc29uW2tleV0ubWFwKGZ1bmN0aW9uIChmcmFnbWVudCkge1xuICAgICAgICAgIHJldHVybiBpbml0RmllbGQoZnJhZ21lbnQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gaW5pdEZpZWxkKGpzb25ba2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cblxuZnVuY3Rpb24gaXNGdW5jdGlvbihmKSB7XG4gIHZhciBnZXRUeXBlID0ge307XG4gIHJldHVybiBmICYmIGdldFR5cGUudG9TdHJpbmcuY2FsbChmKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplKGVsZW1lbnQsIGNvbnRlbnQsIGh0bWxTZXJpYWxpemVyKSB7XG4gIC8vIFJldHVybiB0aGUgdXNlciBjdXN0b21pemVkIG91dHB1dCAoaWYgYXZhaWxhYmxlKVxuICBpZiAoaHRtbFNlcmlhbGl6ZXIpIHtcbiAgICB2YXIgY3VzdG9tID0gaHRtbFNlcmlhbGl6ZXIoZWxlbWVudCwgY29udGVudCk7XG4gICAgaWYgKGN1c3RvbSkge1xuICAgICAgcmV0dXJuIGN1c3RvbTtcbiAgICB9XG4gIH1cblxuICAvLyBGYWxsIGJhY2sgdG8gdGhlIGRlZmF1bHQgSFRNTCBvdXRwdXRcbiAgdmFyIFRBR19OQU1FUyA9IHtcbiAgICBcImhlYWRpbmcxXCI6IFwiaDFcIixcbiAgICBcImhlYWRpbmcyXCI6IFwiaDJcIixcbiAgICBcImhlYWRpbmczXCI6IFwiaDNcIixcbiAgICBcImhlYWRpbmc0XCI6IFwiaDRcIixcbiAgICBcImhlYWRpbmc1XCI6IFwiaDVcIixcbiAgICBcImhlYWRpbmc2XCI6IFwiaDZcIixcbiAgICBcInBhcmFncmFwaFwiOiBcInBcIixcbiAgICBcInByZWZvcm1hdHRlZFwiOiBcInByZVwiLFxuICAgIFwibGlzdC1pdGVtXCI6IFwibGlcIixcbiAgICBcIm8tbGlzdC1pdGVtXCI6IFwibGlcIixcbiAgICBcImdyb3VwLWxpc3QtaXRlbVwiOiBcInVsXCIsXG4gICAgXCJncm91cC1vLWxpc3QtaXRlbVwiOiBcIm9sXCIsXG4gICAgXCJzdHJvbmdcIjogXCJzdHJvbmdcIixcbiAgICBcImVtXCI6IFwiZW1cIlxuICB9O1xuXG4gIGlmIChUQUdfTkFNRVNbZWxlbWVudC50eXBlXSkge1xuICAgIHZhciBuYW1lID0gVEFHX05BTUVTW2VsZW1lbnQudHlwZV07XG4gICAgdmFyIGNsYXNzQ29kZSA9IGVsZW1lbnQubGFiZWwgPyAoJyBjbGFzcz1cIicgKyBlbGVtZW50LmxhYmVsICsgJ1wiJykgOiAnJztcbiAgICByZXR1cm4gJzwnICsgbmFtZSArIGNsYXNzQ29kZSArICc+JyArIGNvbnRlbnQgKyAnPC8nICsgbmFtZSArICc+JztcbiAgfVxuXG4gIGlmIChlbGVtZW50LnR5cGUgPT0gXCJpbWFnZVwiKSB7XG4gICAgdmFyIGxhYmVsID0gZWxlbWVudC5sYWJlbCA/IChcIiBcIiArIGVsZW1lbnQubGFiZWwpIDogXCJcIjtcbiAgICB2YXIgaW1nVGFnID0gJzxpbWcgc3JjPVwiJyArIGVsZW1lbnQudXJsICsgJ1wiIGFsdD1cIicgKyBlbGVtZW50LmFsdCArICdcIj4nO1xuICAgIHJldHVybiAnPHAgY2xhc3M9XCJibG9jay1pbWcnICsgbGFiZWwgKyAnXCI+JyArXG4gICAgICAoZWxlbWVudC5saW5rVXJsID8gKCc8YSBocmVmPVwiJyArIGVsZW1lbnQubGlua1VybCArICdcIj4nICsgaW1nVGFnICsgJzwvYT4nKSA6IGltZ1RhZykgK1xuICAgICAgJzwvcD4nO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudHlwZSA9PSBcImVtYmVkXCIpIHtcbiAgICByZXR1cm4gJzxkaXYgZGF0YS1vZW1iZWQ9XCInKyBlbGVtZW50LmVtYmVkX3VybCArXG4gICAgICAnXCIgZGF0YS1vZW1iZWQtdHlwZT1cIicrIGVsZW1lbnQudHlwZSArXG4gICAgICAnXCIgZGF0YS1vZW1iZWQtcHJvdmlkZXI9XCInKyBlbGVtZW50LnByb3ZpZGVyX25hbWUgK1xuICAgICAgKGVsZW1lbnQubGFiZWwgPyAoJ1wiIGNsYXNzPVwiJyArIGVsZW1lbnQubGFiZWwpIDogJycpICtcbiAgICAgICdcIj4nICsgZWxlbWVudC5vZW1iZWQuaHRtbCtcIjwvZGl2PlwiO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudHlwZSA9PT0gJ2h5cGVybGluaycpIHtcbiAgICByZXR1cm4gJzxhIGhyZWY9XCInICsgZWxlbWVudC51cmwgKyAnXCI+JyArIGNvbnRlbnQgKyAnPC9hPic7XG4gIH1cblxuICBpZiAoZWxlbWVudC50eXBlID09PSAnbGFiZWwnKSB7XG4gICAgcmV0dXJuICc8c3BhbiBjbGFzcz1cIicgKyBlbGVtZW50LmRhdGEubGFiZWwgKyAnXCI+JyArIGNvbnRlbnQgKyAnPC9zcGFuPic7XG4gIH1cblxuICByZXR1cm4gXCI8IS0tIFdhcm5pbmc6IFwiICsgZWxlbWVudC50eXBlICsgXCIgbm90IGltcGxlbWVudGVkLiBVcGdyYWRlIHRoZSBEZXZlbG9wZXIgS2l0LiAtLT5cIiArIGNvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBFbWJlZDogRW1iZWQsXG4gIEltYWdlOiBJbWFnZUVsLFxuICBJbWFnZVZpZXc6IEltYWdlVmlldyxcbiAgVGV4dDogVGV4dCxcbiAgTnVtYmVyOiBOdW0sXG4gIERhdGU6IERhdGVGcmFnbWVudCxcbiAgVGltZXN0YW1wOiBUaW1lc3RhbXAsXG4gIFNlbGVjdDogU2VsZWN0LFxuICBDb2xvcjogQ29sb3IsXG4gIFN0cnVjdHVyZWRUZXh0OiBTdHJ1Y3R1cmVkVGV4dCxcbiAgV2ViTGluazogV2ViTGluayxcbiAgRG9jdW1lbnRMaW5rOiBEb2N1bWVudExpbmssXG4gIEltYWdlTGluazogSW1hZ2VMaW5rLFxuICBGaWxlTGluazogRmlsZUxpbmssXG4gIEdyb3VwOiBHcm91cCxcbiAgR2VvUG9pbnQ6IEdlb1BvaW50LFxuICBTbGljZTogU2xpY2UsXG4gIFNsaWNlWm9uZTogU2xpY2Vab25lLFxuICBpbml0RmllbGQ6IGluaXRGaWVsZCxcbiAgcGFyc2VGcmFnbWVudHM6IHBhcnNlRnJhZ21lbnRzLFxuICBpbnNlcnRTcGFuczogaW5zZXJ0U3BhbnNcbn07XG4iLCJcbi8qKlxuICogQSBkb3VibHkgbGlua2VkIGxpc3QtYmFzZWQgTGVhc3QgUmVjZW50bHkgVXNlZCAoTFJVKSBjYWNoZS4gV2lsbCBrZWVwIG1vc3RcbiAqIHJlY2VudGx5IHVzZWQgaXRlbXMgd2hpbGUgZGlzY2FyZGluZyBsZWFzdCByZWNlbnRseSB1c2VkIGl0ZW1zIHdoZW4gaXRzIGxpbWl0XG4gKiBpcyByZWFjaGVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVC4gQ29weXJpZ2h0IChjKSAyMDEwIFJhc211cyBBbmRlcnNzb24gPGh0dHA6Ly9odW5jaC5zZS8+XG4gKiBTZWUgUkVBRE1FLm1kIGZvciBkZXRhaWxzLlxuICpcbiAqIElsbHVzdHJhdGlvbiBvZiB0aGUgZGVzaWduOlxuICpcbiAqICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5ICAgICAgICAgICAgIGVudHJ5XG4gKiAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX18gICAgICAgICAgICBfX19fX19cbiAqICAgICAgfCBoZWFkIHwubmV3ZXIgPT4gfCAgICAgIHwubmV3ZXIgPT4gfCAgICAgIHwubmV3ZXIgPT4gfCB0YWlsIHxcbiAqICAgICAgfCAgQSAgIHwgICAgICAgICAgfCAgQiAgIHwgICAgICAgICAgfCAgQyAgIHwgICAgICAgICAgfCAgRCAgIHxcbiAqICAgICAgfF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3wgPD0gb2xkZXIufF9fX19fX3xcbiAqXG4gKiAgcmVtb3ZlZCAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIDwtLSAgPC0tICA8LS0gIGFkZGVkXG4gKi9cbmZ1bmN0aW9uIExSVUNhY2hlIChsaW1pdCkge1xuICAvLyBDdXJyZW50IHNpemUgb2YgdGhlIGNhY2hlLiAoUmVhZC1vbmx5KS5cbiAgdGhpcy5zaXplID0gMDtcbiAgLy8gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdGhpcyBjYWNoZSBjYW4gaG9sZC5cbiAgdGhpcy5saW1pdCA9IGxpbWl0O1xuICB0aGlzLl9rZXltYXAgPSB7fTtcbn1cblxuLyoqXG4gKiBQdXQgPHZhbHVlPiBpbnRvIHRoZSBjYWNoZSBhc3NvY2lhdGVkIHdpdGggPGtleT4uIFJldHVybnMgdGhlIGVudHJ5IHdoaWNoIHdhc1xuICogcmVtb3ZlZCB0byBtYWtlIHJvb20gZm9yIHRoZSBuZXcgZW50cnkuIE90aGVyd2lzZSB1bmRlZmluZWQgaXMgcmV0dXJuZWRcbiAqIChpLmUuIGlmIHRoZXJlIHdhcyBlbm91Z2ggcm9vbSBhbHJlYWR5KS5cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnB1dCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgdmFyIGVudHJ5ID0ge2tleTprZXksIHZhbHVlOnZhbHVlfTtcbiAgLy8gTm90ZTogTm8gcHJvdGVjdGlvbiBhZ2FpbnMgcmVwbGFjaW5nLCBhbmQgdGh1cyBvcnBoYW4gZW50cmllcy4gQnkgZGVzaWduLlxuICB0aGlzLl9rZXltYXBba2V5XSA9IGVudHJ5O1xuICBpZiAodGhpcy50YWlsKSB7XG4gICAgLy8gbGluayBwcmV2aW91cyB0YWlsIHRvIHRoZSBuZXcgdGFpbCAoZW50cnkpXG4gICAgdGhpcy50YWlsLm5ld2VyID0gZW50cnk7XG4gICAgZW50cnkub2xkZXIgPSB0aGlzLnRhaWw7XG4gIH0gZWxzZSB7XG4gICAgLy8gd2UncmUgZmlyc3QgaW4gLS0geWF5XG4gICAgdGhpcy5oZWFkID0gZW50cnk7XG4gIH1cbiAgLy8gYWRkIG5ldyBlbnRyeSB0byB0aGUgZW5kIG9mIHRoZSBsaW5rZWQgbGlzdCAtLSBpdCdzIG5vdyB0aGUgZnJlc2hlc3QgZW50cnkuXG4gIHRoaXMudGFpbCA9IGVudHJ5O1xuICBpZiAodGhpcy5zaXplID09PSB0aGlzLmxpbWl0KSB7XG4gICAgLy8gd2UgaGl0IHRoZSBsaW1pdCAtLSByZW1vdmUgdGhlIGhlYWRcbiAgICByZXR1cm4gdGhpcy5zaGlmdCgpO1xuICB9IGVsc2Uge1xuICAgIC8vIGluY3JlYXNlIHRoZSBzaXplIGNvdW50ZXJcbiAgICB0aGlzLnNpemUrKztcbiAgfVxufTtcblxuLyoqXG4gKiBQdXJnZSB0aGUgbGVhc3QgcmVjZW50bHkgdXNlZCAob2xkZXN0KSBlbnRyeSBmcm9tIHRoZSBjYWNoZS4gUmV0dXJucyB0aGVcbiAqIHJlbW92ZWQgZW50cnkgb3IgdW5kZWZpbmVkIGlmIHRoZSBjYWNoZSB3YXMgZW1wdHkuXG4gKlxuICogSWYgeW91IG5lZWQgdG8gcGVyZm9ybSBhbnkgZm9ybSBvZiBmaW5hbGl6YXRpb24gb2YgcHVyZ2VkIGl0ZW1zLCB0aGlzIGlzIGFcbiAqIGdvb2QgcGxhY2UgdG8gZG8gaXQuIFNpbXBseSBvdmVycmlkZS9yZXBsYWNlIHRoaXMgZnVuY3Rpb246XG4gKlxuICogICB2YXIgYyA9IG5ldyBMUlVDYWNoZSgxMjMpO1xuICogICBjLnNoaWZ0ID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgdmFyIGVudHJ5ID0gTFJVQ2FjaGUucHJvdG90eXBlLnNoaWZ0LmNhbGwodGhpcyk7XG4gKiAgICAgZG9Tb21ldGhpbmdXaXRoKGVudHJ5KTtcbiAqICAgICByZXR1cm4gZW50cnk7XG4gKiAgIH1cbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24oKSB7XG4gIC8vIHRvZG86IGhhbmRsZSBzcGVjaWFsIGNhc2Ugd2hlbiBsaW1pdCA9PSAxXG4gIHZhciBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgaWYgKGVudHJ5KSB7XG4gICAgaWYgKHRoaXMuaGVhZC5uZXdlcikge1xuICAgICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkLm5ld2VyO1xuICAgICAgdGhpcy5oZWFkLm9sZGVyID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhlYWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIFJlbW92ZSBsYXN0IHN0cm9uZyByZWZlcmVuY2UgdG8gPGVudHJ5PiBhbmQgcmVtb3ZlIGxpbmtzIGZyb20gdGhlIHB1cmdlZFxuICAgIC8vIGVudHJ5IGJlaW5nIHJldHVybmVkOlxuICAgIGVudHJ5Lm5ld2VyID0gZW50cnkub2xkZXIgPSB1bmRlZmluZWQ7XG4gICAgLy8gZGVsZXRlIGlzIHNsb3csIGJ1dCB3ZSBuZWVkIHRvIGRvIHRoaXMgdG8gYXZvaWQgdW5jb250cm9sbGFibGUgZ3Jvd3RoOlxuICAgIGRlbGV0ZSB0aGlzLl9rZXltYXBbZW50cnkua2V5XTtcbiAgfVxuICByZXR1cm4gZW50cnk7XG59O1xuXG4vKipcbiAqIEdldCBhbmQgcmVnaXN0ZXIgcmVjZW50IHVzZSBvZiA8a2V5Pi4gUmV0dXJucyB0aGUgdmFsdWUgYXNzb2NpYXRlZCB3aXRoIDxrZXk+XG4gKiBvciB1bmRlZmluZWQgaWYgbm90IGluIGNhY2hlLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oa2V5LCByZXR1cm5FbnRyeSkge1xuICAvLyBGaXJzdCwgZmluZCBvdXIgY2FjaGUgZW50cnlcbiAgdmFyIGVudHJ5ID0gdGhpcy5fa2V5bWFwW2tleV07XG4gIGlmIChlbnRyeSA9PT0gdW5kZWZpbmVkKSByZXR1cm47IC8vIE5vdCBjYWNoZWQuIFNvcnJ5LlxuICAvLyBBcyA8a2V5PiB3YXMgZm91bmQgaW4gdGhlIGNhY2hlLCByZWdpc3RlciBpdCBhcyBiZWluZyByZXF1ZXN0ZWQgcmVjZW50bHlcbiAgaWYgKGVudHJ5ID09PSB0aGlzLnRhaWwpIHtcbiAgICAvLyBBbHJlYWR5IHRoZSBtb3N0IHJlY2VubHR5IHVzZWQgZW50cnksIHNvIG5vIG5lZWQgdG8gdXBkYXRlIHRoZSBsaXN0XG4gICAgcmV0dXJuIHJldHVybkVudHJ5ID8gZW50cnkgOiBlbnRyeS52YWx1ZTtcbiAgfVxuICAvLyBIRUFELS0tLS0tLS0tLS0tLS1UQUlMXG4gIC8vICAgPC5vbGRlciAgIC5uZXdlcj5cbiAgLy8gIDwtLS0gYWRkIGRpcmVjdGlvbiAtLVxuICAvLyAgIEEgIEIgIEMgIDxEPiAgRVxuICBpZiAoZW50cnkubmV3ZXIpIHtcbiAgICBpZiAoZW50cnkgPT09IHRoaXMuaGVhZClcbiAgICAgIHRoaXMuaGVhZCA9IGVudHJ5Lm5ld2VyO1xuICAgIGVudHJ5Lm5ld2VyLm9sZGVyID0gZW50cnkub2xkZXI7IC8vIEMgPC0tIEUuXG4gIH1cbiAgaWYgKGVudHJ5Lm9sZGVyKVxuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gZW50cnkubmV3ZXI7IC8vIEMuIC0tPiBFXG4gIGVudHJ5Lm5ld2VyID0gdW5kZWZpbmVkOyAvLyBEIC0teFxuICBlbnRyeS5vbGRlciA9IHRoaXMudGFpbDsgLy8gRC4gLS0+IEVcbiAgaWYgKHRoaXMudGFpbClcbiAgICB0aGlzLnRhaWwubmV3ZXIgPSBlbnRyeTsgLy8gRS4gPC0tIERcbiAgdGhpcy50YWlsID0gZW50cnk7XG4gIHJldHVybiByZXR1cm5FbnRyeSA/IGVudHJ5IDogZW50cnkudmFsdWU7XG59O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBGb2xsb3dpbmcgY29kZSBpcyBvcHRpb25hbCBhbmQgY2FuIGJlIHJlbW92ZWQgd2l0aG91dCBicmVha2luZyB0aGUgY29yZVxuLy8gZnVuY3Rpb25hbGl0eS5cblxuLyoqXG4gKiBDaGVjayBpZiA8a2V5PiBpcyBpbiB0aGUgY2FjaGUgd2l0aG91dCByZWdpc3RlcmluZyByZWNlbnQgdXNlLiBGZWFzaWJsZSBpZlxuICogeW91IGRvIG5vdCB3YW50IHRvIGNoYWdlIHRoZSBzdGF0ZSBvZiB0aGUgY2FjaGUsIGJ1dCBvbmx5IFwicGVla1wiIGF0IGl0LlxuICogUmV0dXJucyB0aGUgZW50cnkgYXNzb2NpYXRlZCB3aXRoIDxrZXk+IGlmIGZvdW5kLCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKGtleSkge1xuICByZXR1cm4gdGhpcy5fa2V5bWFwW2tleV07XG59O1xuXG4vKipcbiAqIFVwZGF0ZSB0aGUgdmFsdWUgb2YgZW50cnkgd2l0aCA8a2V5Pi4gUmV0dXJucyB0aGUgb2xkIHZhbHVlLCBvciB1bmRlZmluZWQgaWZcbiAqIGVudHJ5IHdhcyBub3QgaW4gdGhlIGNhY2hlLlxuICovXG5MUlVDYWNoZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICB2YXIgb2xkdmFsdWUsIGVudHJ5ID0gdGhpcy5nZXQoa2V5LCB0cnVlKTtcbiAgaWYgKGVudHJ5KSB7XG4gICAgb2xkdmFsdWUgPSBlbnRyeS52YWx1ZTtcbiAgICBlbnRyeS52YWx1ZSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIG9sZHZhbHVlID0gdGhpcy5wdXQoa2V5LCB2YWx1ZSk7XG4gICAgaWYgKG9sZHZhbHVlKSBvbGR2YWx1ZSA9IG9sZHZhbHVlLnZhbHVlO1xuICB9XG4gIHJldHVybiBvbGR2YWx1ZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGVudHJ5IDxrZXk+IGZyb20gY2FjaGUgYW5kIHJldHVybiBpdHMgdmFsdWUuIFJldHVybnMgdW5kZWZpbmVkIGlmIG5vdFxuICogZm91bmQuXG4gKi9cbkxSVUNhY2hlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHtcbiAgdmFyIGVudHJ5ID0gdGhpcy5fa2V5bWFwW2tleV07XG4gIGlmICghZW50cnkpIHJldHVybjtcbiAgZGVsZXRlIHRoaXMuX2tleW1hcFtlbnRyeS5rZXldOyAvLyBuZWVkIHRvIGRvIGRlbGV0ZSB1bmZvcnR1bmF0ZWx5XG4gIGlmIChlbnRyeS5uZXdlciAmJiBlbnRyeS5vbGRlcikge1xuICAgIC8vIHJlbGluayB0aGUgb2xkZXIgZW50cnkgd2l0aCB0aGUgbmV3ZXIgZW50cnlcbiAgICBlbnRyeS5vbGRlci5uZXdlciA9IGVudHJ5Lm5ld2VyO1xuICAgIGVudHJ5Lm5ld2VyLm9sZGVyID0gZW50cnkub2xkZXI7XG4gIH0gZWxzZSBpZiAoZW50cnkubmV3ZXIpIHtcbiAgICAvLyByZW1vdmUgdGhlIGxpbmsgdG8gdXNcbiAgICBlbnRyeS5uZXdlci5vbGRlciA9IHVuZGVmaW5lZDtcbiAgICAvLyBsaW5rIHRoZSBuZXdlciBlbnRyeSB0byBoZWFkXG4gICAgdGhpcy5oZWFkID0gZW50cnkubmV3ZXI7XG4gIH0gZWxzZSBpZiAoZW50cnkub2xkZXIpIHtcbiAgICAvLyByZW1vdmUgdGhlIGxpbmsgdG8gdXNcbiAgICBlbnRyeS5vbGRlci5uZXdlciA9IHVuZGVmaW5lZDtcbiAgICAvLyBsaW5rIHRoZSBuZXdlciBlbnRyeSB0byBoZWFkXG4gICAgdGhpcy50YWlsID0gZW50cnkub2xkZXI7XG4gIH0gZWxzZSB7Ly8gaWYoZW50cnkub2xkZXIgPT09IHVuZGVmaW5lZCAmJiBlbnRyeS5uZXdlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgdGhpcy5zaXplLS07XG4gIHJldHVybiBlbnRyeS52YWx1ZTtcbn07XG5cbi8qKiBSZW1vdmVzIGFsbCBlbnRyaWVzICovXG5MUlVDYWNoZS5wcm90b3R5cGUucmVtb3ZlQWxsID0gZnVuY3Rpb24oKSB7XG4gIC8vIFRoaXMgc2hvdWxkIGJlIHNhZmUsIGFzIHdlIG5ldmVyIGV4cG9zZSBzdHJvbmcgcmVmcmVuY2VzIHRvIHRoZSBvdXRzaWRlXG4gIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IHVuZGVmaW5lZDtcbiAgdGhpcy5zaXplID0gMDtcbiAgdGhpcy5fa2V5bWFwID0ge307XG59O1xuXG4vKipcbiAqIFJldHVybiBhbiBhcnJheSBjb250YWluaW5nIGFsbCBrZXlzIG9mIGVudHJpZXMgc3RvcmVkIGluIHRoZSBjYWNoZSBvYmplY3QsIGluXG4gKiBhcmJpdHJhcnkgb3JkZXIuXG4gKi9cbmlmICh0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbicpIHtcbiAgTFJVQ2FjaGUucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2tleW1hcCk7IH07XG59IGVsc2Uge1xuICBMUlVDYWNoZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIgayBpbiB0aGlzLl9rZXltYXApIGtleXMucHVzaChrKTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcbn1cblxuLyoqXG4gKiBDYWxsIGBmdW5gIGZvciBlYWNoIGVudHJ5LiBTdGFydGluZyB3aXRoIHRoZSBuZXdlc3QgZW50cnkgaWYgYGRlc2NgIGlzIGEgdHJ1ZVxuICogdmFsdWUsIG90aGVyd2lzZSBzdGFydHMgd2l0aCB0aGUgb2xkZXN0IChoZWFkKSBlbnJ0eSBhbmQgbW92ZXMgdG93YXJkcyB0aGVcbiAqIHRhaWwuXG4gKlxuICogYGZ1bmAgaXMgY2FsbGVkIHdpdGggMyBhcmd1bWVudHMgaW4gdGhlIGNvbnRleHQgYGNvbnRleHRgOlxuICogICBgZnVuLmNhbGwoY29udGV4dCwgT2JqZWN0IGtleSwgT2JqZWN0IHZhbHVlLCBMUlVDYWNoZSBzZWxmKWBcbiAqL1xuTFJVQ2FjaGUucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihmdW4sIGNvbnRleHQsIGRlc2MpIHtcbiAgdmFyIGVudHJ5O1xuICBpZiAoY29udGV4dCA9PT0gdHJ1ZSkgeyBkZXNjID0gdHJ1ZTsgY29udGV4dCA9IHVuZGVmaW5lZDsgfVxuICBlbHNlIGlmICh0eXBlb2YgY29udGV4dCAhPT0gJ29iamVjdCcpIGNvbnRleHQgPSB0aGlzO1xuICBpZiAoZGVzYykge1xuICAgIGVudHJ5ID0gdGhpcy50YWlsO1xuICAgIHdoaWxlIChlbnRyeSkge1xuICAgICAgZnVuLmNhbGwoY29udGV4dCwgZW50cnkua2V5LCBlbnRyeS52YWx1ZSwgdGhpcyk7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm9sZGVyO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBlbnRyeSA9IHRoaXMuaGVhZDtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGZ1bi5jYWxsKGNvbnRleHQsIGVudHJ5LmtleSwgZW50cnkudmFsdWUsIHRoaXMpO1xuICAgICAgZW50cnkgPSBlbnRyeS5uZXdlcjtcbiAgICB9XG4gIH1cbn07XG5cbi8qKiBSZXR1cm5zIGEgSlNPTiAoYXJyYXkpIHJlcHJlc2VudGF0aW9uICovXG5MUlVDYWNoZS5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzID0gW10sIGVudHJ5ID0gdGhpcy5oZWFkO1xuICB3aGlsZSAoZW50cnkpIHtcbiAgICBzLnB1c2goe2tleTplbnRyeS5rZXkudG9KU09OKCksIHZhbHVlOmVudHJ5LnZhbHVlLnRvSlNPTigpfSk7XG4gICAgZW50cnkgPSBlbnRyeS5uZXdlcjtcbiAgfVxuICByZXR1cm4gcztcbn07XG5cbi8qKiBSZXR1cm5zIGEgU3RyaW5nIHJlcHJlc2VudGF0aW9uICovXG5MUlVDYWNoZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHMgPSAnJywgZW50cnkgPSB0aGlzLmhlYWQ7XG4gIHdoaWxlIChlbnRyeSkge1xuICAgIHMgKz0gU3RyaW5nKGVudHJ5LmtleSkrJzonK2VudHJ5LnZhbHVlO1xuICAgIGVudHJ5ID0gZW50cnkubmV3ZXI7XG4gICAgaWYgKGVudHJ5KVxuICAgICAgcyArPSAnIDwgJztcbiAgfVxuICByZXR1cm4gcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTFJVQ2FjaGU7XG4iLCJcblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEBnbG9iYWxcbiAqIEBuYW1lc3BhY2VcbiAqIEBhbGlhcyBQcmVkaWNhdGVzXG4gKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcImF0XCIgcHJlZGljYXRlOiBlcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuYXQoXCJkb2N1bWVudC50eXBlXCIsIFwiYXJ0aWNsZVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBhdDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJhdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcIm5vdFwiIHByZWRpY2F0ZTogaW5lcXVhbGl0eSBvZiBhIGZyYWdtZW50IHRvIGEgdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubm90KFwiZG9jdW1lbnQudHlwZVwiLCBcImFydGljbGVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgbm90OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcIm5vdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwibWlzc2luZ1wiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSByZXF1ZXN0ZWQgZmllbGQgaXMgZW1wdHlcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5taXNzaW5nKFwibXkuYmxvZy1wb3N0LmF1dGhvclwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIG1pc3Npbmc6IGZ1bmN0aW9uKGZyYWdtZW50KSB7IHJldHVybiBbXCJtaXNzaW5nXCIsIGZyYWdtZW50XTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImhhc1wiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSByZXF1ZXN0ZWQgZmllbGQgaXMgZGVmaW5lZFxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhhcyhcIm15LmJsb2ctcG9zdC5hdXRob3JcIilcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBoYXM6IGZ1bmN0aW9uKGZyYWdtZW50KSB7IHJldHVybiBbXCJoYXNcIiwgZnJhZ21lbnRdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhbiBcImFueVwiIHByZWRpY2F0ZTogZXF1YWxpdHkgb2YgYSBmcmFnbWVudCB0byBhIHZhbHVlLlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmFueShcImRvY3VtZW50LnR5cGVcIiwgW1wiYXJ0aWNsZVwiLCBcImJsb2ctcG9zdFwiXSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9XG4gICAqIEBwYXJhbSB2YWx1ZXMge0FycmF5fVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgYW55OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWVzKSB7IHJldHVybiBbXCJhbnlcIiwgZnJhZ21lbnQsIHZhbHVlc107IH0sXG5cbiAgLyoqXG4gICAqIEJ1aWxkIGFuIFwiaW5cIiBwcmVkaWNhdGU6IGVxdWFsaXR5IG9mIGEgZnJhZ21lbnQgdG8gYSB2YWx1ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5pbihcIm15LnByb2R1Y3QucHJpY2VcIiwgWzQsIDVdKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ31cbiAgICogQHBhcmFtIHZhbHVlcyB7QXJyYXl9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICAgIGluOiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWVzKSB7IHJldHVybiBbXCJpblwiLCBmcmFnbWVudCwgdmFsdWVzXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImZ1bGx0ZXh0XCIgcHJlZGljYXRlOiBmdWxsdGV4dCBzZWFyY2ggaW4gYSBmcmFnbWVudC5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5mdWxsdGV4dChcIm15LmFydGljbGUuYm9keVwiLCBcInNhdXNhZ2VcIl0pXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfVxuICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gdGhlIHRlcm0gdG8gc2VhcmNoXG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBmdWxsdGV4dDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJmdWxsdGV4dFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwic2ltaWxhclwiIHByZWRpY2F0ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5zaW1pbGFyKFwiVVhhc2RGd2U0MkRcIiwgMTApXG4gICAqIEBwYXJhbSBkb2N1bWVudElkIHtTdHJpbmd9IHRoZSBkb2N1bWVudCBpZCB0byByZXRyaWV2ZSBzaW1pbGFyIGRvY3VtZW50cyB0by5cbiAgICogQHBhcmFtIG1heFJlc3VsdHMge051bWJlcn0gdGhlIG1heGltdW0gbnVtYmVyIG9mIHJlc3VsdHMgdG8gcmV0dXJuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBzaW1pbGFyOiBmdW5jdGlvbihkb2N1bWVudElkLCBtYXhSZXN1bHRzKSB7IHJldHVybiBbXCJzaW1pbGFyXCIsIGRvY3VtZW50SWQsIG1heFJlc3VsdHNdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwibnVtYmVyLmd0XCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGdyZWF0ZXIgdGhhbiB0aGUgZ2l2ZW4gdmFsdWUuXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZ3QoXCJteS5wcm9kdWN0LnByaWNlXCIsIDEwKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIG51bWJlci5cbiAgICogQHBhcmFtIHZhbHVlIHtOdW1iZXJ9IHRoZSBsb3dlciBib3VuZCBvZiB0aGUgcHJlZGljYXRlXG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBndDogZnVuY3Rpb24oZnJhZ21lbnQsIHZhbHVlKSB7IHJldHVybiBbXCJudW1iZXIuZ3RcIiwgZnJhZ21lbnQsIHZhbHVlXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcIm51bWJlci5sdFwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBsb3dlciB0aGFuIHRoZSBnaXZlbiB2YWx1ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5sdChcIm15LnByb2R1Y3QucHJpY2VcIiwgMjApXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgbnVtYmVyLlxuICAgKiBAcGFyYW0gdmFsdWUge051bWJlcn0gdGhlIHVwcGVyIGJvdW5kIG9mIHRoZSBwcmVkaWNhdGVcbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGx0OiBmdW5jdGlvbihmcmFnbWVudCwgdmFsdWUpIHsgcmV0dXJuIFtcIm51bWJlci5sdFwiLCBmcmFnbWVudCwgdmFsdWVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwibnVtYmVyLmluUmFuZ2VcIiBwcmVkaWNhdGU6IGNvbWJpbmF0aW9uIG9mIGx0IGFuZCBndC5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5pblJhbmdlKFwibXkucHJvZHVjdC5wcmljZVwiLCAxMCwgMjApXG4gICAqIEBwYXJhbSBmcmFnbWVudCB7U3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgZmllbGQgLSBtdXN0IGJlIGEgbnVtYmVyLlxuICAgKiBAcGFyYW0gYmVmb3JlIHtOdW1iZXJ9XG4gICAqIEBwYXJhbSBhZnRlciB7TnVtYmVyfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByZWRpY2F0ZVxuICAgKi9cbiAgaW5SYW5nZTogZnVuY3Rpb24oZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXIpIHsgcmV0dXJuIFtcIm51bWJlci5pblJhbmdlXCIsIGZyYWdtZW50LCBiZWZvcmUsIGFmdGVyXTsgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBcImRhdGUuYmVmb3JlXCIgcHJlZGljYXRlOiBkb2N1bWVudHMgd2hlcmUgdGhlIGZyYWdtZW50IGZpZWxkIGlzIGJlZm9yZSB0aGUgZ2l2ZW4gZGF0ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBuZXcgRGF0ZSgyMDE0LCA2LCAxKSlcbiAgICogQHBhcmFtIGZyYWdtZW50IHtTdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBmaWVsZCAtIG11c3QgYmUgYSBkYXRlIG9yIHRpbWVzdGFtcCBmaWVsZC5cbiAgICogQHBhcmFtIGJlZm9yZSB7RGF0ZX1cbiAgICogQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmVkaWNhdGVcbiAgICovXG4gIGRhdGVCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBiZWZvcmUpIHsgcmV0dXJuIFtcImRhdGUuYmVmb3JlXCIsIGZyYWdtZW50LCBiZWZvcmVdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwiZGF0ZS5hZnRlclwiIHByZWRpY2F0ZTogZG9jdW1lbnRzIHdoZXJlIHRoZSBmcmFnbWVudCBmaWVsZCBpcyBhZnRlciB0aGUgZ2l2ZW4gZGF0ZS5cbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIG5ldyBEYXRlKDIwMTQsIDEsIDEpKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIGRhdGUgb3IgdGltZXN0YW1wIGZpZWxkLlxuICAgKiBAcGFyYW0gYWZ0ZXIge0RhdGV9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBkYXRlQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBhZnRlcikgeyByZXR1cm4gW1wiZGF0ZS5hZnRlclwiLCBmcmFnbWVudCwgYWZ0ZXJdOyB9LFxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFwiZGF0ZS5iZXR3ZWVuXCIgcHJlZGljYXRlOiBjb21iaW5hdGlvbiBvZiBkYXRlQmVmb3JlIGFuZCBkYXRlQWZ0ZXJcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXRlQmV0d2VlbihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgbmV3IERhdGUoMjAxNCwgMSwgMSksIG5ldyBEYXRlKDIwMTQsIDYsIDEpKVxuICAgKiBAcGFyYW0gZnJhZ21lbnQge1N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGZpZWxkIC0gbXVzdCBiZSBhIGRhdGUgb3IgdGltZXN0YW1wIGZpZWxkLlxuICAgKiBAcGFyYW0gYmVmb3JlIHtEYXRlfVxuICAgKiBAcGFyYW0gYWZ0ZXIge0RhdGV9XG4gICAqIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgY29ycmVzcG9uZGluZyB0byB0aGUgcHJlZGljYXRlXG4gICAqL1xuICBkYXRlQmV0d2VlbjogZnVuY3Rpb24oZnJhZ21lbnQsIGJlZm9yZSwgYWZ0ZXIpIHsgcmV0dXJuIFtcImRhdGUuYmV0d2VlblwiLCBmcmFnbWVudCwgYmVmb3JlLCBhZnRlcl07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZNb250aChcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTQpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ9IGJldHdlZW4gMSBhbmQgMzFcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZNb250aDogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2YtbW9udGhcIiwgZnJhZ21lbnQsIGRheV07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuZGF5T2ZNb250aEFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxNClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcn0gYmV0d2VlbiAxIGFuZCAzMVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZk1vbnRoQWZ0ZXI6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLW1vbnRoLWFmdGVyXCIsIGZyYWdtZW50LCBkYXldOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmRheU9mTW9udGhCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfSBiZXR3ZWVuIDEgYW5kIDMxXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mTW9udGhCZWZvcmU6IGZ1bmN0aW9uKGZyYWdtZW50LCBkYXkpIHsgcmV0dXJuIFtcImRhdGUuZGF5LW9mLW1vbnRoLWJlZm9yZVwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWsoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDE0KVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGRheSB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgNyBvciBzdHJpbmcgYmV0d2VlbiBcIk1vbmRheVwiIGFuZCBcIlN1bmRheVwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGRheU9mV2VlazogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2Ytd2Vla1wiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWtBZnRlcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJXZWRuZXNkYXlcIilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBkYXkge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDcgb3Igc3RyaW5nIGJldHdlZW4gXCJNb25kYXlcIiBhbmQgXCJTdW5kYXlcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBkYXlPZldlZWtBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGRheSkgeyByZXR1cm4gW1wiZGF0ZS5kYXktb2Ytd2Vlay1hZnRlclwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5kYXlPZldlZWtCZWZvcmUoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiV2VkbmVzZGF5XCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gZGF5IHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCA3IG9yIHN0cmluZyBiZXR3ZWVuIFwiTW9uZGF5XCIgYW5kIFwiU3VuZGF5XCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgZGF5T2ZXZWVrQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgZGF5KSB7IHJldHVybiBbXCJkYXRlLmRheS1vZi13ZWVrLWJlZm9yZVwiLCBmcmFnbWVudCwgZGF5XTsgfSxcblxuICAvKipcbiAgICpcbiAgICogQGV4YW1wbGUgUHJlZGljYXRlcy5tb250aChcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgXCJKdW5lXCIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gbW9udGgge051bWJlcnxTdHJpbmd9IE51bWJlciBiZXR3ZWVuIDEgYW5kIDEyIG9yIHN0cmluZyBiZXR3ZWVuIFwiSmFudWFyeVwiIGFuZCBcIkRlY2VtYmVyXCJcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgbW9udGg6IGZ1bmN0aW9uKGZyYWdtZW50LCBtb250aCkgeyByZXR1cm4gW1wiZGF0ZS5tb250aFwiLCBmcmFnbWVudCwgbW9udGhdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1vbnRoQmVmb3JlKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCBcIkp1bmVcIilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBtb250aCB7TnVtYmVyfFN0cmluZ30gTnVtYmVyIGJldHdlZW4gMSBhbmQgMTIgb3Igc3RyaW5nIGJldHdlZW4gXCJKYW51YXJ5XCIgYW5kIFwiRGVjZW1iZXJcIlxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBtb250aEJlZm9yZTogZnVuY3Rpb24oZnJhZ21lbnQsIG1vbnRoKSB7IHJldHVybiBbXCJkYXRlLm1vbnRoLWJlZm9yZVwiLCBmcmFnbWVudCwgbW9udGhdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLm1vbnRoQWZ0ZXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIFwiSnVuZVwiKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIG1vbnRoIHtOdW1iZXJ8U3RyaW5nfSBOdW1iZXIgYmV0d2VlbiAxIGFuZCAxMiBvciBzdHJpbmcgYmV0d2VlbiBcIkphbnVhcnlcIiBhbmQgXCJEZWNlbWJlclwiXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgbW9udGhBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIG1vbnRoKSB7IHJldHVybiBbXCJkYXRlLm1vbnRoLWFmdGVyXCIsIGZyYWdtZW50LCBtb250aF07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMueWVhcihcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMjAxNClcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSB5ZWFyIHtOdW1iZXJ9XG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIHllYXI6IGZ1bmN0aW9uKGZyYWdtZW50LCB5ZWFyKSB7IHJldHVybiBbXCJkYXRlLnllYXJcIiwgZnJhZ21lbnQsIHllYXJdOyB9LFxuXG4gIC8qKlxuICAgKlxuICAgKiBAZXhhbXBsZSBQcmVkaWNhdGVzLmhvdXIoXCJteS5wcm9kdWN0LnJlbGVhc2VEYXRlXCIsIDEyKVxuICAgKiBAcGFyYW0gZnJhZ21lbnRcbiAgICogQHBhcmFtIGhvdXIge051bWJlcn1cbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgaG91cjogZnVuY3Rpb24oZnJhZ21lbnQsIGhvdXIpIHsgcmV0dXJuIFtcImRhdGUuaG91clwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaG91ckJlZm9yZShcIm15LnByb2R1Y3QucmVsZWFzZURhdGVcIiwgMTIpXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gaG91ciB7TnVtYmVyfVxuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqL1xuICBob3VyQmVmb3JlOiBmdW5jdGlvbihmcmFnbWVudCwgaG91cikgeyByZXR1cm4gW1wiZGF0ZS5ob3VyLWJlZm9yZVwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMuaG91ckFmdGVyKFwibXkucHJvZHVjdC5yZWxlYXNlRGF0ZVwiLCAxMilcbiAgICogQHBhcmFtIGZyYWdtZW50XG4gICAqIEBwYXJhbSBob3VyIHtOdW1iZXJ9XG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICovXG4gIGhvdXJBZnRlcjogZnVuY3Rpb24oZnJhZ21lbnQsIGhvdXIpIHsgcmV0dXJuIFtcImRhdGUuaG91ci1hZnRlclwiLCBmcmFnbWVudCwgaG91cl07IH0sXG5cbiAgLyoqXG4gICAqXG4gICAqIEBleGFtcGxlIFByZWRpY2F0ZXMubmVhcihcIm15LnN0b3JlLmxvY2F0aW9uXCIsIDQ4Ljg3Njg3NjcsIDIuMzMzODgwMiwgMTApXG4gICAqIEBwYXJhbSBmcmFnbWVudFxuICAgKiBAcGFyYW0gbGF0aXR1ZGUge051bWJlcn1cbiAgICogQHBhcmFtIGxvbmdpdHVkZSB7TnVtYmVyfVxuICAgKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IGluIGtpbG9tZXRlcnNcbiAgICogQHJldHVybnMge0FycmF5fVxuICAgKi9cbiAgbmVhcjogZnVuY3Rpb24oZnJhZ21lbnQsIGxhdGl0dWRlLCBsb25naXR1ZGUsIHJhZGl1cykgeyByZXR1cm4gW1wiZ2VvcG9pbnQubmVhclwiLCBmcmFnbWVudCwgbGF0aXR1ZGUsIGxvbmdpdHVkZSwgcmFkaXVzXTsgfVxuXG59O1xuIiwiXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgY3JlYXRlRXJyb3IgPSBmdW5jdGlvbihzdGF0dXMsIG1lc3NhZ2UpIHtcbiAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyLnN0YXR1cyA9IHN0YXR1cztcbiAgcmV0dXJuIGVycjtcbn07XG5cbi8vIC0tIFJlcXVlc3QgaGFuZGxlcnNcblxudmFyIGFqYXhSZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICBpZih0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT0gJ3VuZGVmaW5lZCcgJiYgJ3dpdGhDcmVkZW50aWFscycgaW4gbmV3IFhNTEh0dHBSZXF1ZXN0KCkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24odXJsLCBjYWxsYmFjaykge1xuXG4gICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIC8vIENhbGxlZCBvbiBzdWNjZXNzXG4gICAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdHRsLCBjYWNoZUNvbnRyb2wgPSAvbWF4LWFnZVxccyo9XFxzKihcXGQrKS8uZXhlYyhcbiAgICAgICAgICB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnKSk7XG4gICAgICAgIGlmIChjYWNoZUNvbnRyb2wgJiYgY2FjaGVDb250cm9sLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB0dGwgPSBwYXJzZUludChjYWNoZUNvbnRyb2xbMV0sIDEwKTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhudWxsLCBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpLCB4aHIsIHR0bCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBDYWxsZWQgb24gZXJyb3JcbiAgICAgIHZhciByZWplY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHhoci5zdGF0dXM7XG4gICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKHN0YXR1cywgXCJVbmV4cGVjdGVkIHN0YXR1cyBjb2RlIFtcIiArIHN0YXR1cyArIFwiXSBvbiBVUkwgXCIrdXJsKSwgbnVsbCwgeGhyKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIEJpbmQgdGhlIFhIUiBmaW5pc2hlZCBjYWxsYmFja1xuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZih4aHIuc3RhdHVzICYmIHhoci5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gT3BlbiB0aGUgWEhSXG4gICAgICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgLy8gS2l0IHZlcnNpb24gKGNhbid0IG92ZXJyaWRlIHRoZSB1c2VyLWFnZW50IGNsaWVudCBzaWRlKVxuICAgICAgLy8geGhyLnNldFJlcXVlc3RIZWFkZXIoXCJYLVByaXNtaWMtVXNlci1BZ2VudFwiLCBcIlByaXNtaWMtamF2YXNjcmlwdC1raXQvJVZFUlNJT04lXCIucmVwbGFjZShcIiVWRVJTSU9OJVwiLCBHbG9iYWwuUHJpc21pYy52ZXJzaW9uKSk7XG5cbiAgICAgIC8vIEpzb24gcmVxdWVzdFxuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIFhIUlxuICAgICAgeGhyLnNlbmQoKTtcbiAgICB9O1xuICB9XG59KTtcblxudmFyIHhkb21haW5SZXF1ZXN0ID0gKGZ1bmN0aW9uKCkge1xuICBpZih0eXBlb2YgWERvbWFpblJlcXVlc3QgIT0gJ3VuZGVmaW5lZCcpIHsgLy8gSW50ZXJuZXQgRXhwbG9yZXJcbiAgICByZXR1cm4gZnVuY3Rpb24odXJsLCBjYWxsYmFjaykge1xuXG4gICAgICB2YXIgeGRyID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG5cbiAgICAgIC8vIENhbGxlZCBvbiBzdWNjZXNzXG4gICAgICB2YXIgcmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBKU09OLnBhcnNlKHhkci5yZXNwb25zZVRleHQpLCB4ZHIsIDApO1xuICAgICAgfTtcblxuICAgICAgLy8gQ2FsbGVkIG9uIGVycm9yXG4gICAgICB2YXIgcmVqZWN0ID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGNhbGxiYWNrKG5ldyBFcnJvcihtc2cpLCBudWxsLCB4ZHIpO1xuICAgICAgfTtcblxuICAgICAgLy8gQmluZCB0aGUgWERSIGZpbmlzaGVkIGNhbGxiYWNrXG4gICAgICB4ZHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUoeGRyKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIEJpbmQgdGhlIFhEUiBlcnJvciBjYWxsYmFja1xuICAgICAgeGRyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KFwiVW5leHBlY3RlZCBzdGF0dXMgY29kZSBvbiBVUkwgXCIgKyB1cmwpO1xuICAgICAgfTtcblxuICAgICAgLy8gT3BlbiB0aGUgWEhSXG4gICAgICB4ZHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgLy8gQmluZCB0aGUgWERSIHRpbWVvdXQgY2FsbGJhY2tcbiAgICAgIHhkci5vbnRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJlamVjdChcIlJlcXVlc3QgdGltZW91dFwiKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIEVtcHR5IGNhbGxiYWNrLiBJRSBzb21ldGltZXMgYWJvcnQgdGhlIHJlcWV1c3QgaWZcbiAgICAgIC8vIHRoaXMgaXMgbm90IHByZXNlbnRcbiAgICAgIHhkci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkgeyB9O1xuXG4gICAgICB4ZHIuc2VuZCgpO1xuICAgIH07XG4gIH1cbn0pO1xuXG52YXIgbm9kZUpTUmVxdWVzdCA9IChmdW5jdGlvbigpIHtcbiAgaWYodHlwZW9mIHJlcXVpcmUgPT0gJ2Z1bmN0aW9uJyAmJiByZXF1aXJlKCdodHRwJykpIHtcbiAgICB2YXIgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKSxcbiAgICAgICAgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpLFxuICAgICAgICB1cmwgPSByZXF1aXJlKCd1cmwnKSxcbiAgICAgICAgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpLFxuICAgICAgICBwanNvbiA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHJlcXVlc3RVcmwsIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciBwYXJzZWQgPSB1cmwucGFyc2UocmVxdWVzdFVybCksXG4gICAgICAgICAgaCA9IHBhcnNlZC5wcm90b2NvbCA9PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cCxcbiAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgaG9zdG5hbWU6IHBhcnNlZC5ob3N0bmFtZSxcbiAgICAgICAgICAgIHBhdGg6IHBhcnNlZC5wYXRoLFxuICAgICAgICAgICAgcXVlcnk6IHBhcnNlZC5xdWVyeSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ1VzZXItQWdlbnQnOiAnUHJpc21pYy1qYXZhc2NyaXB0LWtpdC8nICsgcGpzb24udmVyc2lvbiArIFwiIE5vZGVKUy9cIiArIHByb2Nlc3MudmVyc2lvblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgIGlmICghcmVxdWVzdFVybCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkJPT01cIik7XG4gICAgICAgIHZhciBlID0gbmV3IEVycm9yKCdkdW1teScpO1xuICAgICAgICB2YXIgc3RhY2sgPSBlLnN0YWNrLnJlcGxhY2UoL15bXlxcKF0rP1tcXG4kXS9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eXFxzK2F0XFxzKy9nbSwgJycpXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9eT2JqZWN0Ljxhbm9ueW1vdXM+XFxzKlxcKC9nbSwgJ3thbm9ueW1vdXN9KClAJylcbiAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgY29uc29sZS5sb2coc3RhY2spO1xuXG4gICAgICB9XG4gICAgICB2YXIgcmVxdWVzdCA9IGguZ2V0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgJiYgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PSAyMDApIHtcbiAgICAgICAgICB2YXIganNvblN0ciA9ICcnO1xuXG4gICAgICAgICAgcmVzcG9uc2Uuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICByZXNwb25zZS5vbignZGF0YScsIGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICAgICAganNvblN0ciArPSBjaHVuaztcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJlc3BvbnNlLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIganNvbjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGpzb24gPSBKU09OLnBhcnNlKGpzb25TdHIpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJGYWlsZWQgdG8gcGFyc2UganNvbjogXCIgKyBqc29uU3RyLCBleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY2FjaGVDb250cm9sID0gcmVzcG9uc2UuaGVhZGVyc1snY2FjaGUtY29udHJvbCddO1xuICAgICAgICAgICAgdmFyIHR0bCA9IGNhY2hlQ29udHJvbCAmJiAvbWF4LWFnZT0oXFxkKykvLnRlc3QoY2FjaGVDb250cm9sKSA/IHBhcnNlSW50KC9tYXgtYWdlPShcXGQrKS8uZXhlYyhjYWNoZUNvbnRyb2wpWzFdLCAxMCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGpzb24sIHJlc3BvbnNlLCB0dGwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGNyZWF0ZUVycm9yKHJlc3BvbnNlLnN0YXR1c0NvZGUsIFwiVW5leHBlY3RlZCBzdGF0dXMgY29kZSBbXCIgKyByZXNwb25zZS5zdGF0dXNDb2RlICsgXCJdIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gcHJvcGVybHkgaGFuZGxlIHRpbWVvdXRzXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGVycm9yIG9uIFVSTCBcIityZXF1ZXN0VXJsKSwgbnVsbCwgZXJyKTtcbiAgICAgIH0pO1xuXG5cbiAgICB9O1xuICB9XG59KTtcblxuLy8gTnVtYmVyIG9mIHJlcXVlc3RzIGN1cnJlbnRseSBydW5uaW5nIChjYXBwZWQgYnkgTUFYX0NPTk5FQ1RJT05TKVxudmFyIHJ1bm5pbmcgPSAwO1xuLy8gUmVxdWVzdHMgaW4gcXVldWVcbnZhciBxdWV1ZSA9IFtdO1xuXG52YXIgcHJvY2Vzc1F1ZXVlID0gZnVuY3Rpb24oKSB7XG4gIGlmIChxdWV1ZS5sZW5ndGggPT09IDAgfHwgcnVubmluZyA+PSBVdGlscy5NQVhfQ09OTkVDVElPTlMpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcnVubmluZysrO1xuICB2YXIgbmV4dCA9IHF1ZXVlLnNoaWZ0KCk7XG4gIHZhciBmbiA9IGFqYXhSZXF1ZXN0KCkgfHwgeGRvbWFpblJlcXVlc3QoKSB8fCBub2RlSlNSZXF1ZXN0KCkgfHxcbiAgICAgICAgKGZ1bmN0aW9uKCkge3Rocm93IG5ldyBFcnJvcihcIk5vIHJlcXVlc3QgaGFuZGxlciBhdmFpbGFibGUgKHRyaWVkIFhNTEh0dHBSZXF1ZXN0ICYgTm9kZUpTKVwiKTt9KSgpO1xuICBmbi5jYWxsKHRoaXMsIG5leHQudXJsLCBmdW5jdGlvbihlcnJvciwgcmVzdWx0LCB4aHIsIHR0bCkge1xuICAgIHJ1bm5pbmctLTtcbiAgICBuZXh0LmNhbGxiYWNrKGVycm9yLCByZXN1bHQsIHhociwgdHRsKTtcbiAgICBwcm9jZXNzUXVldWUoKTtcbiAgfSk7XG59O1xuXG52YXIgcmVxdWVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgcXVldWUucHVzaCh7XG4gICAgICAndXJsJzogdXJsLFxuICAgICAgJ2NhbGxiYWNrJzogY2FsbGJhY2tcbiAgICB9KTtcbiAgICBwcm9jZXNzUXVldWUoKTtcbiAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBNQVhfQ09OTkVDVElPTlM6IDIwLCAvLyBOdW1iZXIgb2YgbWF4aW11bSBzaW11bHRhbmVvdXMgY29ubmVjdGlvbnMgdG8gdGhlIHByaXNtaWMgc2VydmVyXG4gIHJlcXVlc3Q6IHJlcXVlc3Rcbn07XG4iXX0=
