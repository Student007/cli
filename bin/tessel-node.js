#!/usr/bin/env node
var common = require('../src/cli');
var keypress = require('keypress');
var read = require('read');
var colony = require('colony');
// Setup cli.
common.basic();
// Command-line arguments
var argv = require('nomnom').script('tessel-node').option('script', {
    position: 0,
    full: 'script.js',
    help: 'Run this script on Tessel.'
  }).option('arguments', {
    position: 1,
    list: true,
    help: 'Arguments to pass in as process.argv.'
  }).option('version', {
    abbr: 'v',
    flag: true,
    help: 'Print tessel-node\'s version.',
    callback: function () {
      return require('./package.json').version.replace(/^v?/, 'v');
    }
  }).option('interactive', {
    abbr: 'i',
    flag: true,
    help: 'Enter the REPL.'
  }).option('quiet', {
    abbr: 'q',
    flag: true,
    help: '[Tessel] Hide tessel deployment messages.'
  }).option('messages', {
    abbr: 'm',
    flag: true,
    help: '[Tessel] Forward stdin as child process messages.'
  }).option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  }).parse();
argv.verbose = !argv.quiet;
function usage() {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}
function repl(client) {
  // make `process.stdin` begin emitting "keypress" events
  keypress(process.stdin);
  // listen for the ctrl+c event, which seems not to be caught in read loop
  process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
      process.exit(0);
    }
  });
  client.on('message', prompt);
  function prompt() {
    read({ prompt: '>>' }, function (err, data) {
      try {
        if (err) {
          throw err;
        }
        var script = 'local function _run ()\n' + colony.colonize(data, {
            returnLastStatement: true,
            wrap: false
          }) + '\nend\nsetfenv(_run, colony.global);\nreturn _run()';
        client.command('M', new Buffer(JSON.stringify(script)));
      } catch (e) {
        console.error(e.stack);
        setImmediate(prompt);
      }
    });
  }
}
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
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.');
    } else {
      console.error(err);
    }
  });
  // Forward stdin as messages with "-m" option
  if (argv.messages) {
    process.stdin.resume();
    require('readline').createInterface(process.stdin, {}, null).on('line', function (std) {
      client.send(JSON.stringify(std));
    });
  }
  // Check pushing path.
  if (argv.interactive) {
    var pushpath = __dirname + '/../scripts/repl';
  } else if (!argv.script) {
    usage();
  } else {
    var pushpath = argv.script;
  }
  // Command command.
  var updating = false;
  client.on('command', function (command, data) {
    if (command == 'u') {
      verbose && console.error(data.grey);
    } else if (command == 'U') {
      if (updating) {
        // Interrupted by other deploy
        process.exit(0);
      }
      updating = true;
    }
  });
  client.run(pushpath, [
    'tessel',
    pushpath
  ].concat(argv.arguments || []), function () {
    // Stop on Ctrl+C.
    process.on('SIGINT', function () {
      client.once('script-stop', function (code) {
        process.exit(code);
      });
      setTimeout(function () {
        // timeout :|
        process.exit(code);
      }, 5000);
      client.stop();
    });
    client.once('script-stop', function (code) {
      client.close(function () {
        process.exit(code);
      });
    });
    // repl is implemented in repl/index.js. Uploaded to tessel, it sends a
    // message telling host it's ready, then receives stdin via
    // process.on('message')
    if (argv.interactive) {
      repl(client);
    }
  });
});