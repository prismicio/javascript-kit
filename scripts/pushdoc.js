/*eslint-env es6 */

var pages = require('gh-pages');
var path = require('path');

pages.publish(path.join(__dirname, 'out'), (err) => {
  if (err) {
    console.log("Error pushing doc: ", err);
  } else {
    console.log("Successfully pushed doc.");
  }
});
