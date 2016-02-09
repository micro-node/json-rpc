import * as _ from 'lodash';

// types
export const SINGLETYPE = 'single-method';
export const MULTITYPE = 'multi-method';

// some cool regexp
const FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
const FN_ARG_SPLIT = /,/;
const FN_ARG = /^\s*(_?)(.+?)\1\s*$/;
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

//RPC version
export const JSONRPCVERSION = '2.0';

// errors
export const INVALIDREQUEST = -32600;
export const METHODNOTFOUND = -32601;

export function parameterNames(fn){

  let params = [];

  let fnText = fn.toString().replace(STRIP_COMMENTS, '');
  let argDecl = fnText.match(FN_ARGS);
  let args = argDecl[1].split(FN_ARG_SPLIT);

  args.forEach(arg => arg.replace(FN_ARG, (all, underscore, name) => params.push(name)));

  return params;
}


export function methodsDefinition(service){

  let isSingleMethod = _.isFunction(service);

  let type = isSingleMethod? SINGLETYPE: MULTITYPE;
  let methods = {};

  if(isSingleMethod){

    methods.default = { name: 'default', params: parameterNames(service) };

  }else{

    Object.keys(service).forEach( name => methods[name] = {name, params: parameterNames(service[name])});
  }

  return {type, methods};
}


export function response(methods){

  var def = methodsDefinition(methods);

  return check((def.type === SINGLETYPE)? single : multi);

  // single method definition
  function single(req, callback){

    methods.apply(methods, params(req).concat(callback));
  }

  // multimethod definition
  function multi(req, callback){

    methods[req.method].apply(methods[req.method], params(req).concat(callback));
  }

  // extract params
  function params({params, method}){

    if(params === undefined)
      return [];

    if(_.isArray(params))
      return params;

    if(_.isObject(params)){

      return def.methods[method].params
        .map(name => params[name])
        .filter(param => param !== undefined);
    }
  }

  function check(fn){

    return function(req, callback){

      let err = error(def, req);

      if(!err)
        return fn(req, callback);

      callback(err, {
        jsonrpc: JSONRPCVERSION,
        error: err,
        id: req.id
      });
    };
  }
}


export function error(def, req){

  if(req.jsonrpc !== JSONRPCVERSION){

    return {
      code: INVALIDREQUEST,
      message: 'The JSONRPC version doesn\'t match 2.0'
    };
  }

  if(req.id === undefined){

    return {
      code: INVALIDREQUEST,
      message: 'The id member is missing'
    };
  }

  if(def.methods[req.method] === undefined){

    return {
      code: METHODNOTFOUND,
      message: 'The method was not found'
    };
  }

}
