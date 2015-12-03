var AlchemyAPI = require('./alc/alchemyapi');
var alchemy = new AlchemyAPI();

var Promise = require("promise");
var fs = require("fs");
var path = require("path");
var Map = require("es6-map");
var printf = require("printf");
var cheerio = require("cheerio");
var Set = require('es6-set');

var readdir = Promise.denodeify(fs.readdir);
var readFile = Promise.denodeify(fs.readFile);

var entities = function(data){
	// return Promise.resolve(tempData); // test more later
	console.log("Processing data in", data.length, "chunks.");
	//process.stdout.write("Analyzing Google Data: [                    ]   0.00%\r");
	return new Promise(function(resolve, reject){
		var ret = [];

		var next = function(ind){
			alchemy.entities("text", data[ind], {sentiment: 1}, function(resp){
				ret.push(resp);
				ind++;

				// var prog = "Analyzing Google Data: [";

				// for(var i = 0; i < Math.floor(ind*20/data.length); i++){
				// 	prog += "#";
				// }

				// for(var i = 0; i < 20 - Math.floor(ind*20/data.length); i++){
				// 	prog += " ";
				// }

				// prog += "] " + printf("%6.2f%", ind*100/data.length) + "\r";

				// process.stdout.write(prog);

				if(ind >= data.length){
					process.stdout.write("\n");
					resolve(ret);
				} else {
					next(ind);
				}
			});
		};

		next(0);
	});
}

if(process.argv.length < 3){
	console.log("Usage: node analysis.js <google data folder> <facebook data folder>")
} else {
	var googlePath = process.argv[1];
	var facebookPath = process.argv[2];

	var googlePromise = readdir(googlePath)
		.then(function(listing){
			var fileReads = [];
			for(var i = 0; i < listing.length; i++){
				if(listing[i].charAt(0) != '.'){
					fileReads.push(readFile(path.join(googlePath, listing[i]), "utf8"));
				}
			}
			return Promise.all(fileReads);
		})
		.then(function(data){
			return data.map(function(el){
				return JSON.parse(el).event.reduce(function(prev, cur){
					prev.push(cur.query.query_text);
					return prev;
				}, []);
			}).reduce(function(prev, cur){
				Array.prototype.push.apply(prev, cur);
				return prev;
			}, []);
		})
		.then(function(data){
			return data.reduce(function(prev, cur){
				if(prev[prev.length-1].length + cur.length + 1 >= 5000){
					prev.push("");
				}
				prev[prev.length-1] += "\n" + cur;
				return prev;
			}, [[]]);
		})
		.then(function(data){
			//console.log(data);
			return data;
		})
		.then(entities)
		.then(function(data){
			return data.map(function(el){
				return el.entities;
			}).reduce(function(prev, cur){
				Array.prototype.push.apply(prev, cur);
				return prev;
			}, []);
		})
		.then(function(data){
			return data.filter(function(el){
				return el.type != "Quantity" && el.type != "Person";
			});
		})
		.then(function(data){
			var ret = data.reduce(function(prev, cur){
				if(prev.indexOf(cur.text) < 0){
					prev.push(cur.text);
				}
				return prev;
			}, []);

			// console.log("Google done");
			// console.log(ret);

			return ret;
		});

	var facebookPromise = readFile(path.join(facebookPath, "html", "wall.htm"))
		.then(function(data){
			return cheerio.load(data);
		})
		.then(function($){
			var res = [];
			
			$("div.comment").each(function(i, el){
				res.push($(el).text());
			});

			return res;
		})
		.then(function(data){
			//console.log(data);
			return data;
		})
		.then(function(data){
			return data.reduce(function(prev, cur){
				if(prev[prev.length-1].length + cur.length + 1 >= 5000){
					prev.push("");
				}
				prev[prev.length-1] += "\n" + cur;
				return prev;
			}, [[]]);
		})
		.then(entities)
		.then(function(data){
			return data.map(function(el){
				return el.entities;
			}).reduce(function(prev, cur){
				Array.prototype.push.apply(prev, cur);
				return prev;
			}, []);
		})
		.then(function(data){
			var ret = data.filter(function(el){
				return el.type != "Quantity" && el.type != "Person";
			});

			// console.log(ret);
			return ret;
		})
		.then(function(data){
			var ret = data.reduce(function(prev, cur){
				if(prev.indexOf(cur.text) < 0){
					prev.push(cur.text);
				}
				return prev;
			}, []);

			// console.log("Facebook done");
			// console.log(ret);

			return ret;
		});

	Promise.all([googlePromise, facebookPromise])
		.then(function(data){
			var googlekw = data[0];
			var facebookkw = data[1];

			console.log("Google:", googlekw);
			console.log("Facebook:", facebookkw);

			var googleMinusFacebook = googlekw
				.slice(0, googlekw.length)
				.filter(function(el){
					return facebookkw.indexOf(el) < 0;
				});

			var facebookMinusGoogle = facebookkw
				.slice(0, facebookkw.length)
				.filter(function(el){
					return googlekw.indexOf(el) < 0;
				});

			var intersection = googlekw
				.slice(0, googlekw.length)
				.filter(function(el){
					return facebookkw.indexOf(el) >= 0;
				});

			console.log("Facebook but not Google:", facebookMinusGoogle.length);
			console.log("Google but not Facebook:", googleMinusFacebook.length);
			console.log("Both:", intersection.length);
		})
		.catch(function(err){
			console.error("ERROR: " + err.stack);
		});
}
