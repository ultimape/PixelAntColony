//<![CDATA[
/* Polyfills */
// What is a Polyfill? https://www.google.com/search?q=define+polyfill

"use strict";


console.group("Loading Polyfills");
console.timeStamp("Loading Polyfills");
console.time("Loading Polyfills Time");
var numPolyfillsLoaded =0;
console.log("[%s]	Checking for necessary polyfills.", new Date().toISOString());


/* Array.map() 
	// "Creates a new array with the results of calling a provided function on every element in this array."
	// Via: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
*/
// Production steps of ECMA-262, Edition 5, 15.4.4.19
// Reference: http://es5.github.com/#x15.4.4.19
if (!Array.prototype.map) {
  Array.prototype.map = function(callback, thisArg) {

    var T, A, k;

    if (this == null) {
      throw new TypeError(" this is null or not defined");
    }

    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
    var O = Object(this);

    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
    // 3. Let len be ToUint32(lenValue).
    var len = O.length >>> 0;

    // 4. If IsCallable(callback) is false, throw a TypeError exception.
    // See: http://es5.github.com/#x9.11
    if (typeof callback !== "function") {
      throw new TypeError(callback + " is not a function");
    }

    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
    if (arguments.length > 1) {
      T = thisArg;
    }

    // 6. Let A be a new array created as if by the expression new Array(len) where Array is
    // the standard built-in constructor with that name and len is the value of len.
    A = new Array(len);

    // 7. Let k be 0
    k = 0;

    // 8. Repeat, while k < len
    while(k < len) {

      var kValue, mappedValue;

      // a. Let Pk be ToString(k).
      //   This is implicit for LHS operands of the in operator
      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
      //   This step can be combined with c
      // c. If kPresent is true, then
      if (k in O) {

        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
        kValue = O[ k ];

        // ii. Let mappedValue be the result of calling the Call internal method of callback
        // with T as the this value and argument list containing kValue, k, and O.
        mappedValue = callback.call(T, kValue, k, O);

        // iii. Call the DefineOwnProperty internal method of A with arguments
        // Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
        // and false.

        // In browsers that support Object.defineProperty, use the following:
        // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

        // For best browser support, use the following:
        A[ k ] = mappedValue;
      }
      // d. Increase k by 1.
      k++;
    }
	
    // 9. return A
    return A;
  };      
}

/* Array.filter() 
	// "Creates a new array with all elements that pass the test implemented by the provided function."
	// Via: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
*/

if (!Array.prototype.filter)
{
  Array.prototype.filter = function(fun /*, thisp */)
  {
    "use strict";

    if (this == null)
      throw new TypeError();

    var t = Object(this);
    var len = t.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var res = [];
    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in t)
      {
		  var val = t[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, t))
          res.push(val);
      }
    }

    return res;
  };
}


/* Date.now() 
	// "The Date.now() method returns the number of milliseconds elapsed since 1 January 1970 00:00:00 UTC."
	// Via: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now
*/
if (!Date.now) {
	console.log("[%s]	Date.now() polyfill loaded.", new Date().toISOString());
	Date.now = function now() {
		return new Date().getTime();
	};
	numPolyfillsLoaded++;
}

/* Date.toISOString()
	// The toISOString() method returns a string in ISO format (ISO 8601 Extended Format), which can be described as follows: YYYY-MM-DDTHH:mm:ss.sssZ. 
	// The timezone is always UTC as denoted by the suffix "Z".
	// Via: http://stackoverflow.com/a/8563517
*/
if ( !Date.prototype.toISOString ) {
	console.log("[%s]	dateObj.toISOString polyfill loaded.", new Date().toISOString());
	( function() {
		
		function pad(number) {
			if ( number < 10 ) {
				return '0' + number;
			}
			return number;
		}
		
		Date.prototype.toISOString = function() {
			return this.getUTCFullYear() +
			'-' + pad( this.getUTCMonth() + 1 ) +
			'-' + pad( this.getUTCDate() ) +
			'T' + pad( this.getUTCHours() ) +
			':' + pad( this.getUTCMinutes() ) +
			':' + pad( this.getUTCSeconds() ) +
			'.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice( 2, 5 ) +
			'Z';
		};
		numPolyfillsLoaded++;
	}() );
}

		
/* requestAnimationFrame()
	// used to allow the browswer to ratelimit at ~60fps
	// Via: http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
	// modified to count polyfill loading
*/
(function() {
	var lastTime = 0;
	var vendors = ['webkit', 'moz'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame =
		window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
	}
	
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); },
			timeToCall);
			lastTime = currTime + timeToCall;
			
			
			return id;
		};
		numPolyfillsLoaded++;
	}
	
	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
		numPolyfillsLoaded++;
	}
	
}());




console.log("[%s]	Polyfills loaded: %i", new Date().toISOString(),numPolyfillsLoaded);

console.timeStamp("Loading Polyfills");
console.timeEnd("Loading Polyfills Time");
console.groupEnd(); // "Loading Polyfills"
//]]>
	