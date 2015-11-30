'use strict';
var program = require('commander')

var UserError = require('./UserError')

var pkg = require('../package.json')

program
  .version(pkg.version)
  .option('-u, --username <s>','Username for login')
  .option('-p, --password <s>','Password for login')
  .option('-H, --host <s>','Prism host, defaults to cdn.oose.io')
  .option('-P, --port <n>','Prism port, defaults to 5971')
  .parse(process.argv)


/**
 * Prism Config
 * @type {{host: string, port: string}}
 */
var prismConfig = {
  prism: {
    host: program.host || null,
    port: program.port || 5971
  }
}

//setup our prism handle
var prism = new (require('./Prism'))(prismConfig)

//connect
prism.connect()
  .then(function(){
    return prism.login(program.username,program.password)
  })
  .then(function(result){
    console.log('Login successful please use the token below')
    console.log(result)
  })
  .catch(UserError,function(err){
    console.log('ERROR: ' + err.message)
  })
