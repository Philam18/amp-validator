/*
	This module extracts HREFs off AMPHTML link tags, and writes them into a file.

	NOTE IMPORTANT:
		This code is written off the assumption that the 'rel' attribute of the
		link tag proceeds immediately after opening the link tag, and immediately
		before the href attribute, like so:

											<link rel="amphtml" href="...">
	The File is written in the format of Space Separated values, each page represented by one line.
	The first element represents the canonical URL, and the next URL represents the AMP url.

*/
// -------------------------------- MODULE REQUIRE -------------------------------------
const request = require('request-promise'); // Request-promise returns a promise
const fs 			= require('fs');							// Filestream for output data
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
// -------------------------------- REGEX DECLARATIONS ------------------------------------
const REGEX_DOMAIN 			= /(http(s)?:\/\/)?[^\/]+/;	// Matches only the TLD of the url
const REGEX_HREF 				= /<a\s+href="([^"]+)">/gi; //Matches anything with <a href="...">
const REGEX_HREF_AMP 		= /<link\s+rel="amphtml"\s+href="([^"]+)">/gi;	// Matches anything with <link rel="amphtml" href="...">
// ---------------------------------------------------------------------
module.exports = {
	/*
		extractAMPurls( url , callback , optional )
			visits a webpage, and extracts all possible AMP urls from the HTML, and prints it into a file
		param:
			string url 					- the url to the webpage
			Function callback 	- the callback function to invoke after running
			Object options (optional parameters)
				boolean safe 			- whether there should be a timeout after every request to reduce being blocked, true by default
				int timeout 			- what the timeout should be for requests (safe must be TRUE for this to work), 1 seconds default
		returns:
			The filename that was written to after the parsing is complete.
	*/
	extractAMPurls : async function(url, callback, options){
		let SAFE_MODE = true;
		let TIME_OUT 	= 1000;
		if(arguments.length == 2){
			SAFE_MODE = options.safe || true;
			TIME_OUT 	= options.timeout || 2;
			if(!SAFE_MODE) TIME_OUT = 0;
		}

		let response = await getHtmlFromUrl(url);
		if(!response.success) return console.log("Could not retrieve HTML from " + url , response.result);
		console.log("Successfully retrieved HTML from " + url);
		let filename = 'SITEMAP_URL' + timestamp_iso + ".txt";
		let logger 	= fs.createWriteStream( filename );

		// Represents the result set of the entire site
		let html 		= response.result;
		let domain 	= REGEX_DOMAIN.exec(url)[0];

		// Open a filestream to begin writing
		logger.on('open', async ()=>{
			// Write the first url pair
			let base_url = url;
			let base_amp_url = getAmpHrefFromHtml(html).join(' ');
			console.log("Success: " + base_url + ' -> ' + base_amp_url);
			logger.write( base_url + " " + base_amp_url + "\n" );
			// From the current URL, fetch all
			let links = getHrefFromHtml(html);
			iterateLinks(links);
			async function iterateLinks(links){
				let old_links = links;
				let link = old_links.pop();
				let new_url = domain + link;
				await getHtmlFromUrl(new_url).then(
					(resolved)=>{
						let amp_url = getAmpHrefFromHtml(resolved.result).join(' ');
						console.log("Success: " + new_url + ' -> ' + amp_url);
						logger.write( new_url + " " + amp_url  + "\n" );
					},
					(rejected)=>{
						console.log("Failure: " + new_url + ' -> ' + rejected.message);
					}
				);
				if(links.length > 0){
					setTimeout( ()=>{ iterateLinks(old_links) } , TIME_OUT );
				}else{
					callback(filename);
				}
			}
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

/*
	getHrefFromHtml
		Retrieves all the <a href="..."> links from an HTML
	param:
		string html : HTMl of the page to get all the hrefs from
*/
function getHrefFromHtml(html){
	let array = [];
	let result_array = [];
	// Parse body for amp links
	while ((array = REGEX_HREF.exec(html)) !== null) {
		result_array.push(array[1]);
	}
	return result_array;
}

/*
	getAmpHrefFromHtml
		Retrieves all the <link rel="amphtml" href="..."> links from an HTML file
	param:
		string html : HTMl of the page to get all the hrefs from
*/

function getAmpHrefFromHtml(html){
	let array = [];
	let result_array = [];
	// Parse body for amp links
	while ((array = REGEX_HREF_AMP.exec(html)) !== null) {
		result_array.push(array[1]);
	}
	return result_array;
}
