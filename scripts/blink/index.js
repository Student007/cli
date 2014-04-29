var tessel = require('tessel');
var led1 = tessel.led(1).output().high();
var led2 = tessel.led(2).output().low();
var i = 0;
setInterval(function () {
  console.log('Blinked', i++, 'times');
  led1.toggle();
  led2.toggle();
}, 100);