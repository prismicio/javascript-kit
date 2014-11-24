(function (Global, undefined) {

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

    Experiments.prototype.current = function() {
        return this.running.length > 0 ? this.running[0] : null;
    };

    /**
     * Get the current running experiment variation ref from a cookie content
     */
    Experiments.prototype.refFromCookie = function(cookie) {
        if (!cookie || cookie.trim() === "") return null;
        var splitted = cookie.trim().split(" ");
        if (splitted.length < 2) return null;
        var expId = splitted[0];
        var varIndex = parseInt(splitted[1], 10);
        var exp = this.running.filter(function(exp) {
          return exp.googleId() == expId && exp.variations.length > varIndex;
        })[0];
        return exp ? exp.variations[varIndex].ref() : null;
    };

    function Experiment(data) {
        this.data = data;
        var variations = [];
        data.variations && data.variations.forEach(function(v) {
            variations.push(new Variation(v));
        });
        this.variations = variations;
    }

    Experiment.prototype.id = function() {
        return this.data.id;
    };

    Experiment.prototype.googleId = function() {
        return this.data.googleId;
    };

    Experiment.prototype.name = function() {
        return this.data.name;
    };

    function Variation(data) {
        this.data = data;
    }

    Variation.prototype.id = function() {
        return this.data.id;
    };

    Variation.prototype.ref = function() {
        return this.data.ref;
    };

    Variation.prototype.label = function() {
        return this.data.label;
    };

    Global.Prismic.Experiments = Experiments;
    Global.Prismic.Experiment = Experiment;
    Global.Prismic.Variation = Variation;

}(typeof exports === 'object' && exports ? exports : (typeof module === "object" && module && typeof module.exports === "object" ? module.exports : window)));
