/*
	This module takes a list of AMP pages, and validates it for compliancy
*/
const WAIT_TIME = 1000;
// -------------------------------- MODULE REQUIRE -------------------------------------
const request						= require('request-promise'); 	// Fetch AMP page HTML
const ampvalidator 			= require('amphtml-validator'); // AMP validator
const fs 								= require('fs');
// ----------------------- PROVIDES TIMESTAMPING FOR FILES ---------------------------
let today  	= new Date();
let dd = today.getDate();
let mm = today.getMonth() + 1; // by default Jan = 0
let yy = today.getFullYear();
let hr = today.getHours();
let min = today.getMinutes();
let sec = today.getSeconds();
if(dd<10) dd = '0' + dd;
if(mm<10) mm = '0' + mm;
if(hr<10) hr = '0' + hr;
if(min<10) min = '0' + min;
if(sec<10) sec = '0' + sec;
let timestamp = mm + "/" + dd + "/" + yy + " " + hr + ":" + min + ":" + sec;
let timestamp_iso = yy + mm + dd + "T" + hr + min + sec;
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
		console.error("Usage: node validate_amp.js url1 url2 url3 ...");
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
    var data = '';
    stdin.on('readable', function() {
      var chuck = stdin.read();
      if(chuck !== null){
          data += chuck;
      }
    });
    stdin.on('end', function() {
			input = data.split(" ");

			main( cleanArray(input) );
    });
}

function handleShellArguments(){
	main( cleanArray(input) );
}

function main(URLS){
	let item_count = URLS.length;
	let success = 0;
	let failure = 0;
	let warning = 0;
	let final_report = [];

	createReport( URLS );
	async function createReport( links ){
		let old_links 					= links; // JS is pass by
		let current_link 	= old_links.pop();

		let count 				= item_count - links.length;
		let test_pass;
		let test_errors = [];

		console.error(`--------------------------( ${count} / ${item_count} )----------------------------`);

		console.error(`HTTP GET : ${current_link}`);

		// GET HTML TO VALIDATE
		let response = await getHtmlFromUrl( current_link ).then(
			(resolved)=>{
				return resolved;
			},
			(rejected)=>{
				return rejected;
			}
		);

		console.error(`STATUS: ${response.statusCode}`);
		if(response.statusCode === 200){
			// GET AMP REPORT FROM VALIDATOR
			let amp_report = await validateAmpPage(response.body);
			// REPORT RECEIVED; LOG RESULTS
			if(amp_report.success){
				console.error(`PASSED : ${amp_report.errors.length} errors.`);
				success ++;
				test_pass = true;
			}else{
				console.error(`FAILED : ${amp_report.errors.length} errors.`);
				failure ++;
				test_pass = false;
			}
			if ( amp_report.errors.length > 0 ){
				test_errors = amp_report.errors;
				for(let i = 0; i < amp_report.errors.length; i++){
					console.error( `\t[${i+1}] ${amp_report.errors[i]}`);
				}
			}
			// ADD LINKS REPORT TO THE FINAL CUMALATIVE REPORT
			final_report.push({
				"amp_url"				: current_link,
				"messages"			: test_errors
			});
		}
		else{
			console.error(response.body);
		}

		// WAIT A BIT BEFORE MAKING ANOTHEr REQUEST
		if(links.length > 0){
			setTimeout( ()=>{ createReport( old_links ) } , WAIT_TIME );
		}

		// WERE FINISHED; TIME TO WRITE FILE
		else{
			console.error("-------------------------------------------");
			console.error(`DONE: ${count} items checked, ${success} successes, ${failure} errors.`);
			writeReport(item_count, success, failure);
		}
	}

	function writeReport(item_count, passes, fails){
		let amp_report_name = `AMP_REPORT_${timestamp_iso}.txt`;
		console.error(`Writing report to file: ${amp_report_name}`);

		let logger 	= fs.createWriteStream( amp_report_name );
		logger.on('open', ()=>{
			logger.write(`Time:           ${timestamp}\n`);
			logger.write(`Links checked:  ${item_count}\n`);
			logger.write(`Passes:         ${passes}\n`);
			logger.write(`Fails:          ${fails}\n`);

			for(let item of final_report){
				let report = '';
				report += `----------------------------------------------------------\n`;
				report += `AMP URL: ${item.amp_url}\n`;
				report += `${item.messages.length} message(s):\n`;
				for(let i = 0; i < item.messages.length; i++){
					report += `\t[${i+1}] ${item.messages[i]}\n`;
				}
				logger.write(report);
			}
			process.exit(0);
		});

	}
}

function cleanArray(array){
	console.error('Unclean array size: ' + array.length);
	let new_array = [];
	for(item of array){
		if( REGEX_WORD_CHAR.test(item) ){
			new_array.push(item);
		}else{
			console.error('Removed: ' + item);
		}
	}
	console.error('Cleaned array size: ' + new_array.length);
	return new_array;
}
/*
	getHtmlFromUrl(url)
		Fetches HTML from a URL
	param:
		string url : a valid URL
	return:
		Object{boolean success, string result}
			- success represents the status of the HTTP request
			- any errors/responses are contained in result
*/
async function getHtmlFromUrl(url){
	return new Promise((resolve,reject)=>{
		request(url, { resolveWithFullResponse : true } )
		.then(response 	=> {
			resolve(response);
		})
		.catch(error 		=> {
			reject(error);
		});
	});
}

/*
	validateAmpPage(html)
		validates HTML for AMP compliance
	param:
		string html : some HTML to be checked
	return:
		Object{boolean success, array errors}
			- success is the pass/fail of the amp validator
			- errors any errors are stored in error
*/
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
			reject({ success : false , errors : [error] });
		});
	});

}
