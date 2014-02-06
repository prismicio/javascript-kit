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

/* Testing with an error case in the API instantiation */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api/error',
		function(error, api){
			if (error) {
				console.log("Test 2: "+(error.message==="Unexpected status code [404] on URL https://lesbonneschoses.prismic.io/api/error" ? "OK" : "NOK"));
			} else {
				console.log("Test 2: NOK");
			}
		},
		null,
		null
	);
}, 2000);

/* Testing with an error case in an API query */
setTimeout(function(){
	prismic.Api(
		'https://lesbonneschoses.prismic.io/api',
		function(error, api){
			if (error) { console.log("Test 3: NOK"); return; }
			api.form('everything').ref(api.master()).query("wrongpredicate").submit(function(error, _){
				if (error && error.message === "Unexpected status code [400] on URL https://lesbonneschoses.prismic.io/api/documents/search?page=1&pageSize=20&ref=UkL0hcuvzYUANCrm&q=wrongpredicate") {
					console.log("Test 3: OK ");
				}
				else {
					console.log("Test 3: NOK "+error.message);
				}
			});
		},
		null,
		null
	);
}, 3000);

setTimeout(function(){
	console.log("Exiting");
	process.exit(0);
}, 4000);
