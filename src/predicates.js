(function (Global, undefined) {

    "use strict";

    var predicates = {

        at: function(fragment, value) { return ["at", fragment, value]; },

        any: function(fragment, values) { return ["any", fragment, values]; },

        fulltext: function(fragment, values) { return ["fulltext", fragment, values]; },

        similar: function(fragment, value) { return ["similar", fragment, value]; },

        gt: function(fragment, value) { return ["number.gt", fragment, value]; },

        lt: function(fragment, value) { return ["number.lt", fragment, value]; },

        inRange: function(fragment, before, after) { return ["number.inRange", fragment, before, after]; },

        dateBefore: function(fragment, before) { return ["date.before", fragment, before]; },

        dateAfter: function(fragment, after) { return ["date.after", fragment, after]; },

        dateBetween: function(fragment, before, after) { return ["date.between", fragment, before, after]; },

        dayOfMonth: function(fragment, day) { return ["date.day-of-month", fragment, day]; },

        dayOfMonthAfter: function(fragment, day) { return ["date.day-of-month-after", fragment, day]; },

        dayOfMonthBefore: function(fragment, day) { return ["date.day-of-month-before", fragment, day]; },

        dayOfWeek: function(fragment, day) { return ["date.day-of-week", fragment, day]; },

        dayOfWeekAfter: function(fragment, day) { return ["date.day-of-week-after", fragment, day]; },

        dayOfWeekBefore: function(fragment, day) { return ["date.day-of-week-before", fragment, day]; },

        month: function(fragment, month) { return ["date.month", fragment, month]; },

        monthBefore: function(fragment, month) { return ["date.month-before", fragment, month]; },

        monthAfter: function(fragment, month) { return ["date.month-after", fragment, month]; },

        year: function(fragment, year) { return ["date.year", fragment, year]; },

        hour: function(fragment, hour) { return ["date.hour", fragment, hour]; },

        hourBefore: function(fragment, hour) { return ["date.hour-before", fragment, hour]; },

        hourAfter: function(fragment, hour) { return ["date.hour-after", fragment, hour]; },

        near: function(fragment, latitude, longitude, radius) { return ["near", fragment, latitude, longitude]; }

    };

    // -- Export Globally

    Global.Prismic.Predicates = predicates;

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
