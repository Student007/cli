#!/usr/bin/env node
var common = require('../src/cli');
// Setup cli.
common.basic();
common.controller(function (err, client) {
  client.listen(true, [
    10,
    11,
    12,
    13,
    20,
    21,
    22
  ]);
});