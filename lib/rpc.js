import * as _ from 'lodash';
import serializeError from 'serialize-error';

// leaf types
export const FUNCTIONTYPE = 'function';
export const VALUETYPE = 'value';

export const DEFINITIONMETHOD = 'rpc.definition';

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

/**
 * Get Method definition
 * @param service
 * @returns {{type: string, methods: {}}}
 */
export function methodsDefinition(service){

  return innerDef(service);

  function innerDef(prop, parent) {

    // is function
    if (_.isFunction(prop))
      return {
        type: FUNCTIONTYPE,
        params: parameterNames(prop),
        value: prop.bind(parent)
      };

    // is value
    if(isValue(prop))
      return { type: VALUETYPE, value: prop};

    // deeper objects
    let children = Object.create(null);

    // iterate throught all props
    _.forIn(prop, (value, key) => children[key] = innerDef(value, prop));

    return children;
  }
}

/**
 * JSON RPC responder
 * @param methods
 * @returns {*}
 */
export function response(methods){

  var def = methodsDefinition(methods);

  return check(reply);

  // the actual reply
  function reply(req, cb){

    let methodDef = _.get(def, req.method);

    if(req.method === DEFINITIONMETHOD)
      return cb(success(req, def));

    if(methodDef.type === VALUETYPE)
      return cb(success(req, methodDef.value));

    try{

      let args = getParams(req.params, methodDef.params);

      methodDef.value.apply(methodDef.value, args.concat(callback(req, cb)));

    }catch(err){

      cb(error(req, err));
    }
  }

  // extract params
  function getParams(reqParams, defParams){

    if(reqParams === undefined)
      return [];

    if(_.isArray(reqParams))
      return reqParams;

    if(_.isObject(reqParams)){

      return defParams
        .map(name => reqParams[name])
        .filter(p => p !== undefined);
    }
  }

  function check(fn){

    return function(req, cb){

      let err = findError(def, req);

      if(err !== undefined)
        return cb(error(req, err));

      return fn(req, cb);
    };
  }
}

// error helper function
export function findError(def, req){

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

  if(req.method !== DEFINITIONMETHOD){

    let methodDef = _.get(def, req.method);

    if(methodDef === undefined){

      return {
        code: METHODNOTFOUND,
        message: 'The method was not found'
      };
    }

    if(methodDef.type !== VALUETYPE && methodDef.type !== FUNCTIONTYPE){

      return {
        code: INVALIDREQUEST,
        message: 'The method is not a leaf object'
      };
    }
  }
}

/**
 * helpers
 */

export function isValue(prop){

  return _.isBoolean(prop) || _.isNumber(prop) || _.isString(prop) || _.isDate(prop) || _.isArray(prop);
}


export function error(req, error){

  return {jsonrpc: JSONRPCVERSION, id: req.id, error: serializeError(error)};
}

export function success(req, result){

  return {jsonrpc: JSONRPCVERSION, id: req.id, result};
}

export function callback(req, cb){

  return function(err, resp){

    if(err) return cb(error(req, err));

    return cb(success(req, resp));
  };
}