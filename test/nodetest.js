var http = require('http');
var prismic = require('../dist/prismic.io').Prismic;

/* Checking that calling the api asynchonously works */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api',
		function(error, api){console.log("Test 1: "+((api && api.master())==='UkL0hcuvzYUANCrm' ? "OK" : "NOK"));},
		null,
		null,
		null
	);
}, 1000);

/* Testing with an error case */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api/error',
		function(error, api){
			if (error) {
				console.log("Test 2: "+(error.message==="Unexpected status code [404]" ? "OK" : "NOK"));
			} else {
				console.log("Test 2: NOK");
			}
		},
		null,
		null
	);
}, 2000);

setTimeout(function(){
	console.log("Exiting");
	process.exit(0);
}, 3000);
