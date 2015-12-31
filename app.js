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


function* isExists (files, findCB, resultCB) {
	var filesObj = files.map(v=> ({file:v, isFile:null}) )
	for(let v of filesObj) {
		let foundFile = yield fs.stat(v.file, (err, stat)=>{ findCB(err,stat,v,filesObj) } )
		if(foundFile) return resultCB&&resultCB(foundFile)
	}
	resultCB(null)
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
			function findFileFunc(err, stat, f, filesObj) {
				f.isFile = Boolean(stat&&stat.isFile());
				for(let v of filesObj) {
					if(typeof v.isFile!=='boolean') break;
					if(v.isFile) {
						it.next(v.file)  // here terminate the generator, with { value: undefined, done: true }
						return
					}
				}
				it.next();
			},
			function resultCB(indexFile) {
				if(indexFile) route(indexFile, request, response)
				else notFound()
			}
		)
		it.next()

    } else {
      // console.log('file', pathname)
      route(pathname, request, response)
    }



  })

}).listen(80);

