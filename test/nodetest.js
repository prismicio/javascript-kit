var http = require('http');
var prismic = require('../dist/prismic.io').Prismic;

/* Checking that calling the api asynchonously works */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api',
		function(api){console.log("Test 1: "+(api.master()==='UkL0hcuvzYUANCrm' ? "OK" : "NOK"));},
		null,
		null,
		null
	);
}, 1000);

/* Testing with an error case */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api/error',
		function(api){console.log("Test 2: NOK");},
		null,
		null,
		function(errorMessage){console.log("Test 2: "+(errorMessage==="Unexpected status code [404]" ? "OK" : "NOK"));}
	);
}, 2000);

setTimeout(function(){
	console.log("Exiting");
	process.exit(0);
}, 3000);