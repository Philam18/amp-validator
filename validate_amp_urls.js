/*
	This module takes a list of AMP pages, and validates it for compliancy
*/

// -------------------------------- MODULE REQUIRE -------------------------------------
const request					= require('request-promise'); 	// Fetch AMP page HTML
const ampvalidator 			= require('amphtml-validator'); // AMP validator
const fs 								= require('fs');							// Filestream for output data
const LineByLineReader 	= require('line-by-line');
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
module.exports = {

	/*
		validateAMPurls( filename, callback, optional )
			validates all AMP urls inside a file
		param:
			string filename 		- the file containing AMP page URLs
			Function callback   - the function to invoke after running, provides the filename to the callback
			Object options (optional parameters)
				boolean safe_mode - whether there should be a wait_time after every request to reduce being blocked, true by default
				int 		wait_time - what the wait_time in milliseconds should be for requests (safe must be TRUE for this to work), 1 seconds default
				int 		logging   - what level of logging to use in the result file
													 	1 - (DEFAULT) return success, warnings, & errors
														2	- return warnings & errors
														3 - return errors only
		returns:
			a file containing a full page report on the amp pages checked
	*/
	validateAMPurls : async function(
		filename ,
		callback ,
		options = { 'safe_mode' : false , 'wait_time' : 0 , 'logging' : 3 }
	){
		let SAFE_MODE = options.safe_mode;
		let WAIT_TIME = options.wait_time;
		let LOGGING 	= options.logging;

		let log_level = '';
		if(LOGGING === 1){
			log_level = 'Success, Warnings, and Errors';
		}
		else if(LOGGING === 2){
			log_level = 'Warnings and Errors';
		}
		else if(LOGGING === 3){
			log_level = 'Errors only';
		}

		console.log('---------------------- Configuration ----------------------');
		console.log(`Safe Mode enabled:           ${SAFE_MODE}`);
		console.log(`Wait time between requests:  ${WAIT_TIME}`);
		console.log(`Logging level:               ${log_level}`);
		console.log('-----------------------------------------------------------');

		let number_of_items = 0;
		let success = 0;
		let failure = 0;
		let warning = 0;

		let amp_links = []; 		// Two dimentional array
		let final_report = [];	// Stores the result of all arrays
		let line_reader = new LineByLineReader(filename);	// Read a file line by line

		line_reader.on('line',async ( line )=>{
			let urls = line.split(' ');
			amp_links.push( urls );
			console.log(`[${amp_links.length}] Added to checklist: ${urls[1]}`);
		});

		line_reader.on('error',(error)=>{
			console.log(`Error: ${error.message}`);
			return;
		});

		line_reader.on('end',()=>{
			number_of_items = amp_links.length;
			console.log(`Finished Reading "${filename}"`);
			console.log(`${number_of_items} links to validate.`);
			console.log("Beginning validation...");
			createReport( amp_links );
		});

		async function createReport( links ){
			let old_links 			= links; // JS is pass by
			let link_pair 			= old_links.pop();
			let canonical_link 	= link_pair[0];
			let amp_link 				= link_pair[1];
			let count = number_of_items - links.length;
			let test_pass = false;
			let test_state = '';
			let test_errors = [];
			//--------------------- BEGIN TESTING -----------------------
			console.log(`---------------------( ${count} / ${number_of_items} )----------------------`);
			console.log(`Canonical URL: ${canonical_link}`);

			// If there is no AMP link for the canonical page
			if(!amp_link || amp_link === ''){
				console.log('WARNING: Canonical link has no AMP page');
				warning ++;
				test_pass = false;
				test_state = 'warning';
				test_errors.push('Has no AMP page');
			}

			// Otherwise, validate the AMP page
			else{
				console.log(`Item: ${amp_link}`);
				console.log("Waiting for HTTP response");

				// GET HTML TO VALIDATE
				let amp_html = await getHtmlFromUrl( amp_link ).then(
					(resolved)=>{
						console.log("Received HTML. Validating...");
						return resolved.result;
					},
					(rejected)=>{
						return {
							success : "false",
							errors  : `ERROR: HTTP GET failure at: ${amp_link}\n${rejected.result}`
						};
					}
				);

				// GET AMP REPORT FROM VALIDATOR
				let amp_report = await validateAmpPage(amp_html);

				// REPORT RECEIVED; LOG RESULTS
				if(amp_report.success){
					console.log(`PASSED : ${amp_report.errors.length} errors.`);
					success ++;
					test_state = 'ok';
					test_pass = true;
				}else{
					console.log(`FAILED : ${amp_report.errors.length} errors.`);
					failure ++;
					test_state = 'error';
					test_pass = false;
				}
				if ( amp_report.errors.length > 0 ){
					test_errors = amp_report.errors;
					for(let i = 0; i < amp_report.errors.length; i++){
						console.log( `[${i+1}] ${amp_report.errors[i]}`);
					}
				}
			}

			// ADD LINKS REPORT TO THE FINAL CUMALATIVE REPORT
			final_report.push({
				"success" 			: test_pass,
				"status"				: test_state,
				"canonical_url" : canonical_link,
				"amp_url"				: amp_link,
				"messages"			: test_errors
			});

			// WAIT A BIT BEFORE MAKING ANOTHEr REQUEST
			if(links.length > 0){
				setTimeout( ()=>{ createReport( old_links ) } , WAIT_TIME );
			}

			// WERE FINISHED; TIME TO WRITE FILE
			else{
				console.log("-------------------------------------------");
				console.log(`DONE: ${count} items checked, ${success} successes, ${warning} warnings, ${failure} errors.`);
				writeReport();
			}

		}

		function writeReport(){
			let amp_report_name = `AMP_REPORT_${timestamp_iso}.txt`;
			console.log(`Writing report to file: ${amp_report_name}`);

			let logger 	= fs.createWriteStream( amp_report_name );
			logger.on('open', ()=>{
				logger.write(`Time:           ${timestamp}\n`);
				logger.write(`Links checked:  ${number_of_items}\n`);
				logger.write(`Passes:         ${success}\n`);
				logger.write(`Fails:          ${failure}\n`);
				logger.write(`Warnings:       ${warning}\n`);

				for(let item of final_report){
					// Disregard successes
					if(LOGGING === 2){
						if(item.status === 'ok') continue;
					}
					// Disregard successes AND warnings
					else if(LOGGING === 3){
						if(item.status === 'ok' || item.status === 'warning') continue;
					}

					let report = '';
					report += `----------------------------------------------------------\n`;
					if(item.amp_url && item.amp_url !== '') report += `AMP URL      : ${item.amp_url}\n`;
					report += `Canonical URL: ${item.canonical_url}\n`;
					report += `${item.messages.length} message(s):\n`;
					for(let i = 0; i < item.messages.length; i++){
						report += `\t[${i+1}] ${item.messages[i]}\n`;
					}
					logger.write(report);
				}
				callback(amp_report_name);
			});

		}
	}
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
		.then(response => {
			resolve( { "success" : true , "result" : response.body } );
		})
		.catch(error 	=> {
			reject( { "success" : false , "result" : error.message } );
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
