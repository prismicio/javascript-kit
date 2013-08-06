(function( window, undefined ) {

"use strict";

var prismic = function(url) {

		return new prismic.fn.init(url);

	};

prismic.fn = prismic.prototype = {

	constructor: prismic,

	init: function(url) {

		console.log("Load API:", url);
		return this;

	},

	forms: function (sel) {

		console.log("Forms:", sel);
		return this;

	},

	query: function (qry) {

		console.log("Query:", qry);
		return this;

	},

	refs: function (sel) {

		console.log("Refs:", sel);
		return this;

	},

	ref: function (sel) {

		console.log("Ref:", sel);
		return this;

	},

	bookmarks: function () {

		console.log("Bookmarks: ");
		return this;
	},

	submit: function () {

		return ["Structured Text"];

	}

};

prismic.fn.init.prototype = prismic.fn;

prismic.extend = prismic.fn.extend = function() {
	var options, name, src, copy,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length;

	// extend jQuery itself if only one argument is passed
	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];
			}

			// Prevent never-ending loop
			if ( target === copy ) {
				continue;
			}

			if ( copy !== undefined ) {
				target[ name ] = copy;
			}
		}
	}

	// Return the modified object
	return target;
};

prismic.extend({

	getDocument: function (api, ref, id) {

		var docs = api
			.forms("everything")
			.query("[[at(document.id, " + id + ")]]")
			.ref(ref)
			.submit();

		return docs;

	}
});


if ( typeof window === "object" && typeof window.document === "object" ) {
	window.prismic = prismic;
}

})(window);
