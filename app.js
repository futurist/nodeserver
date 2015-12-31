'use strict'

var http = require('http'),
    httpProxy = require('http-proxy');
var util = require('util');
var url = require('url');
var path = require('path');
var fs = require('fs');
var staticServer = require('node-static');

var rootDir = '/home/1111hui/public_html'

var fileServer = new staticServer.Server(rootDir);
var proxy = new httpProxy.createProxyServer({});

var apacheUrls = [
  /\.php|\.py$/,
];

var defaultIndex = [
  'index.html',
  'index.php',
  'index.py',
];


var GlobalIt = null;
function* isExists (files, findCB, resultCB) {
	var filesObj = files.map(v=> ({file:v, isFile:null}) )
	for(let v, i=0, n=files.length; i<n; i++) {
		let foundFile = yield fs.stat(files[i], (err, stat)=>{ findCB(err,stat,i,filesObj,resultCB) } )
		if(foundFile) return resultCB&&resultCB(foundFile)
	}
	resultCB(null)
}

function findFileFunc(err, stat, i, filesObj, resultCB) {
	filesObj[i].isFile = Boolean(stat&&stat.isFile());
	for(let v, i=0, n=filesObj.length; v=filesObj[i], i<n; i++) {
		if(typeof v.isFile!=='boolean') break;
		if(v.isFile) {
			GlobalIt.next(v.file)  // here terminate the generator, with { value: undefined, done: true }
			return
		}
	}
	GlobalIt.next()
}


function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch(err) {
    return !(err && err.code === 'ENOENT');
  }
}

function parseUrl(uri){
  var urlObj = url.parse(uri);
  var pathname = urlObj.pathname
  urlObj.dirname = path.dirname(pathname)
  urlObj.filename = path.basename(pathname)
  return urlObj
}

function doApache (request, response){
      // serve .php using apache
      proxy.web(request, response, {
        target: 'http://127.0.0.1:8181'
      });
}

function doJsonAPI (request, response){
      // serve .php using apache
      proxy.web(request, response, {
        target: 'http://127.0.0.1:4000'
      });
}

function doStatic (request, response){
  // serve static file using node-static
   request.addListener('end', function () {
      fileServer.serve(request, response, function (err, result) {
          if (err) { // There was an error serving the file
              console.error("Error serving " + request.url + " - " + err.message);
              // Respond to the client
              response.writeHead(err.status, err.headers);
              response.end();
          }
      });
  }).resume()
}

function route(pathname, request, response){

    var isApache = apacheUrls.some(function (regex) {
      return regex.test( pathname );
    });
    if(isApache) return doApache(request, response);

    return doStatic(request, response);
}

http.createServer(function (request, response) {
  var pathname = parseUrl(request.url).pathname;
  var filename = rootDir+pathname;
  var notFound = ()=>{
  		response.statusCode = 404;
		response.statusMessage = 'Not found';
		return response.end();
  }

  fs.stat( filename, function(err, stat){
  	
    if(err || !stat ){ 

    	// check is virtul dir/file
	    var isJsonAPI = /^\/json-api\//.test( pathname );
	    if(isJsonAPI) return doJsonAPI(request, response);

		// not found
		return notFound()
    }

    if( stat.isDirectory() ){
      // console.log('dir', pathname)

      	// using generator function + async to not block when find a index file
		var it = isExists(
			defaultIndex.map( v=>path.join(filename, v) ), // index files path array
			findFileFunc, // helper function to iterate when not found right index
			function(indexFile){
				util.inspect(GlobalIt, true, null)
				if(indexFile) route(indexFile, request, response)
				else notFound()
			}
		)
		GlobalIt = it;
		it.next()

    } else {
      // console.log('file', pathname)
      route(pathname, request, response)
    }

    

  })

}).listen(80);

