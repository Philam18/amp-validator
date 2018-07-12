/*
	This module takes a list of AMP pages, and validates it for compliancy
*/
const WAIT_TIME = 1000;
const TIME_OUT = 20000;
const LOGGING = true;
// -------------------------------- MODULE REQUIRE -------------------------------------
const request						= require('request-promise'); 	// Fetch AMP page HTML
const HTTP_REQUEST_OPTIONS = {
	resolveWithFullResponse : true,
	simple									: false,
	timeout 								: TIME_OUT
};
const ampvalidator 			= require('amphtml-validator'); // AMP validator
const readline 					= require('readline');
// ---------------------------------------------------------------------
const REGEX_WORD_CHAR = /[\S]+/i;
// ---------------------------------------------------------------------
var args = process.argv.slice(2);
var input = args[0];

var isTTY = process.stdin.isTTY;
var stdin = process.stdin;
var stdout = process.stdout;

// If no STDIN and no arguments, display usage message
if (isTTY && args.length === 0) {
		printToConsole("Usage: node validate_amp.js url1 url2 url3 ...");
}

// If no STDIN but arguments given
else if (isTTY && args.length !== 0) {
    handleShellArguments();
}

// read from STDIN
else {
    handlePipedContent();
}

function handlePipedContent() {
	console.error('Reading from stdin...');
	let promise_array = [];
	const line_reader = readline.createInterface({
	  input: process.stdin,
	  output: process.stdout,
	  terminal: false
	});

	line_reader.on('line', function( input ){
		console.error('Input Received...');
    if( input !== null && REGEX_WORD_CHAR.test( input ) ){
			setTimeout(function(){
				promise_array.push(validate(input));
			}, WAIT_TIME);
		}
	});

	line_reader.on('close', function(){
		console.error('Input stream ended. Waiting for links to validate...');
		Promise.all(promise_array).then(()=>{
			console.error('All links validated. Finished reporting');
		});
	});

}

function handleShellArguments(){
	console.error('Reading from command line...');
	let promise_array = [];
	for(let link of args){
		setTimeout(function(){
			promise_array.push(validate(input));
		}, WAIT_TIME);
	}
	Promise.all(promise_array).then(()=>{
		console.error('All links validated. Finished reporting');
	});
	printToConsole('Done validating links.');
}

function validate(amp_link){
	return new Promise((resolve,reject)=>{
		printToConsole('\t[Get HTML] Sending: ' + amp_link );
		getHtmlFromUrl(amp_link)
		.then(
			(resolved)=>{
				printToConsole('[Get HTML] Resolved: ');
				printToConsole('[Validate AMP] Sending AMP HTML...');
				validateAmpPage(resolved.body)
				.then(
					(resolved)=>{
						printToConsole('[Validate AMP] Validated!');
						const util = require('util');
						if(!resolved.success){
							console.log('----------------------------------------------------------------------');
							console.log('URL: ' + amp_link);
							console.log('Errors: ');
							for(let i = 0; i < resolved.errors.length; i++) console.log(`\t[${i}] ${resolved.errors[i]}`);
						}
						resolve();
					},
					(rejected)=>{
						printToConsole('[Validate AMP] Rejected: ' + rejected);
						resolve();
					}
				);
			},
			(rejected)=>{
				printToConsole('[Get HTML] Rejected: ' + rejected);
				if(rejected.code === 'ETIMEDOUT'){
					printToConsole(`Server took more than ${TIME_OUT/1000} seconds to write the HTTP status and headers.`);
					printToConsole(rejected);
				}else if(rejected.code === 'ESOCKETTIMEDOUT'){
					printToConsole('Timed out after waiting for next byte');
					printToConsole(rejected);
				}
				resolve(); // We dont care about errors
			}
		);
	});
}

async function getHtmlFromUrl(url){
	return new Promise((resolve,reject)=>{
		request (url, HTTP_REQUEST_OPTIONS )
		.then(	(response)	=>{resolve(response)	})
		.catch( (error)			=>{reject (error) 		});
	});
}

async function validateAmpPage(html){
	return new Promise((resolve, reject) => {
		ampvalidator.getInstance()
		.then((validator)=>{
			let report = { success : false , errors : [] };
		  let result = validator.validateString(html);
			report.success = (result.status === 'PASS') ? true : false;
		  for (var i = 0; i < result.errors.length; i++) {
		    let error = result.errors[i];
		    let log = 'line ' + error.line + ', col ' + error.col + ': ' + error.message;
		    if (error.specUrl !== null && error.specUrl.length != '')	log += ' (see ' + error.specUrl + ')';
				report.errors.push( log );
	    }
			resolve(report);
		})
		.catch((error)=>{
			reject(error);
		});
	});

}

function printToConsole(msg){
	if(LOGGING) console.error(msg);
}
