var once = require('lodash.once');
var noop = require('lodash.noop');
var constant = require('lodash.constant');

// Bacon doesn't support stream instances from different instances of the
// library directly interacting. This function converts a foreign Bacon stream
// or an RxJS stream into a native Bacon stream. It also converts non-streams
// into a stream that emits a single value.
function baconCast(Bacon, input) {
  if (input && input.subscribe && input.subscribeOnNext) { // RxJS
    return Bacon.fromBinder(function(sink) {
      var unsub;
      input.takeUntil({
        then: function(cb) {
          unsub = once(function() {
            sink = noop; // Avoid sinking the End event that cb() will trigger
            cb();
          });
        }
      }).subscribe(function onNext(value) {
        if (sink(new Bacon.Next(constant(value))) === Bacon.noMore) {
          unsub();
        }
      }, function onError(err) {
        sink([new Bacon.Error(err), new Bacon.End()]);
      }, function onCompleted() {
        sink(new Bacon.End());
      });
      return unsub;
    });
  } else if (input && input.subscribe && input.onValue) { // Bacon
    return Bacon.fromBinder(function(sink) {
      return input.subscribe(function(event) {
        if (event.isNext()) {
          sink(new Bacon.Next(event.value.bind(event)));
        } else if (event.isEnd()) {
          sink(new Bacon.End());
        } else if (event.isInitial()) {
          sink(new Bacon.Initial(event.value.bind(event)));
        } else if (event.isError()) {
          sink(new Bacon.Error(event.error));
        } else {
          console.error("Unknown type of Bacon event", event);
        }
      });
    });
  } else {
    return Bacon.once(input);
  }
}

module.exports = baconCast;
