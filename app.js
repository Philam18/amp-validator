// const URL = "http://192.168.99.100:32771/sitemap.html";
// const URL = "https://www.livingsharp.com/sitemap.html";

require('./extract_amp_urls.js').extractAMPurls(
	'https://www.fightful.com/sitemap.xml',
	( filename )=>{

	},
	{"safe_mode" : false, "wait_time" : 0}
);

//
// require('./validate_amp_urls').validateAMPurls(
// 	'SITEMAP_URL_20180710T142839.txt',
// 	( report_filename )=>{
// 		console.log( report_filename)
// 	},
// 	{"safe" : true, "wait_time" : 1000}
// );
