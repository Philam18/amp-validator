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
const WAIT_TIME = 1000;
const TIME_OUT = 20000;
// -------------------------------- MODULE REQUIRE -------------------------------------
const parseString = require('xml2js').parseString;		// Parses XML to a JS object
const request 	= require('request-promise'); 			// Request-promise returns a promise
const HTTP_REQUEST_OPTIONS = {
	resolveWithFullResponse : true,
	simple									: false,
	timeout 								: TIME_OUT
};
// -------------------------------- REGEX DECLARATIONS ------------------------------------
const REGEX_DOMAIN 				= /(http(s)?:\/\/)?[^\/]+/;	// Matches only the TLD of the url
const REGEX_HREF 					= /href="([^"]+)"/gi; //Matches anything with href="...">
const REGEX_HREF_AMP 			= /<link\s+rel="amphtml"\s+href="([^"]+)(")/gi;	// Matches anything with <link rel="amphtml" href="...">
const REGEX_IS_PATH 			= /(^\/.+$)/i; // Determines if an href link has the domain includedconst REGEX_WORD_CHAR = /[\S]+/i;
const REGEX_WORD_CHAR 		= /[\S]+/i;

// ---------------------------------------------------------------------
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

	let hostname = response.request.uri.href.replace(response.request.uri.path,'');
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

	let promise_array = [];
	iterateLinks(hrefs);

	function iterateLinks(hrefs){
		let link = hrefs.pop();
		promise_array.push(
			new Promise( ( resolve , reject )=>{
				console.error('REQUEST : ' + link);
				getHtmlFromUrl( link )
				.then(
					(resolved)=>{
						console.error("HTTP RESPONSE: " + resolved.statusCode + " (resolved): " + `'${link}'` );
						if(resolved.statusCode === 200){
							let amp_link = getAmpHrefFromHtml(resolved.body).join(' ');
							if(REGEX_WORD_CHAR.test(amp_link)){
								console.error( amp_link );
								console.log( amp_link );
							}
						}
						resolve();
					},
					(reject)=>{
						console.error("HTTP RESPONSE: " + reject + " (rejected)");
						resolve(); // we dont care about rejections here, we resolve anyways
						// console.error(`\t${reject.message}`);
					}
				).catch((error)=>{
					console.error("getHtmlFromUrl ERROR: " + error.message)
				});
			})
		);


		if(hrefs.length > 0){
			setTimeout( ()=>{ iterateLinks( hrefs ) } , WAIT_TIME );
		}else{
			Promise.all(promise_array).then(()=>{
				console.error("Done.");
				process.exit(0);
			}).catch((error)=>{
				console.error("Promise.all Error: " + error.message);
				process.exit(1);
			});
		}
	}

}

async function getHtmlFromUrl( url ){
	return new Promise((resolve,reject)=>{
		request (url, HTTP_REQUEST_OPTIONS )
		.then(	(response)	=>{resolve(response)	})
		.catch( (error)			=>{reject (error) 		});
	});
}

function getHrefFromHtml(html){
	let array = [];
	let result_array = [];
	// Parse body for amp links
	while ((array = REGEX_HREF.exec(html)) !== null) {
		result_array.push(array[1]);
	}
	return result_array;
}

function getAmpHrefFromHtml(html){
	let array = [];
	let result_array = [];
	// Parse body for amp links
	while ((array = REGEX_HREF_AMP.exec(html)) !== null) {
		result_array.push(array[1]);
	}
	return result_array;
}
