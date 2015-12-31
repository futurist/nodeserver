'use strict'

var fs=require('fs')

var files = [
	'./app.js',
	'./app1.js',
	'./package.json',
	'./package2.json',
]

function* isExists (files, cb) {
	var isEnd = false;
	var filesObj = files.map(v=> ({file:v, isFile:null}) )
	for(let v, i=0, n=files.length; !isEnd && i<n; i++) {
		isEnd = yield fs.stat(files[i], (err, stat)=>{ cb(err,stat,i,filesObj) } )
	}
}

function getResult(err, stat, i, filesObj) {
	filesObj[i].isFile = Boolean(stat&&stat.isFile());
	var isEnd = false;
	for(let v, i=0, n=filesObj.length; v=filesObj[i], i<n; i++) {
		if(typeof v.isFile!=='boolean') break;
		if(v.isFile) {
			isEnd = true;
			break;
		}
	}
	if(isEnd){
		// yeah, we found the right file
	} else it.next()
}

var it = isExists(files, getResult)
it.next()

