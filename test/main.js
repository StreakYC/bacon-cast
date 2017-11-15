'use strict';

const constant = require('lodash/constant');
const assert = require('assert');
const Bacon = require('baconjs');
const Rx = require('rx');
const Kefir = require('kefir');
const kefirBus = require('kefir-bus');

const baconCast = require('..');

function testStreamForOneValue(stream, value, callback) {
  var s = baconCast(Bacon, stream);
  var values = 0;
  s.onValue(function(x) {
    assert.strictEqual(x, value);
    values++;
  });
  s.onEnd(function() {
    assert.strictEqual(values, 1);
    callback();
  });
}

function shouldNotBeCalled() {
  throw new Error("Should not be called");
}

describe('baconCast', function() {
  describe('Bacon', function() {
    it('supports basic stream', function(done) {
      testStreamForOneValue(Bacon.later(0, shouldNotBeCalled), shouldNotBeCalled, done);
    });

    it('handles unsubscription', function(done) {
      var calls = 0;
      var s = baconCast(Bacon, Bacon.fromPoll(0, function() {
        if (++calls === 1) {
          return 'beep';
        } else {
          throw new Error("Should not happen");
        }
      }));
      s.take(1).onEnd(done);
    });

    it('supports all event types', function(done) {
      var s = baconCast(Bacon, Bacon.mergeAll(
        Bacon.once('beep'),
        Bacon.once(new Bacon.Error('bad')),
        Bacon.once(shouldNotBeCalled)
      ).toProperty('prop'));

      var calls = 0;
      s.subscribe(function(event) {
        switch(++calls) {
          case 1:
            assert(event instanceof Bacon.Initial);
            assert.strictEqual(event.value(), 'prop');
            break;
          case 2:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'beep');
            break;
          case 3:
            assert(event instanceof Bacon.Error);
            assert.strictEqual(event.error, 'bad');
            break;
          case 4:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), shouldNotBeCalled);
            break;
          case 5:
            assert(event instanceof Bacon.End);
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('works on mock stream object', function(done) {
      var unsubbed = 0;
      var s = baconCast(Bacon, {
        onValue: true,
        subscribe: function(sink) {
          sink({
            isInitial: constant(true), isNext: constant(false),
            isError: constant(false), isEnd: constant(false),
            value: constant('prop')
          });
          sink({
            isInitial: constant(false), isNext: constant(true),
            isError: constant(false), isEnd: constant(false),
            value: constant('beep')
          });
          setTimeout(function() {
            sink({
              isInitial: constant(false), isNext: constant(false),
              isError: constant(true), isEnd: constant(false),
              error: 'bad'
            });
            sink({
              isInitial: constant(false), isNext: constant(true),
              isError: constant(false), isEnd: constant(false),
              value: constant(shouldNotBeCalled)
            });
            sink({
              isInitial: constant(false), isNext: constant(false),
              isError: constant(false), isEnd: constant(true)
            });
            sink({
              isInitial: constant(false), isNext: constant(true),
              isError: constant(false), isEnd: constant(false),
              value: function() {
                throw new Error("Post-end event should not be evaluated");
              }
            });
          }, 0);

          return function() {
            unsubbed++;
          };
        }
      });

      var calls = 0;
      s.subscribe(function(event) {
        switch(++calls) {
          case 1:
            assert(event instanceof Bacon.Initial);
            assert.strictEqual(event.value(), 'prop');
            break;
          case 2:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'beep');
            break;
          case 3:
            assert(event instanceof Bacon.Error);
            assert.strictEqual(event.error, 'bad');
            break;
          case 4:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), shouldNotBeCalled);
            break;
          case 5:
            assert(event instanceof Bacon.End);
            assert.strictEqual(unsubbed, 1);
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var bus = new Bacon.Bus();

      var s = baconCast(Bacon, bus);

      var calls1 = 0, calls2 = 0;
      s.take(1).subscribe(function(event) {
        switch (++calls1) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 1);
            break;
          case 2:
            assert(event instanceof Bacon.End);

            s.subscribe(function(event) {
              switch (++calls2) {
                case 1:
                  assert(event instanceof Bacon.Next);
                  assert.strictEqual(event.value(), 2);
                  break;
                case 2:
                  assert(event instanceof Bacon.End);

                  setTimeout(function() {
                    s.subscribe(function(event) {
                      assert(event instanceof Bacon.End);
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      bus.push(1);
      bus.push(2);
      bus.end();
    });
  });

  describe('RxJS', function() {
    it('supports basic observable', function(done) {
      var s = baconCast(Bacon, Rx.Observable.fromArray([
        'beep',
        shouldNotBeCalled
      ]));

      var calls = 0;
      s.subscribe(function(event) {
        switch(++calls) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'beep');
            break;
          case 2:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), shouldNotBeCalled);
            break;
          case 3:
            assert(event instanceof Bacon.End);
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('supports observable with error', function(done) {
      var err = new Error('some err');
      var s = baconCast(Bacon, Rx.Observable.fromArray([
        'beep',
        shouldNotBeCalled
      ]).concat(Rx.Observable.throw(err)));

      var calls = 0;
      s.subscribe(function(event) {
        switch(++calls) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'beep');
            break;
          case 2:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), shouldNotBeCalled);
            break;
          case 3:
            assert(event instanceof Bacon.Error);
            assert.strictEqual(event.error, err);
            break;
          case 4:
            assert(event instanceof Bacon.End);
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var subject = new Rx.Subject();

      var s = baconCast(Bacon, subject);

      var calls1 = 0, calls2 = 0;
      s.take(1).subscribe(function(event) {
        switch (++calls1) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 1);
            break;
          case 2:
            assert(event instanceof Bacon.End);

            s.subscribe(function(event) {
              switch (++calls2) {
                case 1:
                  assert(event instanceof Bacon.Next);
                  assert.strictEqual(event.value(), 2);
                  break;
                case 2:
                  assert(event instanceof Bacon.End);

                  setTimeout(function() {
                    s.subscribe(function(event) {
                      assert(event instanceof Bacon.End);
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      subject.onNext(1);
      subject.onNext(2);
      subject.onCompleted();
    });
  });

  describe('Kefir', function() {
    it('supports basic stream', function(done) {
      testStreamForOneValue(Kefir.later(0, shouldNotBeCalled), shouldNotBeCalled, done);
    });

    it('handles unsubscription', function(done) {
      var calls = 0;
      var s = baconCast(Bacon, Kefir.fromPoll(0, function() {
        if (++calls === 1) {
          return 'beep';
        } else {
          throw new Error("Should not happen");
        }
      }));
      s.take(1).onEnd(done);
    });

    it('supports all event types', function(done) {
      var s = baconCast(Bacon, Kefir.merge([
        Kefir.later(0, 'beep'),
        Kefir.later(1, 'bad').flatMap(Kefir.constantError),
        Kefir.later(2, shouldNotBeCalled)
      ]).toProperty(constant('prop')));

      var calls = 0;
      s.subscribe(function(event) {
        switch(++calls) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'prop');
            break;
          case 2:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 'beep');
            break;
          case 3:
            assert(event instanceof Bacon.Error);
            assert.strictEqual(event.error, 'bad');
            break;
          case 4:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), shouldNotBeCalled);
            break;
          case 5:
            assert(event instanceof Bacon.End);
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var bus = new kefirBus();

      var s = baconCast(Bacon, bus);

      var calls1 = 0, calls2 = 0;
      s.take(1).subscribe(function(event) {
        switch (++calls1) {
          case 1:
            assert(event instanceof Bacon.Next);
            assert.strictEqual(event.value(), 1);
            break;
          case 2:
            assert(event instanceof Bacon.End);

            s.subscribe(function(event) {
              switch (++calls2) {
                case 1:
                  assert(event instanceof Bacon.Next);
                  assert.strictEqual(event.value(), 2);
                  break;
                case 2:
                  assert(event instanceof Bacon.End);

                  setTimeout(function() {
                    s.subscribe(function(event) {
                      assert(event instanceof Bacon.End);
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      bus.emit(1);
      bus.emit(2);
      bus.end();
    });
  });

  describe('Constant', function() {
    it('transforms non-streams to single-item streams', function(done) {
      var value = {a: 5};
      testStreamForOneValue(value, value, done);
    });
  });
});
