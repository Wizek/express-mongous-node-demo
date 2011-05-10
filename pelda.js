/*\
 *  Az Express Nose.js modulba és MongoDB-be (Mongous driver)
 *  való bevezetésre szolgáló példafájl.
 *
 *  v0.7 by Wizek @ 2011.01.23
\*/

// Modulok betöltése
var ObjectID = require('mongodb').BSONNative.ObjectID.createFromHexString
  , express = require('express')
  , http = require('http')
  , db = require('./mongous/mongous.js').Mongous


// Adatbázis neve, amivel foglalkozunk
var dbName = "pelda_db" 

// Létrehozunk egy szervert, és elérhetővé tesszük a server nevű változóban
var server = express.createServer()

// Beálítjuk milyen útvonalon menjen keresztül minden kérés
server.configure(function() {
  //server.use(express.logger(':date :remote-addr :method :response-timems :status :url'))
  // támogat x-www-form-urlencoded -et és JSONt alapból
  server.use(express.bodyParser())
  // Szétnéz található-e fájl a kért URL-hez képest
  server.use(express.static(__dirname + '/static'))
  // Ha nem tud fájlt felszolgálni, megy a routerhez (lejjebb)
  server.use(server.router)
  // Amely kérést a router sem teljesít, azt átirányítjuk végső 
  server.use(function(req, res, next) {
    res.redirect('/')
  })
})

// router
// minden GET lekérdezést tovább engedünk a next() függvény segítségével
server.get('*', function(req, res, next) { next() })
// A POST kéréseket az ajax függvény kezeli
server.post('*', ajax)

function ajax (req, res, next) {
  var d = req.body

  // Hozáadás és törélés
  if (d.what) {
    // A felhasználótól függően hozzáadjuk vagy töröljük az adott értéket
    if (d.type == "add") {
      db(dbName+'.pelda_coll').insert( {"value":d.what} )
      console.log("+ "+d.what)
    }else if (d.type == "del") {
      if (d.which == "id") {
        db(dbName+'.pelda_coll').remove( {"_id":ObjectID(d.what)} )
      }else{
        db(dbName+'.pelda_coll').remove( {"value":d.what} )
      }
      console.log("- "+d.what)
    }
  }

  // Módosítás
  if (d.type == "mod" && d.from && d.to) {
    if (d.which == "id") {
      db(dbName+'.pelda_coll').update({"_id":ObjectID(d.from)}, {"value":d.to})
    }else{
      db(dbName+'.pelda_coll').update({"value":d.from}, {"value":d.to})
    }
    console.log("# "+d.from+" -> "+d.to)
  }
  if (d.type == "refresh") {
    console.log("* Refresh")
  }
  
  // Nem a legjobb megoldás, mert előfordulhat, hogy a find előbb ér célba, mint
  // valamelyik módosítás fentebb, és így idejemúlt képet kapunk az adatokról
  sendRecords()
  function sendRecords (argument) {
    db(dbName+'.pelda_coll').find(function(r) {
      r = r.documents
      var dbResponse = ""
      // Ha van legalább egy dokumentum e adatbázis ezen kollekciójában
      if (r.length > 0) {
        // A választ JSON objektum nyers formájában tároljuk
        dbResponse = JSON.stringify(r, null, 2)
      }else{
        dbResponse = {error:"Üres az adatbázis!"}
      }
      res.send(dbResponse)
    })
  }

}

checkMongoDB()

// 8080-on hallgatózunk szerverünkkel
server.listen(8080, function() {
  console.log("A szerver fut a 8080-as porton!")
})

/*\
 *  Kiegészítők
\*/

// Megvizsgálja fut-e a MongoDB a megadott porton és hoston
// Objektum adható neki success és error kulcsú callback függvényekkel
function checkMongoDB (obj) {
  if (typeof obj != 'object') {obj = {}}
  var port = obj.port || 28017
    , host = obj.host || '127.0.0.1'
    , mongoAddr = http.createClient(port, host)
    , req = mongoAddr.request("GET", "/", {'host': host})

  req.end()

  mongoAddr.on('error', function(e) {
    if (e.errno == 1) {
      noResponse()
    }else{
      console.error(e)
    }
  })

  var reqTimeoutID = setTimeout(noResponse, 2000)

  function noResponse (argument) {
    clearTimeout(reqTimeoutID)
    if (typeof obj.error == 'function') {
      obj.error()
    }else{
      console.error("\nERROR: MongoDB is not responding on "+host+":"+port+"!\n"+
        "No callback for error has been specified, therefore exiting now...")
      process.exit()
    }
  }

  req.on('response', function(res) {
    if (res.statusCode == 200) {
    clearTimeout(reqTimeoutID)
      if (typeof obj.success == 'function') {
        obj.success()
      }
    }else{
      console.error("MongoDB responded, but with a status code different from 200: ["
        +res.statusCode+"]\n", sys.inspect(res))
    }
  })
}