#!/usr/bin/env node

var common = require('../src/cli')

// Setup cli.
common.basic();

common.controller(false, function (err, client) {
  client.listen(true);
})
