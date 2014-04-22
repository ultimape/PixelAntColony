//<![CDATA[
//* debug bits *//
// Makes the error message in chrome's log have some useful information in them.
/*
window.onerror=function(msg, url, linenumber){
	console.error("[%s]\t %s\n\t\t\t\t\t\t\t  Url: %s\n\t\t\t\t\t\t\t  Line Number: %s",
	new Date().toISOString(),
	msg,
	url,
	linenumber);
return true;} 
//]]>
*/