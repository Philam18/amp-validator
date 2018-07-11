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
const WAIT_TIME = 0;
const TIME_OUT = 20000;
// -------------------------------- MODULE REQUIRE -------------------------------------
const request 	= require('request-promise'); 			// Request-promise returns a promise
const parseString = require('xml2js').parseString;		// Parses XML to a JS object
// -------------------------------- REGEX DECLARATIONS ------------------------------------
const REGEX_DOMAIN 				= /(http(s)?:\/\/)?[^\/]+/;	// Matches only the TLD of the url
const REGEX_HREF 					= /href="([^"]+)"/gi; //Matches anything with href="...">
const REGEX_HREF_AMP 			= /<link\s+rel="amphtml"\s+href="([^"]+)(")/gi;	// Matches anything with <link rel="amphtml" href="...">
const REGEX_IS_PATH 			= /(^\/.+$)/i; // Determines if an href link has the domain included
// ---------------------------------------------------------------------
process.env.THREA
URL = process.argv[2];
extractAmpUrls(URL);

async function extractAmpUrls(url){
	let response = await getHtmlFromUrl(url).then(
		(resolved)=>{
			return resolved;
		},
		(rejected)=>{
			console.error(`Could not retrieve HTML from ${URL}: ${rejected}`);
			process.exit(1);
		}
	);

	let hostname = `${response.request.uri.protocol}//${response.request.uri.hostname}`;
	let body = response.body;
	let number_of_items = 0;
	let hrefs = [];

	if(response.headers['content-type'].includes('text/html')){
		console.error('Parsing HTML');
		let result_set = getHrefFromHtml(body);
		for(let item of result_set){
			if( REGEX_IS_PATH.test(item) ) item = hostname + item;
			hrefs.push(item);
		}
	}
	else if(response.headers['content-type'].includes('text/xml')){
		console.error('Parsing XML');
		parseString(body, (error, result)=>{
			let url_set = result.urlset.url;
			for(let url of url_set){
				hrefs.push( url.loc[0] );
			}
		});
	}

	let item_count = hrefs.length;
	iterateLinks( hrefs , '' );
	async function iterateLinks( links , result ){
		let old_links 	= links; // Keep an updated reference to the link-array, for when we recurse
		let href 				= old_links.pop();
		let count 			= item_count - old_links.length;
		console.error(`--------------------------( ${count} / ${item_count} )----------------------------`);
		// Make an HTTP request to the sub-webpage
		let start = process.hrtime();
		let response = await getHtmlFromUrl(href).then(
			(resolved)=>{
				return resolved;
			},
			(rejected)=>{
				return rejected;
			}
		);
		let end_s = process.hrtime(start)[0]; // seconds
		let end_m = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli

		if(response.statusCode === 200){
			let precision = 3; // 3 decimal places
			console.error(`RESOLUTION TIME:\n\t${end_s} seconds, ${end_m} milliseconds.`);
			let amp_url = getAmpHrefFromHtml(response.body).join(' ');
			if (amp_url && amp_url !== ''){
				result += amp_url + ' ';
				console.error(`Added: ${amp_url}`);
			}
			else{
				console.error(`No AMP link found.`);
			}
		}

		// WAIT A BIT BEFORE MAKING ANOTHEr REQUEST
		if(links.length > 0){
			setTimeout( ()=>{ iterateLinks( old_links , result ) } , WAIT_TIME );

		// FINISHED, RETURN
		}
		else{
			console.error(`----------------------------------------------------------------------------------`);
			process.stdout.write(result.toString());
			process.exit(0);
		}
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
	let options = {
		resolveWithFullResponse : true,
		simple									: false,
		timeout 								: TIME_OUT
	};

	console.error(`HTTP Request :\n\t${url}`);
	return new Promise((resolve,reject)=>{
		request(url, options )
		.then(response 	=> {
			console.error(`STATUS :\n\t${response.statusCode}` );
			resolve(response);
		})
		.catch(error 		=> {
			if(error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' && !err.connect){
				console.error(`STATUS:\n\tError - could not establish a connection within ${TIME_OUT/1000} seconds.`);
			}else if(error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' && err.connect){
				console.error(`STATUS:\n\tError - Server did not return a response within ${TIME_OUT/1000} seconds.`);
			}else{
				console.error(`STATUS :\n\t${error}` );
			}
			reject(error);
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
