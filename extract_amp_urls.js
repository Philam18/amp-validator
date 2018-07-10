/*
	This module extracts HREFs off AMPHTML link tags, and writes them into a file.

	NOTE IMPORTANT:
		This code is written off the assumption that the 'rel' attribute of the
		link tag proceeds immediately after opening the link tag, and immediately
		before the href attribute, like so:

											<link rel="amphtml" href="...">

	The File is written in the format of Space Separated values, each url-pair represented by one line.
	The first element/index represents the canonical URL, and the second URL represents the AMP url.




*/
// -------------------------------- MODULE REQUIRE -------------------------------------
const request = require('request-promise'); 			// Request-promise returns a promise
var parseString = require('xml2js').parseString;	// Parses XML to a JS object
const fs 			= require('fs');										// Filestream for output data

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
let timestamp = mm + "-" + dd + "-" + yy + "_" + hr + "-" + min + "-" + sec;
let timestamp_iso = yy + mm + dd + "T" + hr + min + sec;
// -------------------------------- REGEX DECLARATIONS ------------------------------------
const REGEX_DOMAIN 				= /(http(s)?:\/\/)?[^\/]+/;	// Matches only the TLD of the url
const REGEX_HREF 					= /(<a\s+href=")([^"]+)"/gi; //Matches anything with <a href="...">
const REGEX_HREF_AMP 			= /<link\s+rel="amphtml"\s+href="([^"]+)(")/gi;	// Matches anything with <link rel="amphtml" href="...">
const REGEX_PATH_OR_LINK 	= /(^\/.+$)/i; // Determines if an href link has the domain included
const REGEX_XML_FILE			= /^.+(\.xml)$/i; // Determines if a provided sitemap is URL or XML
// ---------------------------------------------------------------------
module.exports = {

	/*
		extractAMPurls( url , callback , optional )
			visits a webpage, and extracts all possible AMP urls from the HTML, and prints it into a file
		param:
			string url 					- the url to the webpage
			Function callback 	- the callback function to invoke after running
			Object options (optional parameters)
				boolean safe_mode - whether there should be a wait_time after every request to reduce being blocked, true by default
				int 		wait_time - what the wait_time should be for requests (safe must be TRUE for this to work), 1 seconds default
		returns:
			The filename that was written to after the parsing is complete.
	*/
	extractAMPurls : async function(
		sitemap_url,
		callback,
		options = { 'safe_mode' : false , 'wait_time' : 0 }
	){


		let SAFE_MODE = options.safe_mode;
		let WAIT_TIME = options.wait_time;
		console.log('---------------------- Configuration ----------------------');
		console.log(`Safe Mode enabled:           ${SAFE_MODE}`);
		console.log(`Wait time between requests:  ${WAIT_TIME}`);
		console.log('-----------------------------------------------------------');

		console.log("Starting crawl...");
		let response = await getHtmlFromUrl(sitemap_url);
		if(!response.success) return console.log(`Could not retrieve HTML from ${sitemap_url}\n${response.result}`);
		let domain 	= REGEX_DOMAIN.exec(sitemap_url)[0];
		let sitemap_body 		= response.result;
		let number_of_items = 0;
		console.log(`Successfully retrieved HTML from ${sitemap_url}`);

		let filename = `SITEMAP_URL_${timestamp_iso}.txt`;
		let logger 	= fs.createWriteStream( filename );

		// Wait until the filestream is open before writing
		logger.on('open', async ()=>{
			// From the (presumed) sitemap URL, fetch all HREFs
			console.log('Starting crawl of sub-pages...');

			// Determine if the website is in X
			let hrefs = [];
			if(REGEX_XML_FILE.test(sitemap_url)){
				parseString(sitemap_body, (error, result)=>{
					if(error) return console.log("Error parsing XML: " + error.message);
					let url_set = result.urlset.url;
					for(let url of url_set){
						hrefs.push( url.loc[0] );
					}
					return;
				});
			}else{
				hrefs = getHrefFromHtml(sitemap_body);
			}


			number_of_items = hrefs.length;
			iterateLinks( hrefs );

			async function iterateLinks(links){
				let old_links 		= links; // Keep an updated reference to the link-array, for when we recurse
				let href 					= old_links.pop();
				let count 				= number_of_items - old_links.length;
				let canonical_url = href;
				if( REGEX_PATH_OR_LINK.test(href) ) canonical_url = domain + canonical_url;

				// Make an HTTP request to the sub-webpage
				console.log(`--------------------------( ${count} / ${number_of_items} )--------------------------`);
				let html = await getHtmlFromUrl(canonical_url).then(
					(resolved)=>{
						console.log(`[SUCCESS] HTTP GET`);
						console.log(`Canonical: ${canonical_url}`);
						return resolved.result;
					},
					(rejected)=>{
						console.log(`[FAILURE] HTTP GET`);
						console.log(`Canonical: ${canonical_url}`);
						console.log(`Error:     ${rejected.result}`);
						return null;
					}
				);

				// ONLY if the HTML returned successfully, grab the AMP url from the HTML (if any)
				if(html){
					let amp_url = getAmpHrefFromHtml(html).join(' ');
					console.log(`AMP      : ${(amp_url.length > 0) ? amp_url : 'None'}`)
					// Write the canonical/amp pair into the file
					logger.write(`${canonical_url} ${amp_url}\n`);
				}

				// WAIT A BIT BEFORE MAKING ANOTHEr REQUEST
				if(links.length > 0){
					setTimeout( ()=>{ iterateLinks(old_links) } , WAIT_TIME );

				// FINISHED, RETURN FILENAME
				}else{
					console.log(`--------------------------------------------------------------`);
					console.log("Done");
					console.log(`Written to file '${filename}'`);
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
