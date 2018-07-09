/*
	This module takes a list of AMP pages, and validates it for compliancy
*/

// -------------------------------- MODULE REQUIRE -------------------------------------
const requests			= require('request-promise'); 	// Fetch AMP page HTML
const ampvalidator 	= require('amphtml-validator'); // AMP validator
const LineByLineReader = require('line-by-line');
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
let timestamp = '_' + mm + "-" + dd + "-" + yy + "_" + hr + "-" + min + "-" + sec;
let timestamp_iso = "_" + yy + mm + dd + "T" + hr + min + sec;
// ---------------------------------------------------------------------
module.exports = {
	/*
		validateAMPurls( filename )
			validates all AMP urls inside a file
		param:
			string filename 		- the file containing AMP page URLs
		returns:
			a file containing a full page report on the amp pages checked
	*/
	validateAMPurls : async function(filename){
		let count = 0;
		let new_file = 'AMP_REPORT' + timestamp_iso + ".txt";
		let logger 	= fs.createWriteStream( new_file );
		logger.on('open', ()=>{
			lr = new LineByLineReader(filename);
			lr.on('error',(error)=>{
				console.log("Error: " + error.message);
				return;
			});

			lr.on('end',()=>{
				console.log("Finished Reading");
			});

			lr.on('line',(line)=>{
				let amp_url = line.split(' ')[1];
				if(amp_url.length === 0) return;
				getHtmlFromUrl(amp_url).then(
					()
				)
			});

		});


	}
}

/*
	getHtmlFromUrl
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
