module.exports = {
  parse: function (strDate) {
    if (strDate) {
      var correctIso8601Date = (strDate.length == 24) ? strDate.substring(0, 22) + ':' + strDate.substring(22, 24) : strDate;
      return new Date(correctIso8601Date);
    }
    else {
      return null;
    }
  }
};
