(function( window, undefined ) {

"use strict";

var prismic = function(url) {

	return new prismic.fn.init(url);

};

prismic.fn = prismic.prototype = {

	constructor: prismic,

	data: null,

	get: function (cb) {

		var self = this;

		$.getJSON(this.url, function (data) {
			self.data = self.parse(data);
			cb && cb(this);
		});

	},

	parse: function (data) {

		var refs,
			master,
			forms = {},
			form,
			f,
			i;

		// Parse the forms
		for(i in data.forms) {
			if (data.forms.hasOwnProperty(i)){
				f = data.forms[i];
				var form = new Form(
					f.name,
					f.fields,
					f.form_method,
					f.rel,
					f.enctype,
					f.action
				);

				// Init the search form
				forms[i] = new SearchForm(this, form, {})
			}
		}

		refs = data.refs.map(function (r) {
			return new Ref(
				r.ref,
				r.label,
				r.isMasterRef
			);
		}) || [];

		master = refs.filter(function (r) {

			return r.isMaster === true;

		});

		if (master.length === 0) {
			throw("No master ref.");
		}

		return {
			bookmarks: data.bookmarks || [],
			refs: refs,
			forms: forms,
			master: master[0]
		}

	},

	init: function(url) {

		this.url = url;

		return this;

	},

	forms: function (formId) {

		return this.data.forms[formId];

	},

	bookmarks: function () {

		return this.data.bookmarks;

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

// TODO: this shouldn't be in the API - but in the website itself
prismic.extend({

	getDocument: function (api, ref, id, cb) {

		var docs = api
			.forms("everything")
			.query("[[at(document.id, " + id + ")]]")
			.ref(ref)
			.submit(cb);

		return docs;

	}
});

function Form(name, fields, form_method, rel, enctype, action) {
	this.name = name;
	this.fields = fields;
	this.form_method = form_method;
	this.rel = rel;
	this.enctype = enctype;
	this.action = action;
};
Form.prototype = {};


function SearchForm(api, form, data) {

	this.api = api;
	this.form = form;
	this.data = data;

}
SearchForm.prototype = {

	ref: function (ref) {
		this.data.ref = ref;
		return this;
	},

	query: function (q) {

		this.data.query = q;
		return this;

	},

	submit: function (cb) {

		var self = this;

		// Simulate queryin' async
		setTimeout(function () {
			console.log("LOADING:", self.data.ref, self.data.query);
			cb && cb([new Doc(), new Doc()]);
		}, 200);

	}

};

function Doc(id, type, href, tags, slugs, fragments) {
	this.id = id;
	this.type = type;
	this.href = href;
	this.tags = tags;
	this.slugs = slugs;
	this.fragments = fragments;
};
Doc.prototype = {

	slug: function () {

		return this.slugs ? this.slugs[0] : "-";

	},

	get: function (field) {

		return this.fragments.filter(function (f) {

			return f === field;

		});

	},

	getAll: function (field) {

		return this.fragments.length ? this.fragments[0] : []

	}

};

function Field(type, default) {
	this.type = type;
	this.default = default;
};
Field.prototype = {};


function Ref(ref, label, isMaster) {
	this.ref = ref;
	this.label = label;
	this.isMaster = isMaster;
};
Ref.prototype = {};



if ( typeof window === "object" && typeof window.document === "object" ) {
	window.prismic = prismic;
}

})(window);
