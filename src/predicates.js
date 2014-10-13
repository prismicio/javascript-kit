(function (Global, undefined) {

    "use strict";

    /**
     * @global
     * @namespace
     * @alias Predicates
     */
    var predicates = {

        /**
         * Build an "at" predicate: equality of a fragment to a value.
         *
         * @example Predicates.at("document.type", "article")
         * @param fragment {String}
         * @param value {String}
         * @returns {Array} an array corresponding to the predicate
         */
        at: function(fragment, value) { return ["at", fragment, value]; },

        /**
         * Build an "any" predicate: equality of a fragment to a value.
         *
         * @example Predicates.any("document.type", ["article", "blog-post"])
         * @param fragment {String}
         * @param values {Array}
         * @returns {Array} an array corresponding to the predicate
         */
        any: function(fragment, values) { return ["any", fragment, values]; },

        /**
         * Build a "fulltext" predicate: fulltext search in a fragment.
         *
         * @example Predicates.fulltext("my.article.body", "sausage"])
         * @param fragment {String}
         * @param value {String} the term to search
         * @returns {Array} an array corresponding to the predicate
         */
        fulltext: function(fragment, value) { return ["fulltext", fragment, value]; },

        /**
         * Build a "similar" predicate.
         *
         * @example Predicates.similar("UXasdFwe42D", 10)
         * @param documentId {String} the document id to retrieve similar documents to.
         * @param maxResults {Number} the maximum number of results to return
         * @returns {Array} an array corresponding to the predicate
         */
        similar: function(documentId, maxResults) { return ["similar", documentId, maxResults]; },

        /**
         * Build a "number.gt" predicate: documents where the fragment field is greater than the given value.
         *
         * @example Predicates.gt("my.product.price", 10)
         * @param fragment {String} the name of the field - must be a number.
         * @param value {Number} the lower bound of the predicate
         * @returns {Array} an array corresponding to the predicate
         */
        gt: function(fragment, value) { return ["number.gt", fragment, value]; },

        /**
         * Build a "number.lt" predicate: documents where the fragment field is lower than the given value.
         *
         * @example Predicates.lt("my.product.price", 20)
         * @param fragment {String} the name of the field - must be a number.
         * @param value {Number} the upper bound of the predicate
         * @returns {Array} an array corresponding to the predicate
         */
        lt: function(fragment, value) { return ["number.lt", fragment, value]; },

        /**
         * Build a "number.inRange" predicate: combination of lt and gt.
         *
         * @example Predicates.inRange("my.product.price", 10, 20)
         * @param fragment {String} the name of the field - must be a number.
         * @param before {Number}
         * @param after {Number}
         * @returns {Array} an array corresponding to the predicate
         */
        inRange: function(fragment, before, after) { return ["number.inRange", fragment, before, after]; },

        /**
         * Build a "date.before" predicate: documents where the fragment field is before the given date.
         *
         * @example Predicates.dateBefore("my.product.releaseDate", new Date(2014, 6, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param before {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateBefore: function(fragment, before) { return ["date.before", fragment, before]; },

        /**
         * Build a "date.after" predicate: documents where the fragment field is after the given date.
         *
         * @example Predicates.dateAfter("my.product.releaseDate", new Date(2014, 1, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param after {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateAfter: function(fragment, after) { return ["date.after", fragment, after]; },

        /**
         * Build a "date.between" predicate: combination of dateBefore and dateAfter
         *
         * @example Predicates.dateBetween("my.product.releaseDate", new Date(2014, 1, 1), new Date(2014, 6, 1))
         * @param fragment {String} the name of the field - must be a date or timestamp field.
         * @param before {Date}
         * @param after {Date}
         * @returns {Array} an array corresponding to the predicate
         */
        dateBetween: function(fragment, before, after) { return ["date.between", fragment, before, after]; },

        /**
         *
         * @example Predicates.dayOfMonth("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonth: function(fragment, day) { return ["date.day-of-month", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfMonthAfter("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonthAfter: function(fragment, day) { return ["date.day-of-month-after", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfMonthBefore("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number} between 1 and 31
         * @returns {Array}
         */
        dayOfMonthBefore: function(fragment, day) { return ["date.day-of-month-before", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeek("my.product.releaseDate", 14)
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeek: function(fragment, day) { return ["date.day-of-week", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeekAfter("my.product.releaseDate", "Wednesday")
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeekAfter: function(fragment, day) { return ["date.day-of-week-after", fragment, day]; },

        /**
         *
         * @example Predicates.dayOfWeekBefore("my.product.releaseDate", "Wednesday")
         * @param fragment
         * @param day {Number|String} Number between 1 and 7 or string between "Monday" and "Sunday"
         * @returns {Array}
         */
        dayOfWeekBefore: function(fragment, day) { return ["date.day-of-week-before", fragment, day]; },

        /**
         *
         * @example Predicates.month("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         */
        month: function(fragment, month) { return ["date.month", fragment, month]; },

        /**
         *
         * @example Predicates.monthBefore("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         */
        monthBefore: function(fragment, month) { return ["date.month-before", fragment, month]; },

        /**
         *
         * @example Predicates.monthAfter("my.product.releaseDate", "June")
         * @param fragment
         * @param month {Number|String} Number between 1 and 12 or string between "January" and "December"
         * @returns {Array}
         * @returns {Array}
         */
        monthAfter: function(fragment, month) { return ["date.month-after", fragment, month]; },

        /**
         *
         * @example Predicates.year("my.product.releaseDate", 2014)
         * @param fragment
         * @param year {Number}
         * @returns {Array}
         */
        year: function(fragment, year) { return ["date.year", fragment, year]; },

        /**
         *
         * @example Predicates.hour("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hour: function(fragment, hour) { return ["date.hour", fragment, hour]; },

        /**
         *
         * @example Predicates.hourBefore("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hourBefore: function(fragment, hour) { return ["date.hour-before", fragment, hour]; },

        /**
         *
         * @example Predicates.hourAfter("my.product.releaseDate", 12)
         * @param fragment
         * @param hour {Number}
         * @returns {Array}
         */
        hourAfter: function(fragment, hour) { return ["date.hour-after", fragment, hour]; },

        /**
         *
         * @example Predicates.near("my.store.location", 48.8768767, 2.3338802, 10)
         * @param fragment
         * @param latitude {Number}
         * @param longitude {Number}
         * @param radius {Number} in kilometers
         * @returns {Array}
         */
        near: function(fragment, latitude, longitude, radius) { return ["geopoint.near", fragment, latitude, longitude, radius]; }

    };

    Global.Prismic.Predicates = predicates;

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
