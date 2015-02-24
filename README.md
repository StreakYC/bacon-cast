# BaconCast

Converts various types of streams to Bacon.js streams. This is intended for use
by libraries which use Bacon internally, but want to be able to accept streams
from other libraries or other versions of Bacon as arguments given by the
application.

* Supports converting RxJS Observables into Bacon streams.
* Supports converting Kefir streams into Bacon streams.
* Supports converting a Bacon stream created by one instance of the Bacon
  library into a stream usable by a different instance of a Bacon library.
  (Bacon does not support using streams from different Bacon libraries
  together directly!)
* Casts non-streams into a Bacon stream of one item by using Bacon.once().

BaconCast is intended for use in nodejs and in browsers via CommonJS bundlers
like Browserify. This project is in NPM and can be installed with

    npm install bacon-cast

The related project [KefirCast](https://github.com/StreakYC/kefir-cast) exists
to convert streams to Kefir streams.

## Example

Suppose you have a library that exports a single function `doStuff`, which can
take a stream as an argument. By using BaconCast, you can support any RxJS
streams, Kefir streams, Bacon.js streams, or constants that your users might
pass to you.

```
var Bacon = require('baconjs');
var baconCast = require('bacon-cast');

module.exports = function doStuff(input) {
  var inputStream = baconCast(Bacon, input);
  // Log anything that comes through the stream for 5 seconds.
  inputStream.takeUntil(Bacon.later(5000)).onValue(function(value) {
    console.log('doStuff received value', value);
  });
}
```

If you did not use BaconCast, then your users would be required to use the same
version and instance of Bacon as you, you wouldn't support RxJS or Kefir
streams without more work, and you would have to handle non-stream constant
values specially.

## API

`baconCast(Bacon, input)` takes your Bacon library instance as the first
argument, and the input stream or constant to convert into a Bacon stream as
the second argument. A Bacon EventStream compatible with the given Bacon library
will be returned.
