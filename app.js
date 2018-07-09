const URL = "https://www.livingsharp.com/items/198/poop-mug";
// const URL = "http://192.168.99.101:32771/sitemap.html";
// const URL = "https://www.livingsharp.com/sitemap.html";
//
// require('./extract_amp_urls.js')
// .extractAMPurls(
// 	URL,
// 	( filename )=>{ console.log(filename) },
// 	{"safe" : false, "timeout" : 1000}
// );


require('./validate_amp').validateAMPurls('SITEMAP_URL_20180709T165948.txt');
