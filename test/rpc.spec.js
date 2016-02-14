var assert = require('assert');
var expect = require('chai').expect;

var rpc = require('../build/rpc');
var parameterNames = rpc.parameterNames;
var methodsDefinition = rpc.methodsDefinition;
var response = rpc.response;


describe('RPC', function(){

  describe('extract function parameters names', function(){

    it('should extract function param names', function(){

      assert.deepEqual(parameterNames(function(a, b, c, d){}), ['a', 'b', 'c', 'd']);
    });

    it('should ignore comments', function(){

      assert.deepEqual(parameterNames(function(a,/* comment */ b, c, d){}), ['a', 'b', 'c', 'd']);
    });
  });

  describe('Methods defintion', function(){

    var multimethod = {

      procedure1: function(a,b, callback){},
      procedure2: function(callback){},
      value: 'hello'
    };

    it('should return definition for a function service', function(){

      var def = methodsDefinition(multimethod.procedure1);

      expect(def).to.have.property('type').that.is.equal(rpc.FUNCTIONTYPE);
      expect(def).to.have.property('params').that.is.deep.equal(['a', 'b', 'callback']);
    })

    it('should return definition for a value service', function(){

      var def = methodsDefinition(multimethod.value);

      expect(def).to.have.property('type').that.is.equal(rpc.VALUETYPE);
      expect(def).to.have.property('value').that.is.equal('hello');
    })

    it('should return definition for Multimethod services', function(){

      var def = methodsDefinition(multimethod);

      expect(def).to.have.property('procedure1');
      expect(def).to.have.property('procedure2');
      expect(def).to.have.property('value');

      expect(def.procedure1.type).to.equal(rpc.FUNCTIONTYPE);
      expect(def.procedure1.params).to.deep.equal(['a', 'b', 'callback']);

      expect(def.procedure2.type).to.equal(rpc.FUNCTIONTYPE);
      expect(def.procedure2.params).to.deep.equal(['callback']);

      expect(def.value.type).to.equal(rpc.VALUETYPE);
      expect(def.value.value).to.equal('hello');

    });
  });


  describe('Response function', function(){

    it('should create the right response for array params', function(done){

      var multimethod = {

        add: function(a, b, callback){

          return callback(null, a + b);
        }
      };

      var req = {

        method: 'add',
        params: [1, 1],
        jsonrpc: '2.0',
        id: 1
      };

      response(multimethod)(req, function(resp){

        expect(resp.result).to.equal(2);
        done();
      });
    });

    it('should create the right response for object params', function(done){

      var multimethod = {

        add: function(a, b, callback){

          return callback(null, a + b);
        }
      };

      var req = {

        jsonrpc: '2.0',
        method: 'add',
        id: 1,
        params: {
          a: 1,
          b: 2
        }
      };

      response(multimethod)(req, function(resp){

        expect(resp.result).to.equal(3);
        done();
      });
    });


    it('should create the right response for function without params', function(done){

      var multimethod = {

        two: function(cb){return cb(null, 2);}
      };

      var req = {

        jsonrpc: '2.0',
        method: 'two',
        id: 1
      };

      response(multimethod)(req, function(resp){

        expect(resp.result).to.equal(2);
        done();
      });
    });


    it('should create the right response for static int values', function(done){

      var service = {
        int: 2
      };


      response(service)({jsonrpc: '2.0', method: 'int', id: 1}, function(resp){

        expect(resp.result).to.equal(2);
        done();
      });
    });

    it('should create the right response for static float values', function(done){

      var service = {
        float: 2.1
      };


      response(service)({jsonrpc: '2.0', method: 'float', id: 1}, function(resp){

        expect(resp.result).to.equal(2.1);
        done();
      });
    });

    it('should create the right response for static string values', function(done){

      var service = {
        string: 'hello'
      };

      response(service)({jsonrpc: '2.0', method: 'string', id: 1}, function(resp){

        expect(resp.result).to.equal('hello');
        done();
      });
    });

    it('should create the right response for static array values', function(done){

      var service = {
        array: [1 , '2', {3: 4}]
      };

      response(service)({jsonrpc: '2.0', method: 'array', id: 1}, function(resp){

        expect(resp.result).to.deep.equal([1 , '2', {3: 4}]);
        done();
      });
    });

    it('should create the right response for static boolean values', function(done){

      var service = {
        true: true
      };

      response(service)({jsonrpc: '2.0', method: 'true', id: 1}, function(resp){

        expect(resp.result).to.equal(true);
        done();
      });
    });

    it('should create the right response for deep objects', function(done){

      var service = {
        a: {

          b: {

            c: function(cb){ cb(null, 'd')}
          }
        }
      };

      response(service)({jsonrpc: '2.0', method: 'a.b.c', id: 1}, function(resp){

        expect(resp.result).to.equal('d');
        done();
      });
    });

    it('should reply with defintion of service', function(done){

      var service = {
        a: {

          b: {

            c: function(cb){ cb(null, 'd')}
          }
        }
      };

      response(service)({jsonrpc: '2.0', method: rpc.DEFINITIONMETHOD, id: 1}, function(resp){

        expect(resp.result).to.have.deep.property('a.b.c.type').that.equal(rpc.FUNCTIONTYPE);
        done();
      });
    });


    it('should create reply with an invalid request', function(done) {


      response(function(){})({}, function(resp){

        expect(resp.error.code).to.equal(rpc.INVALIDREQUEST);
        done();
      });

    })


    it('should create reply with an invalid request for not leaf method', function(done) {

      var service = {

        one: {

          two: 1
        }
      }

      response(service)({jsonrpc: '2.0',id: 1, method:'one'}, function(resp){

        expect(resp.error.code).to.equal(rpc.INVALIDREQUEST);
        done();
      });

    })

    it('should create reply with an methodNotFound', function(done) {

      var multimethod = {

        add: function(a, b, callback){

          return callback(null, a + b);
        }
      };

      var req = {

        jsonrpc: '2.0',
        method: 'do',
        id: 1,
        params: {
          a: 1,
          b: 2
        }
      };

      response(multimethod)(req, function(resp){

        expect(resp.error.code).to.equal(rpc.METHODNOTFOUND);
        done();
      });

    })
  })
});
